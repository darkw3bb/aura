mod audio;
mod cache;
mod commands;
mod media_controls;
mod subsonic;
mod sync;

use audio::streaming::StreamingBuffer;
use cache::CacheDb;
use futures_util::StreamExt;
use media_controls::MediaControlManager;
use parking_lot::Mutex;
use souvlaki::MediaControlEvent;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use subsonic::client::SubsonicClient;
use subsonic::models::Song;

/// Shared helper for media-key handlers: stream a track and start playback.
async fn stream_and_play_bg(
    state: &Arc<AppState>,
    client: &SubsonicClient,
    track: &Song,
) -> Result<(), String> {
    let resp = client.start_stream(&track.id).await?;
    let (buffer, writer) = StreamingBuffer::new();

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

pub struct AppState {
    pub client: Mutex<Option<SubsonicClient>>,
    pub cache: Mutex<Option<CacheDb>>,
    pub app_dir: Mutex<Option<std::path::PathBuf>>,
    pub player: Mutex<audio::Player>,
    pub media_controls: Mutex<MediaControlManager>,
    pub sync_running: AtomicBool,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    let state = Arc::new(AppState {
        client: Mutex::new(None),
        cache: Mutex::new(None),
        app_dir: Mutex::new(None),
        player: Mutex::new(audio::Player::new()),
        media_controls: Mutex::new(MediaControlManager::new()),
        sync_running: AtomicBool::new(false),
    });

    let state_for_setup = state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .setup(move |_app| {
            let state = state_for_setup;

            state.media_controls.lock().attach_handler({
                let state = state.clone();
                move |event| {
                    match event {
                        MediaControlEvent::Toggle => {
                            let is_playing = state.player.lock().is_playing();
                            if is_playing {
                                state.player.lock().pause();
                                state.media_controls.lock().set_paused();
                            } else {
                                state.player.lock().resume();
                                state.media_controls.lock().set_playing();
                            }
                        }
                        MediaControlEvent::Play => {
                            state.player.lock().resume();
                            state.media_controls.lock().set_playing();
                        }
                        MediaControlEvent::Pause => {
                            state.player.lock().pause();
                            state.media_controls.lock().set_paused();
                        }
                        MediaControlEvent::Next => {
                            let state = state.clone();
                            tauri::async_runtime::spawn(async move {
                                let next_track = {
                                    state.player.lock().queue_mut().next().cloned()
                                };
                                if let Some(track) = next_track {
                                    let client = state.client.lock().clone();
                                    if let Some(client) = client {
                                        let _ = stream_and_play_bg(&state, &client, &track).await;
                                    }
                                }
                            });
                        }
                        MediaControlEvent::Previous => {
                            let state = state.clone();
                            tauri::async_runtime::spawn(async move {
                                let prev_track = {
                                    state.player.lock().queue_mut().previous().cloned()
                                };
                                if let Some(track) = prev_track {
                                    let client = state.client.lock().clone();
                                    if let Some(client) = client {
                                        let _ = stream_and_play_bg(&state, &client, &track).await;
                                    }
                                }
                            });
                        }
                        MediaControlEvent::Stop => {
                            state.player.lock().stop();
                            state.media_controls.lock().set_stopped();
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::connect,
            commands::get_artists,
            commands::get_artist,
            commands::get_album,
            commands::get_album_list,
            commands::get_all_albums,
            commands::search,
            commands::get_genres,
            commands::get_songs_by_genre,
            commands::stream_track,
            commands::get_cover_art_url,
            commands::fetch_cover_art,
            commands::fetch_external_cover_art,
            commands::get_cover_art_cached,
            commands::set_rating,
            commands::scrobble,
            commands::play_track,
            commands::play_track_in_context,
            commands::pause,
            commands::resume,
            commands::stop,
            commands::seek,
            commands::set_volume,
            commands::get_playback_state,
            commands::play_next,
            commands::play_previous,
            commands::toggle_shuffle,
            commands::toggle_repeat,
            commands::add_to_queue,
            commands::clear_queue,
            commands::get_queue,
            commands::insert_next_in_queue,
            commands::move_in_queue,
            commands::remove_from_queue,
            commands::jump_to_in_queue,
            commands::get_all_tracks,
            commands::get_cached_tracks_by_rating,
            commands::sync_library,
            commands::search_local,
            commands::search_all,
            commands::record_play,
            commands::get_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
