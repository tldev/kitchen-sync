"use client";

import { useMemo, useState } from "react";

type SyncJobCadenceOption = {
  value: "FIFTEEN_MINUTES" | "HOURLY" | "DAILY";
  label: string;
  description: string;
  helper?: string;
};

type CalendarOption = {
  id: string;
  googleCalendarId: string;
  summary: string;
  timeZone: string;
  accountId: string;
  accountLabel: string;
};

type AccountCalendars = {
  label: string;
  calendars: CalendarOption[];
};

const CADENCE_OPTIONS: SyncJobCadenceOption[] = [
  {
    value: "FIFTEEN_MINUTES",
    label: "Every 15 minutes",
    description: "Keep calendars closely aligned with frequent, lightweight updates.",
    helper: "Best for high-priority or operational calendars."
  },
  {
    value: "HOURLY",
    label: "Hourly",
    description: "Balance freshness with API usage by syncing once per hour.",
    helper: "Ideal for most shared team calendars."
  },
  {
    value: "DAILY",
    label: "Daily",
    description: "Run a morning catch-up to reflect prior day changes in bulk.",
    helper: "Useful for low-velocity or archival destinations."
  }
];

type SyncJobPlannerProps = {
  calendars: CalendarOption[];
};

export default function SyncJobPlanner({ calendars }: SyncJobPlannerProps) {
  const [sourceId, setSourceId] = useState(() => calendars[0]?.id ?? "");
  const [destinationId, setDestinationId] = useState(() => {
    if (calendars.length >= 2) {
      return calendars[1]!.id;
    }

    return calendars[0]?.id ?? "";
  });
  const [cadence, setCadence] = useState<SyncJobCadenceOption["value"]>("HOURLY");

  const calendarsByAccount = useMemo(() => {
    return calendars.reduce<Record<string, AccountCalendars>>((groups, calendar) => {
      if (!groups[calendar.accountId]) {
        groups[calendar.accountId] = {
          label: calendar.accountLabel,
          calendars: []
        };
      }

      groups[calendar.accountId]!.calendars.push(calendar);
      return groups;
    }, {});
  }, [calendars]);

  const selectedSource = calendars.find((calendar) => calendar.id === sourceId) ?? null;
  const selectedDestination = calendars.find((calendar) => calendar.id === destinationId) ?? null;
  const cadenceDetails = CADENCE_OPTIONS.find((option) => option.value === cadence) ?? null;

  const hasCalendars = calendars.length > 0;
  const hasDistinctCalendars = sourceId !== "" && destinationId !== "" && sourceId !== destinationId;
  const canContinue = Boolean(selectedSource && selectedDestination && cadenceDetails && hasDistinctCalendars);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-emerald-300">Create a sync definition</h3>
        <p className="text-sm text-slate-400">
          Choose a source calendar, select where it should be mirrored, and align on how often CalendarSync should run.
        </p>
      </div>

      {!hasCalendars ? (
        <p className="rounded-xl border border-dashed border-emerald-400/40 bg-emerald-500/5 p-6 text-sm text-emerald-200">
          No calendars discovered yet. Use the discovery action in the API or upcoming automation to populate available
          calendars for each linked Google account.
        </p>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-emerald-200" htmlFor="source-calendar">
                Source calendar
              </label>
              <select
                id="source-calendar"
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                {Object.entries(calendarsByAccount).map(([accountId, group]) => (
                  <optgroup key={accountId} label={`Account: ${group.label}`}>
                    {group.calendars.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.summary}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {selectedSource ? (
                <p className="text-xs text-slate-400">
                  Synced from <span className="text-emerald-200">{selectedSource.accountLabel}</span> • {selectedSource.summary} ·
                  Time zone {selectedSource.timeZone}
                </p>
              ) : (
                <p className="text-xs text-rose-300">Select a calendar to continue.</p>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-emerald-200" htmlFor="destination-calendar">
                Destination calendar
              </label>
              <select
                id="destination-calendar"
                value={destinationId}
                onChange={(event) => setDestinationId(event.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                {Object.entries(calendarsByAccount).map(([accountId, group]) => (
                  <optgroup key={accountId} label={`Account: ${group.label}`}>
                    {group.calendars.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.summary}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {selectedDestination ? (
                <p className="text-xs text-slate-400">
                  Will write into <span className="text-emerald-200">{selectedDestination.accountLabel}</span> •
                  {" "}
                  {selectedDestination.summary} · Time zone {selectedDestination.timeZone}
                </p>
              ) : (
                <p className="text-xs text-rose-300">Select a calendar to continue.</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-emerald-200">Select a cadence</h4>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {CADENCE_OPTIONS.map((option) => {
                const selected = cadence === option.value;

                return (
                  <label
                    key={option.value}
                    className={`relative flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-emerald-500/40 focus:outline-none ${
                      selected
                        ? "border-emerald-400 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                        : "border-slate-800 bg-slate-950/60 hover:border-emerald-400/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sync-cadence"
                      value={option.value}
                      checked={selected}
                      onChange={() => setCadence(option.value)}
                      className="sr-only"
                    />
                    <span className="text-sm font-semibold text-slate-100">{option.label}</span>
                    <span className="text-xs text-slate-400">{option.description}</span>
                    {option.helper ? (
                      <span className="text-[11px] uppercase tracking-wide text-emerald-300/80">{option.helper}</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Summary</h4>
              {!hasDistinctCalendars ? (
                <span className="text-xs font-medium text-rose-300">
                  Source and destination must be different calendars to avoid loops.
                </span>
              ) : null}
            </div>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Source</dt>
                <dd className="text-sm text-slate-100">
                  {selectedSource ? (
                    <>
                      <span className="block font-medium text-emerald-200">{selectedSource.summary}</span>
                      <span className="text-xs text-slate-400">{selectedSource.accountLabel}</span>
                    </>
                  ) : (
                    <span className="text-rose-300">Not selected</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Destination</dt>
                <dd className="text-sm text-slate-100">
                  {selectedDestination ? (
                    <>
                      <span className="block font-medium text-emerald-200">{selectedDestination.summary}</span>
                      <span className="text-xs text-slate-400">{selectedDestination.accountLabel}</span>
                    </>
                  ) : (
                    <span className="text-rose-300">Not selected</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Cadence</dt>
                <dd className="text-sm text-slate-100">
                  {cadenceDetails ? (
                    <>
                      <span className="block font-medium text-emerald-200">{cadenceDetails.label}</span>
                      <span className="text-xs text-slate-400">{cadenceDetails.description}</span>
                    </>
                  ) : (
                    <span className="text-rose-300">Select a cadence</span>
                  )}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              disabled={!canContinue}
              className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40 sm:w-auto ${
                canContinue
                  ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                  : "cursor-not-allowed bg-slate-800 text-slate-500"
              }`}
            >
              Continue to transformer selection
            </button>
            <p className="text-xs text-slate-500">
              This planner saves your selections locally for now. The next milestone will persist sync jobs and wire up
              CalendarSync execution.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export type { CalendarOption };
