import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { fetchLiveCalendarsForUser } from "@/lib/google/calendars";
import { prisma } from "@/lib/prisma";

const SAFE_ACCOUNT_FIELDS = {
  id: true,
  provider: true,
  providerAccountId: true,
  type: true,
  createdAt: true,
  updatedAt: true
} as const;

export async function GET() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch calendars directly from Google's API for up-to-date data
    const liveCalendars = await fetchLiveCalendarsForUser(session.user.id);
    
    // Format to match expected structure with account information
    const calendars = liveCalendars.map(cal => ({
      id: cal.id,
      googleCalendarId: cal.googleCalendarId,
      summary: cal.summary,
      timeZone: cal.timeZone,
      description: cal.description,
      color: cal.color,
      accessRole: cal.accessRole,
      accountId: cal.accountId,
      account: {
        id: cal.accountId,
        providerAccountId: cal.providerAccountId,
        provider: "google",
        type: "oauth"
      }
    }));

    return NextResponse.json(calendars.sort((a, b) => a.summary.localeCompare(b.summary)));
  } catch (error) {
    console.error("Failed to fetch live calendars:", error);
    // Fallback to database if Google API fails
    const calendars = await prisma.calendar.findMany({
      where: {
        account: {
          userId: session.user.id
        }
      },
      orderBy: {
        summary: "asc"
      },
      include: {
        account: {
          select: SAFE_ACCOUNT_FIELDS
        }
      }
    });

    return NextResponse.json(calendars);
  }
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    accountId,
    googleCalendarId,
    summary,
    timeZone,
    description,
    color,
    accessRole
  } = body ?? {};

  if (!accountId || !googleCalendarId || !summary || !timeZone) {
    return NextResponse.json(
      {
        error:
          "Missing required fields. Provide accountId, googleCalendarId, summary, and timeZone."
      },
      { status: 400 }
    );
  }

  const account = await prisma.account.findFirst({
    where: {
      id: accountId,
      userId: session.user.id
    },
    select: {
      id: true
    }
  });

  if (!account) {
    return NextResponse.json(
      { error: "Account not found or access denied." },
      { status: 404 }
    );
  }

  const calendar = await prisma.calendar.upsert({
    where: {
      accountId_googleCalendarId: {
        accountId,
        googleCalendarId
      }
    },
    update: {
      summary,
      timeZone,
      description,
      color,
      accessRole
    },
    create: {
      accountId,
      googleCalendarId,
      summary,
      timeZone,
      description,
      color,
      accessRole
    },
    include: {
      account: {
        select: SAFE_ACCOUNT_FIELDS
      }
    }
  });

  const status = calendar.createdAt.getTime() === calendar.updatedAt.getTime() ? 201 : 200;

  return NextResponse.json(calendar, { status });
}
