// Loaded before the app (`node --import ./dist/apps/instrument.mjs …`, set in the Dockerfile):
// instrumentation can only patch libraries imported after it, so app code comes in dynamically.
import { register } from "node:module";

const { env } = await import("#core/config/env");

if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
	register("@opentelemetry/instrumentation/hook.mjs", import.meta.url);
	const { startTelemetry } = await import("@tatara/observability");
	startTelemetry({
		serviceName: env.OTEL_SERVICE_NAME,
		endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
		sampleRatio: env.OTEL_TRACES_SAMPLE_RATIO,
	});
}
