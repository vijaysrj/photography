"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { downloadEdited, saveEdits } from "@/lib/edit/save";
import type { Edits } from "@/lib/edit/types";

/** "Download edited" and "Back to original" on the studio photo page. */
export function EditActions({
  photoId,
  edits,
  originalUrl,
  fallbackUrl,
  fileName,
}: {
  photoId: string;
  edits: Edits;
  originalUrl: string;
  fallbackUrl: string;
  fileName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRevert, setConfirmRevert] = useState(false);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={!!busy} onClick={() => run("Preparing download…", () => downloadEdited({ edits, originalUrl, fallbackUrl, fileName }))} className="btn border border-line hover:border-brass">
          {busy === "Preparing download…" ? busy : "Download edited"}
        </button>
        {confirmRevert ? (
          <span className="flex items-center gap-2 text-sm">
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                run("Restoring…", async () => {
                  await saveEdits({ photoId, edits: null, originalUrl, fallbackUrl });
                  setConfirmRevert(false);
                  router.refresh();
                })
              }
              className="btn bg-paper text-ink hover:bg-brass-2"
            >
              {busy === "Restoring…" ? busy : "Undo all edits"}
            </button>
            <button type="button" onClick={() => setConfirmRevert(false)} className="text-mute hover:text-paper">Keep</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmRevert(true)} className="btn text-mute hover:text-paper">Back to original</button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
