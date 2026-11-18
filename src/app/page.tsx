import Link from "next/link";
import { site } from "@/lib/site";

/** Public front door. The full portfolio arrives in step 2 of the plan. */
export default function Home() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_40%,#2a241c_0%,transparent_70%)]" />
      <div className="relative flex flex-col items-center text-center">
        <div className="animate-rise relative mb-12 aspect-[4/5] w-48 border border-brass/60 p-3 shadow-[0_40px_80px_-30px_rgba(0,0,0,.9)] sm:w-56">
          <div className="h-full w-full bg-[linear-gradient(160deg,#3a3127_0%,#1b1814_55%,#0f0e0c_100%)] p-5">
            <div className="h-full w-full border border-paper/10" />
          </div>
        </div>
        <p className="eyebrow animate-rise [animation-delay:120ms]">{site.tagline}</p>
        <h1 className="animate-rise mt-4 font-display text-5xl font-light tracking-tight [animation-delay:200ms] sm:text-7xl">
          {site.name}
        </h1>
        <p className="animate-rise mt-5 max-w-sm text-mute [animation-delay:280ms]">
          {site.description} The gallery is being hung. Please come back soon.
        </p>
        <Link href="/studio" className="animate-rise mt-12 text-xs tracking-[0.2em] text-faint uppercase transition-colors [animation-delay:360ms] hover:text-brass">
          Studio
        </Link>
      </div>
    </main>
  );
}
