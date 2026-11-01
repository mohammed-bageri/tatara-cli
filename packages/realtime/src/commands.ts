import { type CommandDefinition, defineCommand } from "@tatara/core";
import { z } from "zod";

/** realtime:publish; wired into the app by `tatara sync`. */
export function realtimeCommands({
	realtime,
}: {
	realtime: {
		publishToUser(orgId: string, userId: string, event: string, payload: unknown): Promise<void>;
	};
}): CommandDefinition[] {
	return [
		defineCommand({
			name: "realtime:publish",
			description: "Send an event to a user's open sockets, from outside the api (debugging)",
			args: z.object({
				org: z.string().default("default"),
				user: z.string().min(1),
				event: z.string().min(1),
				data: z.string().default("{}"),
			}),
			async run({ org, user, event, data }, { logger }) {
				await realtime.publishToUser(org, user, event, JSON.parse(data) as unknown);
				logger.info({ org, user, event }, "published");
			},
		}),
	] as CommandDefinition[];
}
