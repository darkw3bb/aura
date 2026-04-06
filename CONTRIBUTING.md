# Contributing to Aura

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. **Install prerequisites** (see README.md for platform-specific deps)

2. **Clone and install:**

```bash
git clone https://github.com/yourname/aura.git
cd aura
npm install
```

3. **Run in dev mode:**

```bash
npx tauri dev
```

This starts both the Vite dev server (frontend) and the Tauri Rust backend with hot-reload.

4. **Build for production:**

```bash
npx tauri build
```

## Project Structure

- `src/` — React/TypeScript frontend
- `src-tauri/` — Rust backend (Tauri)
- `src-tauri/src/subsonic/` — Subsonic API client
- `src-tauri/src/audio/` — Audio playback engine
- `src-tauri/src/cache/` — SQLite cache + FTS5

## Code Style

- **Rust:** Follow `cargo clippy` suggestions. Format with `cargo fmt`.
- **TypeScript:** Follow the existing ESLint config. Format with the project's Prettier config if present.
- **Commits:** Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, etc.).

## Pull Requests

1. Fork the repo and create a branch from `main`.
2. Make your changes, ensuring both Rust and TypeScript compile cleanly.
3. Write a clear PR description explaining what changed and why.
4. Ensure `cargo check` and `npx tsc --noEmit` pass.

## Reporting Issues

- Include your OS, Navidrome version, and Aura version.
- Include steps to reproduce the issue.
- Include any error messages from the console or terminal.

## Areas for Contribution

Check the roadmap in README.md for planned features. Other welcome contributions:

- Bug fixes
- Performance improvements
- UI/UX improvements
- Documentation
- Tests
- Accessibility improvements
