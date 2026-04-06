import { useState, useEffect, useRef } from 'react';
import { useLibraryStore } from '../../stores/libraryStore';
import { useThemeStore } from '../../stores/themeStore';
import { themes } from '../../themes';

export function Settings() {
  const { connect, error, connected, syncing, syncMessage, syncLibrary } =
    useLibraryStore();
  const { themeId, setTheme } = useThemeStore();
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
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
