use base64::Engine;
use crate::audio::streaming::StreamingBuffer;
use crate::cache::{CacheDb, read_cached_cover_art, write_cached_cover_art};
use crate::subsonic::client::SubsonicClient;
use crate::subsonic::models::*;
use crate::AppState;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSearchResult {
    pub artists: Vec<Artist>,
    pub albums: Vec<Album>,
    pub songs: Vec<FlatSong>,
}

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
    pub finished: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueInfo {
    pub tracks: Vec<Song>,
    pub current_index: Option<usize>,
}

// -- Connection --

#[tauri::command]
pub async fn connect(
    app: tauri::AppHandle,
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

    let covers_dir = cache_dir.join("covers");
    std::fs::create_dir_all(&covers_dir)
        .map_err(|e| format!("Failed to create covers dir: {}", e))?;

    crate::sync::stop_background_sync(&state);

    *state.client.lock() = Some(client);
    *state.cache.lock() = Some(cache);
    *state.app_dir.lock() = Some(cache_dir);

    crate::sync::start_background_sync(Arc::clone(&state), app.clone());

    let state_pl = Arc::clone(&state);
    tauri::async_runtime::spawn(async move {
        match do_sync_playlists_to_cache(state_pl.as_ref()).await {
            Ok(n) => log::info!("[playlists] synced {} playlists", n),
            Err(e) => log::warn!("[playlists] initial sync failed: {}", e),
        }
    });

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
    if let Some(ref cache) = *state.cache.lock() {
        if let Ok(Some(mut artist)) = cache.get_artist_detail(&id) {
            if let Some(ref mut albums) = artist.album {
                for album in albums.iter_mut() {
                    if album.cover_art.is_none() {
                        album.cover_art = Some(album.id.clone());
                    }
                }
            }
            return Ok(artist);
        }
    }

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
    if let Some(ref cache) = *state.cache.lock() {
        if let Ok(Some(mut album)) = cache.get_album_detail(&id) {
            if album.cover_art.is_none() {
                album.cover_art = Some(album.id.clone());
            }
            return Ok(album);
        }
    }

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
pub async fn get_all_albums(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<Vec<Album>, String> {
    let cache = state.cache.lock();
    let cache = cache.as_ref().ok_or("Cache not initialized")?;
    let albums = cache.get_all_albums()?;
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

// -- Genres --

#[tauri::command]
pub async fn get_genres(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<Vec<Genre>, String> {
    if let Some(ref cache) = *state.cache.lock() {
        if let Ok(genres) = cache.get_genres() {
            if !genres.is_empty() {
                return Ok(genres);
            }
        }
    }

    let client = state.client.lock().clone().ok_or("Not connected")?;
    client.get_genres().await
}

#[tauri::command]
pub async fn get_songs_by_genre(
    state: tauri::State<'_, Arc<AppState>>,
    genre: String,
    size: Option<i32>,
    offset: Option<i32>,
) -> Result<Vec<FlatSong>, String> {
    let sz = size.unwrap_or(50);
    let off = offset.unwrap_or(0);

    if let Some(ref cache) = *state.cache.lock() {
        if let Ok(tracks) = cache.get_tracks_by_genre(&genre, off, sz) {
            return Ok(tracks);
        }
    }

    let client = state.client.lock().clone().ok_or("Not connected")?;
    let songs = client.get_songs_by_genre(&genre, sz, off).await?;
    Ok(songs
        .into_iter()
        .map(|s| FlatSong {
            id: s.id,
            title: s.title,
            album: s.album,
            album_id: s.album_id,
            artist: s.artist,
            artist_id: s.artist_id,
            track: s.track,
            year: s.year,
            genre: s.genre,
            duration: s.duration,
            bit_rate: s.bit_rate,
            cover_art: s.cover_art,
            user_rating: s.user_rating,
            disc_number: s.disc_number,
            play_count: s.play_count,
            created: s.created,
        })
        .collect())
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
    state: tauri::State<'_, Arc<AppState>>,
    artist: String,
    album: String,
    size: Option<i32>,
) -> Result<String, String> {
    let sz = size.unwrap_or(600);
    let cache_key = format!("ext_{}_{}", artist, album);

    if let Some(ref app_dir) = *state.app_dir.lock() {
        if let Some(path) = read_cached_cover_art(app_dir, &cache_key, sz) {
            let bytes = std::fs::read(&path).map_err(|e| format!("Read cache error: {}", e))?;
            let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
            return Ok(format!("data:image/jpeg;base64,{}", b64));
        }
    }

    let (_, bytes) =
        crate::subsonic::client::fetch_itunes_cover_art(&artist, &album, size).await?;

    if let Some(ref app_dir) = *state.app_dir.lock() {
        let _ = write_cached_cover_art(app_dir, &cache_key, sz, &bytes);
    }

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/jpeg;base64,{}", b64))
}

#[tauri::command]
pub async fn get_cover_art_cached(
    state: tauri::State<'_, Arc<AppState>>,
    id: String,
    size: Option<i32>,
) -> Result<String, String> {
    let sz = size.unwrap_or(300);

    let app_dir = state.app_dir.lock().clone().ok_or("App dir not initialized")?;

    if let Some(path) = read_cached_cover_art(&app_dir, &id, sz) {
        let bytes = std::fs::read(&path).map_err(|e| format!("Read cache error: {}", e))?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        return Ok(format!("data:image/jpeg;base64,{}", b64));
    }

    let client = state.client.lock().clone().ok_or("Not connected")?;
    let (_, bytes) = client.download_cover_art(&id, Some(sz)).await?;

    let _ = write_cached_cover_art(&app_dir, &id, sz, &bytes);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/jpeg;base64,{}", b64))
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
        cache.update_album_rating(&id, rating)?;
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

// -- Play history / stats --

#[tauri::command]
pub async fn record_play(
    state: tauri::State<'_, Arc<AppState>>,
    track_id: String,
) -> Result<(), String> {
    let cache = state.cache.lock();
    let cache = cache.as_ref().ok_or("Cache not initialized")?;
    cache.record_play(&track_id)
}

#[tauri::command]
pub async fn get_stats(
    state: tauri::State<'_, Arc<AppState>>,
    period: String,
) -> Result<StatsData, String> {
    use chrono::{Datelike, Local, NaiveDate};

    let cache = state.cache.lock();
    let cache = cache.as_ref().ok_or("Cache not initialized")?;

    let now = Local::now().naive_local();
    let today = now.date();

    let (ps, pe, pvs, pve, all_time) = match period.as_str() {
        "week" => {
            let wd = today.weekday().num_days_from_monday() as i64;
            let ws = today - chrono::Duration::days(wd);
            let pws = ws - chrono::Duration::days(7);
            (
                ws.and_hms_opt(0, 0, 0).unwrap().format("%Y-%m-%d %H:%M:%S").to_string(),
                now.format("%Y-%m-%d %H:%M:%S").to_string(),
                pws.and_hms_opt(0, 0, 0).unwrap().format("%Y-%m-%d %H:%M:%S").to_string(),
                ws.and_hms_opt(0, 0, 0).unwrap().format("%Y-%m-%d %H:%M:%S").to_string(),
                false,
            )
        }
        "month" => {
            let ms = NaiveDate::from_ymd_opt(today.year(), today.month(), 1).unwrap();
            let pms = if today.month() == 1 {
                NaiveDate::from_ymd_opt(today.year() - 1, 12, 1).unwrap()
            } else {
                NaiveDate::from_ymd_opt(today.year(), today.month() - 1, 1).unwrap()
            };
            (
                ms.and_hms_opt(0, 0, 0).unwrap().format("%Y-%m-%d %H:%M:%S").to_string(),
                now.format("%Y-%m-%d %H:%M:%S").to_string(),
                pms.and_hms_opt(0, 0, 0).unwrap().format("%Y-%m-%d %H:%M:%S").to_string(),
                ms.and_hms_opt(0, 0, 0).unwrap().format("%Y-%m-%d %H:%M:%S").to_string(),
                false,
            )
        }
        _ => (String::new(), String::new(), String::new(), String::new(), true),
    };

    cache.get_stats(&ps, &pe, &pvs, &pve, all_time)
}

// -- Playback commands --

/// Start streaming a track: create a `StreamingBuffer`, spawn a background
/// download task, then hand the buffer to the player so decoding begins
/// as soon as the first bytes arrive.
async fn stream_and_play(
    state: &Arc<AppState>,
    client: &SubsonicClient,
    track: &Song,
) -> Result<(), String> {
    let resp = client.start_stream(&track.id).await?;
    let content_length = resp.content_length();
    let (buffer, writer) = StreamingBuffer::new(content_length);

    let mut byte_stream = resp.bytes_stream();
    tokio::spawn(async move {
        while let Some(chunk) = byte_stream.next().await {
            match chunk {
                Ok(data) => {
                    if !writer.write_chunk(&data) {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
        writer.finish();
    });

    let mut player = state.player.lock();
    player.play_stream(buffer, track.clone())?;
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
pub async fn play_track(
    state: tauri::State<'_, Arc<AppState>>,
    track: Song,
) -> Result<(), String> {
    let client = state.client.lock().clone().ok_or("Not connected")?;
    stream_and_play(&state, &client, &track).await
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

    stream_and_play(&state, &client, &track).await
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
        finished: player.is_finished() && player.current_track().is_some(),
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
        stream_and_play(&state, &client, track).await?;
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
        stream_and_play(&state, &client, track).await?;
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
pub async fn get_queue(state: tauri::State<'_, Arc<AppState>>) -> Result<QueueInfo, String> {
    let player = state.player.lock();
    Ok(QueueInfo {
        tracks: player.queue().tracks().to_vec(),
        current_index: player.queue().get_current_index(),
    })
}

#[tauri::command]
pub async fn insert_next_in_queue(
    state: tauri::State<'_, Arc<AppState>>,
    track: Song,
) -> Result<(), String> {
    state.player.lock().queue_mut().insert_after_current(track);
    Ok(())
}

#[tauri::command]
pub async fn move_in_queue(
    state: tauri::State<'_, Arc<AppState>>,
    from: usize,
    to: usize,
) -> Result<(), String> {
    state.player.lock().queue_mut().move_track(from, to);
    Ok(())
}

#[tauri::command]
pub async fn remove_from_queue(
    state: tauri::State<'_, Arc<AppState>>,
    index: usize,
) -> Result<(), String> {
    state.player.lock().queue_mut().remove_track(index);
    Ok(())
}

#[tauri::command]
pub async fn jump_to_in_queue(
    state: tauri::State<'_, Arc<AppState>>,
    index: usize,
) -> Result<Option<Song>, String> {
    let track = {
        let mut player = state.player.lock();
        player.queue_mut().jump_to(index).cloned()
    };

    if let Some(ref track) = track {
        let client = state.client.lock().clone().ok_or("Not connected")?;
        stream_and_play(&state, &client, track).await?;
    }

    Ok(track)
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
pub async fn search_all(
    state: tauri::State<'_, Arc<AppState>>,
    query: String,
) -> Result<LocalSearchResult, String> {
    let cache = state.cache.lock();
    let cache = cache.as_ref().ok_or("Cache not initialized")?;
    let artists = cache.search_artists(&query)?;
    let albums = cache.search_albums(&query)?;
    let songs = cache.search_tracks(&query)?;
    Ok(LocalSearchResult {
        artists,
        albums,
        songs,
    })
}

#[tauri::command]
pub async fn get_all_tracks(
    state: tauri::State<'_, Arc<AppState>>,
    offset: Option<i32>,
    limit: Option<i32>,
    sort_field: Option<String>,
    sort_dir: Option<String>,
) -> Result<Vec<FlatSong>, String> {
    let cache = state.cache.lock();
    let cache = cache.as_ref().ok_or("Cache not initialized")?;
    cache.get_all_tracks(
        offset.unwrap_or(0),
        limit.unwrap_or(50),
        sort_field.as_deref().unwrap_or("title"),
        sort_dir.as_deref().unwrap_or("asc"),
    )
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

// -- Playlists (tags) --

pub async fn do_sync_playlists_to_cache(state: &AppState) -> Result<u32, String> {
    let client = state.client.lock().clone().ok_or("Not connected")?;
    let summaries = client.get_playlists().await?;
    let keep_ids: Vec<String> = summaries.iter().map(|p| p.id.clone()).collect();

    for pl in &summaries {
        let detail = client.get_playlist(&pl.id).await?;
        let track_ids: Vec<String> = detail
            .entry
            .as_ref()
            .map(|entries| entries.iter().map(|s| s.id.clone()).collect())
            .unwrap_or_default();

        let cache = state.cache.lock();
        let cache = cache.as_ref().ok_or("Cache not initialized")?;
        cache.upsert_playlist_row(&pl.id, &pl.name)?;
        cache.set_playlist_tracks_bulk(&pl.id, &track_ids)?;
        if let Some(entries) = &detail.entry {
            for song in entries {
                cache.upsert_track(song)?;
            }
        }
    }

    {
        let cache = state.cache.lock();
        let cache = cache.as_ref().ok_or("Cache not initialized")?;
        cache.delete_playlists_not_in(&keep_ids)?;
    }

    Ok(summaries.len() as u32)
}

#[tauri::command]
pub async fn sync_playlists_to_cache(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<u32, String> {
    do_sync_playlists_to_cache(state.inner().as_ref()).await
}

#[tauri::command]
pub async fn list_cached_playlists(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<Vec<PlaylistSummary>, String> {
    let cache = state.cache.lock();
    let cache = cache.as_ref().ok_or("Cache not initialized")?;
    cache.get_cached_playlists()
}

#[tauri::command]
pub async fn get_cached_playlist_tracks(
    state: tauri::State<'_, Arc<AppState>>,
    playlist_id: String,
    offset: Option<i32>,
    limit: Option<i32>,
) -> Result<Vec<FlatSong>, String> {
    let cache = state.cache.lock();
    let cache = cache.as_ref().ok_or("Cache not initialized")?;
    cache.get_flat_songs_for_playlist(
        &playlist_id,
        offset.unwrap_or(0),
        limit.unwrap_or(50),
    )
}

#[tauri::command]
pub async fn get_cached_track_tags(
    state: tauri::State<'_, Arc<AppState>>,
    track_id: String,
) -> Result<Vec<String>, String> {
    let cache = state.cache.lock();
    let cache = cache.as_ref().ok_or("Cache not initialized")?;
    cache.get_tag_names_for_track(&track_id)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagInfo {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackTagsEntry {
    pub track_id: String,
    pub tags: Vec<TagInfo>,
}

#[tauri::command]
pub async fn get_cached_tags_for_tracks(
    state: tauri::State<'_, Arc<AppState>>,
    track_ids: Vec<String>,
) -> Result<Vec<TrackTagsEntry>, String> {
    if track_ids.is_empty() {
        return Ok(vec![]);
    }
    let cache = state.cache.lock();
    let cache = cache.as_ref().ok_or("Cache not initialized")?;
    let tag_lists = cache.get_tags_for_track_ids(&track_ids)?;
    let out: Vec<TrackTagsEntry> = track_ids
        .into_iter()
        .zip(tag_lists.into_iter())
        .map(|(track_id, pairs)| TrackTagsEntry {
            track_id,
            tags: pairs
                .into_iter()
                .map(|(name, color)| TagInfo { name, color })
                .collect(),
        })
        .collect();
    Ok(out)
}

#[tauri::command]
pub async fn apply_playlist_tag(
    state: tauri::State<'_, Arc<AppState>>,
    song: Song,
    tag_name: String,
) -> Result<String, String> {
    let name = tag_name.trim().to_string();
    if name.is_empty() {
        return Err("Tag name is empty".to_string());
    }

    let client = state.client.lock().clone().ok_or("Not connected")?;

    {
        let cache = state.cache.lock();
        let cache = cache.as_ref().ok_or("Cache not initialized")?;
        cache.upsert_track(&song)?;
    }

    let playlist_id = {
        let cache = state.cache.lock();
        let cache = cache.as_ref().ok_or("Cache not initialized")?;
        cache.find_playlist_id_by_name_ci(&name)?
    };

    let playlist_id = if let Some(pid) = playlist_id {
        pid
    } else {
        let created = client.create_playlist(&name).await?;
        let id = created.id.clone();
        let cache = state.cache.lock();
        let cache = cache.as_ref().ok_or("Cache not initialized")?;
        cache.upsert_playlist_row(&created.id, &created.name)?;
        id
    };

    {
        let cache = state.cache.lock();
        let cache = cache.as_ref().ok_or("Cache not initialized")?;
        if cache.playlist_has_track(&playlist_id, &song.id)? {
            return Ok(playlist_id);
        }
    }

    if let Err(e) = client
        .update_playlist_add_song(&playlist_id, &song.id)
        .await
    {
        let el = e.to_lowercase();
        if el.contains("already") || el.contains("duplicate") || el.contains("exist") {
            // treat as idempotent success
        } else {
            return Err(e);
        }
    }

    let cache = state.cache.lock();
    let cache = cache.as_ref().ok_or("Cache not initialized")?;
    let _ = cache.append_playlist_track_if_missing(&playlist_id, &song.id)?;
    Ok(playlist_id)
}

const VALID_PILL_COLORS: &[&str] = &[
    "default", "red", "orange", "yellow", "green", "blue", "purple", "pink", "teal",
];

#[tauri::command]
pub async fn set_playlist_color(
    state: tauri::State<'_, Arc<AppState>>,
    playlist_id: String,
    color: String,
) -> Result<(), String> {
    if !VALID_PILL_COLORS.contains(&color.as_str()) {
        return Err(format!("Invalid color '{}'. Valid: {:?}", color, VALID_PILL_COLORS));
    }
    let cache = state.cache.lock();
    let cache = cache.as_ref().ok_or("Cache not initialized")?;
    cache.set_playlist_color(&playlist_id, &color)
}

#[tauri::command]
pub async fn rename_playlist(
    state: tauri::State<'_, Arc<AppState>>,
    playlist_id: String,
    name: String,
) -> Result<(), String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("Name cannot be empty".to_string());
    }
    let client = state.client.lock().clone().ok_or("Not connected")?;
    client.rename_playlist(&playlist_id, &trimmed).await?;

    let cache = state.cache.lock();
    let cache = cache.as_ref().ok_or("Cache not initialized")?;
    cache.rename_playlist(&playlist_id, &trimmed)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_playlist(
    state: tauri::State<'_, Arc<AppState>>,
    playlist_id: String,
) -> Result<(), String> {
    let client = state.client.lock().clone().ok_or("Not connected")?;
    client.delete_playlist(&playlist_id).await?;

    let cache = state.cache.lock();
    let cache = cache.as_ref().ok_or("Cache not initialized")?;
    cache.delete_playlist(&playlist_id)?;
    Ok(())
}

#[tauri::command]
pub async fn remove_playlist_tag(
    state: tauri::State<'_, Arc<AppState>>,
    track_id: String,
    tag_name: String,
) -> Result<(), String> {
    let name = tag_name.trim().to_string();
    if name.is_empty() {
        return Err("Tag name is empty".to_string());
    }

    let (playlist_id, position) = {
        let cache = state.cache.lock();
        let cache = cache.as_ref().ok_or("Cache not initialized")?;
        let pid = cache
            .find_playlist_id_by_name_ci(&name)?
            .ok_or_else(|| format!("No playlist found for tag '{}'", name))?;
        let pos = cache
            .get_track_position_in_playlist(&pid, &track_id)?
            .ok_or_else(|| "Track not found in playlist".to_string())?;
        (pid, pos)
    };

    let client = state.client.lock().clone().ok_or("Not connected")?;
    client
        .update_playlist_remove_song(&playlist_id, position)
        .await?;

    let cache = state.cache.lock();
    let cache = cache.as_ref().ok_or("Cache not initialized")?;
    cache.remove_track_from_playlist(&playlist_id, &track_id)?;
    Ok(())
}
