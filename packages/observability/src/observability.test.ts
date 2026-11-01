import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Hono } from "hono";
import { afterAll, describe, expect, it } from "vitest";
import { httpTracing, startTelemetry, traceIds } from "./index.ts";

/** An OTLP/HTTP receiver that keeps what it's sent. */
async function receiver() {
	const received: { path: string; body: string }[] = [];
	const server = createServer((req, res) => {
		let body = "";
		req.on("data", (chunk: Buffer) => {
			body += chunk.toString();
		});
		req.on("end", () => {
			received.push({ path: req.url ?? "", body });
			res.writeHead(200, { "content-type": "application/json" }).end("{}");
		});
	});
	await new Promise<void>((r) => server.listen(0, r));
	return {
		received,
		url: `http://localhost:${(server.address() as AddressInfo).port}`,
		close: () => server.close(),
	};
}

describe("telemetry", () => {
	let close = () => {};
	afterAll(() => close());

	it("starts nothing without an endpoint", () => {
		expect(startTelemetry({ serviceName: "app" })).toBeNull();
	});

	it("exports a traced Hono request over OTLP, and puts its ids on log lines", async () => {
		const otlp = await receiver();
		close = otlp.close;
		const sdk = startTelemetry({
			serviceName: "test-app",
			endpoint: otlp.url,
			autoInstrument: false,
		});
		const app = new Hono();
		app.use(httpTracing("test-app"));
		let ids: Record<string, string> = {};
		app.get("/hello", (c) => {
			ids = traceIds();
			return c.text("hi");
		});
		expect((await app.request("/hello")).status).toBe(200);
		expect(ids.trace_id).toMatch(/^[0-9a-f]{32}$/);
		await sdk?.shutdown();
		const traces = otlp.received.filter((r) => r.path === "/v1/traces");
		expect(traces.length).toBeGreaterThan(0);
		expect(traces.map((t) => t.body).join("")).toContain(ids.trace_id as string);
		expect(traceIds()).toEqual({});
	});
});
