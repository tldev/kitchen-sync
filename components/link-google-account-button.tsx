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
      className={`inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      disabled={isPending}
      {...props}
    >
      {isPending ? "Redirecting…" : label}
    </button>
  );
}
