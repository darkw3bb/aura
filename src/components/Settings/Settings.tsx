import { useState, useEffect, useRef, useMemo } from 'react';
import { useLibraryStore } from '../../stores/libraryStore';
import { useThemeStore } from '../../stores/themeStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUsageStore, usageForPeriod } from '../../stores/usageStore';
import { themes } from '../../themes';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export function Settings() {
  const { connect, error, connected, syncing, syncMessage, syncLibrary } =
    useLibraryStore();
  const { themeId, setTheme } = useThemeStore();
  const { showTrackListArt, setShowTrackListArt, anthropicApiKey, setAnthropicApiKey } = useSettingsStore();
  const usageLog = useUsageStore(s => s.log);
  const clearUsage = useUsageStore(s => s.clearUsage);
  const allUsage = useMemo(() => usageForPeriod(usageLog, 'all'), [usageLog]);
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const savedUrl = localStorage.getItem('ae_server_url') ?? '';
    const savedUser = localStorage.getItem('ae_username') ?? '';
    const savedPass = localStorage.getItem('ae_password') ?? '';
    setUrl(savedUrl);
    setUsername(savedUser);
    setPassword(savedPass);
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

  const themeList = Object.values(themes);
  const previewKeys = [
    '--bg-primary',
    '--bg-secondary',
    '--accent',
    '--text-primary',
    '--text-muted',
  ] as const;

  return (
    <div className="flex items-center justify-center h-full overflow-y-auto">
      <div className="w-full max-w-md p-8 rounded-2xl bg-themed-secondary">
        {/* Theme picker -- always visible */}
        <h2 className="text-2xl font-bold mb-4 text-themed-primary">Theme</h2>
        <div className="grid grid-cols-2 gap-3 mb-8">
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

        <h2 className="text-2xl font-bold mb-4 text-themed-primary">Display</h2>
        <label className="flex items-center justify-between gap-3 mb-8 cursor-pointer">
          <span className="text-sm text-themed-secondary">Show album art in track lists</span>
          <button
            role="switch"
            aria-checked={showTrackListArt}
            onClick={() => setShowTrackListArt(!showTrackListArt)}
            className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer border-0 ${showTrackListArt ? 'bg-themed-accent' : 'bg-themed-tertiary'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${showTrackListArt ? 'translate-x-4' : 'translate-x-0'}`}
            />
          </button>
        </label>

        <h2 className="text-2xl font-bold mb-4 text-themed-primary">Maestro</h2>
        <div className="mb-8 space-y-3">
          <p className="text-xs text-themed-muted">
            Enter your Anthropic API key to enable Maestro.
            Get one at{' '}
            <span className="text-themed-accent">console.anthropic.com</span>
          </p>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              placeholder="sk-ant-..."
              value={anthropicApiKey}
              onChange={(e) => setAnthropicApiKey(e.target.value)}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-themed-muted hover:text-themed-primary transition-colors cursor-pointer"
            >
              {showApiKey ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {anthropicApiKey && (
            <p className="text-xs text-green-400">API key configured</p>
          )}
          {allUsage.requests > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-themed-tertiary space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-themed-primary">Usage</span>
                <button
                  onClick={clearUsage}
                  className="text-[11px] text-themed-muted hover:text-themed-primary transition-colors cursor-pointer"
                >
                  Reset
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[11px] text-themed-muted">Requests</p>
                  <p className="text-sm font-medium text-themed-primary">{allUsage.requests}</p>
                </div>
                <div>
                  <p className="text-[11px] text-themed-muted">Tokens</p>
                  <p className="text-sm font-medium text-themed-primary">{formatTokens(allUsage.inputTokens + allUsage.outputTokens)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-themed-muted">Cost</p>
                  <p className="text-sm font-medium text-themed-primary">${allUsage.cost.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <h2 className="text-2xl font-bold mb-6 text-themed-primary">
          {connected ? 'Server Settings' : 'Connect to Navidrome'}
        </h2>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          autoComplete="on"
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="ae-server-url"
              className="block text-sm mb-1.5 text-themed-secondary"
            >
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
            <label
              htmlFor="ae-username"
              className="block text-sm mb-1.5 text-themed-secondary"
            >
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
            <label
              htmlFor="ae-password"
              className="block text-sm mb-1.5 text-themed-secondary"
            >
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

          {error && (
            <p className="text-themed-error text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={connecting || !url || !username}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer btn-accent"
          >
            {connecting ? 'Connecting...' : connected ? 'Reconnect' : 'Connect'}
          </button>
        </form>

        {connected && (
          <div className="mt-4 pt-4 space-y-3 border-t border-themed">
            <button
              onClick={syncLibrary}
              disabled={syncing}
              className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer bg-themed-tertiary text-themed-primary"
            >
              {syncing ? 'Syncing...' : 'Sync Library to Local Cache'}
            </button>
            {syncMessage && (
              <p className="text-sm text-themed-secondary">
                {syncMessage}
              </p>
            )}
            <button
              onClick={handleLogout}
              className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors cursor-pointer btn-outline-themed"
            >
              Log Out &amp; Clear Saved Credentials
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
