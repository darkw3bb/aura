use base64::Engine;
use crate::cache::CacheDb;
use crate::subsonic::client::SubsonicClient;
use crate::subsonic::models::*;
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackState {
    pub is_playing: bool,
    pub current_track: Option<Song>,
    pub elapsed_secs: f64,
    pub duration_secs: Option<f64>,
    pub volume: f32,
    pub shuffle: bool,
    pub repeat: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueueInfo {
    pub tracks: Vec<Song>,
    pub current_index: Option<usize>,
}

// -- Connection --

#[tauri::command]
pub async fn connect(
    state: tauri::State<'_, Arc<AppState>>,
    url: String,
    username: String,
    password: String,
) -> Result<(), String> {
    let client = SubsonicClient::new(&url, &username, &password);
    client.ping().await?;

    let cache_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("aura");
    let cache = CacheDb::open(&cache_dir)?;

    *state.client.lock() = Some(client);
    *state.cache.lock() = Some(cache);

    Ok(())
}

// -- Library browsing --

#[tauri::command]
pub async fn get_artists(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<Vec<Artist>, String> {
    let client = state.client.lock().clone().ok_or("Not connected")?;
    client.get_artists().await
}

#[tauri::command]
pub async fn get_artist(
    state: tauri::State<'_, Arc<AppState>>,
    id: String,
) -> Result<ArtistDetail, String> {
    let client = state.client.lock().clone().ok_or("Not connected")?;
    let mut artist = client.get_artist(&id).await?;
    if let Some(ref mut albums) = artist.album {
        for album in albums.iter_mut() {
            if album.cover_art.is_none() {
                album.cover_art = Some(album.id.clone());
            }
        }
    }
    Ok(artist)
}

#[tauri::command]
pub async fn get_album(
    state: tauri::State<'_, Arc<AppState>>,
    id: String,
) -> Result<AlbumDetail, String> {
    let client = state.client.lock().clone().ok_or("Not connected")?;
    let mut album = client.get_album(&id).await?;
    if album.cover_art.is_none() {
        album.cover_art = Some(album.id.clone());
    }
    Ok(album)
}

#[tauri::command]
pub async fn get_album_list(
    state: tauri::State<'_, Arc<AppState>>,
    list_type: String,
    size: Option<i32>,
    offset: Option<i32>,
) -> Result<Vec<Album>, String> {
    let client = state.client.lock().clone().ok_or("Not connected")?;
    let albums = client
        .get_album_list(&list_type, size.unwrap_or(50), offset.unwrap_or(0))
        .await?;
    Ok(albums
        .into_iter()
        .map(|mut a| {
            if a.cover_art.is_none() {
                a.cover_art = Some(a.id.clone());
            }
            a
        })
        .collect())
}

#[tauri::command]
pub async fn search(
    state: tauri::State<'_, Arc<AppState>>,
    query: String,
) -> Result<SearchResult, String> {
    let client = state.client.lock().clone().ok_or("Not connected")?;
    client.search(&query).await
}

// -- Streaming --

#[tauri::command]
pub async fn stream_track(
    state: tauri::State<'_, Arc<AppState>>,
    id: String,
) -> Result<String, String> {
    let client = state.client.lock().clone().ok_or("Not connected")?;
    Ok(client.stream_url(&id))
}

#[tauri::command]
pub async fn get_cover_art_url(
    state: tauri::State<'_, Arc<AppState>>,
    id: String,
    size: Option<i32>,
) -> Result<String, String> {
    let client = state.client.lock().clone().ok_or("Not connected")?;
    Ok(client.cover_art_url(&id, size))
}

#[tauri::command]
pub async fn fetch_cover_art(
    state: tauri::State<'_, Arc<AppState>>,
    id: String,
    size: Option<i32>,
) -> Result<String, String> {
    let client = state.client.lock().clone().ok_or("Not connected")?;
    let (content_type, bytes) = client.download_cover_art(&id, size).await?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", content_type, b64))
}

#[tauri::command]
pub async fn fetch_external_cover_art(
    artist: String,
    album: String,
    size: Option<i32>,
) -> Result<String, String> {
    let (content_type, bytes) =
        crate::subsonic::client::fetch_itunes_cover_art(&artist, &album, size).await?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", content_type, b64))
}

// -- Rating --

#[tauri::command]
pub async fn set_rating(
    state: tauri::State<'_, Arc<AppState>>,
    id: String,
    rating: i32,
) -> Result<(), String> {
    let client = state.client.lock().clone().ok_or("Not connected")?;
    client.set_rating(&id, rating).await?;

    let cache = state.cache.lock();
    if let Some(ref cache) = *cache {
        cache.update_track_rating(&id, rating)?;
    }

    state.player.lock().update_track_rating(&id, rating);

    Ok(())
}

// -- Scrobble --

#[tauri::command]
pub async fn scrobble(
    state: tauri::State<'_, Arc<AppState>>,
    id: String,
) -> Result<(), String> {
    let client = state.client.lock().clone().ok_or("Not connected")?;
    client.scrobble(&id).await
}

// -- Playback commands --

#[tauri::command]
pub async fn play_track(
    state: tauri::State<'_, Arc<AppState>>,
    track: Song,
) -> Result<(), String> {
    let client = state.client.lock().clone().ok_or("Not connected")?;
    let data = client.download_stream(&track.id).await?;
    let mut player = state.player.lock();
    player.play_bytes(data, track.clone())?;
    drop(player);

    let cover_url = track
        .cover_art
        .as_deref()
        .map(|id| client.cover_art_url(id, Some(300)));
    let mut mc = state.media_controls.lock();
    mc.set_metadata(
        &track.title,
        track.artist.as_deref().unwrap_or("Unknown"),
        track.album.as_deref().unwrap_or(""),
        track.duration.map(|d| d as f64),
        cover_url.as_deref(),
    );
    mc.set_playing();
    Ok(())
}

#[tauri::command]
pub async fn play_track_in_context(
    state: tauri::State<'_, Arc<AppState>>,
    tracks: Vec<Song>,
    index: usize,
) -> Result<(), String> {
    let track = tracks
        .get(index)
        .ok_or("Index out of bounds")?
        .clone();

    let client = state.client.lock().clone().ok_or("Not connected")?;

    {
        let mut player = state.player.lock();
        player.queue_mut().set_tracks_at(tracks, index);
    }

    let data = client.download_stream(&track.id).await?;
    let mut player = state.player.lock();
    player.play_bytes(data, track.clone())?;
    drop(player);

    let cover_url = track
        .cover_art
        .as_deref()
        .map(|id| client.cover_art_url(id, Some(300)));
    let mut mc = state.media_controls.lock();
    mc.set_metadata(
        &track.title,
        track.artist.as_deref().unwrap_or("Unknown"),
        track.album.as_deref().unwrap_or(""),
        track.duration.map(|d| d as f64),
        cover_url.as_deref(),
    );
    mc.set_playing();
    Ok(())
}

#[tauri::command]
pub async fn pause(state: tauri::State<'_, Arc<AppState>>) -> Result<(), String> {
    state.player.lock().pause();
    state.media_controls.lock().set_paused();
    Ok(())
}

#[tauri::command]
pub async fn resume(state: tauri::State<'_, Arc<AppState>>) -> Result<(), String> {
    state.player.lock().resume();
    state.media_controls.lock().set_playing();
    Ok(())
}

#[tauri::command]
pub async fn stop(state: tauri::State<'_, Arc<AppState>>) -> Result<(), String> {
    state.player.lock().stop();
    state.media_controls.lock().set_stopped();
    Ok(())
}

#[tauri::command]
pub async fn seek(
    state: tauri::State<'_, Arc<AppState>>,
    position_secs: f64,
) -> Result<(), String> {
    let mut player = state.player.lock();
    player.seek(std::time::Duration::from_secs_f64(position_secs))
}

#[tauri::command]
pub async fn set_volume(
    state: tauri::State<'_, Arc<AppState>>,
    volume: f32,
) -> Result<(), String> {
    state.player.lock().set_volume(volume);
    Ok(())
}

#[tauri::command]
pub async fn get_playback_state(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<PlaybackState, String> {
    let player = state.player.lock();
    let repeat = match player.queue().repeat_mode() {
        crate::audio::queue::RepeatMode::Off => "off",
        crate::audio::queue::RepeatMode::All => "all",
        crate::audio::queue::RepeatMode::One => "one",
    };
    Ok(PlaybackState {
        is_playing: player.is_playing(),
        current_track: player.current_track().cloned(),
        elapsed_secs: player.elapsed().as_secs_f64(),
        duration_secs: player.track_duration().map(|d| d.as_secs_f64()),
        volume: player.volume(),
        shuffle: player.queue().is_shuffle(),
        repeat: repeat.to_string(),
    })
}

#[tauri::command]
pub async fn play_next(state: tauri::State<'_, Arc<AppState>>) -> Result<Option<Song>, String> {
    let next_track = {
        let mut player = state.player.lock();
        player.queue_mut().next().cloned()
    };

    if let Some(ref track) = next_track {
        let client = state.client.lock().clone().ok_or("Not connected")?;
        let data = client.download_stream(&track.id).await?;
        let mut player = state.player.lock();
        player.play_bytes(data, track.clone())?;
        drop(player);

        let cover_url = track
            .cover_art
            .as_deref()
            .map(|id| client.cover_art_url(id, Some(300)));
        let mut mc = state.media_controls.lock();
        mc.set_metadata(
            &track.title,
            track.artist.as_deref().unwrap_or("Unknown"),
            track.album.as_deref().unwrap_or(""),
            track.duration.map(|d| d as f64),
            cover_url.as_deref(),
        );
        mc.set_playing();
    }

    Ok(next_track)
}

#[tauri::command]
pub async fn play_previous(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<Option<Song>, String> {
    let prev_track = {
        let mut player = state.player.lock();
        player.queue_mut().previous().cloned()
    };

    if let Some(ref track) = prev_track {
        let client = state.client.lock().clone().ok_or("Not connected")?;
        let data = client.download_stream(&track.id).await?;
        let mut player = state.player.lock();
        player.play_bytes(data, track.clone())?;
        drop(player);

        let cover_url = track
            .cover_art
            .as_deref()
            .map(|id| client.cover_art_url(id, Some(300)));
        let mut mc = state.media_controls.lock();
        mc.set_metadata(
            &track.title,
            track.artist.as_deref().unwrap_or("Unknown"),
            track.album.as_deref().unwrap_or(""),
            track.duration.map(|d| d as f64),
            cover_url.as_deref(),
        );
        mc.set_playing();
    }

    Ok(prev_track)
}

#[tauri::command]
pub async fn toggle_shuffle(state: tauri::State<'_, Arc<AppState>>) -> Result<bool, String> {
    let mut player = state.player.lock();
    Ok(player.queue_mut().toggle_shuffle())
}

#[tauri::command]
pub async fn toggle_repeat(state: tauri::State<'_, Arc<AppState>>) -> Result<String, String> {
    let mut player = state.player.lock();
    let mode = player.queue_mut().toggle_repeat();
    Ok(match mode {
        crate::audio::queue::RepeatMode::Off => "off".to_string(),
        crate::audio::queue::RepeatMode::All => "all".to_string(),
        crate::audio::queue::RepeatMode::One => "one".to_string(),
    })
}

#[tauri::command]
pub async fn add_to_queue(
    state: tauri::State<'_, Arc<AppState>>,
    track: Song,
) -> Result<(), String> {
    state.player.lock().queue_mut().add_track(track);
    Ok(())
}

#[tauri::command]
pub async fn clear_queue(state: tauri::State<'_, Arc<AppState>>) -> Result<(), String> {
    state.player.lock().queue_mut().clear();
    Ok(())
}

#[tauri::command]
pub async fn get_queue(state: tauri::State<'_, Arc<AppState>>) -> Result<Vec<Song>, String> {
    let player = state.player.lock();
    Ok(player.queue().tracks().to_vec())
}

// -- Cache / local search --

#[tauri::command]
pub async fn sync_library(state: tauri::State<'_, Arc<AppState>>) -> Result<String, String> {
    let client = state.client.lock().clone().ok_or("Not connected")?;

    let artists = client.get_artists().await?;

    // Cache artists (drop lock before awaiting)
    {
        let cache = state.cache.lock();
        let cache = cache.as_ref().ok_or("Cache not initialized")?;
        for artist in &artists {
            cache.upsert_artist(artist)?;
        }
    }

    let mut album_count = 0;
    let mut track_count = 0;

    for artist in &artists {
        if let Ok(detail) = client.get_artist(&artist.id).await {
            if let Some(albums) = &detail.album {
                for album in albums {
                    album_count += 1;
                    let album_detail = client.get_album(&album.id).await;

                    // Lock cache briefly to write, then drop before next await
                    let cache = state.cache.lock();
                    let cache = cache.as_ref().ok_or("Cache not initialized")?;
                    cache.upsert_album(album)?;

                    if let Ok(ref ad) = album_detail {
                        if let Some(songs) = &ad.song {
                            for song in songs {
                                cache.upsert_track(song)?;
                                track_count += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(format!(
        "Synced {} artists, {} albums, {} tracks",
        artists.len(),
        album_count,
        track_count
    ))
}

#[tauri::command]
pub async fn search_local(
    state: tauri::State<'_, Arc<AppState>>,
    query: String,
) -> Result<Vec<FlatSong>, String> {
    let cache = state.cache.lock();
    let cache = cache.as_ref().ok_or("Cache not initialized")?;
    cache.search_tracks(&query)
}

#[tauri::command]
pub async fn get_cached_tracks_by_rating(
    state: tauri::State<'_, Arc<AppState>>,
    offset: Option<i32>,
    limit: Option<i32>,
) -> Result<Vec<FlatSong>, String> {
    let cache = state.cache.lock();
    let cache = cache.as_ref().ok_or("Cache not initialized")?;
    cache.get_tracks_by_rating(offset.unwrap_or(0), limit.unwrap_or(50))
}
