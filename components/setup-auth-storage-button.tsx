"use client";

import { useState } from "react";

interface SetupAuthStorageButtonProps {
  accountId: string;
  accountEmail?: string;
  onSuccess?: () => void;
}

export function SetupAuthStorageButton({
  accountId,
  accountEmail,
  onSuccess,
}: SetupAuthStorageButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/accounts/${accountId}/setup-auth-storage`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to setup auth storage");
      }

      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleSetup}
        disabled={loading || success}
        className={`
          rounded-md px-4 py-2 text-sm font-medium transition-colors
          ${
            success
              ? "bg-green-600 text-white cursor-not-allowed"
              : loading
              ? "bg-gray-400 text-white cursor-wait"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }
        `}
      >
        {loading ? (
          <>
            <span className="inline-block animate-spin mr-2">⟳</span>
            Setting up...
          </>
        ) : success ? (
          <>✓ Auth Storage Ready</>
        ) : (
          <>Setup CalendarSync Auth</>
        )}
      </button>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          <p className="font-medium">✓ Success!</p>
          <p>
            CalendarSync authentication is now configured for{" "}
            {accountEmail || "this account"}. You can now create sync jobs.
          </p>
        </div>
      )}

      <p className="text-xs text-gray-500">
        This creates an encrypted authentication file that CalendarSync uses to access your
        Google Calendar. This is a one-time setup per Google account.
      </p>
    </div>
  );
}

