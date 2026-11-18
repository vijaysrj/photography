"use client";

import { useState, useSyncExternalStore, useTransition } from "react";

const noop = () => () => {};
import type { Visibility } from "@/lib/db/schema";

const OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: "private", label: "Private", hint: "Only you, in the studio." },
  { value: "unlisted", label: "Link only", hint: "Anyone with the link. Not listed on your site or in search." },
  { value: "public", label: "Public", hint: "Shown on your site for everyone." },
];

/** Private / Link only / Public switch, plus the link to copy or share. */
export function ShareControls({
  visibility,
  path,
  onChange,
  onResetLink,
  noun = "photo",
}: {
  visibility: Visibility;
  path: string | null;
  onChange: (v: Visibility) => Promise<void>;
  onResetLink?: () => Promise<void>;
  noun?: string;
}) {
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState(visibility);
  const [shownFor, setShownFor] = useState(visibility);
  if (shownFor !== visibility) {
    setShownFor(visibility);
    setOptimistic(visibility);
  }
  const hint = OPTIONS.find((o) => o.value === optimistic)!.hint;

  return (
    <div>
      <p className="eyebrow">Who can see this {noun}</p>
      <div role="radiogroup" aria-label="Visibility" className="mt-3 grid grid-cols-3 rounded-full border border-line bg-ink-2 p-1">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={optimistic === o.value}
            disabled={pending}
            onClick={() => {
              setOptimistic(o.value);
              start(() => onChange(o.value));
            }}
            className={`h-9 rounded-full text-sm transition-colors duration-300 ${optimistic === o.value ? "bg-paper text-ink" : "text-mute hover:text-paper"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 flex justify-between gap-3 text-xs text-faint">
        <span>{hint}</span>
        <span aria-live="polite" className="shrink-0">{pending ? "Saving…" : ""}</span>
      </p>
      {optimistic !== "private" && path && !pending && <ShareLink path={path} onReset={optimistic === "unlisted" ? onResetLink : undefined} />}
    </div>
  );
}

export function ShareLink({ path, onReset }: { path: string; onReset?: () => Promise<void> }) {
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, start] = useTransition();
  // Read the browser's address only after hydration, so server and browser HTML match.
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const canShare = useSyncExternalStore(noop, () => "share" in navigator, () => false);
  const url = origin + path;

  return (
    <div className="mt-4 rounded-xl border border-line bg-ink-2 p-3">
      <div className="flex items-center gap-2">
        <input readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 truncate bg-transparent text-sm text-paper/90 outline-none" data-testid="share-url" />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(url).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="shrink-0 rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-brass-2"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        {canShare && (
          <button type="button" onClick={() => navigator.share({ url }).catch(() => {})} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs hover:border-brass">
            Share
          </button>
        )}
      </div>
      {onReset && (
        <div className="mt-2 text-xs text-faint">
          {confirmReset ? (
            <span>
              The old link will stop working.{" "}
              <button type="button" disabled={pending} onClick={() => start(async () => { await onReset(); setConfirmReset(false); })} className="text-danger hover:underline">
                Make a new link
              </button>{" "}
              · <button type="button" onClick={() => setConfirmReset(false)} className="hover:text-paper">Keep</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmReset(true)} className="hover:text-paper">Shared with the wrong person? Make a new link</button>
          )}
        </div>
      )}
    </div>
  );
}
