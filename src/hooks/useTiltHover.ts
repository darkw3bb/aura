import { useRef, useEffect, useCallback, type RefObject, type MouseEvent as ReactMouseEvent } from 'react';

interface TiltConfig {
  maxTilt?: number;
  perspective?: number;
  scale?: number;
  shineBrightness?: number;
  parallaxFactor?: number;
  lerpSpeed?: number;
  returnSpeed?: number;
}

interface Vec {
  rx: number; ry: number; scale: number;
  shineX: number; shineY: number; shineOpacity: number;
  px: number; py: number;
}

const ZERO: Vec = { rx: 0, ry: 0, scale: 1, shineX: 50, shineY: 50, shineOpacity: 0, px: 0, py: 0 };

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function vecNearZero(cur: Vec, rest: Vec): boolean {
  return (
    Math.abs(cur.rx - rest.rx) < 0.01 &&
    Math.abs(cur.ry - rest.ry) < 0.01 &&
    Math.abs(cur.scale - rest.scale) < 0.0001 &&
    Math.abs(cur.shineOpacity - rest.shineOpacity) < 0.005 &&
    Math.abs(cur.px - rest.px) < 0.01 &&
    Math.abs(cur.py - rest.py) < 0.01
  );
}

export function useTiltHover(config: TiltConfig = {}) {
  const {
    maxTilt = 6,
    perspective = 800,
    scale = 1.02,
    shineBrightness = 0.18,
    parallaxFactor = 2,
    lerpSpeed = 0.08,
    returnSpeed = 0.06,
  } = config;

  const cardRef = useRef<HTMLDivElement>(null);
  const shineRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const target = useRef<Vec>({ ...ZERO });
  const current = useRef<Vec>({ ...ZERO });
  const active = useRef(false);
  const running = useRef(false);
  const raf = useRef(0);
  const initialized = useRef(false);
  const listeners = useRef<{ move: (e: MouseEvent) => void; leave: () => void } | null>(null);

  useEffect(() => {
    return () => {
      if (initialized.current && cardRef.current && listeners.current) {
        cardRef.current.removeEventListener('mousemove', listeners.current.move);
        cardRef.current.removeEventListener('mouseleave', listeners.current.leave);
      }
      cancelAnimationFrame(raf.current);
    };
  }, []);

  const onMouseEnter = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    if (!initialized.current) {
      initialized.current = true;

      function applyStyles() {
        const c = current.current;
        if (cardRef.current) {
          cardRef.current.style.transform =
            `perspective(${perspective}px) rotateX(${c.rx}deg) rotateY(${c.ry}deg) scale3d(${c.scale},${c.scale},${c.scale})`;
        }
        if (shineRef.current) {
          shineRef.current.style.background =
            `radial-gradient(ellipse at ${c.shineX}% ${c.shineY}%, rgba(255,255,255,${c.shineOpacity}) 0%, transparent 70%)`;
        }
        if (textRef.current) {
          textRef.current.style.transform = `translate3d(${c.px}px,${c.py}px,0)`;
        }
      }

      function tick() {
        const t = active.current ? lerpSpeed : returnSpeed;
        const tgt = active.current ? target.current : ZERO;
        const c = current.current;

        c.rx = lerp(c.rx, tgt.rx, t);
        c.ry = lerp(c.ry, tgt.ry, t);
        c.scale = lerp(c.scale, tgt.scale, t);
        c.shineX = lerp(c.shineX, tgt.shineX, t);
        c.shineY = lerp(c.shineY, tgt.shineY, t);
        c.shineOpacity = lerp(c.shineOpacity, tgt.shineOpacity, t);
        c.px = lerp(c.px, tgt.px, t);
        c.py = lerp(c.py, tgt.py, t);

        applyStyles();

        if (!active.current && vecNearZero(c, ZERO)) {
          Object.assign(c, ZERO);
          applyStyles();
          running.current = false;
          return;
        }

        raf.current = requestAnimationFrame(tick);
      }

      function startLoop() {
        if (!running.current) {
          running.current = true;
          raf.current = requestAnimationFrame(tick);
        }
      }

      function onMove(ev: MouseEvent) {
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const hw = rect.width / 2;
        const hh = rect.height / 2;
        const ox = (ev.clientX - rect.left - hw) / hw;
        const oy = (ev.clientY - rect.top - hh) / hh;

        target.current = {
          rx: oy * -maxTilt,
          ry: ox * maxTilt,
          scale,
          shineX: ((ev.clientX - rect.left) / rect.width) * 100,
          shineY: ((ev.clientY - rect.top) / rect.height) * 100,
          shineOpacity: shineBrightness,
          px: ox * -parallaxFactor,
          py: oy * -parallaxFactor,
        };
        active.current = true;
        startLoop();
      }

      function onLeave() {
        active.current = false;
        startLoop();
      }

      listeners.current = { move: onMove, leave: onLeave };
      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', onLeave);

      onMove(e.nativeEvent);
    }
  }, [maxTilt, perspective, scale, shineBrightness, parallaxFactor, lerpSpeed, returnSpeed]);

  return {
    cardRef: cardRef as RefObject<HTMLDivElement>,
    shineRef: shineRef as RefObject<HTMLDivElement>,
    textRef: textRef as RefObject<HTMLDivElement>,
    onMouseEnter,
  };
}
