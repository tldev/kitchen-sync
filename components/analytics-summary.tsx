const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: Date | string | null | undefined): string {
  if (!value) {
    return "No views recorded yet";
  }

  const dateValue = typeof value === "string" ? new Date(value) : value;
  return dateTimeFormatter.format(dateValue);
}

type AnalyticsSummaryProps = {
  totalPageViews: number;
  lastPageViewAt: Date | string | null;
  jobSuccessRate: number | null;
  completedRuns: number;
  successfulRuns: number;
  failedRuns: number;
  cancelledRuns: number;
};

function formatPercentage(value: number | null): string {
  if (value === null) {
    return "No completed runs";
  }

  return `${Math.round(value * 1000) / 10}%`;
}

export default function AnalyticsSummary({
  totalPageViews,
  lastPageViewAt,
  jobSuccessRate,
  completedRuns,
  successfulRuns,
  failedRuns,
  cancelledRuns,
}: AnalyticsSummaryProps) {
  const problematicRuns = failedRuns + cancelledRuns;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-emerald-300">Automation insights</h3>
          <p className="text-sm text-slate-400">
            Telemetry helps you understand how often teammates visit the dashboard and whether scheduled jobs are staying
            healthy.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dashboard views</p>
            <p className="mt-3 text-3xl font-semibold text-emerald-100">{totalPageViews}</p>
            <p className="mt-2 text-xs text-slate-500">{formatDate(lastPageViewAt)}</p>
          </div>
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Job success rate</p>
            <p className="mt-3 text-3xl font-semibold text-emerald-100">{formatPercentage(jobSuccessRate)}</p>
            <p className="mt-2 text-xs text-slate-500">
              {jobSuccessRate === null ? "No completed runs yet" : `Based on ${completedRuns} completed runs.`}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Run outcomes</p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <p>
                <span className="text-emerald-300">{successfulRuns}</span> successful
              </p>
              <p>
                <span className="text-rose-300">{problematicRuns}</span> needing attention
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-500">Includes failed and cancelled runs.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
