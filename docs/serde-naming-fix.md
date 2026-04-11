# Serde Field Naming Fix (snake_case / camelCase mismatch)

This document explains a serialization bug that caused many optional fields on
`Song`, `Album`, `AlbumDetail`, `Artist`, and `ArtistDetail` to silently arrive
as `undefined` on the TypeScript frontend, and how it was fixed.

---

## Background: two serialization hops

Data in this app crosses two JSON boundaries:

```
Subsonic API  ──(1)──▸  Rust structs  ──(2)──▸  TypeScript frontend
  (camelCase)              (snake_case              (snake_case
   "bitRate")               bit_rate)                bit_rate)
```

Hop (1) is **deserialization** — the Subsonic REST API returns camelCase JSON
(`bitRate`, `artistId`, `coverArt`, etc.) and serde maps it into Rust's
snake_case fields.

Hop (2) is **serialization** — Tauri IPC serializes the Rust struct back to JSON
and sends it to the frontend via `invoke`.

---

## The bug

The API-facing model structs (`Song`, `Album`, `AlbumDetail`, `Artist`,
`ArtistDetail`) all carried:

```rust
#[serde(rename_all = "camelCase")]
```

This attribute affects **both** serialization and deserialization. So while hop
(1) worked correctly (camelCase API JSON mapped to snake_case Rust fields), hop
(2) **re-camelCased** the field names before sending them to the frontend:

```
Rust field  bit_rate   ──serialize──▸  JSON key  "bitRate"
```

The TypeScript interfaces declared all fields in snake_case:

```typescript
export interface Song {
  bit_rate?: number;   // expects JSON key "bit_rate"
  artist_id?: string;
  cover_art?: string;
  // ...
}
```

The result: every multi-word field on Song/Album/etc. arrived as `undefined` on
the frontend. Single-word fields (`id`, `title`, `album`, `artist`, `year`,
`genre`, `suffix`, `duration`) were unaffected because their camelCase and
snake_case forms are identical.

### Why it wasn't obvious

- All affected fields are `Option<T>` / `T | undefined`, so no crashes occurred.
- Single-word fields covered the most visible data (titles, artist names, etc.).
- `user_rating` being silently undefined meant stars always showed 0 — but the
UI still rendered, just with empty stars.
- `bit_rate`, `cover_art`, `content_type`, `disc_number` being undefined caused
subtle missing-data issues (no bitrate display, missing cover art on some
paths, no format pill info).

### Why the Rated Tracks view worked

The cache layer uses a separate set of "Flat" structs (`FlatSong`, `FlatAlbum`,
`FlatArtist`) that are built manually from SQLite rows and **do not** have
`rename_all = "camelCase"`. They serialize with the default Rust field names
(snake_case), which matched the TypeScript interfaces. So the Rated Tracks view
(powered by `getCachedTracksByRating` → `FlatSong`) displayed `bit_rate` and
`user_rating` correctly, while Album Detail and Artist Detail (powered by
`getAlbum` → `Song`) did not.

---

## The fix

Replaced `#[serde(rename_all = "camelCase")]` with per-field
`#[serde(alias = "...")]` attributes on every multi-word field:

```rust
// Before
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Song {
    pub bit_rate: Option<i32>,
    pub artist_id: Option<String>,
    // ...
}

// After
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Song {
    #[serde(alias = "bitRate")]
    pub bit_rate: Option<i32>,
    #[serde(alias = "artistId")]
    pub artist_id: Option<String>,
    // ...
}
```

### How `alias` differs from `rename_all`


| Aspect              | `rename_all = "camelCase"` | `alias = "camelCaseName"`                            |
| ------------------- | -------------------------- | ---------------------------------------------------- |
| **Serialization**   | Outputs camelCase          | No effect — outputs the Rust field name (snake_case) |
| **Deserialization** | Accepts **only** camelCase | Accepts **both** the Rust field name and the alias   |


This gives us the best of both worlds:


| Direction                          | Key format              | Works?                   |
| ---------------------------------- | ----------------------- | ------------------------ |
| Subsonic API → Rust                | camelCase (`bitRate`)   | Accepted via alias       |
| Rust → Frontend (Tauri IPC)        | snake_case (`bit_rate`) | Matches TS interfaces    |
| Frontend → Rust (play_track, etc.) | snake_case (`bit_rate`) | Accepted as primary name |


---

## Affected structs

All in `src-tauri/src/subsonic/models.rs`:


| Struct         | Fields that gained aliases                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `Song`         | `album_id`, `artist_id`, `content_type`, `bit_rate`, `cover_art`, `user_rating`, `disc_number` |
| `Album`        | `artist_id`, `cover_art`, `song_count`                                                         |
| `AlbumDetail`  | `artist_id`, `cover_art`, `song_count`                                                         |
| `Artist`       | `album_count`, `cover_art`, `artist_image_url`                                                 |
| `ArtistDetail` | `album_count`, `cover_art`                                                                     |


### Structs intentionally left unchanged

- `**PlaybackState`** (`src-tauri/src/commands.rs`) — keeps `rename_all = "camelCase"` because its TypeScript interface already uses camelCase
(`isPlaying`, `currentTrack`, `elapsedSecs`, `durationSecs`).
- **API wrapper structs** (`SubsonicEnvelope`, `AlbumBody`, `AlbumListBody`,
`SearchBody`, etc.) — keep `rename_all = "camelCase"` because they are only
used for deserializing Subsonic API responses and are never sent to the
frontend.
- **Flat structs** (`FlatSong`, `FlatAlbum`, `FlatArtist`) — already had no
`rename_all` and were serializing correctly as snake_case.

---

## What this fixed across the app

With `Song` and related structs now serializing as snake_case, every view that
consumes API data (not just cache data) gets the full set of fields:

- `**bit_rate`** — kbps column now renders in Album Detail and Artist Detail
(previously only worked in Rated Tracks via the cache)
- `**artist_id**` — clickable artist links in Album Detail and Artist Detail
track rows now navigate correctly (previously fell through to plain text)
- `**cover_art**` — cover art resolves for API-sourced tracks in the player bar
- `**user_rating**` — star ratings from the API reflect actual server values
(previously always showed 0)
- `**content_type**` — FormatPill in the player bar can now determine the audio
format for API-sourced tracks
- `**disc_number**` — disc grouping metadata is now available
- **Frontend → Backend round-trip** — when the frontend sends `Song` objects
back to the backend (e.g., `play_track_in_context`), multi-word fields are
now correctly deserialized because the primary name is snake_case (matching
what the frontend sends)

