import { z } from "zod";
import { defineCommand } from "@tatara/core";
import { sendEmail } from "#core/email/send";

export default defineCommand({
	name: "email:send-test",
	description: "Send a test email (see it in Mailpit locally)",
	args: z.object({ to: z.email().default("dev@example.com") }),
	async run({ to }, { logger }) {
		await sendEmail({ to, subject: "Test email", text: "It works." });
		logger.info({ to }, "test email sent");
	},
});
