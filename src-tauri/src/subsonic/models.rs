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
pub struct Artist {
    pub id: String,
    pub name: String,
    #[serde(alias = "albumCount")]
    pub album_count: Option<i32>,
    #[serde(alias = "coverArt")]
    pub cover_art: Option<String>,
    #[serde(alias = "artistImageUrl")]
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
pub struct ArtistDetail {
    pub id: String,
    pub name: String,
    #[serde(alias = "albumCount")]
    pub album_count: Option<i32>,
    #[serde(alias = "coverArt")]
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
pub struct Album {
    pub id: String,
    pub name: String,
    pub artist: Option<String>,
    #[serde(alias = "artistId")]
    pub artist_id: Option<String>,
    #[serde(alias = "coverArt")]
    pub cover_art: Option<String>,
    #[serde(alias = "songCount")]
    pub song_count: Option<i32>,
    pub duration: Option<i64>,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub created: Option<String>,
    #[serde(alias = "userRating")]
    pub user_rating: Option<i32>,
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
pub struct AlbumDetail {
    pub id: String,
    pub name: String,
    pub artist: Option<String>,
    #[serde(alias = "artistId")]
    pub artist_id: Option<String>,
    #[serde(alias = "coverArt")]
    pub cover_art: Option<String>,
    #[serde(alias = "songCount")]
    pub song_count: Option<i32>,
    pub duration: Option<i64>,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub song: Option<Vec<Song>>,
    #[serde(alias = "userRating")]
    pub user_rating: Option<i32>,
}

// -- Songs --

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Song {
    pub id: String,
    pub title: String,
    pub album: Option<String>,
    #[serde(alias = "albumId")]
    pub album_id: Option<String>,
    pub artist: Option<String>,
    #[serde(alias = "artistId")]
    pub artist_id: Option<String>,
    pub track: Option<i32>,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub size: Option<i64>,
    #[serde(alias = "contentType")]
    pub content_type: Option<String>,
    pub suffix: Option<String>,
    pub duration: Option<i64>,
    #[serde(alias = "bitRate")]
    pub bit_rate: Option<i32>,
    pub path: Option<String>,
    #[serde(alias = "coverArt")]
    pub cover_art: Option<String>,
    #[serde(alias = "userRating")]
    pub user_rating: Option<i32>,
    #[serde(alias = "discNumber")]
    pub disc_number: Option<i32>,
    #[serde(alias = "playCount")]
    pub play_count: Option<i64>,
    pub created: Option<String>,
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

// -- Genres --

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Genre {
    #[serde(rename = "value")]
    pub value: String,
    #[serde(alias = "songCount", default)]
    pub song_count: i32,
    #[serde(alias = "albumCount", default)]
    pub album_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenresBody {
    pub genres: Option<GenresContainer>,
    #[serde(flatten)]
    _extra: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenresContainer {
    pub genre: Option<Vec<Genre>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SongsByGenreBody {
    pub songs_by_genre: Option<SongsByGenreContainer>,
    #[serde(flatten)]
    _extra: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SongsByGenreContainer {
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
    pub play_count: Option<i64>,
    pub created: Option<String>,
}

// -- Stats --

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackStat {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub cover_art: Option<String>,
    pub album_id: Option<String>,
    pub artist_id: Option<String>,
    pub plays: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtistStat {
    pub id: String,
    pub name: String,
    pub cover_art: Option<String>,
    pub plays: i64,
    pub track_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlbumStat {
    pub id: String,
    pub name: String,
    pub artist: Option<String>,
    pub cover_art: Option<String>,
    pub artist_id: Option<String>,
    pub plays: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenreStat {
    pub genre: String,
    pub plays: i64,
    pub track_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyPlay {
    pub date: String,
    pub count: i64,
    pub duration_secs: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatsData {
    pub total_tracks: i64,
    pub total_albums: i64,
    pub total_artists: i64,
    pub total_genres: i64,
    pub total_play_count: i64,
    pub total_play_duration_secs: i64,
    pub period_plays: i64,
    pub period_unique_tracks: i64,
    pub period_unique_artists: i64,
    pub period_unique_albums: i64,
    pub period_duration_secs: i64,
    pub prev_plays: i64,
    pub prev_unique_tracks: i64,
    pub prev_unique_artists: i64,
    pub prev_unique_albums: i64,
    pub prev_duration_secs: i64,
    pub top_tracks: Vec<TrackStat>,
    pub top_artists: Vec<ArtistStat>,
    pub top_albums: Vec<AlbumStat>,
    pub top_genres: Vec<GenreStat>,
    pub daily_plays: Vec<DailyPlay>,
}
