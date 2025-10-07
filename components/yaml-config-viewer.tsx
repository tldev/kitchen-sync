"use client";

import { useState } from "react";

interface YamlConfigViewerProps {
  yaml: string;
  title?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export default function YamlConfigViewer({
  yaml,
  title = "CalendarSync Configuration",
  collapsible = true,
  defaultExpanded = false,
}: YamlConfigViewerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy YAML:", err);
    }
  };

  if (collapsible && !isExpanded) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-3 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>{title}</span>
          </div>
          <span className="text-xs text-gray-500">Show YAML</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {collapsible && (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="rounded p-1 text-gray-500 transition hover:bg-gray-100"
              title="Collapse"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          <h5 className="text-sm font-medium text-gray-700">{title}</h5>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
          title="Copy to clipboard"
        >
          {copied ? (
            <>
              <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-600">Copied!</span>
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="relative overflow-hidden rounded-lg border border-gray-300 bg-gray-900">
        <pre className="overflow-x-auto p-4 text-xs text-gray-100">
          <code className="language-yaml">{yaml}</code>
        </pre>
      </div>
      <p className="text-xs text-gray-500">
        This YAML configuration will be passed to the <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">calendarsync</code> CLI tool.
        The CLI uses OAuth tokens stored in an encrypted <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">auth-storage.yaml</code> file (created during account setup using AGE encryption).
      </p>
    </div>
  );
}

