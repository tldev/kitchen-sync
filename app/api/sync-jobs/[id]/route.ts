import { NextResponse } from "next/server";
import { SyncJobCadence, SyncJobStatus } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type UpdatePayload = {
  name?: string;
  sourceCalendarId?: string;
  destinationCalendarId?: string;
  cadence?: SyncJobCadence;
  status?: SyncJobStatus;
  config?: Record<string, unknown> | null;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
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

async function ensureJobOwner(jobId: string, userId: string) {
  const job = await prisma.syncJob.findFirst({
    where: {
      id: jobId,
      ownerId: userId
    },
    include: {
      sourceCalendar: true,
      destinationCalendar: true
    }
  });

  return job;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await ensureJobOwner(params.id, session.user.id);

  if (!job) {
    return NextResponse.json({ error: "Sync job not found." }, { status: 404 });
  }

  return NextResponse.json(job);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await ensureJobOwner(params.id, session.user.id);

  if (!job) {
    return NextResponse.json({ error: "Sync job not found." }, { status: 404 });
  }

  const rawBody = await request.json();
  const body = (rawBody ?? {}) as UpdatePayload;

  if (
    body.cadence !== undefined &&
    body.cadence !== null &&
    !isValidCadence(body.cadence)
  ) {
    return NextResponse.json(
      { error: "Invalid cadence provided." },
      { status: 400 }
    );
  }

  if (body.status !== undefined && body.status !== null && !isValidStatus(body.status)) {
    return NextResponse.json(
      { error: "Invalid status provided." },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    data.name = body.name;
  }
  if (body.cadence !== undefined) {
    data.cadence = body.cadence;
  }
  if (body.status !== undefined) {
    data.status = body.status;
  }
  if (body.config !== undefined) {
    data.config = body.config;
  }
  if (body.lastRunAt !== undefined) {
    data.lastRunAt = body.lastRunAt ? new Date(body.lastRunAt) : null;
  }
  if (body.nextRunAt !== undefined) {
    data.nextRunAt = body.nextRunAt ? new Date(body.nextRunAt) : null;
  }

  if (
    body.sourceCalendarId ||
    body.destinationCalendarId
  ) {
    const calendarIds = [
      body.sourceCalendarId ?? job.sourceCalendarId,
      body.destinationCalendarId ?? job.destinationCalendarId
    ];

    const calendars = await prisma.calendar.findMany({
      where: {
        id: {
          in: calendarIds
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

    if (body.sourceCalendarId) {
      data.sourceCalendarId = body.sourceCalendarId;
    }
    if (body.destinationCalendarId) {
      data.destinationCalendarId = body.destinationCalendarId;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(job);
  }

  const updated = await prisma.syncJob.update({
    where: { id: job.id },
    data,
    include: {
      sourceCalendar: true,
      destinationCalendar: true
    }
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await ensureJobOwner(params.id, session.user.id);

  if (!job) {
    return NextResponse.json({ error: "Sync job not found." }, { status: 404 });
  }

  await prisma.syncJob.delete({
    where: { id: job.id }
  });

  return NextResponse.json({ success: true });
}
