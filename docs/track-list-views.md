# Track List Views

Audio Engine uses several distinct track list views, each tailored to a specific
browsing context. Navigation between views is driven by `libraryStore.view`
(Zustand state) rather than URL routes. Search is the exception — it renders as a
modal overlay toggled by `searchOpen` state in `App.tsx`.

---

## View quick reference


| View              | Component                   | Opened via              | Columns / fields                       | Key behaviour                                    |
| ----------------- | --------------------------- | ----------------------- | -------------------------------------- | ------------------------------------------------ |
| **Rated**         | `TrackList/RatedTracks.tsx` | Sidebar "Rated"         | #, Title, Artist, Album, Rating, Time  | Virtualised infinite scroll; inline star editing |
| **Album Detail**  | `Library/AlbumDetail.tsx`   | Click any album         | #, Title, (feat. artist), Rating, Time | Album header with cover art; Play All button     |
| **Artist Detail** | `Library/ArtistDetail.tsx`  | Click any artist        | Per album: #, Title, Rating, Time      | Tracks grouped by album; Play All across albums  |
| **Search**        | `Search/SearchOverlay.tsx`  | Sidebar "Search" / `⌘K` | Cover art, Title, Artist · Album, Time | Overlay with debounced search; single-click play |


---

## Rated (Top Rated)

**File:** `src/components/TrackList/RatedTracks.tsx`

The Rated view lists every track the user has given a star rating, ordered by
rating (highest first). It is the only view that uses virtualised rendering and
paginated data loading.

### Layout

A sticky column-header row sits above a scrollable track list:


| Column     | Width   | Content                                                  |
| ---------- | ------- | -------------------------------------------------------- |
| **#**      | fixed   | Row index, or animated EQ bars when the track is playing |
| **Title**  | flex    | Track title — accent-coloured when currently playing     |
| **Artist** | 9 rem   | Clickable link that navigates to Artist Detail           |
| **Album**  | 9 rem   | Clickable link that navigates to Album Detail            |
| **Rating** | 6 rem   | Interactive `StarRating` — editable inline               |
| **Time**   | 3.5 rem | Duration formatted as `m:ss`                             |


### Behaviour

- **Virtualised list** — powered by `@tanstack/react-virtual` with an estimated
row height of 48 px and 20 rows of overscan.
- **Infinite scroll** — loads pages of 50 tracks via
`api.getCachedTracksByRating(offset, limit)`. When the user scrolls within 5
rows of the end, the next page is fetched automatically.
- **Double-click** a row to play that track in context (the full loaded list
becomes the playback queue).
- **Inline rating** — changing a star rating calls `setRating` and updates local
state immediately.
- **Navigation links** — the Artist and Album cells are buttons that call
`loadArtist` / `loadAlbum`, switching the view away from Rated.
- **Empty state** — when no rated tracks exist, a helper message is displayed.

---

## Album Detail

**File:** `src/components/Library/AlbumDetail.tsx`

Displayed when the user opens a specific album from the Album Grid, from a
Rated-view album link, or from search results.

### Header

The top of the view shows:

- Album cover art (192 × 192 px, rounded)
- Album title
- Artist name (clickable — navigates to Artist Detail)
- Metadata line: year · track count · genre
- **Play All** button (accent-coloured pill) — starts playback from track 1

### Track rows

There is no column-header row. Each row contains:


| Element             | Content                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **#**               | `song.track` number from metadata (falls back to list index); EQ bars when playing                                        |
| **Title**           | Track title — accent-coloured when currently playing                                                                      |
| **Featured artist** | Shown as a second line *only* when the track artist differs from the album artist; clickable to navigate to Artist Detail |
| **Rating**          | Interactive `StarRating`                                                                                                  |
| **Time**            | Duration formatted as `m:ss`                                                                                              |


### Behaviour

- **Double-click** a row to play that track in context (the album's track list
is the playback queue).
- **Back button** (`← Back to Albums`) returns to the Album Grid view.
- Track order matches the album metadata returned by the server.

---

## Artist Detail

**File:** `src/components/Library/ArtistDetail.tsx`

Shown when the user selects an artist from the sidebar Artist List, from a
Rated-view artist link, or from search results.

### Header

- Artist name (large heading)
- Metadata line: album count · total track count
- **Play All** button — queues every track by the artist (flattened across all
albums, in album order)

### Album sections

Tracks are **grouped by album**. Each section contains:

- Album cover art (80 × 80 px thumbnail, rounded)
- Album name and metadata (year · track count · genre)
- A track list for that album

### Track rows (per album section)


| Element    | Content                                                          |
| ---------- | ---------------------------------------------------------------- |
| **#**      | Track number from metadata (or list index); EQ bars when playing |
| **Title**  | Track title — accent-coloured when currently playing             |
| **Rating** | Interactive `StarRating`                                         |
| **Time**   | Duration formatted as `m:ss`                                     |


There is no Artist column — the artist is the page itself.

### Behaviour

- **Double-click** a row to play that track **within its album** (the queue is
scoped to the album section, not the full artist catalogue).
- **Play All** (header button) plays all tracks across every album.
- **Back button** (`← Back to Artists`) returns to the Artists view.

---

## Search Overlay

**Files:** `src/components/Search/SearchOverlay.tsx`,
`src/hooks/useSearch.ts`

Search is not a standalone view — it is a full-screen modal overlay that floats
above whichever view is currently active. It opens via the sidebar Search button
or the `⌘K` / `Ctrl+K` keyboard shortcut.

### Input

A text input with auto-focus, a search icon, and a Clear button. Pressing
`Escape` closes the overlay.

### Result sections

Results are grouped into three sections (each shown only when non-empty):

1. **Artists** — cover art thumbnail, name, album count. Click navigates to
  Artist Detail and closes the overlay.
2. **Albums** — cover art thumbnail, name, artist · year. Click navigates to
  Album Detail and closes the overlay.
3. **Tracks** — see below.

### Track rows


| Element       | Content                                 |
| ------------- | --------------------------------------- |
| **Cover art** | 32 × 32 px thumbnail                    |
| **Title**     | Track title                             |
| **Subtitle**  | `Artist · Album` on a single muted line |
| **Time**      | Duration formatted as `m:ss`            |


### Behaviour

- **Debounced search** — queries fire 150 ms after the user stops typing.
Prefers local search results (`api.searchLocal`); falls back to server-side
search (`api.search`).
- **Single click** on a track plays it immediately (`playTrack`, not
`playTrackInContext` — so there is no queue context) and closes the overlay.
- **No star ratings** are shown on search track rows.
- **No results** state displays `No results for "query"`.
- Clicking the backdrop closes the overlay.

---

## Shared patterns

These behaviours are consistent across all track list views:

- **Now-playing indicator** — every view replaces the `#` column with animated
EQ bars when a track matches `currentTrack`. The bars pause when playback is
paused (`data-paused` attribute).
- **Accent-coloured title** — the currently-playing track's title is rendered in
the theme's accent colour instead of the default text colour.
- **Row hover styling** — all rows use the shared `track-row` CSS class, which
provides a consistent hover background.
- **Duration formatting** — all views use the same `formatDuration` helper
(`m:ss`, or `--:--` when missing).
- `**StarRating` component** — used in Rated, Album Detail, and Artist Detail
(but not Search).
- **Playback context** — `playTrackInContext(songs, index)` sets the full passed
array as the playback queue. Search is the only view that uses `playTrack`
(single track, no queue).

