# Audio Engine

A blazingly fast, cross-platform desktop music player for [Navidrome](https://navidrome.org/) and Subsonic-compatible servers.

Built with [Tauri 2](https://v2.tauri.app/) (Rust backend) and React (TypeScript frontend) for native performance in a lightweight package.

## Features

- **Instant search** — Local SQLite cache with FTS5 full-text search index for sub-millisecond results
- **Native audio playback** — Pure Rust audio engine (rodio + symphonia) supporting MP3, FLAC, AAC, ALAC, OGG Vorbis, Opus, WAV, AIFF, WavPack
- **OS media controls** — macOS Now Playing / Control Center, Windows SMTC, Linux MPRIS via souvlaki
- **Star ratings** — Rate tracks 1–5 stars, synced back to your Navidrome server
- **Rated tracks view** — Infinite-scroll virtual list of your rated tracks, sorted by rating
- **Album browser** — Grid view with cover art, artist sidebar
- **Background library sync** — Full metadata cached locally for offline browsing
- **Lightweight** — ~5MB binary vs ~150MB for Electron-based alternatives
- **Cross-platform** — macOS, Windows, Linux

## Prerequisites

- [Rust](https://rustup.rs/) (1.77+)
- [Node.js](https://nodejs.org/) (18+)
- A running [Navidrome](https://navidrome.org/) server (or any Subsonic API-compatible server)

### Platform-specific

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

## Getting Started

```bash
# Clone the repo
git clone https://github.com/yourname/audio-engine.git
cd audio-engine

# Install frontend dependencies
npm install

# Run in development mode
npx tauri dev

# Build for production
npx tauri build
```

On first launch, enter your Navidrome server URL, username, and password in the Settings page. Click **Sync Library to Local Cache** to populate the local search index.

## Architecture

```
src-tauri/           Rust backend
  src/
    subsonic/        Subsonic/OpenSubsonic API client
    audio/           Audio playback engine (rodio + symphonia)
    cache/           SQLite metadata cache + FTS5 search
    media_controls   OS media key integration (souvlaki)
    commands         Tauri IPC command handlers

src/                 React + TypeScript frontend
  components/
    Player/          Transport bar (play/pause/skip/seek/volume)
    Library/         Album grid, artist list, cover art
    TrackList/       Infinite scroll virtual track list
    Search/          Search overlay (Cmd+K)
    Settings/        Server connection settings
    Rating/          Star rating component
  stores/            Zustand state management
  hooks/             React hooks (search, player)
  lib/               Typed Tauri IPC wrappers
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open search |
| `Escape` | Close search / overlay |
| Media keys | Play, Pause, Next, Previous (via OS) |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Tauri 2 |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS 4 |
| State | Zustand |
| Virtual scroll | TanStack Virtual |
| Audio | rodio + symphonia (Rust) |
| Media keys | souvlaki (Rust) |
| HTTP | reqwest (Rust) |
| Cache | SQLite + FTS5 via rusqlite |
| Async | Tokio |

## Roadmap

- [ ] Gapless playback
- [ ] Offline mode (download tracks)
- [ ] Synced lyrics (LRCLIB)
- [ ] Last.fm / ListenBrainz scrobbling
- [ ] Audio equalizer
- [ ] Vim-style keyboard navigation
- [ ] Waveform seekbar
- [ ] Mini player mode
- [ ] Multiple server support
- [ ] Smart playlists
- [ ] ReplayGain volume normalization
- [ ] Crossfade
- [ ] Theme system (dark/light/custom)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
