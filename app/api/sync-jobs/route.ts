import { NextResponse } from "next/server";
import { SyncJobCadence, SyncJobStatus } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CreateSyncJobPayload = {
  name?: string;
  sourceCalendarId?: string;
  destinationCalendarId?: string;
  cadence?: SyncJobCadence;
  status?: SyncJobStatus;
  config?: Record<string, unknown> | null;
};

function isValidCadence(value: unknown): value is SyncJobCadence {
  return (
    typeof value === "string" &&
    Object.values(SyncJobCadence).includes(value as SyncJobCadence)
  );
}

function isValidStatus(value: unknown): value is SyncJobStatus {
  return (
    typeof value === "string" &&
    Object.values(SyncJobStatus).includes(value as SyncJobStatus)
  );
}

export async function GET() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await prisma.syncJob.findMany({
    where: {
      ownerId: session.user.id
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      sourceCalendar: true,
      destinationCalendar: true
    }
  });

  return NextResponse.json(jobs);
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.json();
  const body = (rawBody ?? {}) as CreateSyncJobPayload;
  const {
    name,
    sourceCalendarId,
    destinationCalendarId,
    cadence,
    status,
    config
  } = body ?? {};

  if (!name || !sourceCalendarId || !destinationCalendarId) {
    return NextResponse.json(
      {
        error:
          "Missing required fields. Provide name, sourceCalendarId, and destinationCalendarId."
      },
      { status: 400 }
    );
  }

  if (!isValidCadence(cadence)) {
    return NextResponse.json(
      { error: "Invalid cadence provided." },
      { status: 400 }
    );
  }

  if (status && !isValidStatus(status)) {
    return NextResponse.json(
      { error: "Invalid status provided." },
      { status: 400 }
    );
  }

  const calendars = await prisma.calendar.findMany({
    where: {
      id: {
        in: [sourceCalendarId, destinationCalendarId]
      },
      account: {
        userId: session.user.id
      }
    },
    select: {
      id: true
    }
  });

  if (calendars.length !== 2) {
    return NextResponse.json(
      {
        error: "Source and destination calendars must belong to the authenticated user."
      },
      { status: 403 }
    );
  }

  const job = await prisma.syncJob.create({
    data: {
      ownerId: session.user.id,
      name,
      sourceCalendarId,
      destinationCalendarId,
      cadence,
      status: status ?? SyncJobStatus.ACTIVE,
      config: config ?? null
    },
    include: {
      sourceCalendar: true,
      destinationCalendar: true
    }
  });

  return NextResponse.json(job, { status: 201 });
}
