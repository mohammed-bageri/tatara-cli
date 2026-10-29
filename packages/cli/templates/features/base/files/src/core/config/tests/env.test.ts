import { afterEach, describe, expect, it, vi } from "vitest";

// .env.test is loaded into process.env, so it holds every variable this app requires
const saved = { ...process.env };

const LOCAL_DEFAULTS = [
	"APP_URL",
	"CORS_ORIGINS",
	"EMAIL_DRIVER",
	"STORAGE_DRIVER",
	"SMTP_URL",
	"KEYCLOAK_URL",
].filter((key) => saved[key] !== undefined);

async function loadEnv(vars: Record<string, string | undefined>) {
	vi.resetModules();
	process.env = { ...vars } as NodeJS.ProcessEnv;
	return (await import("#core/config/env")).env;
}

afterEach(() => {
	process.env = { ...saved };
	vi.resetModules();
});

describe("env in production", () => {
	it("loads when every setting is given", async () => {
		const env = await loadEnv({ ...saved, NODE_ENV: "production" });
		expect(env.NODE_ENV).toBe("production");
	});

	it.each(LOCAL_DEFAULTS)("refuses to fall back to the local default for %s", async (key) => {
		await expect(loadEnv({ ...saved, NODE_ENV: "production", [key]: undefined })).rejects.toThrow();
	});

	it("keeps local defaults outside production", async () => {
		const env = await loadEnv({ ...saved, NODE_ENV: "development", APP_URL: undefined });
		expect(env.APP_URL).toBe("http://localhost:3000");
	});
});
