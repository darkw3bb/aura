import { useEffect, useRef } from 'react';
import { useContextMenuStore } from '../../stores/contextMenuStore';

export function ContextMenu() {
  const { visible, x, y, items, hide } = useContextMenuStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const handleClose = () => hide();
    window.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') handleClose();
    });
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [visible, hide]);

  useEffect(() => {
    if (!visible || !ref.current) return;
    const menu = ref.current;
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let adjustedX = x;
    let adjustedY = y;
    if (x + rect.width > vw) adjustedX = vw - rect.width - 4;
    if (y + rect.height > vh) adjustedY = vh - rect.height - 4;
    menu.style.left = `${adjustedX}px`;
    menu.style.top = `${adjustedY}px`;
  }, [visible, x, y]);

  if (!visible) return null;

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] py-1 rounded-lg shadow-lg bg-themed-secondary border border-themed"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className="w-full text-left px-3 py-1.5 text-[13px] text-themed-primary hover:bg-themed-tertiary cursor-pointer bg-transparent border-0"
          onClick={(e) => {
            e.stopPropagation();
            item.onClick();
            hide();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
