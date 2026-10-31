import { cache } from "#core/cache/index";
import { schedules } from "#generated/schedules";
// tatara:slot imports

/** What runs a schedule, wherever it's triggered from: the cron app, `schedule:run`, or HTTP. */
export const scheduleRunner = {
	schedules,
	// one run per tick across every process and trigger
	lock: cache,
	// tatara:slot options
};
