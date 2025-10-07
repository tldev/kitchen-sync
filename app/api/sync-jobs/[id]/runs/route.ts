import { NextResponse } from "next/server";
import { JobRunStatus } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CreateJobRunPayload = {
  status?: JobRunStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  message?: string | null;
  logLocation?: string | null;
};

function isValidStatus(value: unknown): value is JobRunStatus {
  return (
    typeof value === "string" &&
    Object.values(JobRunStatus).includes(value as JobRunStatus)
  );
}

async function ensureJobAccess(jobId: string, userId: string) {
  return prisma.syncJob.findFirst({
    where: {
      id: jobId,
      ownerId: userId
    },
    select: {
      id: true
    }
  });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await ensureJobAccess(params.id, session.user.id);

  if (!job) {
    return NextResponse.json({ error: "Sync job not found." }, { status: 404 });
  }

  const runs = await prisma.jobRun.findMany({
    where: {
      jobId: job.id
    },
    orderBy: {
      startedAt: "desc"
    }
  });

  return NextResponse.json(runs);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await ensureJobAccess(params.id, session.user.id);

  if (!job) {
    return NextResponse.json({ error: "Sync job not found." }, { status: 404 });
  }

  const rawBody = await request.json();
  const body = (rawBody ?? {}) as CreateJobRunPayload;

  if (!isValidStatus(body.status)) {
    return NextResponse.json(
      { error: "Invalid status provided." },
      { status: 400 }
    );
  }

  const run = await prisma.jobRun.create({
    data: {
      jobId: job.id,
      status: body.status,
      startedAt: body.startedAt ? new Date(body.startedAt) : undefined,
      finishedAt: body.finishedAt ? new Date(body.finishedAt) : undefined,
      message: body.message ?? null,
      logLocation: body.logLocation ?? null
    }
  });

  return NextResponse.json(run, { status: 201 });
}
