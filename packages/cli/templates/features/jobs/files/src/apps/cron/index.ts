import { Cron } from "croner";
import { withLock } from "#core/jobs/lock";
import { logger } from "#core/logging/logger";
import { handleSignals, onShutdown } from "@tatara/core";
import { schedules } from "#generated/schedules";

const jobs = schedules.map((schedule) => {
	const log = logger.child({ schedule: schedule.name });
	return new Cron(schedule.cron, { timezone: "UTC", protect: true, name: schedule.name }, async (self) => {
		const tick = self.currentRun()?.toISOString() ?? new Date().toISOString();
		const ran = await withLock(`schedule:${schedule.name}:${tick}`, schedule.lockTtlMs ?? 60_000, () =>
			schedule.run({ logger: log }),
		).catch((error: unknown) => {
			log.error({ err: error }, "schedule failed");
			return true;
		});
		if (!ran) log.debug("skipped: another process holds this tick");
	});
});

onShutdown("cron", () => {
	for (const job of jobs) job.stop();
});
handleSignals(logger);
logger.info({ schedules: schedules.map((s) => `${s.name} (${s.cron})`) }, "cron started");
