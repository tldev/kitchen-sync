"use client";

import { useTransition } from "react";
import { signOut } from "next-auth/react";

type SignOutButtonProps = {
  className?: string;
};

export default function SignOutButton({ className }: SignOutButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(() => {
          void signOut({ callbackUrl: "/signin" });
        })
      }
      className={`inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-400/80 hover:text-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ""}`}
      disabled={isPending}
    >
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
