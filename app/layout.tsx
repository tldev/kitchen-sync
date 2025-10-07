import Image from "next/image";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getAuthSession } from "@/lib/auth";
import SignInButton from "@/components/sign-in-button";
import SignOutButton from "@/components/sign-out-button";
import "./globals.css";

export const metadata: Metadata = {
  title: "CalendarSync Automations",
  description: "Manage Google calendar sync automations"
};

export default async function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  const session = await getAuthSession();
  const user = session?.user;
  const fallbackLabel = user?.name ?? user?.email ?? "?";
  const userInitials = fallbackLabel
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "?";

  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100">
        <div className="min-h-screen">
          <header className="border-b border-slate-800 bg-slate-950/60 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <div className="flex flex-col">
                <span className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
                  CalendarSync Automation
                </span>
                <h1 className="text-xl font-bold">Kitchen Sync Dashboard</h1>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-emerald-400/40 px-4 py-1 text-xs font-medium text-emerald-300">
                  V1 Scaffold
                </span>
                {user ? (
                  <div className="flex items-center gap-3">
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={user.name ?? user.email ?? "Authenticated user"}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full border border-emerald-500/40"
                        priority
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-sm font-semibold text-emerald-200">
                        {userInitials}
                      </div>
                    )}
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-medium text-emerald-200">
                        {user.name ?? user.email}
                      </p>
                      {user.email ? (
                        <p className="text-xs text-slate-400">{user.email}</p>
                      ) : null}
                    </div>
                    <SignOutButton />
                  </div>
                ) : (
                  <SignInButton />
                )}
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-6 py-12">{children}</main>
          <footer className="border-t border-slate-800 bg-slate-950/60 py-6">
            <div className="mx-auto max-w-5xl px-6 text-sm text-slate-400">
              Crafted for CalendarSync orchestration pilots.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
