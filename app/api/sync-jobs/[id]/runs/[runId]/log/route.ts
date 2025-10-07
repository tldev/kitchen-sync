import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readRunLog } from "@/lib/calendarsync/run-logs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string; runId: string } },
) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await prisma.jobRun.findFirst({
    where: {
      id: params.runId,
      jobId: params.id,
      job: {
        ownerId: session.user.id,
      },
    },
    select: {
      id: true,
      logLocation: true,
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Job run not found." }, { status: 404 });
  }

  if (!run.logLocation) {
    return NextResponse.json({ error: "Logs are not available for this run." }, { status: 404 });
  }

  try {
    const content = await readRunLog(run.logLocation);
    return NextResponse.json({ log: content });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load run logs.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

