use parking_lot::{Condvar, Mutex};
use std::io::{self, Read, Seek, SeekFrom};
use std::sync::Arc;

struct StreamingState {
    buffer: Vec<u8>,
    read_pos: u64,
    finished: bool,
    cancelled: bool,
}

struct StreamingShared {
    state: Mutex<StreamingState>,
    data_available: Condvar,
}

/// A growing byte buffer fed by a background download task.
/// Implements `Read + Seek + Send + Sync` so it can be passed directly to
/// rodio's `Decoder` while the HTTP body is still arriving.
///
/// Forward reads block until data arrives. `SeekFrom::End` is only
/// supported after the download finishes so that format probing never
/// stalls waiting for the entire file.
pub struct StreamingBuffer {
    shared: Arc<StreamingShared>,
}

/// Write-side handle given to the background download task.
pub struct StreamingWriter {
    shared: Arc<StreamingShared>,
}

impl StreamingBuffer {
    pub fn new() -> (Self, StreamingWriter) {
        let shared = Arc::new(StreamingShared {
            state: Mutex::new(StreamingState {
                buffer: Vec::new(),
                read_pos: 0,
                finished: false,
                cancelled: false,
            }),
            data_available: Condvar::new(),
        });
        (
            StreamingBuffer {
                shared: shared.clone(),
            },
            StreamingWriter { shared },
        )
    }
}

impl Drop for StreamingBuffer {
    fn drop(&mut self) {
        let mut state = self.shared.state.lock();
        state.cancelled = true;
        self.shared.data_available.notify_all();
    }
}

impl StreamingWriter {
    /// Append a chunk from the HTTP response body. Returns `false` if
    /// the reader has been dropped (playback stopped), signalling the
    /// download task to abort.
    pub fn write_chunk(&self, data: &[u8]) -> bool {
        let mut state = self.shared.state.lock();
        if state.cancelled {
            return false;
        }
        state.buffer.extend_from_slice(data);
        self.shared.data_available.notify_all();
        true
    }

    /// Mark the stream as complete (all bytes received).
    pub fn finish(&self) {
        let mut state = self.shared.state.lock();
        state.finished = true;
        self.shared.data_available.notify_all();
    }
}

impl Read for StreamingBuffer {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let mut state = self.shared.state.lock();
        loop {
            let buffered = state.buffer.len() as u64;
            if state.read_pos < buffered {
                let start = state.read_pos as usize;
                let avail = (buffered - state.read_pos) as usize;
                let n = avail.min(buf.len());
                buf[..n].copy_from_slice(&state.buffer[start..start + n]);
                state.read_pos += n as u64;
                return Ok(n);
            }
            if state.finished {
                return Ok(0);
            }
            self.shared.data_available.wait(&mut state);
        }
    }
}

impl Seek for StreamingBuffer {
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        let mut state = self.shared.state.lock();
        let new_pos = match pos {
            SeekFrom::Start(n) => n,
            SeekFrom::Current(n) => (state.read_pos as i64 + n) as u64,
            SeekFrom::End(n) => {
                if state.finished {
                    (state.buffer.len() as i64 + n) as u64
                } else {
                    return Err(io::Error::new(
                        io::ErrorKind::Unsupported,
                        "SeekFrom::End unavailable while stream is still downloading",
                    ));
                }
            }
        };
        state.read_pos = new_pos;
        Ok(new_pos)
    }
}
