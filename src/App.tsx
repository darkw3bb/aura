import { useState, useEffect, useCallback } from 'react';
import { useLibraryStore } from './stores/libraryStore';
import { usePlayerStore } from './stores/playerStore';
import { Settings } from './components/Settings/Settings';
import { AlbumGrid } from './components/Library/AlbumGrid';
import { ArtistList } from './components/Library/ArtistList';
import { AlbumDetail } from './components/Library/AlbumDetail';
import { ArtistDetail } from './components/Library/ArtistDetail';
import { PlayerBar } from './components/Player/PlayerBar';
import { SearchOverlay } from './components/Search/SearchOverlay';
import { RatedTracks } from './components/TrackList/RatedTracks';
import { AllTracks } from './components/TrackList/AllTracks';
import { GenreList } from './components/Library/GenreList';
import { GenreTracks } from './components/TrackList/GenreTracks';
import { QueuePanel } from './components/Queue/QueuePanel';
import { YearsView } from './components/Library/YearsView';
import { ContextMenu } from './components/ContextMenu/ContextMenu';
import { UpdateBanner } from './components/UpdateBanner';

function App() {
  const { view, setView, connected, connect, canGoBack, canGoForward, goBack, goForward } = useLibraryStore();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const savedUrl = localStorage.getItem('ae_server_url');
    const savedUser = localStorage.getItem('ae_username');
    const savedPass = localStorage.getItem('ae_password');
    if (savedUrl && savedUser && savedPass && !connected) {
      connect(savedUrl, savedUser, savedPass);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen((prev) => !prev);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === '[') {
      e.preventDefault();
      const { canGoBack, goBack } = useLibraryStore.getState();
      if (canGoBack) goBack();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === ']') {
      e.preventDefault();
      const { canGoForward, goForward } = useLibraryStore.getState();
      if (canGoForward) goForward();
    }
    if (e.key === 'Escape') {
      setSearchOpen(false);
    }
    if (e.code === 'Space') {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      e.preventDefault();
      const { isPlaying, currentTrack, pause, resume } = usePlayerStore.getState();
      if (currentTrack) {
        isPlaying ? pause() : resume();
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col h-screen bg-themed-primary overflow-hidden">
      <UpdateBanner />
      <div className="flex flex-1 overflow-hidden min-w-0">
        {connected && (
          <div className="w-56 shrink-0 flex flex-col overflow-hidden bg-themed-secondary border-r border-themed">
            <div className="px-4 pt-6 pb-1">
              <h1 className="text-[13px] font-bold tracking-tight text-themed-primary">
                Aura
              </h1>
            </div>

            <nav className="px-3 flex flex-col">
              <p className="section-label">Library</p>
              <div className="flex flex-col gap-0.5">
                <NavButton
                  active={view === 'albums'}
                  onClick={() => setView('albums')}
                  icon={
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                    </svg>
                  }
                >
                  Albums
                </NavButton>

                <NavButton
                  active={view === 'tracks'}
                  onClick={() => setView('tracks')}
                  icon={
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  }
                >
                  Tracks
                </NavButton>

                <NavButton
                  active={view === 'artists' || view === 'artist-detail'}
                  onClick={() => setView('artists')}
                  icon={
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  }
                >
                  Artists
                </NavButton>

                <NavButton
                  active={view === 'genres' || view === 'genre-detail'}
                  onClick={() => setView('genres')}
                  icon={
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                      <line x1="7" y1="7" x2="7.01" y2="7" />
                    </svg>
                  }
                >
                  Genres
                </NavButton>

                <NavButton
                  active={view === 'rated'}
                  onClick={() => setView('rated')}
                  icon={
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  }
                >
                  Rated
                </NavButton>

                <NavButton
                  active={view === 'years'}
                  onClick={() => setView('years')}
                  icon={
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  }
                >
                  Years
                </NavButton>
              </div>

              <p className="section-label">Tools</p>
              <div className="flex flex-col gap-0.5">
                <NavButton
                  active={false}
                  onClick={() => setSearchOpen(true)}
                  icon={
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  }
                >
                  Search
                  <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-themed-tertiary text-themed-muted">
                    {'\u2318'}K
                  </kbd>
                </NavButton>

                <NavButton
                  active={view === 'queue'}
                  onClick={() => setView('queue')}
                  icon={
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                  }
                >
                  Queue
                </NavButton>

                <NavButton
                  active={view === 'settings'}
                  onClick={() => setView('settings')}
                  icon={
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  }
                >
                  Settings
                </NavButton>
              </div>
            </nav>

            {view !== 'settings' && (
              <div className="flex-1 overflow-hidden mt-2 divider">
                <ArtistList />
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-hidden min-w-0 flex flex-col">
          {connected && (
            <div className="flex items-center gap-1 px-4 pt-3 pb-0 shrink-0">
              <button
                onClick={goBack}
                disabled={!canGoBack}
                className="nav-item p-1 rounded-md cursor-pointer disabled:opacity-25 disabled:cursor-default"
                aria-label="Go back"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                onClick={goForward}
                disabled={!canGoForward}
                className="nav-item p-1 rounded-md cursor-pointer disabled:opacity-25 disabled:cursor-default"
                aria-label="Go forward"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}
          <div className="flex-1 overflow-hidden min-w-0">
            {view === 'settings' && <Settings />}
            {view === 'albums' && <AlbumGrid />}
            {view === 'album-detail' && <AlbumDetail />}
            {view === 'artist-detail' && <ArtistDetail />}
            {view === 'tracks' && <AllTracks />}
            {view === 'rated' && <RatedTracks />}
            {view === 'genres' && <GenreList />}
            {view === 'genre-detail' && <GenreTracks />}
            {view === 'years' && <YearsView />}
            {view === 'queue' && <QueuePanel />}
            {view === 'artists' && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-themed-primary">
                  Select an artist from the sidebar
                </h2>
              </div>
            )}
          </div>
        </div>
      </div>

      {connected && <PlayerBar />}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ContextMenu />
    </div>
  );
}

function NavButton({
  children,
  active,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      data-active={active}
      className="nav-item w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer"
    >
      {icon}
      {children}
    </button>
  );
}

export default App;
