"use client";

import { useTransition } from "react";
import { signIn } from "next-auth/react";

type SignInButtonProps = {
  className?: string;
};

export default function SignInButton({ className }: SignInButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(() => {
          void signIn("google", { callbackUrl: "/" });
        })
      }
      className={`inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ""}`}
      disabled={isPending}
    >
      <svg
        aria-hidden
        className="h-4 w-4"
        viewBox="0 0 533.5 544.3"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M533.5 278.4c0-17.4-1.5-34.1-4.4-50.3H272v95.2h147.6c-6.4 34.6-26.1 63.8-55.6 83.5v69.4h89.7c52.6-48.5 80.8-120 80.8-197.8z"
          fill="#4285f4"
        />
        <path
          d="M272 544.3c73.7 0 135.6-24.4 180.8-66.1l-89.7-69.4c-24.9 16.7-56.8 26.5-91.1 26.5-69.9 0-129-47.2-150.1-110.7H29.3v69.9C74.4 487.7 167.5 544.3 272 544.3z"
          fill="#34a853"
        />
        <path
          d="M121.9 324.6c-4.7-14.1-7.4-29.1-7.4-44.6s2.7-30.5 7.4-44.6V165.5h-92.6C10.6 207.6 0 251.7 0 300c0 48.3 10.6 92.4 29.3 134.5l92.6-71.7z"
          fill="#fbbc05"
        />
        <path
          d="M272 107.7c40.1 0 76 13.8 104.3 40.9l78.1-78.1C407.5 24.5 345.6 0 272 0 167.5 0 74.4 56.6 29.3 165.5l92.6 69.9C143 154.9 202.1 107.7 272 107.7z"
          fill="#ea4335"
        />
      </svg>
      {isPending ? "Redirecting…" : "Sign in with Google"}
    </button>
  );
}
