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
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-6 text-center">
      <h2 className="text-2xl font-semibold text-gray-900">Sign In</h2>
      <SignInButton className="px-6 py-2.5" />
    </div>
  );
}
