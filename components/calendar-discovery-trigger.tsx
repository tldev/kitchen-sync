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
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      {isDiscovering ? (
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm text-blue-900">Discovering calendars…</p>
        </div>
      ) : error ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-red-900">Discovery failed</p>
          <p className="text-sm text-red-800">{error}</p>
          <button
            type="button"
            onClick={() => void discoverCalendars()}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-blue-900">No calendars found.</p>
          <button
            type="button"
            onClick={() => void discoverCalendars()}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Discover
          </button>
        </div>
      )}
    </div>
  );
}

