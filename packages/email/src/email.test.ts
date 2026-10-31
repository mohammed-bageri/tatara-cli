import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";
import { createMailer } from "./index.ts";

const sendMail = vi.fn(async () => ({}));
vi.mock("nodemailer", () => ({ createTransport: vi.fn(() => ({ sendMail })) }));

describe("createMailer", () => {
	it("logs recipient and subject, never the body, with the console driver", async () => {
		const lines: string[] = [];
		const logger = pino({}, { write: (line: string) => lines.push(line) });
		const mailer = createMailer({ driver: "console", smtpUrl: "smtp://x", from: "a@x", logger });
		await mailer.send({ to: "b@x", subject: "Hi", text: "secret code 123456" });
		expect(lines.join("")).toContain("b@x");
		expect(lines.join("")).not.toContain("123456");
		expect(sendMail).not.toHaveBeenCalled();
	});

	it("sends through one SMTP transport with the configured sender", async () => {
		const { createTransport } = await import("nodemailer");
		const mailer = createMailer({
			driver: "smtp",
			smtpUrl: "smtp://localhost:1025",
			from: "noreply@x",
			logger: pino({ level: "silent" }),
		});
		await mailer.send({ to: "b@x", subject: "Hi", text: "Hello" });
		await mailer.send({ to: "c@x", subject: "Hi", text: "Hello" });
		expect(createTransport).toHaveBeenCalledTimes(1);
		expect(createTransport).toHaveBeenCalledWith("smtp://localhost:1025");
		expect(sendMail).toHaveBeenLastCalledWith({
			from: "noreply@x",
			to: "c@x",
			subject: "Hi",
			text: "Hello",
		});
	});
});
