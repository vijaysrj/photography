"use client";

import { useState, useTransition } from "react";

/** Tick boxes for which albums a photo is in, plus a quick "new album". */
export function AlbumPicker({
  albums,
  selected,
  onToggle,
  onCreate,
}: {
  albums: { id: string; title: string }[];
  selected: string[];
  onToggle: (albumId: string, on: boolean) => Promise<void>;
  onCreate: (form: FormData) => Promise<void>;
}) {
  const [on, setOn] = useState(new Set(selected));
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <p className="eyebrow">Albums</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {albums.map((a) => {
          const checked = on.has(a.id);
          return (
            <li key={a.id}>
              <button
                type="button"
                aria-pressed={checked}
                disabled={pending}
                onClick={() => {
                  const next = new Set(on);
                  if (checked) next.delete(a.id);
                  else next.add(a.id);
                  setOn(next);
                  start(() => onToggle(a.id, !checked));
                }}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${checked ? "border-brass bg-brass/15 text-paper" : "border-line text-mute hover:text-paper"}`}
              >
                {checked ? "✓ " : ""}{a.title}
              </button>
            </li>
          );
        })}
        <li>
          {adding ? (
            <form
              action={async (f) => {
                await onCreate(f);
                setAdding(false);
              }}
              className="flex items-center gap-1"
            >
              <input name="title" autoFocus required placeholder="Album name" className="h-8 w-36 rounded-full border border-brass bg-ink-2 px-3 text-sm outline-none" />
              <input type="hidden" name="stay" value="1" />
              <button className="h-8 rounded-full bg-paper px-3 text-xs text-ink">Add</button>
            </form>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="rounded-full border border-dashed border-line px-3 py-1.5 text-sm text-mute hover:text-paper">
              + New album
            </button>
          )}
        </li>
      </ul>
    </div>
  );
}
