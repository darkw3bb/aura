import { create } from 'zustand';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
}

interface ContextMenuStore {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  show: (x: number, y: number, items: ContextMenuItem[]) => void;
  hide: () => void;
}

export const useContextMenuStore = create<ContextMenuStore>((set) => ({
  visible: false,
  x: 0,
  y: 0,
  items: [],
  show: (x, y, items) => set({ visible: true, x, y, items }),
  hide: () => set({ visible: false }),
}));
