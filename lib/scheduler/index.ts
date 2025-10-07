import { startSyncJobScheduler } from "./sync-job-scheduler";

const shouldDisableScheduler = process.env.SYNC_JOB_SCHEDULER_DISABLED === "true";
const isServerEnvironment = typeof window === "undefined";

if (isServerEnvironment && !shouldDisableScheduler) {
  startSyncJobScheduler();
}

export { enqueueDueSyncJobs, startSyncJobScheduler } from "./sync-job-scheduler";
export type { EnqueueDueJobsOptions, SyncJobSchedulerOptions } from "./sync-job-scheduler";
