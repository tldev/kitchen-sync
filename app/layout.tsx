import "@/lib/scheduler";
import { initializeObservability } from "@/lib/observability";
import Image from "next/image";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getAuthSession } from "@/lib/auth";
import SignInButton from "@/components/sign-in-button";
import SignOutButton from "@/components/sign-out-button";
import "./globals.css";

// Initialize observability on server startup
if (typeof window === "undefined") {
  initializeObservability();
}

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
      <body className="bg-gray-50 text-gray-900">
        <div className="min-h-screen">
          <header className="border-b border-gray-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <h1 className="text-xl font-semibold text-gray-900">Kitchen Sync</h1>
              <div className="flex items-center gap-3">
                {user ? (
                  <div className="flex items-center gap-3">
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={user.name ?? user.email ?? "Authenticated user"}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full border border-gray-300"
                        priority
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-gray-100 text-sm font-semibold text-gray-700">
                        {userInitials}
                      </div>
                    )}
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-medium text-gray-900">
                        {user.name ?? user.email}
                      </p>
                      {user.email ? (
                        <p className="text-xs text-gray-500">{user.email}</p>
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
        </div>
      </body>
    </html>
  );
}
