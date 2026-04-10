use std::collections::HashSet;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::time::{sleep, Duration};

use crate::AppState;

const INITIAL_DELAY: Duration = Duration::from_secs(10);
const INCREMENTAL_INTERVAL: Duration = Duration::from_secs(15 * 60);
const FULL_SYNC_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);
const THROTTLE_CALL: Duration = Duration::from_millis(100);
const THROTTLE_BATCH: Duration = Duration::from_millis(500);
const NEWEST_BATCH_SIZE: i32 = 50;

#[derive(Clone, serde::Serialize)]
pub struct SyncStatus {
    pub syncing: bool,
    pub progress: f32,
    pub message: String,
}

fn emit_progress(app: &AppHandle, progress: f32, message: &str) {
    let _ = app.emit(
        "sync-status",
        SyncStatus {
            syncing: true,
            progress,
            message: message.to_string(),
        },
    );
}

fn emit_done(app: &AppHandle) {
    let _ = app.emit(
        "sync-status",
        SyncStatus {
            syncing: false,
            progress: 1.0,
            message: String::new(),
        },
    );
}

/// Spawn the background sync loop. Safe to call multiple times — only one
/// loop will run at a time thanks to the `sync_running` flag.
pub fn start_background_sync(state: Arc<AppState>, app: AppHandle) {
    if state.sync_running.swap(true, Ordering::Relaxed) {
        return;
    }

    tokio::spawn(async move {
        sleep(INITIAL_DELAY).await;

        loop {
            if !state.sync_running.load(Ordering::Relaxed) {
                break;
            }

            let needs_full = should_run_full_sync(&state);

            if needs_full {
                log::info!("[sync] starting full background sync");
                emit_progress(&app, 0.0, "Starting full sync…");
                match full_throttled_sync(&state, &app).await {
                    Ok((artists, albums, tracks)) => {
                        log::info!(
                            "[sync] full sync complete: {} artists, {} albums, {} tracks",
                            artists, albums, tracks
                        );
                        mark_full_sync(&state);
                    }
                    Err(e) => log::warn!("[sync] full sync failed: {}", e),
                }
            } else {
                log::info!("[sync] starting incremental sync");
                emit_progress(&app, 0.0, "Checking for new music…");
                match incremental_sync(&state, &app).await {
                    Ok(new) => {
                        if new > 0 {
                            log::info!("[sync] incremental sync added {} new albums", new);
                        } else {
                            log::debug!("[sync] incremental sync: nothing new");
                        }
                    }
                    Err(e) => log::warn!("[sync] incremental sync failed: {}", e),
                }
            }

            emit_done(&app);

            match crate::commands::do_sync_playlists_to_cache(&*state).await {
                Ok(n) => log::debug!("[playlists] synced {} playlists", n),
                Err(e) => log::warn!("[playlists] sync failed: {}", e),
            }

            sleep(INCREMENTAL_INTERVAL).await;
        }

        state.sync_running.store(false, Ordering::Relaxed);
    });
}

pub fn stop_background_sync(state: &AppState) {
    state.sync_running.store(false, Ordering::Relaxed);
}

fn should_run_full_sync(state: &AppState) -> bool {
    let cache = state.cache.lock();
    let cache = match cache.as_ref() {
        Some(c) => c,
        None => return false,
    };

    if cache.track_count().unwrap_or(0) == 0 {
        return true;
    }

    let last = cache
        .get_sync_meta("last_full_sync")
        .ok()
        .flatten()
        .and_then(|v| v.parse::<i64>().ok());

    match last {
        None => true,
        Some(ts) => {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64;
            (now - ts) >= FULL_SYNC_INTERVAL.as_secs() as i64
        }
    }
}

fn mark_full_sync(state: &AppState) {
    let cache = state.cache.lock();
    if let Some(cache) = cache.as_ref() {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let _ = cache.set_sync_meta("last_full_sync", &now.to_string());
    }
}

fn is_cancelled(state: &AppState) -> bool {
    !state.sync_running.load(Ordering::Relaxed)
}

/// Fetch the newest albums from the server, upsert all of them (to catch
/// metadata changes), and fetch full details only for truly new albums.
async fn incremental_sync(state: &AppState, app: &AppHandle) -> Result<usize, String> {
    let client = state.client.lock().clone().ok_or("Not connected")?;

    let newest = client
        .get_album_list("newest", NEWEST_BATCH_SIZE, 0)
        .await?;

    let total = newest.len() as f32;
    let mut new_count = 0;
    let mut seen_artists: HashSet<String> = HashSet::new();

    for (i, album) in newest.iter().enumerate() {
        if is_cancelled(state) {
            return Ok(new_count);
        }

        let pct = (i as f32) / total.max(1.0);
        emit_progress(app, pct, &format!("Checking: {}", album.name));

        let exists = {
            let cache = state.cache.lock();
            let cache = cache.as_ref().ok_or("Cache not initialized")?;
            cache.album_exists(&album.id)?
        };

        // Always upsert album metadata from the list response (cheap, catches updates)
        {
            let cache = state.cache.lock();
            let cache = cache.as_ref().ok_or("Cache not initialized")?;
            cache.upsert_album(album)?;
        }

        if !exists {
            new_count += 1;

            sleep(THROTTLE_CALL).await;
            let album_detail = client.get_album(&album.id).await;
            if let Ok(ref detail) = album_detail {
                let cache = state.cache.lock();
                let cache = cache.as_ref().ok_or("Cache not initialized")?;
                if let Some(songs) = &detail.song {
                    for song in songs {
                        cache.upsert_track(song)?;
                    }
                }
            }

            if let Some(ref artist_id) = album.artist_id {
                if seen_artists.insert(artist_id.clone()) {
                    sleep(THROTTLE_CALL).await;
                    if let Ok(artist_detail) = client.get_artist(artist_id).await {
                        let cache = state.cache.lock();
                        let cache = cache.as_ref().ok_or("Cache not initialized")?;
                        let artist = crate::subsonic::models::Artist {
                            id: artist_detail.id,
                            name: artist_detail.name,
                            album_count: artist_detail.album_count,
                            cover_art: artist_detail.cover_art,
                            artist_image_url: None,
                        };
                        cache.upsert_artist(&artist)?;
                    }
                }
            }
        }
    }

    Ok(new_count)
}

/// Walk every artist -> album -> track with throttling between calls.
async fn full_throttled_sync(
    state: &AppState,
    app: &AppHandle,
) -> Result<(usize, usize, usize), String> {
    let client = state.client.lock().clone().ok_or("Not connected")?;

    emit_progress(app, 0.0, "Fetching artists…");
    let artists = client.get_artists().await?;

    {
        let cache = state.cache.lock();
        let cache = cache.as_ref().ok_or("Cache not initialized")?;
        for artist in &artists {
            cache.upsert_artist(artist)?;
        }
    }

    let artist_count = artists.len();
    let total_artists = artist_count as f32;
    let mut album_count = 0usize;
    let mut track_count = 0usize;
    let mut batch_counter = 0usize;

    for (artist_idx, artist) in artists.iter().enumerate() {
        if is_cancelled(state) {
            break;
        }

        let pct = (artist_idx as f32) / total_artists.max(1.0);
        emit_progress(app, pct, &format!("Syncing: {}", artist.name));

        sleep(THROTTLE_CALL).await;

        let detail = match client.get_artist(&artist.id).await {
            Ok(d) => d,
            Err(_) => continue,
        };

        let albums = match detail.album {
            Some(a) => a,
            None => continue,
        };

        for album in &albums {
            if is_cancelled(state) {
                break;
            }

            sleep(THROTTLE_CALL).await;

            album_count += 1;
            batch_counter += 1;

            let album_detail = client.get_album(&album.id).await;

            {
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

            if batch_counter % 10 == 0 {
                sleep(THROTTLE_BATCH).await;
            }
        }
    }

    Ok((artist_count, album_count, track_count))
}
