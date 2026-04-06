import { useState, useEffect, useRef, useCallback, type RefObject, type Dispatch, type SetStateAction } from 'react';

interface UseKeyboardNavOptions {
  itemCount: number;
  onActivate: (index: number) => void;
  scrollRef?: RefObject<HTMLElement | null>;
  scrollToIndex?: (index: number) => void;
}

interface UseKeyboardNavReturn {
  focusIndex: number;
  setFocusIndex: Dispatch<SetStateAction<number>>;
  isKeyboardNav: boolean;
  handleMouseMove: () => void;
  getItemProps: (index: number) => {
    'data-kbd-idx': number;
    'data-focused': boolean;
    onMouseEnter: () => void;
  };
}

export function useKeyboardNav({
  itemCount,
  onActivate,
  scrollRef,
  scrollToIndex,
}: UseKeyboardNavOptions): UseKeyboardNavReturn {
  const [focusIndex, setFocusIndex] = useState(-1);
  const keyboardNavRef = useRef(false);
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;

  useEffect(() => {
    setFocusIndex(-1);
  }, [itemCount]);

  useEffect(() => {
    if (focusIndex < 0) return;

    if (scrollToIndex) {
      scrollToIndex(focusIndex);
    } else if (scrollRef?.current) {
      const el = scrollRef.current.querySelectorAll<HTMLElement>('[data-kbd-idx]')[focusIndex];
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusIndex, scrollRef, scrollToIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (itemCount === 0) return;

      switch (e.key) {
        case 'j': {
          e.preventDefault();
          keyboardNavRef.current = true;
          setFocusIndex((i) => (i < 0 ? 0 : Math.min(i + 1, itemCount - 1)));
          break;
        }
        case 'k': {
          e.preventDefault();
          keyboardNavRef.current = true;
          setFocusIndex((i) => (i < 0 ? 0 : Math.max(i - 1, 0)));
          break;
        }
        case 'Enter': {
          setFocusIndex((i) => {
            if (i >= 0 && i < itemCount) {
              e.preventDefault();
              onActivateRef.current(i);
            }
            return i;
          });
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [itemCount]);

  const handleMouseMove = useCallback(() => {
    keyboardNavRef.current = false;
  }, []);

  const getItemProps = useCallback(
    (index: number) => ({
      'data-kbd-idx': index,
      'data-focused': index === focusIndex,
      onMouseEnter: () => {
        if (!keyboardNavRef.current) setFocusIndex(index);
      },
    }),
    [focusIndex],
  );

  return {
    focusIndex,
    setFocusIndex,
    isKeyboardNav: keyboardNavRef.current,
    handleMouseMove,
    getItemProps,
  };
}
