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
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Stats</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Views</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{totalPageViews}</p>
            <p className="mt-1 text-xs text-gray-400">{formatDate(lastPageViewAt)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Success Rate</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{formatPercentage(jobSuccessRate)}</p>
            <p className="mt-1 text-xs text-gray-400">
              {jobSuccessRate === null ? "No runs yet" : `${completedRuns} runs`}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Results</p>
            <div className="mt-2 space-y-1 text-sm text-gray-900">
              <p>
                <span className="font-semibold text-green-600">{successfulRuns}</span> successful
              </p>
              <p>
                <span className="font-semibold text-red-600">{problematicRuns}</span> failed
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
