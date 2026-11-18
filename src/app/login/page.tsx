import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isOwner } from "@/lib/auth/session";
import { site } from "@/lib/site";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/studio") ? next : "/studio";
  if (await isOwner()) redirect(target);

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="animate-rise flex w-full max-w-sm flex-col items-center text-center">
        <Link href="/" className="eyebrow hover:text-brass">{site.name}</Link>
        <h1 className="mt-6 font-display text-5xl font-light">The Studio</h1>
        <p className="mt-3 text-sm text-mute">Your private space for uploading and arranging work.</p>
        <LoginForm next={target} />
      </div>
    </main>
  );
}
