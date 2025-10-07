import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { discoverCalendarsForAccount } from "@/lib/google/calendars";

export async function POST(
  request: Request,
  { params }: { params: { accountId: string } }
) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId } = params;

  if (!accountId) {
    return NextResponse.json({ error: "Account ID is required" }, { status: 400 });
  }

  try {
    const result = await discoverCalendarsForAccount(session.user.id, accountId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while discovering calendars.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

