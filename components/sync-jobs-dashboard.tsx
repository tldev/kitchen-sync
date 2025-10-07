"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JobRunStatus, Prisma, SyncJobCadence, SyncJobStatus } from "@prisma/client";
import RunLogViewer from "./run-log-viewer";
import YamlConfigViewer from "./yaml-config-viewer";
import { generateYamlPreview } from "@/lib/yaml-preview";
import { createDefaultOptionState } from "@/lib/sync-job-transformers";

const cadenceLabels: Record<SyncJobCadence, string> = {
  FIFTEEN_MINUTES: "Every 15 minutes",
  HOURLY: "Hourly",
  DAILY: "Daily",
};

const jobStatusStyles: Record<SyncJobStatus, string> = {
  ACTIVE: "bg-green-50 text-green-700 border border-green-200",
  PAUSED: "bg-amber-50 text-amber-700 border border-amber-200",
};

const jobStatusLabels: Record<SyncJobStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
};

const runStatusStyles: Record<JobRunStatus, string> = {
  PENDING: "bg-gray-50 text-gray-700 border border-gray-200",
  RUNNING: "bg-blue-50 text-blue-700 border border-blue-200",
  SUCCESS: "bg-green-50 text-green-700 border border-green-200",
  FAILED: "bg-red-50 text-red-700 border border-red-200",
  CANCELLED: "bg-amber-50 text-amber-700 border border-amber-200",
};

const runStatusLabels: Record<JobRunStatus, string> = {
  PENDING: "Pending",
  RUNNING: "Running",
  SUCCESS: "Success",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

type SyncJobWithHistory = Prisma.SyncJobGetPayload<{
  include: {
    sourceCalendar: {
      include: { account: true };
    };
    destinationCalendar: {
      include: { account: true };
    };
    runs: true;
  };
}>;

type SyncJobsDashboardProps = {
  jobs: SyncJobWithHistory[];
};

function formatAccountId(value: string): string {
  if (value.length <= 8) {
    return value;
  }

  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) {
    return "–";
  }

  const dateValue = typeof value === "string" ? new Date(value) : value;
  return dateTimeFormatter.format(dateValue);
}

function generateJobYaml(job: SyncJobWithHistory): string {
  try {
    // Parse the config from the database (Prisma JsonValue)
    let optionStates = createDefaultOptionState();
    if (job.config && typeof job.config === "object" && !Array.isArray(job.config)) {
      optionStates = job.config as any;
    }

    return generateYamlPreview({
      jobId: job.id,
      jobName: job.name,
      sourceCalendarId: job.sourceCalendar.googleCalendarId,
      sourceAccountId: job.sourceCalendar.account.providerAccountId,
      sourceTimeZone: job.sourceCalendar.timeZone,
      destinationCalendarId: job.destinationCalendar.googleCalendarId,
      destinationAccountId: job.destinationCalendar.account.providerAccountId,
      destinationTimeZone: job.destinationCalendar.timeZone,
      optionStates,
    });
  } catch (error) {
    console.error("Failed to generate YAML preview:", error);
    return "# Error generating YAML preview";
  }
}

export default function SyncJobsDashboard({ jobs }: SyncJobsDashboardProps) {
  const router = useRouter();
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  const handleDelete = async (jobId: string, jobName: string) => {
    if (!confirm(`Are you sure you want to delete "${jobName}"?\n\nThis will permanently delete the sync job and all its run history.`)) {
      return;
    }

    setDeletingJobId(jobId);

    try {
      const response = await fetch(`/api/sync-jobs/${jobId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete sync job");
      }

      // Refresh the page to show updated list
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete sync job");
      setDeletingJobId(null);
    }
  };

  if (jobs.length === 0) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Sync Jobs</h3>
        <p className="mt-2 text-sm text-gray-600">
          No sync jobs yet.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">Sync Jobs</h3>
        <div className="space-y-5">
          {jobs.map((job) => {
            const lastRun = job.runs[0] ?? null;
            const hasError = lastRun
              ? lastRun.status === JobRunStatus.FAILED || lastRun.status === JobRunStatus.CANCELLED
              : false;
            const sourceAccountLabel = formatAccountId(job.sourceCalendar.account.providerAccountId);
            const destinationAccountLabel = formatAccountId(job.destinationCalendar.account.providerAccountId);

            return (
              <article
                key={job.id}
                className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-5"
              >
                <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 space-y-1">
                    <h4 className="text-base font-semibold text-gray-900">{job.name}</h4>
                    <p className="text-sm text-gray-600">
                      {job.sourceCalendar.summary} ({sourceAccountLabel})
                      <span className="mx-2 text-gray-400">→</span>
                      {job.destinationCalendar.summary} ({destinationAccountLabel})
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${jobStatusStyles[job.status]}`}>
                      <span className="h-2 w-2 rounded-full bg-current" />
                      {jobStatusLabels[job.status]}
                    </span>
                    <button
                      onClick={() => handleDelete(job.id, job.name)}
                      disabled={deletingJobId === job.id}
                      className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="Delete sync job"
                    >
                      {deletingJobId === job.id ? (
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </header>
                <dl className="grid gap-4 text-sm text-gray-900 sm:grid-cols-3">
                  <div className="space-y-1">
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Frequency</dt>
                    <dd>{cadenceLabels[job.cadence]}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Next</dt>
                    <dd>{formatDate(job.nextRunAt)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Last</dt>
                    <dd>{lastRun ? formatDate(lastRun.startedAt) : "None"}</dd>
                  </div>
                </dl>
                {hasError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                    <p className="font-semibold">Failed</p>
                    <p className="mt-1">
                      {lastRun?.message ?? "Run did not complete successfully"}
                    </p>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <YamlConfigViewer
                    yaml={generateJobYaml(job)}
                    title="CalendarSync CLI Configuration"
                    collapsible={true}
                    defaultExpanded={false}
                  />
                </div>
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-gray-700">History</h5>
                  {job.runs.length === 0 ? (
                    <p className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-500">
                      No runs yet
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {job.runs.map((run) => (
                        <li
                          key={run.id}
                          className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${runStatusStyles[run.status]}`}>
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {runStatusLabels[run.status]}
                              </span>
                              <div className="text-xs text-gray-600">
                                <p>{formatDate(run.startedAt)}</p>
                              </div>
                            </div>
                            <RunLogViewer 
                              jobId={job.id} 
                              runId={run.id} 
                              hasLogs={!!run.logLocation} 
                            />
                          </div>
                          {run.message ? (
                            <p className="text-xs text-gray-500 whitespace-pre-wrap">{run.message}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
