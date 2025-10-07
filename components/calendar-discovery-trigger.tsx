"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CalendarDiscoveryTriggerProps = {
  hasCalendars: boolean;
  hasLinkedAccounts: boolean;
};

export default function CalendarDiscoveryTrigger({
  hasCalendars,
  hasLinkedAccounts,
}: CalendarDiscoveryTriggerProps) {
  const router = useRouter();
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Auto-discover calendars if user has linked accounts but no calendars
    if (hasLinkedAccounts && !hasCalendars && !isDiscovering) {
      void discoverCalendars();
    }
  }, [hasLinkedAccounts, hasCalendars]);

  const discoverCalendars = async () => {
    setIsDiscovering(true);
    setError(null);

    try {
      const response = await fetch("/api/calendars/discover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error ?? "Failed to discover calendars");
      }

      // Refresh the page to show discovered calendars
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsDiscovering(false);
    }
  };

  if (!hasLinkedAccounts) {
    return null;
  }

  if (hasCalendars && !isDiscovering && !error) {
    return null;
  }

  return (
    <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/5 p-4">
      {isDiscovering ? (
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          <p className="text-sm text-emerald-200">Discovering calendars from your linked Google accounts…</p>
        </div>
      ) : error ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-rose-200">Calendar discovery failed</p>
          <p className="text-sm text-rose-100/80">{error}</p>
          <button
            type="button"
            onClick={() => void discoverCalendars()}
            className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-400/10"
          >
            Retry discovery
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-emerald-200">No calendars found yet.</p>
          <button
            type="button"
            onClick={() => void discoverCalendars()}
            className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-400/10"
          >
            Discover calendars
          </button>
        </div>
      )}
    </div>
  );
}

