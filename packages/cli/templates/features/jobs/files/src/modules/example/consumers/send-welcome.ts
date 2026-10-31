import { z } from "zod";
import { defineConsumer } from "@tatara/jobs";

export default defineConsumer({
	topic: "example.send-welcome",
	description: "Example consumer: greets a new user",
	schema: z.object({ name: z.string().min(1) }),
	async handle({ name }, { logger }) {
		logger.info({ name }, "welcome sent");
	},
});
