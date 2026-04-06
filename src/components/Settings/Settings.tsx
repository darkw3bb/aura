import { useState, useEffect, useRef } from 'react';
import { useLibraryStore } from '../../stores/libraryStore';

export function Settings() {
  const { connect, error, connected, syncing, syncMessage, syncLibrary } =
    useLibraryStore();
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
    'w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition-colors focus:border-[var(--accent)]';
  const inputStyle = {
    background: 'var(--bg-tertiary)',
    borderColor: 'var(--border)',
    color: 'var(--text-primary)',
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-md p-8 rounded-2xl" style={{ background: 'var(--bg-secondary)' }}>
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
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
              className="block text-sm mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
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
              style={inputStyle}
            />
          </div>

          <div>
            <label
              htmlFor="ae-username"
              className="block text-sm mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
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
              style={inputStyle}
            />
          </div>

          <div>
            <label
              htmlFor="ae-password"
              className="block text-sm mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
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
              style={inputStyle}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={connecting || !url || !username}
            className="w-full py-2.5 rounded-lg font-medium text-sm text-white transition-colors disabled:opacity-50 cursor-pointer"
            style={{ background: 'var(--accent)' }}
          >
            {connecting ? 'Connecting...' : connected ? 'Reconnect' : 'Connect'}
          </button>
        </form>

        {connected && (
          <div className="mt-4 pt-4 space-y-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={syncLibrary}
              disabled={syncing}
              className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
            >
              {syncing ? 'Syncing...' : 'Sync Library to Local Cache'}
            </button>
            {syncMessage && (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {syncMessage}
              </p>
            )}
            <button
              onClick={handleLogout}
              className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors cursor-pointer"
              style={{
                background: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
            >
              Log Out &amp; Clear Saved Credentials
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
