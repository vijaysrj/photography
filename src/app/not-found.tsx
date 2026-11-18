import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="eyebrow">404</p>
        <h1 className="mt-3 font-display text-5xl font-light">Nothing hangs here</h1>
        <Link href="/" className="btn mt-8 border border-line hover:border-brass">Back to the gallery</Link>
      </div>
    </main>
  );
}
