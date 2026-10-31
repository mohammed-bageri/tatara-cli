---
"@tatara/jobs": minor
"@tatara/cli": minor
"create-tatara": minor
---

Jobs v2: one job envelope (`id, topic, data, orgId, attempt, maxAttempts`) over drivers — `inline` (tests), `postgres` (`tatara.jobs`, SKIP LOCKED; a transactional outbox with `{ executor }`), `bullmq` (default) and `kafka` (kafkajs; delayed and dead topics). Retries double from `backoffMs`; `onDeadLetter` runs once, after the last attempt; a payload that doesn't validate is dead at once. `createJobs<TopicsOf<typeof consumers>>` types `enqueue`. Schedules lock through any `lock()` (the cache), get `forEachOrg`, and can be started from outside: `schedule:run` and `triggerSchedule` for an HTTP trigger. Generated apps pick `JOBS_DRIVER`, bring the cache add-on with jobs, and mount `POST /internal/schedules/:name` when `SCHEDULE_TRIGGER_SECRET` is set. Codemod 0.11.0 `jobs-drivers`.
