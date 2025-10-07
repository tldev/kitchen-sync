import type { AnalyticsSummary } from "@/lib/telemetry";

type AnalyticsOverviewProps = {
  summary: AnalyticsSummary;
};

const formatter = new Intl.NumberFormat("en-US");

function formatSuccessRate(rate: number | null) {
  if (rate === null) {
    return "--";
  }

  return `${(rate * 100).toFixed(1)}%`;
}

export default function AnalyticsOverview({ summary }: AnalyticsOverviewProps) {
  const successRate = formatSuccessRate(summary.jobSuccessRate);
  const successRateHelper = summary.jobRunSampleSize > 0
    ? `${summary.jobRunSampleSize} job runs in the last 30 days`
    : "No completed job runs in the last 30 days";

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-emerald-300">Telemetry snapshot</h3>
          <p className="mt-1 text-sm text-slate-400">
            Lightweight analytics to understand engagement and operational health.
          </p>
        </div>
      </div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-5">
          <dt className="text-xs uppercase tracking-wide text-slate-500">All-time page views</dt>
          <dd className="mt-2 text-2xl font-semibold text-emerald-200">
            {formatter.format(summary.totalPageViews)}
          </dd>
          <p className="mt-1 text-xs text-slate-500">Across all authenticated sessions.</p>
        </div>
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-5">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Page views (7 days)</dt>
          <dd className="mt-2 text-2xl font-semibold text-emerald-200">
            {formatter.format(summary.pageViewsLastSevenDays)}
          </dd>
          <p className="mt-1 text-xs text-slate-500">Includes repeat visits for rapid feedback.</p>
        </div>
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-5">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Job success rate (30 days)</dt>
          <dd className="mt-2 text-2xl font-semibold text-emerald-200">{successRate}</dd>
          <p className="mt-1 text-xs text-slate-500">{successRateHelper}</p>
        </div>
      </dl>
    </section>
  );
}
