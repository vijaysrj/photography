"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PRESETS, presetAdjustments } from "@/lib/edit/presets";
import { ASPECTS, aspectRatio, fitAspect, flipAspect } from "@/lib/edit/crop";
import { downscale, fitSize, loadBitmap, renderEdited, rotatedSize } from "@/lib/edit/render";
import { saveEdits } from "@/lib/edit/save";
import { ZERO, emptyEdits, isIdentity, type Adjustments, type Edits, type Geometry } from "@/lib/edit/types";
import { CropOverlay } from "./crop-overlay";
import { Slider } from "./slider";

type Props = {
  photoId: string;
  title: string;
  initial: Edits | null;
  /** Unedited 2560px copy: fast to load, used for the live preview. */
  previewUrl: string;
  /** The untouched original, used when saving for best quality. */
  originalUrl: string;
};

type Tab = "presets" | "light" | "colour" | "crop";
type Source = { canvas: HTMLCanvasElement; w: number; h: number };

const PREVIEW_EDGE = 1600;
const LIGHT: [keyof Adjustments, string, number?][] = [
  ["exposure", "Exposure"],
  ["contrast", "Contrast"],
  ["highlights", "Highlights"],
  ["shadows", "Shadows"],
  ["fade", "Fade", 0],
  ["vignette", "Vignette"],
];
const COLOUR: [keyof Adjustments, string][] = [
  ["warmth", "Warmth"],
  ["tint", "Tint"],
  ["saturation", "Saturation"],
  ["vibrance", "Vibrance"],
];

export function Editor({ photoId, title, initial, previewUrl, originalUrl }: Props) {
  const router = useRouter();
  const [edits, setEdits] = useState<Edits>(() => initial ?? emptyEdits());
  const [tab, setTab] = useState<Tab>("presets");
  const [before, setBefore] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const view = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const dirty = useMemo(() => JSON.stringify(edits) !== JSON.stringify(initial ?? emptyEdits()), [edits, initial]);

  // Load the unedited preview copy once.
  useEffect(() => {
    const ac = new AbortController();
    loadBitmap(previewUrl, ac.signal)
      .then((bmp) => {
        const { w, h } = fitSize(bmp.width, bmp.height, PREVIEW_EDGE);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d")!;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bmp, 0, 0, w, h);
        bmp.close();
        setSource({ canvas: c, w, h });
      })
      .catch((e) => !ac.signal.aborted && setError(e instanceof Error ? e.message : "Couldn't open this photo"));
    return () => ac.abort();
  }, [previewUrl]);

  // Track the space available for the preview.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draw the preview whenever anything changes (once per frame at most).
  useEffect(() => {
    if (!source || !view.current) return;
    const id = requestAnimationFrame(() => {
      const out = before
        ? renderEdited(source.canvas, source.w, source.h, emptyEdits())
        : renderEdited(source.canvas, source.w, source.h, edits, { ignoreCrop: tab === "crop" });
      const v = view.current!;
      v.width = out.width;
      v.height = out.height;
      v.getContext("2d")!.drawImage(out, 0, 0);
    });
    return () => cancelAnimationFrame(id);
  }, [source, edits, tab, before]);

  // Little previews of each preset, with the current crop and rotation.
  const geometryKey = JSON.stringify(edits.geometry);
  useEffect(() => {
    if (!source) return;
    const id = setTimeout(() => {
      const small = downscale(source.canvas, 220);
      const next: Record<string, string> = {};
      const g: Geometry = JSON.parse(geometryKey);
      const base = { ...emptyEdits(), geometry: g };
      next.none = renderEdited(small, small.width, small.height, base, { longEdge: 160 }).toDataURL("image/jpeg", 0.8);
      for (const p of PRESETS) {
        next[p.id] = renderEdited(small, small.width, small.height, { ...base, mono: !!p.mono, adjust: presetAdjustments(p) }, { longEdge: 160 }).toDataURL("image/jpeg", 0.8);
      }
      setThumbs(next);
    }, 120);
    return () => clearTimeout(id);
  }, [source, geometryKey]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  const setAdjust = (k: keyof Adjustments, v: number) => setEdits((e) => ({ ...e, preset: e.preset ? `${e.preset}*` : null, adjust: { ...e.adjust, [k]: v } }));
  const setGeometry = (g: Partial<Geometry>) => setEdits((e) => ({ ...e, geometry: { ...e.geometry, ...g } }));

  const frame = source ? rotatedSize(source.w, source.h, edits.geometry.rotate) : { w: 3, h: 2 };
  const frameRatio = frame.w / frame.h;
  const ratio = aspectRatio(edits.geometry.aspect, frameRatio);

  const chooseAspect = (id: string) => setGeometry({ aspect: id, crop: fitAspect(id === "free" ? edits.geometry.crop : { x: 0, y: 0, w: 1, h: 1 }, aspectRatio(id, frameRatio), frameRatio) });
  const rotate = () => setGeometry({ rotate: (((edits.geometry.rotate + 270) % 360) as Geometry["rotate"]), crop: { x: 0, y: 0, w: 1, h: 1 }, aspect: "free" });

  // Size the preview canvas to fit the stage.
  const shown = source ? (tab === "crop" && !before ? frame : before ? { w: source.w, h: source.h } : { w: frame.w * edits.geometry.crop.w, h: frame.h * edits.geometry.crop.h }) : null;
  const scale = shown && box.w ? Math.min(box.w / shown.w, box.h / shown.h) : 0;

  const save = useCallback(async () => {
    setError(null);
    try {
      await saveEdits({ photoId, edits, originalUrl, fallbackUrl: previewUrl, onStatus: setSaving });
      router.push(`/studio/photos/${photoId}`);
      router.refresh();
    } catch (e) {
      setSaving(null);
      setError(e instanceof Error ? e.message : "Couldn't save");
    }
  }, [edits, originalUrl, previewUrl, photoId, router]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink lg:flex-row" data-testid="editor">
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line/70 px-3 pt-[env(safe-area-inset-top)] sm:px-5">
          <Link href={`/studio/photos/${photoId}`} className="rounded-full px-3 py-2 text-sm text-mute hover:text-paper">Cancel</Link>
          <p className="truncate font-display text-xl">{title || "Edit"}</p>
          <button type="button" onClick={save} disabled={!source || !!saving || !dirty} className="btn min-h-9 bg-paper px-4 text-ink hover:bg-brass-2">
            {saving ? "Saving…" : "Save"}
          </button>
        </header>

        <div ref={stage} className="relative m-3 min-h-0 flex-1 sm:m-6">
          {!source && !error && <p className="absolute inset-0 grid place-items-center text-sm text-mute">Opening photo…</p>}
          {shown && scale > 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: shown.w * scale, height: shown.h * scale }}>
              <canvas ref={view} data-testid="preview" className="block h-full w-full shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)]" />
              {tab === "crop" && !before && <CropOverlay crop={edits.geometry.crop} ratio={ratio} frameRatio={frameRatio} onChange={(crop) => setGeometry({ crop })} />}
            </div>
          )}
          {!(shown && scale > 0) && <canvas ref={view} className="hidden" />}
          {saving && (
            <div className="absolute inset-0 grid place-items-center bg-ink/70 backdrop-blur-sm">
              <p className="animate-pulse text-sm text-paper" role="status">{saving}</p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-center gap-2 pb-2">
          <button
            type="button"
            onPointerDown={() => setBefore(true)}
            onPointerUp={() => setBefore(false)}
            onPointerLeave={() => setBefore(false)}
            onKeyDown={(e) => e.key === " " && setBefore(true)}
            onKeyUp={() => setBefore(false)}
            className={`rounded-full border px-4 py-1.5 text-xs select-none ${before ? "border-brass text-brass" : "border-line text-mute hover:text-paper"}`}
          >
            Hold to compare
          </button>
          <button type="button" onClick={() => setEdits(emptyEdits())} disabled={isIdentity(edits)} className="rounded-full border border-line px-4 py-1.5 text-xs text-mute hover:text-paper disabled:opacity-40">
            Reset all
          </button>
        </div>
        {error && <p role="alert" className="px-4 pb-2 text-center text-sm text-danger">{error}</p>}
      </div>

      <aside className="flex max-h-[44dvh] shrink-0 flex-col border-t border-line bg-ink-2 pb-[env(safe-area-inset-bottom)] lg:max-h-none lg:w-[340px] lg:border-t-0 lg:border-l">
        <nav role="tablist" className="grid shrink-0 grid-cols-4 border-b border-line">
          {(["presets", "light", "colour", "crop"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`h-12 text-sm capitalize transition-colors ${tab === t ? "text-paper shadow-[inset_0_-2px_0_var(--color-brass)]" : "text-mute hover:text-paper"}`}
            >
              {t === "colour" ? "Colour" : t}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-5">
          {tab === "presets" && (
            <ul className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-3 lg:overflow-visible">
              {[{ id: "none", name: "Original" }, ...PRESETS].map((p) => {
                const active = p.id === "none" ? !edits.preset && Object.values(edits.adjust).every((v) => v === 0) && !edits.mono : edits.preset?.replace(/\*$/, "") === p.id;
                return (
                  <li key={p.id} className="w-20 shrink-0 lg:w-auto">
                    <button
                      type="button"
                      onClick={() =>
                        setEdits((e) =>
                          p.id === "none"
                            ? { ...e, preset: null, mono: false, adjust: { ...ZERO } }
                            : { ...e, preset: p.id, mono: !!PRESETS.find((x) => x.id === p.id)!.mono, adjust: presetAdjustments(PRESETS.find((x) => x.id === p.id)!) },
                        )
                      }
                      className="group w-full text-center"
                      aria-pressed={active}
                    >
                      <span className={`block aspect-square overflow-hidden rounded-md bg-ink-3 ring-2 transition ${active ? "ring-brass" : "ring-transparent group-hover:ring-line"}`}>
                        {thumbs[p.id] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumbs[p.id]} alt="" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span className={`mt-1.5 block text-xs ${active ? "text-paper" : "text-mute"}`}>{p.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {tab === "light" && (
            <div className="grid gap-5">
              {LIGHT.map(([k, label, min]) => (
                <Slider key={k} label={label} value={edits.adjust[k]} min={min ?? -100} onChange={(v) => setAdjust(k, v)} />
              ))}
            </div>
          )}

          {tab === "colour" && (
            <div className="grid gap-5">
              {COLOUR.map(([k, label]) => (
                <Slider key={k} label={label} value={edits.adjust[k]} onChange={(v) => setAdjust(k, v)} />
              ))}
              <label className="flex items-center justify-between text-sm">
                <span className="text-mute">Black and white</span>
                <input type="checkbox" checked={edits.mono} onChange={(e) => setEdits((x) => ({ ...x, mono: e.target.checked }))} className="h-5 w-5 accent-[var(--color-brass)]" />
              </label>
            </div>
          )}

          {tab === "crop" && (
            <div className="grid gap-5">
              <div>
                <p className="eyebrow">Shape</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ASPECTS.map((a) => {
                    const on = edits.geometry.aspect === a.id || flipAspect(edits.geometry.aspect) === a.id;
                    return (
                      <button key={a.id} type="button" onClick={() => chooseAspect(a.id)} className={`rounded-full border px-3 py-1.5 text-xs ${on ? "border-brass bg-brass/15 text-paper" : "border-line text-mute hover:text-paper"}`}>
                        {a.label}
                      </button>
                    );
                  })}
                  {flipAspect(edits.geometry.aspect) !== edits.geometry.aspect && (
                    <button type="button" onClick={() => chooseAspect(flipAspect(edits.geometry.aspect))} className="rounded-full border border-line px-3 py-1.5 text-xs text-mute hover:text-paper" title="Switch between portrait and landscape">
                      ⇄ {edits.geometry.aspect}
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-faint">5:7, 2:3, 4:5 and 3:4 match common print and frame sizes.</p>
              </div>
              <Slider label="Straighten" value={edits.geometry.straighten} min={-45} max={45} step={0.1} unit="°" onChange={(v) => setGeometry({ straighten: v })} />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={rotate} className="rounded-full border border-line px-4 py-2 text-sm hover:border-brass">Rotate ⟲</button>
                <button type="button" onClick={() => setGeometry({ flipH: !edits.geometry.flipH })} className="rounded-full border border-line px-4 py-2 text-sm hover:border-brass">Flip ⇋</button>
                <button type="button" onClick={() => setGeometry({ crop: { x: 0, y: 0, w: 1, h: 1 }, aspect: "free", straighten: 0 })} className="rounded-full border border-line px-4 py-2 text-sm text-mute hover:text-paper">Reset crop</button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
