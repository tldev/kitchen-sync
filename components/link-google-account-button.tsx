"use client";

import { useTransition } from "react";
import { signIn } from "next-auth/react";

import type { ButtonHTMLAttributes } from "react";

type LinkGoogleAccountButtonProps = {
  label?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function LinkGoogleAccountButton({
  label = "Link another Google account",
  className = "",
  ...props
}: LinkGoogleAccountButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(() => {
          void signIn("google", {
            callbackUrl: "/",
            prompt: "consent",
            access_type: "offline"
          });
        })
      }
      className={`inline-flex items-center gap-2 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-400/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      disabled={isPending}
      {...props}
    >
      {isPending ? "Redirecting…" : label}
    </button>
  );
}
