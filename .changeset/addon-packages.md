---
"@tatara/cli": minor
"create-tatara": minor
---

Generated apps use `@tatara/storage`, `@tatara/email`, `@tatara/i18n` and `@tatara/jobs`. Each add-on keeps one short config file (`src/core/<addon>/index.ts` or `send.ts`), and the worker and cron apps call `startWorker`/`startCron`. `tatara upgrade` runs the 0.7.0 `addon-packages` codemod, which moves each add-on on its own.
