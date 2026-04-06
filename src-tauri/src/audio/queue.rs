use crate::subsonic::models::Song;
use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RepeatMode {
    Off,
    All,
    One,
}

pub struct PlayQueue {
    tracks: Vec<Song>,
    current_index: Option<usize>,
    shuffle: bool,
    repeat: RepeatMode,
    shuffle_order: Vec<usize>,
}

impl PlayQueue {
    pub fn new() -> Self {
        Self {
            tracks: Vec::new(),
            current_index: None,
            shuffle: false,
            repeat: RepeatMode::Off,
            shuffle_order: Vec::new(),
        }
    }

    pub fn set_tracks(&mut self, tracks: Vec<Song>) {
        self.tracks = tracks;
        self.current_index = if self.tracks.is_empty() {
            None
        } else {
            Some(0)
        };
        self.rebuild_shuffle_order();
    }

    pub fn set_tracks_at(&mut self, tracks: Vec<Song>, index: usize) {
        self.tracks = tracks;
        self.current_index = if self.tracks.is_empty() {
            None
        } else {
            Some(index.min(self.tracks.len().saturating_sub(1)))
        };
        self.rebuild_shuffle_order();
    }

    pub fn add_track(&mut self, track: Song) {
        self.tracks.push(track);
        if self.current_index.is_none() {
            self.current_index = Some(0);
        }
        self.rebuild_shuffle_order();
    }

    pub fn clear(&mut self) {
        self.tracks.clear();
        self.current_index = None;
        self.shuffle_order.clear();
    }

    pub fn current(&self) -> Option<&Song> {
        let idx = self.effective_index()?;
        self.tracks.get(idx)
    }

    pub fn next(&mut self) -> Option<&Song> {
        if self.tracks.is_empty() {
            return None;
        }

        if self.repeat == RepeatMode::One {
            return self.current();
        }

        let pos = self.current_index.unwrap_or(0);
        let next_pos = pos + 1;

        if next_pos >= self.tracks.len() {
            if self.repeat == RepeatMode::All {
                self.current_index = Some(0);
            } else {
                return None;
            }
        } else {
            self.current_index = Some(next_pos);
        }

        self.current()
    }

    pub fn previous(&mut self) -> Option<&Song> {
        if self.tracks.is_empty() {
            return None;
        }

        let pos = self.current_index.unwrap_or(0);
        if pos == 0 {
            if self.repeat == RepeatMode::All {
                self.current_index = Some(self.tracks.len() - 1);
            }
        } else {
            self.current_index = Some(pos - 1);
        }

        self.current()
    }

    pub fn peek_next(&self) -> Option<&Song> {
        if self.tracks.is_empty() {
            return None;
        }
        if self.repeat == RepeatMode::One {
            return self.current();
        }
        let pos = self.current_index.unwrap_or(0);
        let next_pos = pos + 1;
        if next_pos >= self.tracks.len() {
            if self.repeat == RepeatMode::All {
                self.tracks.first()
            } else {
                None
            }
        } else {
            let idx = if self.shuffle {
                self.shuffle_order.get(next_pos).copied().unwrap_or(next_pos)
            } else {
                next_pos
            };
            self.tracks.get(idx)
        }
    }

    pub fn toggle_shuffle(&mut self) -> bool {
        self.shuffle = !self.shuffle;
        if self.shuffle {
            self.rebuild_shuffle_order();
        }
        self.shuffle
    }

    pub fn toggle_repeat(&mut self) -> RepeatMode {
        self.repeat = match self.repeat {
            RepeatMode::Off => RepeatMode::All,
            RepeatMode::All => RepeatMode::One,
            RepeatMode::One => RepeatMode::Off,
        };
        self.repeat.clone()
    }

    pub fn tracks(&self) -> &[Song] {
        &self.tracks
    }

    pub fn is_shuffle(&self) -> bool {
        self.shuffle
    }

    pub fn repeat_mode(&self) -> &RepeatMode {
        &self.repeat
    }

    fn effective_index(&self) -> Option<usize> {
        let pos = self.current_index?;
        if self.shuffle {
            self.shuffle_order.get(pos).copied()
        } else {
            Some(pos)
        }
    }

    fn rebuild_shuffle_order(&mut self) {
        let mut rng = rand::thread_rng();
        self.shuffle_order = (0..self.tracks.len()).collect();
        self.shuffle_order.shuffle(&mut rng);
    }
}
