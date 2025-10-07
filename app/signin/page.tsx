import { redirect } from "next/navigation";
import SignInButton from "@/components/sign-in-button";
import { getAuthSession } from "@/lib/auth";

export const metadata = {
  title: "Sign in | CalendarSync Automations"
};

export default async function SignInPage() {
  const session = await getAuthSession();

  if (session) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-8 text-center">
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold text-emerald-300">Access Kitchen Sync</h2>
        <p className="text-sm text-slate-300">
          Sign in with your Google account to manage CalendarSync automation jobs. Authentication is required to protect your
          schedules and connected calendars.
        </p>
      </div>
      <SignInButton className="px-6 py-2.5" />
      <p className="text-xs text-slate-500">
        By continuing you agree to securely share your Google profile information for session management.
      </p>
    </div>
  );
}
