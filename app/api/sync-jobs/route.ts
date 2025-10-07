import { NextResponse } from "next/server";
import { SyncJobCadence, SyncJobStatus } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateConfigPayload } from "@/lib/sync-job-transformers";

type CreateSyncJobPayload = {
  name?: string;
  sourceCalendarId?: string;
  destinationCalendarId?: string;
  cadence?: SyncJobCadence;
  status?: SyncJobStatus;
  config?: unknown;
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

  const sanitizedConfigResult = validateConfigPayload(config ?? null);

  if (!sanitizedConfigResult.success) {
    return NextResponse.json(
      {
        error: `Invalid configuration provided: ${sanitizedConfigResult.errors.join(" ")}`,
      },
      { status: 400 }
    );
  }

  const sanitizedConfig = sanitizedConfigResult.config;
  const hasConfig =
    sanitizedConfig.transformers.length > 0 || sanitizedConfig.filters.length > 0;

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
      config: hasConfig ? sanitizedConfig : null
    },
    include: {
      sourceCalendar: true,
      destinationCalendar: true
    }
  });

  return NextResponse.json(job, { status: 201 });
}
