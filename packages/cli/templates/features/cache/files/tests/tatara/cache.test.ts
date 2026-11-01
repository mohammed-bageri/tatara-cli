import { orgKey } from "@tatara/cache";
import { describe, expect, it, vi } from "vitest";
import { cache } from "#core/cache/index";

describe("cache", () => {
	it("wraps a computation and drops an org's keys together", async () => {
		const orgId = crypto.randomUUID();
		const load = vi.fn(async () => ({ total: 3 }));
		expect(await cache.wrap(orgKey(orgId, "dashboard"), 60_000, load)).toEqual({ total: 3 });
		expect(await cache.wrap(orgKey(orgId, "dashboard"), 60_000, load)).toEqual({ total: 3 });
		expect(load).toHaveBeenCalledTimes(1);
		expect(await cache.delPrefix(orgKey(orgId))).toBe(1);
		expect(await cache.get(orgKey(orgId, "dashboard"))).toBeNull();
	});

	it("lets one holder run under a lock", async () => {
		const key = crypto.randomUUID();
		const first = cache.lock(key, 10_000, () => new Promise((r) => setTimeout(() => r("ran"), 50)));
		expect(await cache.lock(key, 10_000, async () => "second")).toEqual({ acquired: false });
		expect(await first).toEqual({ acquired: true, value: "ran" });
	});
});
