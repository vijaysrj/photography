"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryPhoto } from "@/lib/gallery";

type Props = {
  photos: GalleryPhoto[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
};

const MAX_ZOOM = 4;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Full-screen viewer. Swipe or arrow keys to move, pinch / double-tap / scroll
 * to zoom, drag to pan, swipe down or Escape to close.
 */
export function Lightbox({ photos, index, onIndex, onClose }: Props) {
  const photo = photos[index];
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [swipe, setSwipe] = useState({ dx: 0, dy: 0, active: false });
  const [chrome, setChrome] = useState(true);
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; startView: typeof view; pinchDist?: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < photos.length) onIndex(next);
    },
    [index, photos.length, onIndex],
  );

  const [dragging, setDragging] = useState(false);
  const [shownIndex, setShownIndex] = useState(index);
  // Reset zoom whenever the photo changes (adjusting state during render, as React recommends).
  if (shownIndex !== index) {
    setShownIndex(index);
    setView({ scale: 1, x: 0, y: 0 });
  }

  // Preload neighbours so moving through feels instant.
  useEffect(() => {
    for (const n of [photos[index + 1], photos[index - 1]]) if (n) new Image().src = n.large;
  }, [index, photos]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") setView((v) => ({ ...v, scale: clamp(v.scale * 1.5, 1, MAX_ZOOM) }));
      else if (e.key === "-") setView((v) => (v.scale / 1.5 <= 1.01 ? { scale: 1, x: 0, y: 0 } : { ...v, scale: v.scale / 1.5 }));
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [go, onClose]);

  /** Keeps a zoomed photo from being dragged off screen. */
  const bound = useCallback((v: typeof view) => {
    const el = stage.current;
    if (!el || v.scale <= 1) return { scale: 1, x: 0, y: 0 };
    const maxX = (el.clientWidth * (v.scale - 1)) / 2;
    const maxY = (el.clientHeight * (v.scale - 1)) / 2;
    return { scale: v.scale, x: clamp(v.x, -maxX, maxX), y: clamp(v.y, -maxY, maxY) };
  }, []);

  const zoomAt = useCallback(
    (clientX: number, clientY: number, scale: number, from = view) => {
      const el = stage.current!;
      const r = el.getBoundingClientRect();
      const cx = clientX - r.left - r.width / 2;
      const cy = clientY - r.top - r.height / 2;
      const s = clamp(scale, 1, MAX_ZOOM);
      const k = s / from.scale;
      return bound({ scale: s, x: cx - (cx - from.x) * k, y: cy - (cy - from.y) * k });
    },
    [bound, view],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragging(true);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    gesture.current = {
      startX: e.clientX,
      startY: e.clientY,
      startView: view,
      pinchDist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && g.pinchDist) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      g.moved = true;
      setView(zoomAt(mid.x, mid.y, (g.startView.scale * dist) / g.pinchDist, g.startView));
      return;
    }
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (Math.hypot(dx, dy) > 6) g.moved = true;
    if (g.startView.scale > 1) setView(bound({ ...g.startView, x: g.startView.x + dx, y: g.startView.y + dy }));
    else setSwipe({ dx, dy: Math.max(0, dy), active: true });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (pointers.current.size > 0) {
      // One finger lifted from a pinch: continue as a pan from here.
      const [p] = [...pointers.current.values()];
      gesture.current = { startX: p.x, startY: p.y, startView: view, moved: true };
      return;
    }
    gesture.current = null;
    setDragging(false);
    if (swipe.active) {
      const { dx, dy } = swipe;
      setSwipe({ dx: 0, dy: 0, active: false });
      if (dy > 120 && Math.abs(dy) > Math.abs(dx)) return onClose();
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) return go(dx < 0 ? 1 : -1);
    }
    if (!g.moved) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        lastTap.current = 0;
        setView(view.scale > 1 ? { scale: 1, x: 0, y: 0 } : zoomAt(e.clientX, e.clientY, 2.5));
      } else {
        lastTap.current = now;
        const t = now;
        setTimeout(() => lastTap.current === t && setChrome((c) => !c), 300);
      }
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    // Trackpad pinch arrives as ctrl+wheel; a plain wheel zooms only when already zoomed.
    if (!e.ctrlKey && view.scale === 1) return;
    setView(zoomAt(e.clientX, e.clientY, view.scale * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002))));
  };

  if (!photo) return null;
  const fade = swipe.active ? Math.max(0.35, 1 - swipe.dy / 400) : 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.title || "Photo"}
      className="fixed inset-0 z-50 flex flex-col bg-black select-none"
      style={{ backgroundColor: `rgba(0,0,0,${fade})` }}
    >
      <div
        ref={stage}
        className="relative flex-1 touch-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        style={{ cursor: view.scale > 1 ? "grab" : "zoom-in" }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center p-0 sm:p-10"
          style={{
            transform: swipe.active
              ? `translate(${swipe.dx}px, ${swipe.dy}px) scale(${1 - swipe.dy / 1500})`
              : `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transition: swipe.active || dragging ? "none" : "transform 300ms var(--ease-gallery)",
          }}
        >
          {/* The medium copy (already cached from the grid) shows underneath while the large one loads. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={photo.id}
            src={photo.large}
            alt={photo.title}
            width={photo.width}
            height={photo.height}
            draggable={false}
            className="block h-auto max-h-full w-auto max-w-full"
            style={{ backgroundImage: `url("${photo.medium}")`, backgroundSize: "100% 100%", backgroundColor: photo.color ?? undefined }}
          />
        </div>
      </div>

      <div className={`pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))] transition-opacity duration-300 sm:p-5 ${chrome ? "opacity-100" : "opacity-0"}`}>
        <span className="eyebrow pl-2 text-paper/70">{index + 1} / {photos.length}</span>
        <button onClick={onClose} aria-label="Close" className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-black/40 text-paper backdrop-blur hover:bg-black/70">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      {index > 0 && (
        <button onClick={() => go(-1)} aria-label="Previous photo" className={`absolute top-1/2 left-4 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-paper backdrop-blur transition-opacity hover:bg-black/70 sm:grid ${chrome ? "opacity-100" : "opacity-0"}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
      )}
      {index < photos.length - 1 && (
        <button onClick={() => go(1)} aria-label="Next photo" className={`absolute top-1/2 right-4 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-paper backdrop-blur transition-opacity hover:bg-black/70 sm:grid ${chrome ? "opacity-100" : "opacity-0"}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      )}

      {(photo.title || photo.description || photo.camera) && (
        <div className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pt-16 pb-[max(1.25rem,env(safe-area-inset-bottom))] transition-opacity duration-300 sm:px-10 ${chrome && view.scale === 1 ? "opacity-100" : "opacity-0"}`}>
          {photo.title && <p className="font-display text-2xl sm:text-3xl">{photo.title}</p>}
          {photo.description && <p className="mt-1 max-w-2xl text-sm text-paper/80">{photo.description}</p>}
          {photo.camera && <p className="eyebrow mt-2 text-paper/50">{photo.camera}</p>}
        </div>
      )}
    </div>
  );
}
