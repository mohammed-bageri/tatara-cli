import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	type CommandLedger,
	cleanText,
	createEncryption,
	defineCommand,
	hashToken,
	numericCode,
	randomCode,
	runCommand,
	safeEqual,
	safeUrl,
	text,
	url,
} from "./index.ts";

const logger = pino({ level: "silent" });
const key = (byte: number) => Buffer.alloc(32, byte).toString("base64");

describe("encryption", () => {
	it("round-trips, and reads values sealed with an older key after rotation", () => {
		const old = createEncryption(`k1:${key(1)}`);
		const sealed = old.encrypt("refresh-token");
		expect(sealed).toMatch(/^enc1\.k1\./);
		const rotated = createEncryption(`k2:${key(2)},k1:${key(1)}`);
		expect(rotated.decrypt(sealed)).toBe("refresh-token");
		expect(rotated.encrypt("x")).toMatch(/^enc1\.k2\./);
	});

	it("refuses tampered values, unknown keys and bad keys", () => {
		const e = createEncryption(`k1:${key(1)}`);
		const sealed = e.encrypt("secret");
		const parts = sealed.split(".");
		const body = Buffer.from(parts[3] as string, "base64url");
		body[0] = (body[0] as number) ^ 1;
		expect(() => e.decrypt([...parts.slice(0, 3), body.toString("base64url")].join("."))).toThrow();
		// the key id is authenticated: relabelling a value fails too
		expect(() =>
			createEncryption(`k9:${key(1)}`).decrypt(sealed.replace(".k1.", ".k9.")),
		).toThrow();
		expect(() => e.decrypt("plain")).toThrow(/unknown format/);
		expect(() => createEncryption("k1:c2hvcnQ=")).toThrow(/32 bytes/);
		expect(() => createEncryption(`k1:${key(1)},k1:${key(2)}`)).toThrow(/twice/);
		// a value cut short (no full tag) is refused, whatever Node allows
		expect(() => e.decrypt(`${parts.slice(0, 3).join(".")}.AAAA`)).toThrow();
	});
});

describe("codes and tokens", () => {
	it("draws codes from the alphabet, evenly", () => {
		expect(numericCode()).toMatch(/^\d{6}$/);
		const counts = new Map<string, number>();
		for (let i = 0; i < 20_000; i++) {
			const c = randomCode(1, "abc");
			counts.set(c, (counts.get(c) ?? 0) + 1);
		}
		for (const n of counts.values()) expect(Math.abs(n - 20_000 / 3)).toBeLessThan(400);
	});

	it("hashes tokens and compares secrets of any length", () => {
		expect(hashToken("t")).toBe(hashToken("t"));
		expect(safeEqual("abc", "abc")).toBe(true);
		expect(safeEqual("abc", "abcd")).toBe(false);
	});
});

describe("text", () => {
	it("cleans control, invisible and bidi characters and collapses whitespace", () => {
		expect(cleanText("  hello\u0000  \u202Eworld\u200B  ")).toBe("hello world");
		expect(cleanText("a\r\n\r\n\r\n\r\nb  c", { multiline: true })).toBe("a\n\nb c");
		expect(cleanText("é")).toBe("é");
	});

	it("strips every format character but the joiners scripts and emoji need", () => {
		const sneaky = "a\u061Cb\u00ADc\u180Ed\u{E0041}e\uFFF9f\u3164g\u034Fh";
		expect(cleanText(sneaky)).toBe("abcdefgh");
		// ZWNJ (Persian) and ZWJ (emoji sequences) stay
		expect(cleanText("می\u200Cخواهم 👨\u200D👩")).toBe("می\u200Cخواهم 👨\u200D👩");
		expect(cleanText("a\rb", { multiline: true })).toBe("a\nb");
	});

	it("keeps only http(s) links", () => {
		expect(safeUrl("https://google.com@evil.com/")).toBeNull();
		expect(safeUrl("https://user:pass@x.com/")).toBeNull();
		expect(safeUrl("https://example.com/a b")).toBe("https://example.com/a%20b");
		expect(safeUrl("javascript:alert(1)")).toBeNull();
		expect(safeUrl("data:text/html,x")).toBeNull();
		expect(safeUrl("not a url")).toBeNull();
	});

	it("gives zod fields that clean before they check", () => {
		const schema = z.object({ title: text({ min: 1, max: 5 }), site: url() });
		expect(schema.parse({ title: "  hi\u200B ", site: "https://x.dev" })).toEqual({
			title: "hi",
			site: "https://x.dev/",
		});
		expect(schema.safeParse({ title: "   ", site: "https://x.dev" }).success).toBe(false);
		expect(schema.safeParse({ title: "ok", site: "javascript:x" }).success).toBe(false);
	});
});

function memoryLedger(): CommandLedger & { runs: string[] } {
	const runs: string[] = [];
	return {
		runs,
		async completed() {
			return new Set(runs);
		},
		async record({ name }) {
			runs.push(name);
		},
	};
}

describe("deploy", () => {
	it("runs deploy commands every time and once commands once, in order", async () => {
		const ran: string[] = [];
		const commands = [
			defineCommand({
				name: "b:seed-plans",
				description: "",
				phase: "once",
				order: 20,
				run: () => void ran.push("seed"),
			}),
			defineCommand({
				name: "a:sync",
				description: "",
				phase: "deploy",
				order: 10,
				run: () => void ran.push("sync"),
			}),
			defineCommand({ name: "c:manual", description: "", run: () => void ran.push("manual") }),
		];
		const ledger = memoryLedger();
		expect(await runCommand(commands, ["deploy"], logger, { ledger })).toBe(0);
		expect(await runCommand(commands, ["deploy"], logger, { ledger })).toBe(0);
		expect(ran).toEqual(["sync", "seed", "sync"]);
	});

	it("fails the deploy, logged, when the ledger can't record, and runs nothing it can't run", async () => {
		const broken: CommandLedger = {
			completed: async () => new Set(),
			record: async () => {
				throw new Error("no such table");
			},
		};
		const ran: string[] = [];
		const commands = [
			defineCommand({
				name: "a:once",
				description: "",
				phase: "once",
				run: () => void ran.push("once"),
			}),
		];
		expect(await runCommand(commands, ["deploy"], logger, { ledger: broken })).toBe(1);
		const needsArgs = [
			defineCommand({
				name: "a:first",
				description: "",
				phase: "deploy",
				order: 1,
				run: () => void ran.push("first"),
			}),
			defineCommand({
				name: "b:args",
				description: "",
				phase: "deploy",
				order: 2,
				args: z.object({ id: z.string() }),
				run: () => void ran.push("args"),
			}),
		];
		ran.length = 0;
		expect(await runCommand(needsArgs, ["deploy"], logger, { ledger: memoryLedger() })).toBe(1);
		expect(ran).toEqual([]);
	});

	it("runs one deploy at a time when the ledger can lock", async () => {
		let held = false;
		let overlapped = false;
		const ledger: CommandLedger = {
			...memoryLedger(),
			async exclusive(fn) {
				while (held) await new Promise((r) => setTimeout(r, 5));
				held = true;
				try {
					return await fn();
				} finally {
					held = false;
				}
			},
		};
		let inside = 0;
		const commands = [
			defineCommand({
				name: "a:slow",
				description: "",
				phase: "once",
				async run() {
					inside++;
					if (inside > 1) overlapped = true;
					await new Promise((r) => setTimeout(r, 30));
					inside--;
				},
			}),
		];
		await Promise.all([1, 2].map(() => runCommand(commands, ["deploy"], logger, { ledger })));
		expect(overlapped).toBe(false);
	});

	it("stops at the first failure and records nothing for it", async () => {
		const later = vi.fn();
		const ledger = memoryLedger();
		const commands = [
			defineCommand({
				name: "a:break",
				description: "",
				phase: "once",
				order: 1,
				run: () => {
					throw new Error("no");
				},
			}),
			defineCommand({ name: "b:later", description: "", phase: "deploy", order: 2, run: later }),
		];
		expect(await runCommand(commands, ["deploy"], logger, { ledger })).toBe(1);
		expect(later).not.toHaveBeenCalled();
		expect(ledger.runs).toEqual([]);
	});
});
