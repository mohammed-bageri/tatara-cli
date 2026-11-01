import { defineNotification } from "@tatara/notifications";
import { z } from "zod";

export default defineNotification({
	name: "example.welcome",
	description: "Example notification: greets a new user",
	schema: z.object({ name: z.string().min(1) }),
	channels: ["in-app", "push"],
	inApp: ({ name }, language) => ({
		title: language === "ar" ? `أهلاً ${name}` : `Welcome, ${name}`,
		url: "/",
	}),
	push: ({ name }) => ({ title: `Welcome, ${name}` }),
});
