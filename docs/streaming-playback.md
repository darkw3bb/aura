# Streaming Playback

Aura streams audio from the Subsonic server and begins decoding as soon as
the first bytes arrive, rather than downloading the entire file first.  This
keeps startup latency under a second even for large FLACs.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (React / Zustand)                             │
│                                                         │
│  playerStore.playTrack(track)                           │
│    1. Optimistic UI update (currentTrack, isPlaying)    │
│    2. _skipRefreshUntil = Infinity  (guard active)      │
│    3. await api.playTrack(track)   ── Tauri IPC ──┐     │
│    4. Clear guard on resolve                      │     │
│                                                   │     │
│  PlayerBar polls refreshState every 1 s           │     │
│    └─ skipped while guard is active               │     │
└───────────────────────────────────────────────────│─────┘
                                                    │
┌───────────────────────────────────────────────────▼─────┐
│  Backend (Rust / Tauri)                                 │
│                                                         │
│  play_track command                                     │
│    1. client.start_stream(id).await                     │
│       └─ HTTP GET /rest/stream → Response (headers only)│
│                                                         │
│    2. StreamingBuffer::new() → (buffer, writer)         │
│                                                         │
│    3. tokio::spawn background download task              │
│       └─ reads resp.bytes_stream() chunks               │
│       └─ writer.write_chunk(data) → appends to Vec      │
│       └─ writer.finish() on completion                  │
│                                                         │
│    4. player.play_stream(buffer, track)                 │
│       └─ Decoder::new(buffer) — blocks ~50-100 ms      │
│          while symphonia reads codec headers             │
│       └─ rodio audio thread pulls samples on demand     │
│                                                         │
│    5. Set OS media controls metadata                    │
└─────────────────────────────────────────────────────────┘
```

## Key components

### `StreamingBuffer` / `StreamingWriter`

**File:** `src-tauri/src/audio/streaming.rs`

A split reader/writer pair connected through `Arc<Mutex<Vec<u8>>>` +
`Condvar`.


| Type              | Role                                                                            |
| ----------------- | ------------------------------------------------------------------------------- |
| `StreamingBuffer` | Read side. Implements `Read + Seek + Send + Sync`. Passed to rodio's `Decoder`. |
| `StreamingWriter` | Write side. Owned by the background download task.                              |


`**Read::read`** returns data at the current `read_pos` if available.  When
the decoder catches up to the download, `read` blocks on the condvar until
more bytes arrive or the stream finishes (returns 0 / EOF).

`**Seek**` supports `SeekFrom::Start` and `SeekFrom::Current` at any time
(within already-buffered data the read is instant; beyond it the next `read`
blocks).  `SeekFrom::End` returns `Unsupported` while the download is still
in progress so that symphonia's format prober never stalls waiting for the
full file.  Once the download finishes, `SeekFrom::End` works normally.

**Cancellation:** dropping `StreamingBuffer` (e.g. when `Player::stop` is
called) sets a `cancelled` flag and wakes the condvar.  The writer's
`write_chunk` returns `false`, which causes the background task to exit and
drop the HTTP stream.

### `SubsonicClient::start_stream`

**File:** `src-tauri/src/subsonic/client.rs`

Returns the `reqwest::Response` as soon as HTTP headers arrive, instead of
buffering the entire body like `download_stream`.  The caller consumes the
body incrementally via `resp.bytes_stream()`.

### `Player::play_stream`

**File:** `src-tauri/src/audio/mod.rs`

Mirrors `play_bytes` but accepts a `StreamingBuffer`.  Calls
`Decoder::new(buffer)` which blocks briefly while symphonia reads the codec
header (typically the first few KB), then hands the decoded source to
rodio's audio thread.

### Frontend optimistic guard

**File:** `src/stores/playerStore.ts`

The frontend sets `currentTrack` optimistically before the Tauri IPC call
and protects it from being overwritten by stale polling data:

- `_skipRefreshUntil = Infinity` — blocks `refreshState` from overwriting
`currentTrack`, `isPlaying`, and `elapsedSecs`.
- `_playGuard = Date.now()` — each play captures a unique guard value.
Only the latest play's completion handler clears the skip window, so
rapid track changes never race.

`pause`, `resume`, and `stop` use a fixed 2-second skip window since those
commands complete near-instantly.

## Data flow timeline

```
 0 ms   User clicks track B (track A is playing)
         Frontend: currentTrack=B, guard=Infinity
         Rust: HTTP GET → server responds with headers

~5 ms   StreamingBuffer created, background download spawned
         First chunks start arriving

~50 ms  Decoder::new() finishes reading FLAC/MP3 headers
         Audio output begins — user hears track B

~1 s    refreshState polls, guard still active → keeps B

~3-8 s  Background download completes
         writer.finish() → SeekFrom::End now works
         Full seeking available

         Tauri command returns Ok(())
         Frontend: guard cleared, refreshState resumes normally
```

## Trade-offs


| What                          | Behaviour                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Seeking during early playback | Blocks until the target position has been downloaded. Seeking within the already-buffered portion is instant.                         |
| Slow network                  | If the decoder outruns the download, the audio thread blocks briefly, causing a short stutter rather than a crash.                    |
| Duration                      | The UI gets duration from the Subsonic track metadata (`track.duration`), not from the stream, so it is always available immediately. |
| Memory                        | The full file accumulates in the `Vec<u8>`, same as before. A ring buffer could reduce peak memory but is not needed today.           |


