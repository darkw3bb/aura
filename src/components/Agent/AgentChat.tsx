import { useState, useRef, useEffect, useCallback, type ReactNode, type ComponentProps } from 'react';
import Markdown from 'react-markdown';
import { useAgentChatStore } from '../../stores/agentChatStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { usePlayerStore } from '../../stores/playerStore';
import { api } from '../../lib/tauri';
import { type ChatMessage } from '../../lib/agentLoop';

const TOOL_LABELS: Record<string, string> = {
  get_now_playing: 'Checking now playing',
  search_tracks: 'Searching library',
  get_albums: 'Loading albums',
  get_artists: 'Loading artists',
  get_genres: 'Loading genres',
  get_album_detail: 'Loading album details',
  get_artist_detail: 'Loading artist details',
  get_tracks_by_rating: 'Loading rated tracks',
  get_songs_by_genre: 'Loading genre tracks',
  list_playlists: 'Loading playlists',
  get_playlist_tracks: 'Loading playlist tracks',
  apply_tag: 'Applying tag',
  apply_tag_bulk: 'Tagging tracks',
};

interface ActionLink {
  type: 'open_playlist' | 'open_album' | 'open_artist' | 'open_genre' | 'play_track';
  id: string;
  label: string;
}

const ACTION_REGEX = /\{\{(open_playlist|open_album|open_artist|open_genre|play_track):([^:}]+):([^}]+)\}\}/g;


const ACTION_ICONS: Record<ActionLink['type'], ReactNode> = {
  open_playlist: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  open_album: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  open_artist: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  open_genre: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  play_track: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
};

function ActionButton({ action, onNavigate }: { action: ActionLink; onNavigate: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      switch (action.type) {
        case 'open_playlist':
          useLibraryStore.getState().navigateToPlaylist(action.id);
          onNavigate();
          break;
        case 'open_album':
          await useLibraryStore.getState().loadAlbum(action.id);
          onNavigate();
          break;
        case 'open_artist':
          await useLibraryStore.getState().loadArtist(action.id);
          onNavigate();
          break;
        case 'open_genre':
          useLibraryStore.getState().loadGenre(action.id);
          onNavigate();
          break;
        case 'play_track': {
          const track = await api.getCachedTrack(action.id);
          const song = track ?? { id: action.id, title: action.label };
          if (song.album_id) {
            const album = await api.getAlbum(song.album_id).catch(() => null);
            if (album?.song) {
              const idx = album.song.findIndex(s => s.id === action.id);
              if (idx >= 0) {
                await usePlayerStore.getState().playTrackInContext(album.song, idx);
                break;
              }
            }
          }
          await usePlayerStore.getState().playTrack(song);
          break;
        }
      }
    } catch (e) {
      console.error('Action failed:', e);
    } finally {
      setLoading(false);
    }
  }, [action, onNavigate]);

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-themed-accent/15 text-themed-accent text-[12px] font-medium hover:bg-themed-accent/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50 border border-themed-accent/20"
    >
      {loading ? (
        <span className="w-3 h-3 rounded-full border-2 border-themed-accent/30 border-t-themed-accent animate-spin" />
      ) : (
        ACTION_ICONS[action.type]
      )}
      {action.label}
    </button>
  );
}

const ACTION_PLACEHOLDER = /\uFFFC(\d+)\uFFFC/g;

function RichText({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const actions: ActionLink[] = [];
  let idx = 0;
  const cleaned = text.replace(ACTION_REGEX, (_match, type, id, label) => {
    actions.push({ type: type as ActionLink['type'], id, label });
    return `\uFFFC${idx++}\uFFFC`;
  });
  ACTION_REGEX.lastIndex = 0;

  if (actions.length === 0) {
    return <MarkdownContent text={text} />;
  }

  const mdComponents: ComponentProps<typeof Markdown>['components'] = {
    p({ children }) {
      return <p className="mb-2 last:mb-0">{injectActions(children, actions, onNavigate)}</p>;
    },
    li({ children }) {
      return <li>{injectActions(children, actions, onNavigate)}</li>;
    },
  };

  return <Markdown components={mdComponents}>{cleaned}</Markdown>;
}

function injectActions(children: ReactNode, actions: ActionLink[], onNavigate: () => void): ReactNode {
  if (!children) return children;
  if (typeof children === 'string') {
    return replaceInString(children, actions, onNavigate);
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === 'string') {
        return <span key={i}>{replaceInString(child, actions, onNavigate)}</span>;
      }
      return child;
    });
  }
  return children;
}

function replaceInString(str: string, actions: ActionLink[], onNavigate: () => void): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(ACTION_PLACEHOLDER.source, 'g');
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) parts.push(str.slice(last, m.index));
    const action = actions[parseInt(m[1])];
    if (action) parts.push(<ActionButton key={`a${m[1]}`} action={action} onNavigate={onNavigate} />);
    last = m.index + m[0].length;
  }
  if (last < str.length) parts.push(str.slice(last));
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

const mdComponents: ComponentProps<typeof Markdown>['components'] = {
  p({ children }) { return <p className="mb-2 last:mb-0">{children}</p>; },
  strong({ children }) { return <strong className="font-semibold">{children}</strong>; },
  em({ children }) { return <em>{children}</em>; },
  ul({ children }) { return <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-0.5">{children}</ul>; },
  ol({ children }) { return <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-0.5">{children}</ol>; },
  li({ children }) { return <li>{children}</li>; },
  code({ children, className }) {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return <code className="block bg-themed-tertiary rounded-md px-2.5 py-2 text-[12px] my-2 overflow-x-auto whitespace-pre">{children}</code>;
    }
    return <code className="bg-themed-tertiary rounded px-1 py-0.5 text-[12px]">{children}</code>;
  },
  h1({ children }) { return <h4 className="font-semibold mb-1">{children}</h4>; },
  h2({ children }) { return <h4 className="font-semibold mb-1">{children}</h4>; },
  h3({ children }) { return <h4 className="font-semibold mb-1">{children}</h4>; },
  hr() { return <hr className="border-themed my-2" />; },
  blockquote({ children }) { return <blockquote className="border-l-2 border-themed-accent pl-2.5 my-2 opacity-80">{children}</blockquote>; },
};

function MarkdownContent({ text }: { text: string }) {
  return <Markdown components={mdComponents}>{text}</Markdown>;
}

function ToolBadge({ name, input, running }: { name: string; input: Record<string, unknown>; running?: boolean }) {
  const label = TOOL_LABELS[name] || name;
  const detail =
    (input.query as string) ||
    (input.tag_name as string) ||
    (input.genre as string) ||
    '';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-colors ${
      running
        ? 'bg-themed-accent/15 text-themed-accent'
        : 'bg-themed-tertiary text-themed-muted'
    }`}>
      {running ? (
        <span className="w-2 h-2 rounded-full bg-themed-accent animate-pulse shrink-0" />
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {label}
      {detail && <span className="opacity-60">({detail})</span>}
    </span>
  );
}

type TimelineItem =
  | { kind: 'user'; text: string }
  | { kind: 'tools'; tools: { id: string; name: string; input: Record<string, unknown> }[] }
  | { kind: 'text'; text: string };

function buildTimeline(messages: ChatMessage[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const msg of messages) {
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        items.push({ kind: 'user', text: msg.content });
      }
      continue;
    }
    if (typeof msg.content === 'string') {
      if (msg.content.trim()) items.push({ kind: 'text', text: msg.content });
      continue;
    }
    let pending: { id: string; name: string; input: Record<string, unknown> }[] = [];
    for (const block of msg.content) {
      if (block.type === 'tool_use') {
        pending.push({ id: block.id, name: block.name, input: block.input });
      } else if (block.type === 'text' && block.text.trim()) {
        if (pending.length > 0) {
          items.push({ kind: 'tools', tools: pending });
          pending = [];
        }
        items.push({ kind: 'text', text: block.text });
      }
    }
    if (pending.length > 0) items.push({ kind: 'tools', tools: pending });
  }
  return items;
}

function getResolvedToolIds(messages: ChatMessage[]): Set<string> {
  const ids = new Set<string>();
  for (const msg of messages) {
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'tool_result') ids.add(block.tool_use_id);
      }
    }
  }
  return ids;
}

function ChatPanel() {
  const {
    sessions,
    activeSessionId,
    isLoading,
    newSession,
    setActiveSession,
    deleteSession,
    sendMessage,
    close,
  } = useAgentChatStore();
  const { anthropicApiKey } = useSettingsStore();
  const { setView } = useLibraryStore();
  const [input, setInput] = useState('');
  const [showSessions, setShowSessions] = useState(false);

  const handleNavigate = useCallback(() => {
    close();
  }, [close]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages ?? [];
  const timeline = buildTimeline(messages);
  const resolvedIds = getResolvedToolIds(messages);

  const showThinking = isLoading && (() => {
    if (timeline.length === 0) return true;
    const last = timeline[timeline.length - 1];
    if (last.kind !== 'tools') return true;
    return last.tools.every(t => resolvedIds.has(t.id));
  })();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, timeline.length, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isLoading, activeSessionId]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasApiKey = !!anthropicApiKey;

  return (
    <div className="flex flex-col h-full bg-themed-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-themed shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="p-1 rounded-md hover:bg-themed-tertiary transition-colors cursor-pointer text-themed-muted"
            title="Chat history"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          <h2 className="text-sm font-semibold text-themed-primary">Maestro</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => newSession()}
            className="p-1.5 rounded-md hover:bg-themed-tertiary transition-colors cursor-pointer text-themed-muted"
            title="New chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            onClick={close}
            className="p-1.5 rounded-md hover:bg-themed-tertiary transition-colors cursor-pointer text-themed-muted"
            title="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Session list (collapsible) */}
      {showSessions && (
        <div className="border-b border-themed max-h-48 overflow-y-auto shrink-0">
          {sessions.length === 0 ? (
            <p className="px-4 py-3 text-xs text-themed-muted">No chats yet</p>
          ) : (
            sessions.map(s => (
              <div
                key={s.id}
                className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-themed-tertiary transition-colors ${
                  s.id === activeSessionId ? 'bg-themed-tertiary' : ''
                }`}
                onClick={() => {
                  setActiveSession(s.id);
                  setShowSessions(false);
                }}
              >
                <span className="flex-1 text-xs text-themed-primary truncate">
                  {s.title}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(s.id);
                  }}
                  className="p-0.5 rounded hover:bg-themed-secondary text-themed-muted cursor-pointer shrink-0"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {!hasApiKey && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-themed-muted">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-sm text-themed-muted">
              Add your Anthropic API key in{' '}
              <button
                onClick={() => { close(); setView('settings'); }}
                className="text-themed-accent hover:underline cursor-pointer"
              >
                Settings
              </button>
              {' '}to enable Maestro.
            </p>
          </div>
        )}

        {hasApiKey && timeline.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-themed-muted">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <p className="text-sm text-themed-muted max-w-[240px]">
              Ask me to explore your library, find songs, or organize tracks with tags.
            </p>
          </div>
        )}

        {timeline.map((item, i) => {
          if (item.kind === 'user') {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-themed-accent text-white text-[13px] leading-relaxed whitespace-pre-wrap">
                  {item.text}
                </div>
              </div>
            );
          }
          if (item.kind === 'tools') {
            return (
              <div key={i} className="flex justify-start">
                <div className="flex flex-wrap gap-1.5 max-w-[85%]">
                  {item.tools.map(tool => (
                    <ToolBadge
                      key={tool.id}
                      name={tool.name}
                      input={tool.input}
                      running={isLoading && !resolvedIds.has(tool.id)}
                    />
                  ))}
                </div>
              </div>
            );
          }
          const hasActions = /\{\{(open_playlist|open_album|open_artist|open_genre|play_track):/.test(item.text);
          return (
            <div key={i} className="flex justify-start">
              <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-themed-secondary text-themed-primary text-[13px] leading-relaxed agent-markdown">
                {hasActions ? (
                  <RichText text={item.text} onNavigate={handleNavigate} />
                ) : (
                  <MarkdownContent text={item.text} />
                )}
              </div>
            </div>
          );
        })}

        {showThinking && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-themed-secondary">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-themed-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-themed-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-themed-muted animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {hasApiKey && (
        <div className="px-4 py-3 border-t border-themed shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Ask about your music..."
              rows={1}
              className="flex-1 resize-none px-3 py-2 rounded-lg bg-themed-tertiary text-themed-primary text-[13px] placeholder:text-themed-muted outline-none border border-themed focus:border-themed-accent transition-colors disabled:opacity-50"
              style={{ maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="p-2 rounded-lg bg-themed-accent text-white disabled:opacity-30 cursor-pointer transition-opacity shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const SHORTCUT_LABEL = isMac ? '⌘J' : 'Ctrl+J';

export function MaestroPanel() {
  const isOpen = useAgentChatStore(s => s.isOpen);

  return (
    <div
      className={`shrink-0 border-l border-themed overflow-hidden transition-[width] duration-200 ease-out ${
        isOpen ? 'w-96' : 'w-0'
      }`}
    >
      <div className="w-96 h-full">
        {isOpen && <ChatPanel />}
      </div>
    </div>
  );
}

export function MaestroFAB() {
  const { toggle, isLoading } = useAgentChatStore();
  const { anthropicApiKey } = useSettingsStore();

  return (
    <button
      onClick={toggle}
      className="fixed bottom-20 right-4 z-40 w-11 h-11 rounded-full bg-themed-accent text-white shadow-lg flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform"
      title={`Maestro (${SHORTCUT_LABEL})`}
    >
      {isLoading && (
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-themed-primary animate-pulse" />
      )}
      {!anthropicApiKey ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      )}
    </button>
  );
}
