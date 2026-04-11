import { create } from 'zustand';
import { getModelConfig } from '../lib/models';

const STORAGE_KEY = 'ae_maestro_usage';

export interface UsageEntry {
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  cost: number;
  requests: number;
}

function loadLog(): UsageEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function persistLog(log: UsageEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
}

export function computeCost(inputTokens: number, outputTokens: number, model?: string): number {
  const cfg = getModelConfig(model ?? '');
  return (inputTokens / 1_000_000) * cfg.costPerMInput +
         (outputTokens / 1_000_000) * cfg.costPerMOutput;
}

function sumEntries(entries: UsageEntry[]): UsageTotals {
  let inputTokens = 0;
  let outputTokens = 0;
  let cost = 0;
  for (const e of entries) {
    inputTokens += e.inputTokens;
    outputTokens += e.outputTokens;
    cost += computeCost(e.inputTokens, e.outputTokens, e.model);
  }
  return { inputTokens, outputTokens, cost, requests: entries.length };
}

function getPeriodBounds(period: 'week' | 'month'): { start: number; prevStart: number } {
  const now = new Date();
  if (period === 'week') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);
    const prevWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start: weekStart.getTime(), prevStart: prevWeekStart.getTime() };
  }
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  prevMonthStart.setHours(0, 0, 0, 0);
  return { start: monthStart.getTime(), prevStart: prevMonthStart.getTime() };
}

export function usageForPeriod(log: UsageEntry[], period: 'week' | 'month' | 'all'): UsageTotals {
  if (period === 'all') return sumEntries(log);
  const { start } = getPeriodBounds(period);
  return sumEntries(log.filter(e => e.timestamp >= start));
}

export function previousPeriodUsage(log: UsageEntry[], period: 'week' | 'month'): UsageTotals {
  const { start, prevStart } = getPeriodBounds(period);
  return sumEntries(log.filter(e => e.timestamp >= prevStart && e.timestamp < start));
}

interface UsageStore {
  log: UsageEntry[];
  recordUsage: (entry: UsageEntry) => void;
  clearUsage: () => void;
}

export const useUsageStore = create<UsageStore>((set) => ({
  log: loadLog(),

  recordUsage: (entry) => {
    set(s => {
      const log = [...s.log, entry];
      persistLog(log);
      return { log };
    });
  },

  clearUsage: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ log: [] });
  },
}));
