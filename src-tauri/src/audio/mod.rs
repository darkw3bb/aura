pub mod queue;

use parking_lot::Mutex as PLMutex;
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink};
use std::io::Cursor;
use std::sync::Arc;
use std::time::{Duration, Instant};

use self::queue::PlayQueue;
use crate::subsonic::models::Song;

pub struct Player {
    _stream: Option<OutputStream>,
    stream_handle: Option<OutputStreamHandle>,
    sink: Option<Sink>,
    current_track: Option<Song>,
    volume: f32,
    queue: PlayQueue,
    playback_start: Option<Instant>,
    paused_elapsed: Duration,
    is_playing: bool,
    track_duration: Option<Duration>,
    // Shared reference for pre-buffered next track data
    next_track_buffer: Arc<PLMutex<Option<bytes::Bytes>>>,
}

unsafe impl Send for Player {}

impl Player {
    pub fn new() -> Self {
        let (stream, handle) = OutputStream::try_default().ok().unzip();
        Self {
            _stream: stream,
            stream_handle: handle,
            sink: None,
            current_track: None,
            volume: 0.8,
            queue: PlayQueue::new(),
            playback_start: None,
            paused_elapsed: Duration::ZERO,
            is_playing: false,
            track_duration: None,
            next_track_buffer: Arc::new(PLMutex::new(None)),
        }
    }

    pub fn play_bytes(&mut self, data: bytes::Bytes, track: Song) -> Result<(), String> {
        self.stop();

        let handle = self
            .stream_handle
            .as_ref()
            .ok_or("No audio output available")?;

        let sink = Sink::try_new(handle).map_err(|e| format!("Failed to create sink: {}", e))?;

        let cursor = Cursor::new(data);
        let source =
            Decoder::new(cursor).map_err(|e| format!("Failed to decode audio: {}", e))?;

        sink.set_volume(self.volume);
        sink.append(source);

        self.track_duration = track.duration.map(|d| Duration::from_secs(d as u64));
        self.current_track = Some(track);
        self.sink = Some(sink);
        self.playback_start = Some(Instant::now());
        self.paused_elapsed = Duration::ZERO;
        self.is_playing = true;

        Ok(())
    }

    pub fn pause(&mut self) {
        if let Some(sink) = &self.sink {
            sink.pause();
            if let Some(start) = self.playback_start {
                self.paused_elapsed += start.elapsed();
            }
            self.playback_start = None;
            self.is_playing = false;
        }
    }

    pub fn resume(&mut self) {
        if let Some(sink) = &self.sink {
            sink.play();
            self.playback_start = Some(Instant::now());
            self.is_playing = true;
        }
    }

    pub fn stop(&mut self) {
        if let Some(sink) = self.sink.take() {
            sink.stop();
        }
        self.current_track = None;
        self.playback_start = None;
        self.paused_elapsed = Duration::ZERO;
        self.is_playing = false;
        self.track_duration = None;
    }

    pub fn seek(&mut self, position: Duration) -> Result<(), String> {
        if let Some(sink) = &self.sink {
            sink.try_seek(position).map_err(|e| format!("Seek error: {}", e))?;
            self.paused_elapsed = position;
            self.playback_start = if self.is_playing {
                Some(Instant::now())
            } else {
                None
            };
        }
        Ok(())
    }

    pub fn set_volume(&mut self, volume: f32) {
        self.volume = volume.clamp(0.0, 1.0);
        if let Some(sink) = &self.sink {
            sink.set_volume(self.volume);
        }
    }

    pub fn is_playing(&self) -> bool {
        self.is_playing
    }

    pub fn is_finished(&self) -> bool {
        self.sink.as_ref().map(|s| s.empty()).unwrap_or(true)
    }

    pub fn elapsed(&self) -> Duration {
        let live = self
            .playback_start
            .map(|s| s.elapsed())
            .unwrap_or(Duration::ZERO);
        self.paused_elapsed + live
    }

    pub fn current_track(&self) -> Option<&Song> {
        self.current_track.as_ref()
    }

    pub fn queue(&self) -> &PlayQueue {
        &self.queue
    }

    pub fn queue_mut(&mut self) -> &mut PlayQueue {
        &mut self.queue
    }

    pub fn volume(&self) -> f32 {
        self.volume
    }

    pub fn track_duration(&self) -> Option<Duration> {
        self.track_duration
    }

    pub fn update_track_rating(&mut self, track_id: &str, rating: i32) {
        if let Some(track) = &mut self.current_track {
            if track.id == track_id {
                track.user_rating = Some(rating);
            }
        }
    }

    pub fn next_track_buffer(&self) -> Arc<PLMutex<Option<bytes::Bytes>>> {
        self.next_track_buffer.clone()
    }

    pub fn take_next_buffer(&self) -> Option<bytes::Bytes> {
        self.next_track_buffer.lock().take()
    }
}
