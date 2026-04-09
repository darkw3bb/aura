import { useState, useEffect, useRef } from 'react';
import { useLibraryStore } from '../../stores/libraryStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useThemeStore } from '../../stores/themeStore';
import { themes } from '../../themes';

type SettingsTab = 'appearance' | 'server' | 'music-assistant';

export function Settings() {
  const { connected } = useLibraryStore();
  const [tab, setTab] = useState<SettingsTab>(connected ? 'appearance' : 'server');

  return (
    <div className="flex h-full overflow-hidden">
      <nav className="w-48 shrink-0 p-4 pt-6 space-y-1 border-r border-themed overflow-y-auto">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-themed-muted px-2.5 mb-2">
          Settings
        </p>
        <TabButton active={tab === 'appearance'} onClick={() => setTab('appearance')}
          icon={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>}
        >
          Appearance
        </TabButton>
        <TabButton active={tab === 'server'} onClick={() => setTab('server')}
          icon={<><rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></>}
        >
          Server
        </TabButton>
        <TabButton active={tab === 'music-assistant'} onClick={() => setTab('music-assistant')}
          icon={<><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></>}
        >
          Music Assistant
        </TabButton>
      </nav>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto">
          {tab === 'appearance' && <AppearanceTab />}
          {tab === 'server' && <ServerTab />}
          {tab === 'music-assistant' && <MusicAssistantTab />}
        </div>
      </div>
    </div>
  );
}

function TabButton({ children, active, onClick, icon }: {
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
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Appearance
// ---------------------------------------------------------------------------

function AppearanceTab() {
  const { themeId, setTheme } = useThemeStore();

  const themeList = Object.values(themes);
  const previewKeys = [
    '--bg-primary',
    '--bg-secondary',
    '--accent',
    '--text-primary',
    '--text-muted',
  ] as const;

  return (
    <>
      <h2 className="text-xl font-bold mb-1 text-themed-primary">Appearance</h2>
      <p className="text-sm text-themed-muted mb-5">Choose a colour theme for the app.</p>
      <div className="grid grid-cols-2 gap-3">
        {themeList.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={`flex flex-col gap-2 p-3 rounded-lg border cursor-pointer transition-colors text-left ${
              themeId === t.id
                ? 'border-themed-accent'
                : 'border-themed'
            }`}
            style={{ background: t.colors['--bg-primary'] }}
          >
            <span
              className="text-[13px] font-medium"
              style={{ color: t.colors['--text-primary'] }}
            >
              {t.name}
            </span>
            <div className="flex gap-1.5">
              {previewKeys.map((key) => (
                <span
                  key={key}
                  className="w-4 h-4 rounded-full border border-black/10"
                  style={{ background: t.colors[key] }}
                />
              ))}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Server (Navidrome / Subsonic)
// ---------------------------------------------------------------------------

function ServerTab() {
  const { connect, error, connected, syncing, syncMessage, syncLibrary } =
    useLibraryStore();

  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setUrl(localStorage.getItem('ae_server_url') ?? '');
    setUsername(localStorage.getItem('ae_username') ?? '');
    setPassword(localStorage.getItem('ae_password') ?? '');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (connecting || !url || !username) return;
    setConnecting(true);
    await connect(url, username, password);
    setConnecting(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('ae_server_url');
    localStorage.removeItem('ae_username');
    localStorage.removeItem('ae_password');
    setPassword('');
    window.location.reload();
  };

  const inputClass =
    'w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition-colors input-themed';

  return (
    <>
      <h2 className="text-xl font-bold mb-1 text-themed-primary">
        {connected ? 'Server Settings' : 'Connect to Navidrome'}
      </h2>
      <p className="text-sm text-themed-muted mb-5">
        {connected
          ? 'Manage your Navidrome / Subsonic connection.'
          : 'Enter your server credentials to get started.'}
      </p>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        autoComplete="on"
        className="space-y-4"
      >
        <div>
          <label htmlFor="ae-server-url" className="block text-sm mb-1.5 text-themed-secondary">
            Server URL
          </label>
          <input
            id="ae-server-url"
            name="url"
            type="url"
            autoComplete="url"
            placeholder="https://your-navidrome-server.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="ae-username" className="block text-sm mb-1.5 text-themed-secondary">
            Username
          </label>
          <input
            id="ae-username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="ae-password" className="block text-sm mb-1.5 text-themed-secondary">
            Password
          </label>
          <input
            id="ae-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && <p className="text-themed-error text-sm">{error}</p>}

        <button
          type="submit"
          disabled={connecting || !url || !username}
          className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer btn-accent"
        >
          {connecting ? 'Connecting...' : connected ? 'Reconnect' : 'Connect'}
        </button>
      </form>

      {connected && (
        <div className="mt-6 pt-6 space-y-3 border-t border-themed">
          <button
            onClick={syncLibrary}
            disabled={syncing}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer bg-themed-tertiary text-themed-primary"
          >
            {syncing ? 'Syncing...' : 'Sync Library to Local Cache'}
          </button>
          {syncMessage && (
            <p className="text-sm text-themed-secondary">{syncMessage}</p>
          )}
          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors cursor-pointer btn-outline-themed"
          >
            Log Out &amp; Clear Saved Credentials
          </button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Music Assistant
// ---------------------------------------------------------------------------

function MusicAssistantTab() {
  const { maConnected, maConnect, maDisconnect } = usePlayerStore();

  const [maUrl, setMaUrl] = useState('');
  const [maToken, setMaToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMaUrl(localStorage.getItem('ae_ma_url') ?? '');
    setMaToken(localStorage.getItem('ae_ma_token') ?? '');
  }, []);

  const inputClass =
    'w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition-colors input-themed';

  return (
    <>
      <h2 className="text-xl font-bold mb-1 text-themed-primary">Music Assistant</h2>
      <p className="text-sm text-themed-muted mb-5">
        Connect to a Music Assistant server to play music on external speakers like AirPlay, Chromecast, or DLNA.
      </p>

      {maConnected ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-themed-tertiary">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-sm text-themed-primary">Connected to Music Assistant</span>
          </div>
          <p className="text-xs text-themed-muted">
            Use the speaker icon in the player bar to select an output device.
          </p>
          <button
            onClick={async () => {
              await maDisconnect();
              localStorage.removeItem('ae_ma_url');
              localStorage.removeItem('ae_ma_token');
              setMaUrl('');
              setMaToken('');
              setError(null);
            }}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors cursor-pointer btn-outline-themed"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="ae-ma-url" className="block text-sm mb-1.5 text-themed-secondary">
              Server URL
            </label>
            <input
              id="ae-ma-url"
              type="url"
              placeholder="http://192.168.1.100:8095"
              value={maUrl}
              onChange={(e) => setMaUrl(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="ae-ma-token" className="block text-sm mb-1.5 text-themed-secondary">
              API Token
            </label>
            <input
              id="ae-ma-token"
              type="password"
              placeholder="Long-lived token from MA settings"
              value={maToken}
              onChange={(e) => setMaToken(e.target.value)}
              className={inputClass}
            />
            <p className="text-[11px] text-themed-muted mt-1">
              Create a long-lived token in the MA web UI: Settings &rarr; Users &rarr; your profile.
            </p>
          </div>

          {error && <p className="text-themed-error text-sm">{error}</p>}

          <button
            disabled={connecting || !maUrl || !maToken}
            onClick={async () => {
              setConnecting(true);
              setError(null);
              try {
                await maConnect(maUrl, maToken);
                localStorage.setItem('ae_ma_url', maUrl);
                localStorage.setItem('ae_ma_token', maToken);
              } catch (e) {
                setError(String(e));
              } finally {
                setConnecting(false);
              }
            }}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer btn-accent"
          >
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      )}
    </>
  );
}
