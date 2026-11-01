import { defineEmail } from "@tatara/email";
import { z } from "zod";

export default defineEmail({
	name: "example.welcome",
	schema: z.object({ name: z.string().min(1) }),
	render: ({ name }, language) =>
		language === "ar"
			? { subject: "أهلاً بك", text: `أهلاً ${name}` }
			: { subject: "Welcome", text: `Hello ${name}, welcome aboard.` },
});
