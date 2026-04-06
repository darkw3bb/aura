use md5::{Digest, Md5};
use rand::Rng;
use reqwest::Client;
use std::collections::HashMap;

use super::models::*;

#[derive(Debug, Clone)]
pub struct SubsonicClient {
    base_url: String,
    username: String,
    password: String,
    http: Client,
}

impl SubsonicClient {
    pub fn new(base_url: &str, username: &str, password: &str) -> Self {
        let base = base_url.trim_end_matches('/').to_string();
        Self {
            base_url: base,
            username: username.to_string(),
            password: password.to_string(),
            http: Client::new(),
        }
    }

    fn auth_params(&self) -> HashMap<String, String> {
        let salt: String = rand::thread_rng()
            .sample_iter(&rand::distributions::Alphanumeric)
            .take(12)
            .map(char::from)
            .collect();

        let mut hasher = Md5::new();
        hasher.update(format!("{}{}", self.password, salt));
        let token = hex::encode(hasher.finalize());

        let mut params = HashMap::new();
        params.insert("u".to_string(), self.username.clone());
        params.insert("t".to_string(), token);
        params.insert("s".to_string(), salt);
        params.insert("v".to_string(), "1.16.1".to_string());
        params.insert("c".to_string(), "aura".to_string());
        params.insert("f".to_string(), "json".to_string());
        params
    }

    fn url(&self, endpoint: &str) -> String {
        format!("{}/rest/{}", self.base_url, endpoint)
    }

    async fn get<T: serde::de::DeserializeOwned>(
        &self,
        endpoint: &str,
        extra_params: &[(&str, &str)],
    ) -> Result<T, String> {
        let mut params = self.auth_params();
        for (k, v) in extra_params {
            params.insert(k.to_string(), v.to_string());
        }

        let resp = self
            .http
            .get(&self.url(endpoint))
            .query(&params)
            .send()
            .await
            .map_err(|e| format!("HTTP error: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("HTTP {}", resp.status()));
        }

        let text = resp
            .text()
            .await
            .map_err(|e| format!("Response read error: {}", e))?;

        log::debug!("Subsonic {} response: {}", endpoint, &text[..text.len().min(500)]);

        let envelope: SubsonicResponse<T> = serde_json::from_str(&text)
            .map_err(|e| format!("JSON parse error: {} (body: {})", e, &text[..text.len().min(200)]))?;

        if envelope.subsonic_response.status != "ok" {
            if let Some(err) = envelope.subsonic_response.error {
                return Err(format!("Subsonic error {}: {}", err.code, err.message));
            }
            return Err("Unknown subsonic error".to_string());
        }

        Ok(envelope.subsonic_response.body)
    }

    pub async fn ping(&self) -> Result<(), String> {
        let _: PingBody = self.get("ping", &[]).await?;
        Ok(())
    }

    pub async fn get_artists(&self) -> Result<Vec<Artist>, String> {
        let body: ArtistsBody = self.get("getArtists", &[]).await?;
        let artists = body
            .artists
            .and_then(|a| a.index)
            .map(|indexes| {
                indexes
                    .into_iter()
                    .flat_map(|idx| idx.artist.unwrap_or_default())
                    .collect()
            })
            .unwrap_or_default();
        Ok(artists)
    }

    pub async fn get_artist(&self, id: &str) -> Result<ArtistDetail, String> {
        let body: ArtistBody = self.get("getArtist", &[("id", id)]).await?;
        body.artist.ok_or_else(|| "Artist not found".to_string())
    }

    pub async fn get_album(&self, id: &str) -> Result<AlbumDetail, String> {
        let body: AlbumBody = self.get("getAlbum", &[("id", id)]).await?;
        body.album.ok_or_else(|| "Album not found".to_string())
    }

    pub async fn get_album_list(
        &self,
        list_type: &str,
        size: i32,
        offset: i32,
    ) -> Result<Vec<Album>, String> {
        let size_str = size.to_string();
        let offset_str = offset.to_string();
        let body: AlbumListBody = self
            .get(
                "getAlbumList2",
                &[
                    ("type", list_type),
                    ("size", &size_str),
                    ("offset", &offset_str),
                ],
            )
            .await?;
        Ok(body
            .album_list2
            .and_then(|a| a.album)
            .unwrap_or_default())
    }

    pub async fn search(&self, query: &str) -> Result<SearchResult, String> {
        let body: SearchBody = self.get("search3", &[("query", query)]).await?;
        Ok(body.search_result3.unwrap_or(SearchResult {
            artist: Some(vec![]),
            album: Some(vec![]),
            song: Some(vec![]),
        }))
    }

    pub fn stream_url(&self, id: &str) -> String {
        let params = self.auth_params();
        let query: Vec<String> = params.iter().map(|(k, v)| format!("{}={}", k, v)).collect();
        format!("{}/rest/stream?id={}&{}", self.base_url, id, query.join("&"))
    }

    pub fn cover_art_url(&self, id: &str, size: Option<i32>) -> String {
        let params = self.auth_params();
        let query: Vec<String> = params.iter().map(|(k, v)| format!("{}={}", k, v)).collect();
        let size_param = size
            .map(|s| format!("&size={}", s))
            .unwrap_or_default();
        format!(
            "{}/rest/getCoverArt?id={}&{}{}",
            self.base_url,
            id,
            query.join("&"),
            size_param
        )
    }

    pub async fn set_rating(&self, id: &str, rating: i32) -> Result<(), String> {
        let rating_str = rating.to_string();
        let _: EmptyBody = self
            .get("setRating", &[("id", id), ("rating", &rating_str)])
            .await?;
        Ok(())
    }

    pub async fn scrobble(&self, id: &str) -> Result<(), String> {
        let _: EmptyBody = self
            .get("scrobble", &[("id", id), ("submission", "true")])
            .await?;
        Ok(())
    }

    /// Begin streaming an audio track. Returns the HTTP `Response` as soon
    /// as headers arrive so the caller can consume the body incrementally.
    pub async fn start_stream(&self, id: &str) -> Result<reqwest::Response, String> {
        let mut query = self.auth_params();
        query.insert("id".to_string(), id.to_string());

        self.http
            .get(&format!("{}/rest/stream", self.base_url))
            .query(&query)
            .send()
            .await
            .map_err(|e| format!("Stream error: {}", e))
    }

    pub async fn download_stream(&self, id: &str) -> Result<bytes::Bytes, String> {
        let params = self.auth_params();
        let mut query = params;
        query.insert("id".to_string(), id.to_string());

        let resp = self
            .http
            .get(&format!("{}/rest/stream", self.base_url))
            .query(&query)
            .send()
            .await
            .map_err(|e| format!("Stream error: {}", e))?;

        resp.bytes()
            .await
            .map_err(|e| format!("Stream read error: {}", e))
    }

    pub async fn download_cover_art(
        &self,
        id: &str,
        size: Option<i32>,
    ) -> Result<(String, bytes::Bytes), String> {
        let mut params = self.auth_params();
        params.insert("id".to_string(), id.to_string());
        if let Some(s) = size {
            params.insert("size".to_string(), s.to_string());
        }

        let resp = self
            .http
            .get(&format!("{}/rest/getCoverArt", self.base_url))
            .query(&params)
            .send()
            .await
            .map_err(|e| format!("Cover art error: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Cover art HTTP {}", resp.status()));
        }

        let content_type = resp
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("image/jpeg")
            .to_string();

        if !content_type.starts_with("image/") {
            return Err(format!("Cover art returned non-image content-type: {}", content_type));
        }

        let bytes = resp
            .bytes()
            .await
            .map_err(|e| format!("Cover art read error: {}", e))?;

        Ok((content_type, bytes))
    }
}

pub async fn fetch_itunes_cover_art(
    artist: &str,
    album: &str,
    size: Option<i32>,
) -> Result<(String, bytes::Bytes), String> {
    let http = Client::new();
    let term = format!("{} {}", artist, album);
    let resp = http
        .get("https://itunes.apple.com/search")
        .query(&[
            ("term", term.as_str()),
            ("entity", "album"),
            ("limit", "1"),
        ])
        .send()
        .await
        .map_err(|e| format!("iTunes search error: {}", e))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("iTunes JSON error: {}", e))?;

    let artwork_url = body["results"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|r| r["artworkUrl100"].as_str())
        .ok_or_else(|| "No iTunes artwork found".to_string())?;

    let dim = size.unwrap_or(600);
    let hi_res_url = artwork_url.replace("100x100bb", &format!("{dim}x{dim}bb"));

    let img_resp = http
        .get(&hi_res_url)
        .send()
        .await
        .map_err(|e| format!("iTunes image download error: {}", e))?;

    let content_type = img_resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();

    let bytes = img_resp
        .bytes()
        .await
        .map_err(|e| format!("iTunes image read error: {}", e))?;

    Ok((content_type, bytes))
}
