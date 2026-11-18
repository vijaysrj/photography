"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="mt-10 flex w-full flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="eyebrow" htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        className="h-12 rounded-xl border border-line bg-ink-2 px-4 text-base text-paper outline-none transition-colors placeholder:text-faint focus:border-brass"
        placeholder="••••••••••"
      />
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn mt-2 bg-paper text-ink hover:bg-brass-2">
        {pending ? "Opening…" : "Open the studio"}
      </button>
    </form>
  );
}
