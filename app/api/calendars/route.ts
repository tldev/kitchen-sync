import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
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
