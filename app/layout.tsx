import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CalendarSync Automations",
  description: "Manage Google calendar sync automations"
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
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
              <span className="rounded-full border border-emerald-400/40 px-4 py-1 text-xs font-medium text-emerald-300">
                V1 Scaffold
              </span>
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
