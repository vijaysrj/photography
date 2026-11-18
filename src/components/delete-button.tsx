"use client";

import { useState, useTransition } from "react";

export function DeleteButton({ action }: { action: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className="btn border border-line text-mute hover:border-danger hover:text-danger">
        Delete
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => action())}
        className="btn bg-danger text-ink hover:opacity-90"
      >
        {pending ? "Deleting…" : "Delete forever"}
      </button>
      <button type="button" onClick={() => setArmed(false)} className="btn text-mute hover:text-paper">Keep</button>
    </div>
  );
}
