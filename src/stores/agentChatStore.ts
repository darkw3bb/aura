import { create } from 'zustand';
import {
  runAgentLoop,
  type ChatMessage,
  type ToolExecution,
} from '../lib/agentLoop';
import { useSettingsStore } from './settingsStore';
import { useUsageStore } from './usageStore';

const STORAGE_KEY = 'ae_agent_sessions';
const MAX_PERSISTED_SESSIONS = 20;

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

interface AgentChatStore {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isOpen: boolean;
  isLoading: boolean;
  toolExecutions: ToolExecution[];

  toggle: () => void;
  open: () => void;
  close: () => void;
  newSession: () => string;
  setActiveSession: (id: string) => void;
  deleteSession: (id: string) => void;
  sendMessage: (text: string) => Promise<void>;
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function persistSessions(sessions: ChatSession[]) {
  const trimmed = sessions.slice(0, MAX_PERSISTED_SESSIONS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function deriveTitle(text: string): string {
  const clean = text.replace(/\n/g, ' ').trim();
  if (clean.length <= 40) return clean;
  return clean.slice(0, 40) + '...';
}

export const useAgentChatStore = create<AgentChatStore>((set, get) => ({
  sessions: loadSessions(),
  activeSessionId: null,
  isOpen: false,
  isLoading: false,
  toolExecutions: [],

  toggle: () => set(s => ({ isOpen: !s.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  newSession: () => {
    const id = generateId();
    const session: ChatSession = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
    };
    set(s => {
      const sessions = [session, ...s.sessions];
      persistSessions(sessions);
      return { sessions, activeSessionId: id };
    });
    return id;
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  deleteSession: (id) => {
    set(s => {
      const sessions = s.sessions.filter(sess => sess.id !== id);
      persistSessions(sessions);
      const activeSessionId =
        s.activeSessionId === id
          ? (sessions[0]?.id ?? null)
          : s.activeSessionId;
      return { sessions, activeSessionId };
    });
  },

  sendMessage: async (text: string) => {
    const { activeSessionId, sessions, isLoading } = get();
    if (isLoading) return;

    const { anthropicApiKey: apiKey, maestroModel } = useSettingsStore.getState();
    if (!apiKey) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = get().newSession();
    }

    const session = (sessionId === activeSessionId ? sessions : get().sessions)
      .find(s => s.id === sessionId);
    if (!session) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...session.messages, userMessage];

    const isFirstMessage = session.messages.length === 0;
    const title = isFirstMessage ? deriveTitle(text) : session.title;

    set(s => ({
      isLoading: true,
      toolExecutions: [],
      sessions: s.sessions.map(sess =>
        sess.id === sessionId
          ? { ...sess, messages: updatedMessages, title }
          : sess,
      ),
    }));

    try {
      const finalMessages = await runAgentLoop(
        updatedMessages,
        apiKey,
        maestroModel,
        (execution) => {
          set(s => {
            const existing = s.toolExecutions.findIndex(
              e => e.toolName === execution.toolName && e.status === 'running',
            );
            if (existing >= 0) {
              const updated = [...s.toolExecutions];
              updated[existing] = execution;
              return { toolExecutions: updated };
            }
            return { toolExecutions: [...s.toolExecutions, execution] };
          });
        },
        (messages) => {
          set(s => ({
            sessions: s.sessions.map(sess =>
              sess.id === sessionId
                ? { ...sess, messages }
                : sess,
            ),
          }));
        },
        (inputTokens, outputTokens, model) => {
          useUsageStore.getState().recordUsage({
            timestamp: Date.now(),
            inputTokens,
            outputTokens,
            model,
          });
        },
      );

      set(s => {
        const sessions = s.sessions.map(sess =>
          sess.id === sessionId
            ? { ...sess, messages: finalMessages }
            : sess,
        );
        persistSessions(sessions);
        return { sessions, isLoading: false, toolExecutions: [] };
      });
    } catch (e) {
      const errorText = e instanceof Error ? e.message : String(e);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Error: ${errorText}`,
      };

      set(s => {
        const sessions = s.sessions.map(sess =>
          sess.id === sessionId
            ? { ...sess, messages: [...updatedMessages, errorMessage] }
            : sess,
        );
        persistSessions(sessions);
        return { sessions, isLoading: false, toolExecutions: [] };
      });
    }
  },
}));
