import { TelemetryEventType, Prisma } from "@prisma/client";

import { prisma } from "./prisma";

type RecordPageViewOptions = {
  userId?: string | null;
  path: string;
  metadata?: Record<string, unknown>;
};

export async function recordPageView({ userId, path, metadata }: RecordPageViewOptions): Promise<void> {
  try {
    await prisma.telemetryEvent.create({
      data: {
        type: TelemetryEventType.PAGE_VIEW,
        path,
        userId: userId ?? undefined,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (error) {
    console.error("Failed to record page view telemetry", error);
  }
}
