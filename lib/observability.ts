/**
 * Observability integration stub for Sentry, Logtail, or other monitoring services.
 * 
 * This module provides hooks for error tracking, log aggregation, and metrics collection.
 * In V1, these are no-ops or console-based, but can be expanded in future iterations.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface ErrorContext extends LogContext {
  userId?: string;
  jobId?: string;
  runId?: string;
}

/**
 * Initialize observability providers based on environment configuration.
 * Call this once during application startup.
 */
export function initializeObservability(): void {
  const sentryDsn = process.env.SENTRY_DSN;
  const logtailToken = process.env.LOGTAIL_SOURCE_TOKEN;

  if (sentryDsn) {
    console.info("[observability] Sentry DSN detected. Integration can be added by installing @sentry/nextjs.");
    // Future: Initialize Sentry SDK here
    // Sentry.init({ dsn: sentryDsn, environment: process.env.NODE_ENV });
  }

  if (logtailToken) {
    console.info("[observability] Logtail token detected. Integration can be added by installing @logtail/node.");
    // Future: Initialize Logtail transport here
  }

  if (!sentryDsn && !logtailToken) {
    console.debug("[observability] No external observability providers configured. Using console-based logging.");
  }
}

/**
 * Capture an exception with context for error tracking.
 * In V1 this logs to console; integrate with Sentry in production.
 */
export function captureException(error: Error | unknown, context?: ErrorContext): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error("[observability] Exception captured:", {
    message: errorMessage,
    stack: errorStack,
    context,
  });

  // Future: Send to Sentry
  // Sentry.captureException(error, { contexts: { custom: context } });
}

/**
 * Log a structured message with context.
 * In V1 this uses console; integrate with Logtail or other log aggregators in production.
 */
export function log(level: LogLevel, message: string, context?: LogContext): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...context,
  };

  switch (level) {
    case "debug":
      console.debug("[observability]", logEntry);
      break;
    case "info":
      console.info("[observability]", logEntry);
      break;
    case "warn":
      console.warn("[observability]", logEntry);
      break;
    case "error":
      console.error("[observability]", logEntry);
      break;
  }

  // Future: Send to Logtail
  // logtail.log(logEntry);
}

/**
 * Record a custom metric (e.g., job success rate, API latency).
 * In V1 this is a no-op; integrate with a metrics backend in production.
 */
export function recordMetric(name: string, value: number, tags?: Record<string, string>): void {
  console.debug("[observability] Metric recorded:", { name, value, tags });

  // Future: Send to Datadog, CloudWatch, or Prometheus
  // metrics.gauge(name, value, tags);
}

/**
 * Create a child logger with pre-populated context.
 * Useful for adding consistent context to all logs within a job run or request.
 */
export function createLogger(defaultContext: LogContext) {
  return {
    debug: (message: string, context?: LogContext) =>
      log("debug", message, { ...defaultContext, ...context }),
    info: (message: string, context?: LogContext) =>
      log("info", message, { ...defaultContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      log("warn", message, { ...defaultContext, ...context }),
    error: (message: string, context?: LogContext) =>
      log("error", message, { ...defaultContext, ...context }),
  };
}

