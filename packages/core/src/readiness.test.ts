import { expect, it } from "vitest";
import { createReadiness } from "./index.ts";

it("is ready when every check passes", async () => {
	const r = createReadiness();
	r.registerReadinessCheck("db", async () => {});
	expect(await r.runReadinessChecks()).toEqual({ ready: true, checks: { db: "ok" } });
});

it("is not ready when a check throws", async () => {
	const r = createReadiness();
	r.registerReadinessCheck("db", async () => {});
	r.registerReadinessCheck("redis", async () => {
		throw new Error("down");
	});
	expect(await r.runReadinessChecks()).toEqual({
		ready: false,
		checks: { db: "ok", redis: "failed" },
	});
});
