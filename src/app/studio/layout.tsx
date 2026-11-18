import Link from "next/link";
import { requireOwner } from "@/lib/auth/session";
import { site } from "@/lib/site";
import { signOut } from "./actions";

export const metadata = { robots: { index: false } };

export default async function StudioLayout({ children }: LayoutProps<"/studio">) {
  await requireOwner();
  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-ink/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
          <Link href="/studio" className="flex items-baseline gap-3">
            <span className="font-display text-2xl leading-none">{site.shortName}</span>
            <span className="eyebrow">Studio</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/" className="rounded-full px-3 py-2 text-mute transition-colors hover:text-paper">View site</Link>
            <form action={signOut}>
              <button className="rounded-full px-3 py-2 text-mute transition-colors hover:text-paper">Sign out</button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
