<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="128" height="128" alt="Aura icon" />
</p>

<h1 align="center">Aura</h1>

<p align="center">
  A desktop music player built for the way music was meant to be heard&mdash;album by album, year by year.<br>
  Connects to <a href="https://navidrome.org/">Navidrome</a> and Subsonic-compatible servers. Lightweight. Native. Cross-platform.
</p>

<p align="center">
  <a href="https://github.com/darkw3bb/aura/releases/latest"><strong>Download Latest Release</strong></a>
</p>

<p align="center">
  <a href="https://github.com/darkw3bb/aura/releases/latest">
    <img src="https://img.shields.io/github/v/release/darkw3bb/aura?style=flat-square&label=latest&color=7c3aed" alt="Latest release" />
  </a>
  <a href="https://github.com/darkw3bb/aura/releases">
    <img src="https://img.shields.io/github/downloads/darkw3bb/aura/total?style=flat-square&color=7c3aed" alt="Total downloads" />
  </a>
  <a href="https://github.com/darkw3bb/aura/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/darkw3bb/aura/ci.yml?style=flat-square&label=CI" alt="CI status" />
  </a>
</p>

---

## Why Aura

Most music players treat songs as interchangeable items in a playlist. Aura doesn't.

Aura is built for people who love music — who want to put on an album and hear it the way the artist intended, front to back. The entire interface is designed around **albums and artists**, not individual tracks. There's no standalone track shuffle mode because that's not the point. The point is discovery and immersion.

**Browse your library through time.** The Years view lets you scroll through your collection decade by decade, year by year — a timeline of your musical taste. The Albums landing page shows what you've been listening to recently, keeping you connected to the music you're into right now. Artist pages group everything by album, because that's how music is made.

**Designed to feel instant.** Your entire library — every album, artist, track, and piece of cover art — is cached locally on your machine. Search results come back in microseconds via a full-text index. Scrolling through thousands of albums is smooth because the UI never waits on your server. Pages open near-instantly. The app feels like browsing local files, even though your music lives on a remote server.

Your music. Your server. A proper desktop app with a point of view about how music should be experienced.

---

## Features

### Listening experience

- **Album-first navigation** — Albums, Artists, and Years are the primary ways to explore your library
- **Years view** — browse your entire collection grouped by release year, newest first
- **Recently Played** — the Albums landing page keeps you close to what you've been listening to
- **Artist pages** — album-grouped tracks with per-album ratings and Play All
- **3D tilt hover** — Apple TV-style pointer-tracking tilt, shine, and parallax on album cards
- **Star ratings** — rate tracks and albums 1–5 stars, synced back to your server
- **Genre browsing** — explore your library by genre
- **Queue management** — drag-and-drop reordering, play next, add to queue, previously-played history

### Speed and efficiency

- **Aggressive local caching** — metadata in SQLite, cover art on disk, search via FTS5 full-text index — the UI almost never makes a network call
- **Background library sync** — incremental sync every hour, full sync every 6 hours, with a progress indicator in the player bar — your cache stays fresh without you lifting a finger
- **Native Rust audio engine** — pure Rust playback via rodio + symphonia: FLAC, MP3, AAC, ALAC, OGG Vorbis, Opus, WAV, AIFF, WavPack
- **Persistent cover art cache** — album art is downloaded once and served from disk forever, with iTunes fallback for missing artwork
- **~5 MB binary** — minimal memory footprint, no Electron, no browser overhead

### Desktop-native

- **OS media controls** — macOS Now Playing / Control Center, Windows SMTC, Linux MPRIS
- **Keyboard-driven** — Cmd/Ctrl+K search, vim-style J/K navigation, Enter to activate, and more
- **Auto-updates** — built-in updater checks for new versions and installs with one click
- **Cross-platform** — macOS, Windows, and Linux from a single codebase

### Personalization

- **7 built-in themes** — Midnight, Nord, Catppuccin, Aura Light, Winamp, Matrix, iTunes Classic
- **Track list album art** — optional cover art thumbnails in track rows, togglable in Settings

---

## Downloads

Head to the **[Releases](https://github.com/darkw3bb/aura/releases)** page and grab the latest build for your platform:

| Platform | Architecture | What to download |
|----------|-------------|-----------------|
| macOS | Apple Silicon (M1/M2/M3/M4) | `Aura_x.x.x_aarch64.dmg` |
| macOS | Intel | `Aura_x.x.x_x64.dmg` |
| Windows | x64 | `Aura_x.x.x_x64-setup.exe` (NSIS installer) |
| Linux | x64 | `Aura_x.x.x_amd64.AppImage` or `.deb` |

> **macOS users:** Aura isn't code-signed yet, so macOS will show an "app is damaged" warning. Click Cancel, then run this in Terminal to clear the quarantine flag:
> ```bash
> xattr -cr /Applications/Aura.app
> ```
> The app will open normally after that. This is a standard macOS restriction on unsigned apps — the app is not actually damaged.

> **Where are the builds?** Every tagged release triggers a GitHub Actions build across macOS, Windows, and Linux. The compiled installers are uploaded as assets to the [Releases](https://github.com/darkw3bb/aura/releases) page — not under "Packages." Look for the **Assets** dropdown at the bottom of each release.

> **Auto-updates:** Once installed, Aura checks for new versions automatically. You'll see a banner at the top of the app when an update is available — one click to download, install, and restart.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `J` / `K` | Move focus down / up in lists and grids |
| `Enter` | Activate focused item (open album, play track) |
| `Cmd/Ctrl + K` | Open search |
| `Cmd/Ctrl + [` | Navigate back |
| `Cmd/Ctrl + ]` | Navigate forward |
| `Space` | Play / Pause |
| `Escape` | Close search / overlay |
| Media keys | Play, Pause, Next, Previous (via OS) |

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | [Tauri 2](https://v2.tauri.app/) |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS 4 |
| State | Zustand |
| Virtual scroll | TanStack Virtual |
| Audio | rodio + symphonia (Rust) |
| Media keys | souvlaki (Rust) |
| HTTP | reqwest (Rust) |
| Cache | SQLite + FTS5 via rusqlite |
| Async | Tokio |
| Updates | tauri-plugin-updater |

---

## Getting Started (Development)

### Prerequisites

- [Rust](https://rustup.rs/) (1.77+)
- [Node.js](https://nodejs.org/) (18+)
- A running [Navidrome](https://navidrome.org/) server (or any Subsonic API-compatible server)

#### Platform-specific

**macOS:** Xcode Command Line Tools

```bash
xcode-select --install
```

**Linux (Debian/Ubuntu):**

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
  libasound2-dev
```

**Windows:** [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### Run locally

```bash
git clone https://github.com/darkw3bb/aura.git
cd aura
npm install
npx tauri dev
```

On first launch, enter your Navidrome server URL, username, and password in Settings. Click **Sync Library to Local Cache** to populate the local search index.

### Build for production

```bash
npx tauri build
```

---

## Architecture

```
src-tauri/           Rust backend
  src/
    audio/           Audio playback engine (rodio + symphonia)
      streaming.rs   HTTP streaming with chunked buffer
      queue.rs       Queue, shuffle, repeat logic
    cache/           SQLite metadata cache + FTS5 search + cover art disk cache
    subsonic/        Subsonic/OpenSubsonic API client
      client.rs      REST client, auth, streaming URLs
      models.rs      API response types
    commands.rs      Tauri IPC command handlers
    media_controls.rs  OS media key integration (souvlaki)
    sync.rs          Background library sync (incremental + full)
    lib.rs           App setup, plugin registration, event wiring

src/                 React + TypeScript frontend
  components/
    Library/         Album grid, album detail, artist detail/list, cover art,
                       genre list, Years view, album card with 3D tilt
    Player/          Transport bar (play/pause/seek/volume/format pill/sync indicator)
    TrackList/       Virtual track lists (all tracks, rated, genre, shared VirtualTrackList)
    Queue/           Queue panel with drag-and-drop reordering
    Search/          Search overlay (Cmd+K)
    Settings/        Server connection, theme picker, display options
    Rating/          Star rating component
    UpdateBanner.tsx In-app update prompt
  stores/            Zustand state (library, player, settings, theme, context menu)
  hooks/             useSearch, useUpdater, useKeyboardNav, useTiltHover
  themes/            7 color themes (midnight, nord, catppuccin, aura-light, etc.)
  lib/               Typed Tauri IPC wrappers
```

---

## Roadmap

- [ ] Gapless playback
- [ ] Offline mode (download tracks)
- [ ] Synced lyrics (LRCLIB)
- [ ] Last.fm / ListenBrainz scrobbling
- [ ] Audio equalizer
- [x] Vim-style keyboard navigation
- [ ] Waveform seekbar
- [ ] Mini player mode
- [ ] Multiple server support
- [ ] Smart playlists
- [ ] ReplayGain volume normalization
- [ ] Crossfade
- [x] Theme system (7 themes)
- [x] Years view (browse by release year)
- [x] Background library sync
- [x] Cover art disk cache
- [x] Album card 3D tilt hover

---

## Contributing

Contributions are very welcome! If you want to improve Aura, open a PR.

---

## License

[PolyForm Noncommercial 1.0.0](LICENSE)
