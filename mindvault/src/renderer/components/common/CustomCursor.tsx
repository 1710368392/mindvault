import React, { useEffect, useRef, useCallback } from 'react';

type CursorType = 'default' | 'pointer' | 'text' | 'move' | 'not-allowed' | 'wait' | 'crosshair' | 'grab' | 'grabbing' | 'n-resize' | 's-resize' | 'e-resize' | 'w-resize' | 'ne-resize' | 'nw-resize' | 'se-resize' | 'sw-resize';

const CURSOR_MAP: Record<CursorType, string> = {
  'default': 'Normal',
  'pointer': 'Link',
  'text': 'Text',
  'move': 'Move',
  'not-allowed': 'Unavailable',
  'wait': 'Busy',
  'crosshair': 'Precision',
  'grab': 'Move',
  'grabbing': 'Move',
  'n-resize': 'Vertical',
  's-resize': 'Vertical',
  'e-resize': 'Horizontal',
  'w-resize': 'Horizontal',
  'ne-resize': 'Diagonal2',
  'nw-resize': 'Diagonal1',
  'se-resize': 'Diagonal1',
  'sw-resize': 'Diagonal2',
};

const HOTSPOT_MAP: Record<string, { x: number; y: number }> = {
  'Normal': { x: 0, y: 0 },
  'Link': { x: 4, y: 0 },
  'Text': { x: 4, y: 9 },
  'Move': { x: 15, y: 15 },
  'Unavailable': { x: 0, y: 0 },
  'Busy': { x: 0, y: 0 },
  'Precision': { x: 5, y: 6 },
  'Vertical': { x: 15, y: 15 },
  'Horizontal': { x: 15, y: 15 },
  'Diagonal1': { x: 15, y: 15 },
  'Diagonal2': { x: 15, y: 15 },
};

const KEY_FRAMES = 12;
const SUB_FRAMES = 5;
const TOTAL_FRAMES = KEY_FRAMES * SUB_FRAMES;
const FRAME_SIZE = 32;
const CYCLE_DURATION = 2000;

interface CursorImages {
  frames: HTMLImageElement[];
  loaded: boolean;
}

const imageStore: Record<string, CursorImages> = {};

function getRendererBaseUrl(): string {
  const href = window.location.href;
  const lastIndex = href.lastIndexOf('/');
  return href.substring(0, lastIndex + 1);
}

async function loadCursorImages(name: string): Promise<boolean> {
  if (imageStore[name]?.loaded) return true;

  const frames: HTMLImageElement[] = [];
  const promises: Promise<boolean>[] = [];
  const baseUrl = getRendererBaseUrl();

  for (let i = 0; i < KEY_FRAMES; i++) {
    const img = new Image();
    img.src = `${baseUrl}cursors-frames/${name}/frame_${String(i).padStart(3, '0')}.png`;
    const p = new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => {
        console.warn(`[CustomCursor] Failed to load: ${img.src}`);
        resolve(false);
      };
    });
    frames.push(img);
    promises.push(p);
  }

  const results = await Promise.all(promises);
  const allLoaded = results.every(r => r);

  imageStore[name] = { frames, loaded: allLoaded };
  return allLoaded;
}

const detectCursorType = (element: Element | null): CursorType => {
  if (!element) return 'default';
  const el = element as HTMLElement;
  const tagName = el.tagName.toLowerCase();
  const computedStyle = window.getComputedStyle(el);
  const cursorProp = computedStyle.cursor;
  const role = el.getAttribute('role');

  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return 'not-allowed';
  if (cursorProp === 'grabbing' || el.classList.contains('cursor-grabbing') || el.classList.contains('is-dragging-item')) return 'grabbing';
  if (cursorProp === 'grab' || el.classList.contains('cursor-grab') || el.getAttribute('draggable') === 'true') return 'grab';
  if (cursorProp === 'crosshair' || el.classList.contains('cursor-crosshair')) return 'crosshair';
  if (cursorProp === 'not-allowed' || el.classList.contains('cursor-not-allowed')) return 'not-allowed';
  if (cursorProp === 'move' || el.classList.contains('cursor-move')) return 'move';
  if (cursorProp === 'text' || el.classList.contains('cursor-text')) return 'text';
  if (cursorProp === 'wait') return 'wait';
  if (cursorProp === 'pointer') return 'pointer';
  if (tagName === 'a' || role === 'link') return 'pointer';
  if (tagName === 'button' || role === 'button' || (tagName === 'input' && ['submit', 'button', 'reset'].includes((el as HTMLInputElement).type))) return 'pointer';
  if (el.classList.contains('cursor-pointer')) return 'pointer';
  if (tagName === 'input' && ['text', 'search', 'url', 'email', 'password', 'number'].includes((el as HTMLInputElement).type)) return 'text';
  if (tagName === 'textarea') return 'text';
  if (el.getAttribute('contenteditable') === 'true') return 'text';
  const resizeAttr = el.getAttribute('data-resize');
  if (resizeAttr) {
    const map: Record<string, CursorType> = { n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize', ne: 'ne-resize', nw: 'nw-resize', se: 'se-resize', sw: 'sw-resize' };
    if (map[resizeAttr]) return map[resizeAttr];
  }
  return 'default';
};

const CustomCursor: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const visibleRef = useRef(false);
  const cursorTypeRef = useRef<CursorType>('default');
  const loadedRef = useRef(false);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const renderFrame = useCallback((timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = timestamp - startTimeRef.current;
    const progress = (elapsed % CYCLE_DURATION) / CYCLE_DURATION;
    const totalFrame = progress * TOTAL_FRAMES;

    const keyFrame0 = Math.floor(totalFrame / SUB_FRAMES) % KEY_FRAMES;
    const keyFrame1 = (keyFrame0 + 1) % KEY_FRAMES;
    const t = (totalFrame % SUB_FRAMES) / SUB_FRAMES;

    const cursorName = CURSOR_MAP[cursorTypeRef.current];
    const store = imageStore[cursorName];

    const canvas = canvasRef.current;
    if (canvas && store?.loaded && store.frames.length >= KEY_FRAMES) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE);
        if (t < 0.05) {
          ctx.globalAlpha = 1;
          ctx.drawImage(store.frames[keyFrame0], 0, 0, FRAME_SIZE, FRAME_SIZE);
        } else {
          ctx.globalAlpha = 1 - t;
          ctx.drawImage(store.frames[keyFrame0], 0, 0, FRAME_SIZE, FRAME_SIZE);
          ctx.globalAlpha = t;
          ctx.drawImage(store.frames[keyFrame1], 0, 0, FRAME_SIZE, FRAME_SIZE);
          ctx.globalAlpha = 1;
        }
      }
    }

    if (containerRef.current) {
      const hotspot = HOTSPOT_MAP[cursorName] || { x: 0, y: 0 };
      containerRef.current.style.transform = `translate(${posRef.current.x - hotspot.x}px, ${posRef.current.y - hotspot.y}px)`;
      containerRef.current.style.opacity = visibleRef.current ? '1' : '0';
    }

    rafRef.current = requestAnimationFrame(renderFrame);
  }, []);

  useEffect(() => {
    const cursorNames = [...new Set(Object.values(CURSOR_MAP))];
    Promise.all(cursorNames.map(name => loadCursorImages(name))).then((results) => {
      const anyLoaded = results.some(r => r);
      if (!anyLoaded) {
        document.documentElement.setAttribute('data-custom-cursor', 'false');
        return;
      }
      loadedRef.current = true;
      document.documentElement.setAttribute('data-custom-cursor', 'true');
      rafRef.current = requestAnimationFrame(renderFrame);
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      document.documentElement.setAttribute('data-custom-cursor', 'false');
    };
  }, [renderFrame]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      visibleRef.current = true;
      const target = e.target as Element;
      const newType = detectCursorType(target);
      if (newType !== cursorTypeRef.current) {
        cursorTypeRef.current = newType;
        startTimeRef.current = 0;
      }
    };
    const onMouseEnter = () => { visibleRef.current = true; };
    const onMouseLeave = () => { visibleRef.current = false; };
    const onMouseDown = () => { if (cursorTypeRef.current === 'grab') cursorTypeRef.current = 'grabbing'; };
    const onMouseUp = () => { if (cursorTypeRef.current === 'grabbing') cursorTypeRef.current = 'grab'; };

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mouseenter', onMouseEnter, true);
    document.addEventListener('mouseleave', onMouseLeave, true);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mouseup', onMouseUp, true);

    return () => {
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('mouseenter', onMouseEnter, true);
      document.removeEventListener('mouseleave', onMouseLeave, true);
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('mouseup', onMouseUp, true);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 99999,
        willChange: 'transform',
        opacity: 0,
        transition: 'opacity 0.1s ease',
        imageRendering: 'pixelated',
      }}
    >
      <canvas
        ref={canvasRef}
        width={FRAME_SIZE}
        height={FRAME_SIZE}
        style={{
          display: 'block',
          width: FRAME_SIZE,
          height: FRAME_SIZE,
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
};

export default CustomCursor;
