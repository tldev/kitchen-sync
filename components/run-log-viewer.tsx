"use client";

import { useState } from "react";

type RunLogViewerProps = {
  jobId: string;
  runId: string;
  hasLogs: boolean;
};

export default function RunLogViewer({ jobId, runId, hasLogs }: RunLogViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLog = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sync-jobs/${jobId}/runs/${runId}/log`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load logs");
      }

      setLog(data.log);
      setIsOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  if (!hasLogs) {
    return null;
  }

  return (
    <>
      <button
        onClick={fetchLog}
        disabled={loading}
        className="text-xs text-blue-600 hover:text-blue-800 hover:underline disabled:text-gray-400"
      >
        {loading ? "Loading..." : "View Logs"}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Run Logs</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-6" style={{ maxHeight: "calc(90vh - 120px)" }}>
              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                  <p className="font-semibold">Error loading logs</p>
                  <p className="mt-1">{error}</p>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-gray-900 p-4 text-xs text-gray-100 font-mono">
                  {log}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


