"use client";

import { useRef } from "react";
import { dragCorner, moveCrop, type Corner } from "@/lib/edit/crop";
import type { CropRect } from "@/lib/edit/types";

/** Draggable crop box with rule-of-thirds guides, drawn over the preview. */
export function CropOverlay({
  crop,
  ratio,
  frameRatio,
  onChange,
}: {
  crop: CropRect;
  ratio: number | null;
  frameRatio: number;
  onChange: (c: CropRect) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | Corner; x: number; y: number; start: CropRect } | null>(null);

  const toFrac = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const down = (mode: "move" | Corner, e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = toFrac(e);
    drag.current = { mode, x: p.x, y: p.y, start: crop };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toFrac(e);
    onChange(d.mode === "move" ? moveCrop(d.start, p.x - d.x, p.y - d.y) : dragCorner(d.start, d.mode, p.x, p.y, ratio, frameRatio));
  };
  const up = () => (drag.current = null);

  const handle = (c: Corner, cls: string) => (
    <div
      onPointerDown={(e) => down(c, e)}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      data-testid={`crop-${c}`}
      className={`absolute h-8 w-8 touch-none ${cls}`}
      style={{ cursor: c === "nw" || c === "se" ? "nwse-resize" : "nesw-resize" }}
    >
      <span className={`absolute h-5 w-5 border-paper ${c.includes("n") ? "-top-px border-t-[3px]" : "-bottom-px border-b-[3px]"} ${c.includes("w") ? "-left-px border-l-[3px]" : "-right-px border-r-[3px]"}`} />
    </div>
  );

  return (
    <div ref={box} className="absolute inset-0 overflow-hidden">
      <div
        data-testid="crop-box"
        className="absolute touch-none border border-paper/80"
        onPointerDown={(e) => down("move", e)}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{
          left: `${crop.x * 100}%`,
          top: `${crop.y * 100}%`,
          width: `${crop.w * 100}%`,
          height: `${crop.h * 100}%`,
          boxShadow: "0 0 0 9999px rgba(10,9,8,.62)",
          cursor: "move",
        }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 left-1/3 w-px bg-paper/30" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-paper/30" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-paper/30" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-paper/30" />
        </div>
        {handle("nw", "top-0 left-0")}
        {handle("ne", "top-0 right-0")}
        {handle("sw", "bottom-0 left-0")}
        {handle("se", "right-0 bottom-0")}
      </div>
    </div>
  );
}
