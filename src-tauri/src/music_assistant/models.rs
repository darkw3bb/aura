use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaPlayer {
    pub player_id: String,
    pub name: String,
    #[serde(default)]
    pub powered: bool,
    #[serde(default)]
    pub available: bool,
    #[serde(rename = "type", default)]
    pub player_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaPlayerInfo {
    pub id: String,
    pub name: String,
    pub powered: bool,
    pub available: bool,
    pub player_type: String,
}

impl From<MaPlayer> for MaPlayerInfo {
    fn from(p: MaPlayer) -> Self {
        Self {
            id: p.player_id,
            name: p.name,
            powered: p.powered,
            available: p.available,
            player_type: p.player_type,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaQueueState {
    #[serde(default)]
    pub queue_id: String,
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub elapsed_time: f64,
    #[serde(default)]
    pub current_index: Option<usize>,
    #[serde(default)]
    pub current_item: Option<MaQueueItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaQueueItem {
    #[serde(default)]
    pub duration: Option<f64>,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaPlayerState {
    pub player_id: String,
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub volume_level: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OutputMode {
    Local,
    MusicAssistant { player_id: String },
}

impl Default for OutputMode {
    fn default() -> Self {
        Self::Local
    }
}
