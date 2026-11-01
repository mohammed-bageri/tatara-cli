import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { upgrade } from "../../commands/upgrade.ts";
import { loadProject, type Project } from "../../project/config.ts";
import { hashContent } from "../../project/hashes.ts";
import { authzRoles } from "./authz-roles.ts";

const ROLES = `export const SYSTEM_ROLES = [
	{ key: "admin", name: "Admin", description: "Full access, including roles and members." },
	{ key: "member", name: "Member", description: "Default role for every member." },
	{ key: "teacher", name: "Teacher", description: "Their classes." },
	{
		key: "staff",
		name: "Staff",
		description: "Internal staff: platform permissions on the admin app.",
	},
] as const;
`;

function app(authMethods: string[], addons = ["authz"]): Project {
	const root = mkdtempSync(join(tmpdir(), "tatara-authz-roles-"));
	const files: Record<string, string> = {
		"src/core/authz/system-roles.ts": ROLES,
		"package.json": JSON.stringify({ name: "app", dependencies: {}, devDependencies: {} }),
		"tatara.json": JSON.stringify({
			version: "0.12.0",
			name: "app",
			orm: "prisma",
			database: "postgres",
			auth: "better-auth",
			authMethods,
			addons,
			packageManager: "pnpm",
			generated: { cli: "0.12.0", files: {} },
		}),
	};
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	return loadProject(root);
}

const run = (project: Project) =>
	upgrade(project, {
		cliVersion: "0.13.0",
		codemods: [authzRoles],
		baseline: {
			async isUnchanged(path, content) {
				return project.config.generated?.files[path] === hashContent(content);
			},
		},
		runSync: async () => {},
		runInstall: async () => {},
		formatFile: async () => {},
	});
const roles = (project: Project) =>
	readFileSync(join(project.root, "src/core/authz/system-roles.ts"), "utf8");
const heldBy = (text: string, key: string) =>
	new RegExp(`key: "${key}"[^}]*heldBy: "(\\w+)"`).exec(text)?.[1];

describe("0.13.0 authz-roles codemod", () => {
	it("gives member to every member and staff to the staff identity role, and says the rest", async () => {
		const project = app(["password", "orgs"]);
		const report = await run(project);
		const text = roles(project);
		expect(heldBy(text, "member")).toBe("members");
		expect(heldBy(text, "staff")).toBe("identity");
		expect(heldBy(text, "admin")).toBeUndefined();
		expect(heldBy(text, "teacher")).toBeUndefined();
		const notes = report.notes.join("\n");
		expect(notes).toContain("authzPlugin(authz");
		expect(notes).toContain("no longer follow better-auth's member role");
		// idempotent
		await run(project);
		expect(roles(project)).toBe(text);
	});

	it("keeps honouring Keycloak roles", async () => {
		const project = app(["keycloak"]);
		await run(project);
		const text = roles(project);
		expect(heldBy(text, "admin")).toBe("identity");
		expect(heldBy(text, "teacher")).toBe("identity");
		expect(heldBy(text, "member")).toBe("members");
	});

	it("leaves an app without authz alone", async () => {
		const project = app(["password"], []);
		const report = await run(project);
		expect(roles(project)).toBe(ROLES);
		expect(report.notes.join("\n")).not.toContain("heldBy");
	});
});
