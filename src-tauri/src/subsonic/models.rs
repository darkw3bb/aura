use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubsonicResponse<T> {
    #[serde(rename = "subsonic-response")]
    pub subsonic_response: SubsonicEnvelope<T>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicEnvelope<T> {
    pub status: String,
    pub version: String,
    #[serde(flatten)]
    pub body: T,
    pub error: Option<SubsonicError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubsonicError {
    pub code: i32,
    pub message: String,
}

// -- Artists --

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtistsBody {
    pub artists: Option<ArtistsContainer>,
    #[serde(flatten)]
    _extra: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtistsContainer {
    pub index: Option<Vec<ArtistIndex>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtistIndex {
    pub name: String,
    pub artist: Option<Vec<Artist>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Artist {
    pub id: String,
    pub name: String,
    pub album_count: Option<i32>,
    pub cover_art: Option<String>,
    pub artist_image_url: Option<String>,
}

// -- Artist detail --

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtistBody {
    pub artist: Option<ArtistDetail>,
    #[serde(flatten)]
    _extra: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtistDetail {
    pub id: String,
    pub name: String,
    pub album_count: Option<i32>,
    pub cover_art: Option<String>,
    pub album: Option<Vec<Album>>,
}

// -- Albums --

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumListBody {
    pub album_list2: Option<AlbumListContainer>,
    #[serde(flatten)]
    _extra: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlbumListContainer {
    pub album: Option<Vec<Album>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Album {
    pub id: String,
    pub name: String,
    pub artist: Option<String>,
    pub artist_id: Option<String>,
    pub cover_art: Option<String>,
    pub song_count: Option<i32>,
    pub duration: Option<i64>,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub created: Option<String>,
}

// -- Album detail --

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumBody {
    pub album: Option<AlbumDetail>,
    #[serde(flatten)]
    _extra: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumDetail {
    pub id: String,
    pub name: String,
    pub artist: Option<String>,
    pub artist_id: Option<String>,
    pub cover_art: Option<String>,
    pub song_count: Option<i32>,
    pub duration: Option<i64>,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub song: Option<Vec<Song>>,
}

// -- Songs --

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Song {
    pub id: String,
    pub title: String,
    pub album: Option<String>,
    pub album_id: Option<String>,
    pub artist: Option<String>,
    pub artist_id: Option<String>,
    pub track: Option<i32>,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub size: Option<i64>,
    pub content_type: Option<String>,
    pub suffix: Option<String>,
    pub duration: Option<i64>,
    pub bit_rate: Option<i32>,
    pub path: Option<String>,
    pub cover_art: Option<String>,
    pub user_rating: Option<i32>,
    pub disc_number: Option<i32>,
}

// -- Search --

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchBody {
    pub search_result3: Option<SearchResult>,
    #[serde(flatten)]
    _extra: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub artist: Option<Vec<Artist>>,
    pub album: Option<Vec<Album>>,
    pub song: Option<Vec<Song>>,
}

// -- Ping --

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingBody {
    #[serde(flatten)]
    _extra: std::collections::HashMap<String, serde_json::Value>,
}

// -- Empty (for setRating, scrobble, etc.) --

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmptyBody {
    #[serde(flatten)]
    _extra: std::collections::HashMap<String, serde_json::Value>,
}

// Flattened types for the frontend

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlatArtist {
    pub id: String,
    pub name: String,
    pub album_count: Option<i32>,
    pub cover_art: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlatAlbum {
    pub id: String,
    pub name: String,
    pub artist: Option<String>,
    pub artist_id: Option<String>,
    pub cover_art: Option<String>,
    pub song_count: Option<i32>,
    pub duration: Option<i64>,
    pub year: Option<i32>,
    pub genre: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlatSong {
    pub id: String,
    pub title: String,
    pub album: Option<String>,
    pub album_id: Option<String>,
    pub artist: Option<String>,
    pub artist_id: Option<String>,
    pub track: Option<i32>,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub duration: Option<i64>,
    pub bit_rate: Option<i32>,
    pub cover_art: Option<String>,
    pub user_rating: Option<i32>,
    pub disc_number: Option<i32>,
}
