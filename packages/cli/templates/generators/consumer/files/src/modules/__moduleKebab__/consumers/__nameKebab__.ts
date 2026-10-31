import { z } from "zod";
import { defineConsumer } from "@tatara/jobs";

export const __nameCamel__Payload = z.object({ id: z.string().min(1) });

export default defineConsumer({
	topic: "__moduleKebab__.__nameKebab__",
	description: "__nameTitle__",
	schema: __nameCamel__Payload,
	async handle({ id }, { logger }) {
		// must be idempotent: a job can run more than once
		logger.info({ id }, "__moduleKebab__.__nameKebab__ handled");
	},
});
