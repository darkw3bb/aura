use reqwest::Client;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};

use super::models::*;

static MSG_ID: AtomicU64 = AtomicU64::new(1);

fn next_msg_id() -> String {
    MSG_ID.fetch_add(1, Ordering::Relaxed).to_string()
}

#[derive(Debug, Clone)]
pub struct MusicAssistantClient {
    base_url: String,
    token: String,
    http: Client,
}

impl MusicAssistantClient {
    pub fn new(base_url: &str, token: &str) -> Self {
        let base = base_url.trim().trim_end_matches('/').to_string();
        let clean_token = token
            .trim()
            .strip_prefix("Bearer ")
            .or_else(|| token.trim().strip_prefix("bearer "))
            .unwrap_or(token.trim())
            .to_string();
        Self {
            base_url: base,
            token: clean_token,
            http: Client::new(),
        }
    }

    fn api_url(&self) -> String {
        format!("{}/api", self.base_url)
    }

    async fn rpc(&self, command: &str, args: Value) -> Result<Value, String> {
        let body = json!({
            "message_id": next_msg_id(),
            "command": command,
            "args": args,
        });

        log::debug!("MA RPC -> {}", command);

        let resp = self
            .http
            .post(&self.api_url())
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", self.token))
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                let msg = format!("Cannot reach Music Assistant at {}: {}", self.base_url, e);
                log::error!("MA RPC {} failed: {}", command, msg);
                msg
            })?;

        let status = resp.status();

        if status.as_u16() == 401 || status.as_u16() == 403 {
            log::error!("MA RPC {} auth failed: {}", command, status);
            return Err(
                "Authentication failed (401). Create a long-lived token in the \
                Music Assistant web UI under Settings → Users, then paste it here."
                    .to_string(),
            );
        }

        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            log::error!("MA RPC {} HTTP {}: {}", command, status, &text[..text.len().min(300)]);
            return Err(format!("Music Assistant HTTP {}: {}", status, text));
        }

        let result: Value = resp
            .json()
            .await
            .map_err(|e| {
                let msg = format!("Music Assistant JSON error: {}", e);
                log::error!("MA RPC {} {}", command, msg);
                msg
            })?;

        if let Some(error) = result.get("error") {
            log::error!("MA RPC {} returned error: {}", command, error);
            return Err(format!("Music Assistant error: {}", error));
        }

        let response = result.get("result").cloned().unwrap_or(result);
        log::debug!("MA RPC <- {} ok", command);
        Ok(response)
    }

    // -- Discovery / info --

    pub async fn ping(&self) -> Result<(), String> {
        self.rpc("info", json!({})).await?;
        Ok(())
    }

    pub async fn get_players(&self) -> Result<Vec<MaPlayer>, String> {
        let result = self.rpc("players/all", json!({})).await?;
        serde_json::from_value(result)
            .map_err(|e| format!("Failed to parse players: {}", e))
    }

    pub async fn get_player(&self, player_id: &str) -> Result<MaPlayerState, String> {
        let result = self
            .rpc("players/get", json!({ "player_id": player_id }))
            .await?;
        serde_json::from_value(result)
            .map_err(|e| format!("Failed to parse player state: {}", e))
    }

    // -- Queue transport (all playback goes through the queue layer) --

    pub async fn play_media(
        &self,
        queue_id: &str,
        media: &str,
        option: &str,
    ) -> Result<(), String> {
        self.rpc(
            "player_queues/play_media",
            json!({
                "queue_id": queue_id,
                "media": [media],
                "option": option,
            }),
        )
        .await?;
        Ok(())
    }

    pub async fn pause(&self, queue_id: &str) -> Result<(), String> {
        self.rpc("player_queues/pause", json!({ "queue_id": queue_id }))
            .await?;
        Ok(())
    }

    pub async fn resume(&self, queue_id: &str) -> Result<(), String> {
        self.rpc("player_queues/resume", json!({ "queue_id": queue_id }))
            .await?;
        Ok(())
    }

    pub async fn stop(&self, queue_id: &str) -> Result<(), String> {
        self.rpc("player_queues/stop", json!({ "queue_id": queue_id }))
            .await?;
        Ok(())
    }

    pub async fn next(&self, queue_id: &str) -> Result<(), String> {
        self.rpc("player_queues/next", json!({ "queue_id": queue_id }))
            .await?;
        Ok(())
    }

    pub async fn previous(&self, queue_id: &str) -> Result<(), String> {
        self.rpc("player_queues/previous", json!({ "queue_id": queue_id }))
            .await?;
        Ok(())
    }

    pub async fn seek(&self, queue_id: &str, position_secs: f64) -> Result<(), String> {
        self.rpc(
            "player_queues/seek",
            json!({
                "queue_id": queue_id,
                "position": position_secs as i64,
            }),
        )
        .await?;
        Ok(())
    }

    // -- Player-level commands (only for things the queue doesn't manage) --

    pub async fn set_volume(&self, player_id: &str, volume_level: f64) -> Result<(), String> {
        self.rpc(
            "players/cmd/volume_set",
            json!({
                "player_id": player_id,
                "volume_level": volume_level,
            }),
        )
        .await?;
        Ok(())
    }

    // -- Queue state polling --

    pub async fn get_queue_state(&self, queue_id: &str) -> Result<MaQueueState, String> {
        let result = self
            .rpc("player_queues/get", json!({ "queue_id": queue_id }))
            .await?;
        serde_json::from_value(result)
            .map_err(|e| format!("Failed to parse queue state: {}", e))
    }
}
