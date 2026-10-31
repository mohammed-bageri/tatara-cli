import { z } from "zod";
import { keycloak } from "#modules/users/services/keycloak";
import { defineCommand } from "@tatara/core";
import { env } from "#core/config/env";

export default defineCommand({
	name: "keycloak:token",
	description: "Print an access token for a dev-realm user (development only)",
	args: z.object({
		user: z.string().default("alice"),
		password: z.string().optional(),
		client: z.string().default("__APP_NAME__-web"),
	}),
	async run({ user, password, client }) {
		if (env.NODE_ENV === "production") throw new Error("keycloak:token is for development only");
		const res = await fetch(`${keycloak.issuer}/protocol/openid-connect/token`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "password",
				client_id: client,
				username: user,
				password: password ?? user,
				// the organization scope puts the user's Keycloak organizations in the token
				scope: "openid organization",
			}),
		});
		const body = (await res.json()) as { access_token?: string; error_description?: string };
		if (!res.ok || !body.access_token) {
			throw new Error(`Keycloak refused: ${body.error_description ?? res.statusText}`);
		}
		console.log(body.access_token);
	},
});
