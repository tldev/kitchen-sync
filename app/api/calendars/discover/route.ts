import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { discoverCalendarsForUser } from "@/lib/google/calendars";

export async function POST() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await discoverCalendarsForUser(session.user.id);
    return NextResponse.json({ results });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while discovering calendars.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
