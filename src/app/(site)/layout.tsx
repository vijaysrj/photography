import Link from "next/link";
import { site } from "@/lib/site";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="absolute inset-x-0 top-0 z-20 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-10">
          <Link href="/" className="font-display text-2xl tracking-tight">{site.name}</Link>
          <nav className="flex gap-5 text-sm text-mute">
            <Link href="/#work" className="transition-colors hover:text-paper">Work</Link>
            <Link href="/#albums" className="transition-colors hover:text-paper">Albums</Link>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-line/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-10 text-xs text-faint sm:flex-row sm:justify-between sm:px-10">
          <span>© {new Date().getFullYear()} {site.name}. All photographs are the property of the photographer.</span>
          <Link href="/studio" className="tracking-[0.2em] uppercase hover:text-brass">Studio</Link>
        </div>
      </footer>
    </div>
  );
}
