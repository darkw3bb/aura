use souvlaki::{MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, PlatformConfig};

pub struct MediaControlManager {
    controls: Option<MediaControls>,
}

// souvlaki's macOS types contain Obj-C pointers that are !Send.
// Access is serialized through a parking_lot::Mutex in AppState.
unsafe impl Send for MediaControlManager {}

impl MediaControlManager {
    pub fn new() -> Self {
        #[cfg(not(target_os = "windows"))]
        let config = PlatformConfig {
            dbus_name: "audio_engine",
            display_name: "Audio Engine",
            hwnd: None,
        };

        #[cfg(target_os = "windows")]
        let config = PlatformConfig {
            dbus_name: "audio_engine",
            display_name: "Audio Engine",
            hwnd: None,
        };

        let controls = MediaControls::new(config).ok();

        Self { controls }
    }

    pub fn set_metadata(
        &mut self,
        title: &str,
        artist: &str,
        album: &str,
        duration: Option<f64>,
        cover_url: Option<&str>,
    ) {
        if let Some(ref mut controls) = self.controls {
            let _ = controls.set_metadata(MediaMetadata {
                title: Some(title),
                artist: Some(artist),
                album: Some(album),
                duration: duration.map(|d| std::time::Duration::from_secs_f64(d)),
                cover_url,
            });
        }
    }

    pub fn set_playing(&mut self) {
        if let Some(ref mut controls) = self.controls {
            let _ = controls.set_playback(MediaPlayback::Playing { progress: None });
        }
    }

    pub fn set_paused(&mut self) {
        if let Some(ref mut controls) = self.controls {
            let _ = controls.set_playback(MediaPlayback::Paused { progress: None });
        }
    }

    pub fn set_stopped(&mut self) {
        if let Some(ref mut controls) = self.controls {
            let _ = controls.set_playback(MediaPlayback::Stopped);
        }
    }

    pub fn attach_handler<F>(&mut self, handler: F)
    where
        F: Fn(MediaControlEvent) + Send + 'static,
    {
        if let Some(ref mut controls) = self.controls {
            let _ = controls.attach(move |event| {
                handler(event);
            });
        }
    }
}
