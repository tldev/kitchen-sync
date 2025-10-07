"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  OPTION_DEFINITIONS,
  createDefaultOptionState,
  createSummary as summarizeOptionState,
  type FieldDefinition,
  type FieldValue,
  type OptionDefinition,
  type OptionId,
  type OptionStateMap,
} from "@/lib/sync-job-transformers";
import { generateYamlPreview } from "@/lib/yaml-preview";
import YamlConfigViewer from "./yaml-config-viewer";

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
    description: "High frequency updates",
  },
  {
    value: "HOURLY",
    label: "Hourly",
    description: "Standard sync frequency",
  },
  {
    value: "DAILY",
    label: "Daily",
    description: "Low frequency updates",
  }
];

type AccountOption = {
  id: string;
  label: string;
};

type SyncJobPlannerProps = {
  calendars: CalendarOption[];
  accounts: AccountOption[];
};

export default function SyncJobPlanner({ calendars: initialCalendars, accounts }: SyncJobPlannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<CalendarOption[]>(initialCalendars);
  const [discoveringAccounts, setDiscoveringAccounts] = useState<Set<string>>(new Set());
  const [sourceAccountId, setSourceAccountId] = useState(() => accounts[0]?.id ?? "");
  const [sourceId, setSourceId] = useState(() => initialCalendars[0]?.id ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(() => {
    // Try to default to a different account if available
    return accounts[1]?.id ?? accounts[0]?.id ?? "";
  });
  const [destinationId, setDestinationId] = useState(() => {
    if (initialCalendars.length >= 2) {
      return initialCalendars[1]!.id;
    }

    return initialCalendars[0]?.id ?? "";
  });
  const [cadence, setCadence] = useState<SyncJobCadenceOption["value"]>("HOURLY");
  const [optionStates, setOptionStates] = useState<OptionStateMap>(() => createDefaultOptionState());

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

  const sourceCalendars = useMemo(() => {
    return calendarsByAccount[sourceAccountId]?.calendars ?? [];
  }, [calendarsByAccount, sourceAccountId]);

  const destinationCalendars = useMemo(() => {
    return calendarsByAccount[destinationAccountId]?.calendars ?? [];
  }, [calendarsByAccount, destinationAccountId]);

  // Discover calendars for a specific account
  const discoverCalendarsForAccount = useCallback(async (accountId: string) => {
    if (discoveringAccounts.has(accountId)) {
      return; // Already discovering
    }

    setDiscoveringAccounts(prev => new Set(prev).add(accountId));
    setError(null);

    try {
      const response = await fetch(`/api/calendars/discover/${accountId}`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error ?? "Failed to discover calendars");
      }

      const result = await response.json();
      
      // Fetch updated calendars from the API
      const calendarsResponse = await fetch("/api/calendars");
      if (calendarsResponse.ok) {
        const updatedCalendars = await calendarsResponse.json();
        const calendarOptions: CalendarOption[] = updatedCalendars.map((cal: any) => ({
          id: cal.id,
          googleCalendarId: cal.googleCalendarId,
          summary: cal.summary,
          timeZone: cal.timeZone,
          accountId: cal.account.id,
          accountLabel: cal.account.providerAccountId.length <= 8 
            ? cal.account.providerAccountId 
            : `${cal.account.providerAccountId.slice(0, 4)}…${cal.account.providerAccountId.slice(-4)}`
        }));
        setCalendars(calendarOptions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to discover calendars");
    } finally {
      setDiscoveringAccounts(prev => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  }, [discoveringAccounts]);

  // Update source calendar when account changes
  const handleSourceAccountChange = useCallback(async (accountId: string) => {
    setSourceAccountId(accountId);
    const accountCalendars = calendarsByAccount[accountId]?.calendars ?? [];
    
    if (accountCalendars.length === 0) {
      // No calendars for this account, trigger discovery
      await discoverCalendarsForAccount(accountId);
      // After discovery, the calendars will be updated and we'll select the first one
      const updatedAccountCalendars = calendarsByAccount[accountId]?.calendars ?? [];
      if (updatedAccountCalendars.length > 0) {
        setSourceId(updatedAccountCalendars[0].id);
      }
    } else {
      setSourceId(accountCalendars[0].id);
    }
  }, [calendarsByAccount, discoverCalendarsForAccount]);

  // Update destination calendar when account changes
  const handleDestinationAccountChange = useCallback(async (accountId: string) => {
    setDestinationAccountId(accountId);
    const accountCalendars = calendarsByAccount[accountId]?.calendars ?? [];
    
    if (accountCalendars.length === 0) {
      // No calendars for this account, trigger discovery
      await discoverCalendarsForAccount(accountId);
      // After discovery, the calendars will be updated and we'll select the first one
      const updatedAccountCalendars = calendarsByAccount[accountId]?.calendars ?? [];
      if (updatedAccountCalendars.length > 0) {
        setDestinationId(updatedAccountCalendars[0].id);
      }
    } else {
      setDestinationId(accountCalendars[0].id);
    }
  }, [calendarsByAccount, discoverCalendarsForAccount]);

  // Update calendar selections when calendars change (after discovery)
  useEffect(() => {
    if (sourceAccountId && sourceCalendars.length > 0 && !sourceId) {
      setSourceId(sourceCalendars[0].id);
    }
  }, [sourceAccountId, sourceCalendars, sourceId]);

  useEffect(() => {
    if (destinationAccountId && destinationCalendars.length > 0 && !destinationId) {
      setDestinationId(destinationCalendars[0].id);
    }
  }, [destinationAccountId, destinationCalendars, destinationId]);

  const selectedSource = calendars.find((calendar) => calendar.id === sourceId) ?? null;
  const selectedDestination = calendars.find((calendar) => calendar.id === destinationId) ?? null;
  const cadenceDetails = CADENCE_OPTIONS.find((option) => option.value === cadence) ?? null;
  const optionSummary = useMemo(() => summarizeOptionState(optionStates), [optionStates]);

  const hasCalendars = calendars.length > 0;
  const hasDistinctCalendars = sourceId !== "" && destinationId !== "" && sourceId !== destinationId;
  const canContinue = Boolean(selectedSource && selectedDestination && cadenceDetails && hasDistinctCalendars);

  // Generate YAML preview
  const yamlPreview = useMemo(() => {
    if (!selectedSource || !selectedDestination) {
      return "";
    }
    return generateYamlPreview({
      jobName: `${selectedSource.summary} → ${selectedDestination.summary}`,
      sourceCalendarId: selectedSource.googleCalendarId,
      sourceAccountId: selectedSource.accountId,
      sourceTimeZone: selectedSource.timeZone,
      destinationCalendarId: selectedDestination.googleCalendarId,
      destinationAccountId: selectedDestination.accountId,
      destinationTimeZone: selectedDestination.timeZone,
      optionStates,
    });
  }, [selectedSource, selectedDestination, optionStates]);

  const updateOptionEnabled = (optionId: OptionId, enabled: boolean) => {
    setOptionStates((previous) => ({
      ...previous,
      [optionId]: {
        ...previous[optionId],
        enabled,
      },
    }));
  };

  const updateOptionValue = (optionId: OptionId, fieldId: string, value: FieldValue) => {
    setOptionStates((previous) => ({
      ...previous,
      [optionId]: {
        ...previous[optionId],
        values: {
          ...previous[optionId]?.values,
          [fieldId]: value,
        },
      },
    }));
  };

  const handleSaveJob = async () => {
    if (!canContinue) {
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/sync-jobs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: `${selectedSource?.summary} → ${selectedDestination?.summary}`,
            sourceCalendarId: sourceId,
            destinationCalendarId: destinationId,
            cadence,
            status: "ACTIVE",
            config: optionStates,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error ?? "Failed to create sync job");
        }

        // Refresh the page to show the new job
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    });
  };

  const renderFieldInput = (
    option: OptionDefinition,
    field: FieldDefinition,
    value: FieldValue,
    onChange: (nextValue: FieldValue) => void,
  ) => {
    const inputId = `${option.id}-${field.id}`;

    switch (field.type) {
      case "text":
        return (
          <div className="space-y-2" key={inputId}>
            <label className="block text-sm font-medium text-gray-700" htmlFor={inputId}>
              {field.label}
            </label>
            <input
              id={inputId}
              type="text"
              value={String(value ?? "")}
              onChange={(event) => onChange(event.target.value)}
              placeholder={field.placeholder}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        );
      case "textarea":
        return (
          <div className="space-y-2" key={inputId}>
            <label className="block text-sm font-medium text-gray-700" htmlFor={inputId}>
              {field.label}
            </label>
            <textarea
              id={inputId}
              value={String(value ?? "")}
              onChange={(event) => onChange(event.target.value)}
              placeholder={field.placeholder}
              rows={4}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        );
      case "number":
        return (
          <div className="space-y-2" key={inputId}>
            <label className="block text-sm font-medium text-gray-700" htmlFor={inputId}>
              {field.label}
            </label>
            <input
              id={inputId}
              type="number"
              value={Number(value ?? field.defaultValue ?? 0)}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                onChange(Number.isNaN(parsed) ? field.defaultValue ?? 0 : parsed);
              }}
              min={field.min}
              max={field.max}
              step={field.step}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        );
      case "select":
        return (
          <div className="space-y-2" key={inputId}>
            <label className="block text-sm font-medium text-gray-700" htmlFor={inputId}>
              {field.label}
            </label>
            <select
              id={inputId}
              value={String(value ?? field.defaultValue)}
              onChange={(event) => onChange(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {field.options.map((optionChoice) => (
                <option key={optionChoice.value} value={optionChoice.value}>
                  {optionChoice.label}
                </option>
              ))}
            </select>
          </div>
        );
      case "checkbox":
        return (
          <label
            key={inputId}
            className="flex items-center gap-3 rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900"
          >
            <input
              id={inputId}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(event) => onChange(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 bg-white text-blue-600 focus:ring-blue-100"
            />
            <span>{field.label}</span>
          </label>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Create Sync Job</h3>

      {!hasCalendars ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
          No calendars available yet.
        </p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Source</h4>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700" htmlFor="source-account">
                  Google Account
                </label>
                <select
                  id="source-account"
                  value={sourceAccountId}
                  onChange={(event) => handleSourceAccountChange(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700" htmlFor="source-calendar">
                  Calendar
                </label>
                {discoveringAccounts.has(sourceAccountId) ? (
                  <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Discovering calendars...
                  </div>
                ) : sourceCalendars.length === 0 ? (
                  <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                    No calendars available
                  </div>
                ) : (
                  <select
                    id="source-calendar"
                    value={sourceId}
                    onChange={(event) => setSourceId(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {sourceCalendars.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.summary}
                      </option>
                    ))}
                  </select>
                )}
                {selectedSource ? (
                  <p className="text-xs text-gray-500">
                    {selectedSource.timeZone}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Destination</h4>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700" htmlFor="destination-account">
                  Google Account
                </label>
                <select
                  id="destination-account"
                  value={destinationAccountId}
                  onChange={(event) => handleDestinationAccountChange(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700" htmlFor="destination-calendar">
                  Calendar
                </label>
                {discoveringAccounts.has(destinationAccountId) ? (
                  <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Discovering calendars...
                  </div>
                ) : destinationCalendars.length === 0 ? (
                  <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                    No calendars available
                  </div>
                ) : (
                  <select
                    id="destination-calendar"
                    value={destinationId}
                    onChange={(event) => setDestinationId(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {destinationCalendars.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.summary}
                      </option>
                    ))}
                  </select>
                )}
                {selectedDestination ? (
                  <p className="text-xs text-gray-500">
                    {selectedDestination.timeZone}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Frequency</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              {CADENCE_OPTIONS.map((option) => {
                const selected = cadence === option.value;

                return (
                  <label
                    key={option.value}
                    className={`relative flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition ${
                      selected
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-300 bg-white hover:border-blue-300"
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
                    <span className="text-sm font-semibold text-gray-900">{option.label}</span>
                    <span className="text-xs text-gray-500">{option.description}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            {!hasDistinctCalendars ? (
              <p className="text-xs font-medium text-red-600">
                Source and destination must be different
              </p>
            ) : null}
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <p className="font-semibold">Error</p>
                <p className="mt-1">{error}</p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleSaveJob}
              disabled={!canContinue || isPending}
              className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition ${
                canContinue && !isPending
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "cursor-not-allowed bg-gray-300 text-gray-500"
              }`}
            >
              {isPending ? "Creating…" : "Create"}
            </button>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Options</h4>
            <div className="space-y-3">
              {OPTION_DEFINITIONS.map((definition) => {
                const state = optionStates[definition.id];
                const enabled = state?.enabled ?? false;
                const values = state?.values ?? {};

                return (
                  <div
                    key={definition.id}
                    className={`space-y-3 rounded-lg border p-4 transition ${
                      enabled
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <h5 className="text-sm font-semibold text-gray-900">{definition.label}</h5>
                        <p className="text-xs text-gray-600">{definition.description}</p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-600">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 bg-white text-blue-600 focus:ring-blue-100"
                          checked={enabled}
                          onChange={(event) => updateOptionEnabled(definition.id as OptionId, event.target.checked)}
                        />
                        Enable
                      </label>
                    </div>
                    {enabled ? (
                      <div className="space-y-3">
                        {definition.fields.map((field) =>
                          renderFieldInput(
                            definition,
                            field,
                            values[field.id] as FieldValue,
                            (nextValue) => updateOptionValue(definition.id as OptionId, field.id, nextValue),
                          ),
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {yamlPreview && (
            <div className="pt-2">
              <YamlConfigViewer
                yaml={yamlPreview}
                title="CalendarSync CLI Configuration"
                collapsible={true}
                defaultExpanded={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type { CalendarOption };
