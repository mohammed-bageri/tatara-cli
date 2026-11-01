import { FEATURES } from "../features/index.ts";
import type { AppOptions, Feature } from "../features/types.ts";

export class OptionsError extends Error {}

/** Normalizes and validates options; throws OptionsError with a user-facing message. */
export function validateOptions(input: AppOptions): AppOptions {
	const options: AppOptions = {
		...input,
		authMethods: [...new Set(input.authMethods)],
		// schedules lock with the cache, so jobs bring it along
		addons: [
			...new Set([...input.addons, ...(input.addons.includes("jobs") ? (["cache"] as const) : [])]),
		],
	};
	if (!/^[a-z][a-z0-9-]*$/.test(options.name)) {
		throw new OptionsError(
			`App name "${options.name}" must be lowercase letters, digits and dashes, starting with a letter.`,
		);
	}
	if ((options.orm === "none") !== (options.database === "none")) {
		throw new OptionsError("Choose both an ORM and a database, or neither.");
	}
	const hasDb = options.database !== "none";
	if (options.auth !== "none" && !hasDb) {
		throw new OptionsError(`Auth (${options.auth}) needs a database.`);
	}
	if (options.auth === "better-auth") {
		const signIn = options.authMethods.filter((m) => m !== "orgs");
		if (signIn.length === 0) {
			throw new OptionsError(
				"better-auth needs at least one sign-in method: email-otp, phone-otp, password or keycloak.",
			);
		}
	} else if (options.authMethods.length > 0) {
		throw new OptionsError("Auth methods only apply to better-auth.");
	}
	for (const addon of options.addons) {
		if ((addon === "authz" || addon === "admin") && options.auth === "none") {
			throw new OptionsError(`The ${addon} add-on needs an auth provider.`);
		}
		if (addon === "authz" && !hasDb) {
			throw new OptionsError("The authz add-on needs a database.");
		}
	}
	return options;
}

/** Feature ids selected by the options, in application order. */
export function selectedFeatureIds(options: AppOptions): string[] {
	const ids = ["base", `pm-${options.packageManager}`];
	if (options.database !== "none") ids.push("db", options.database);
	if (options.orm !== "none") ids.push(options.orm);
	if (options.auth !== "none") ids.push(options.auth);
	if (options.auth === "better-auth") {
		for (const m of options.authMethods) ids.push(`auth-${m}`);
	}
	if (options.auth !== "none") ids.push("auth");
	for (const addon of options.addons) ids.push(addon);
	return ids;
}

export function resolveFeatures(options: AppOptions): Feature[] {
	return selectedFeatureIds(options).map((id) => {
		const feature = FEATURES[id];
		if (!feature) throw new Error(`Unknown feature "${id}"`);
		return feature;
	});
}

export function isApplicable(
	rule: { when?: string[]; unless?: string[] },
	selected: ReadonlySet<string>,
): boolean {
	if (rule.when && !rule.when.every((id) => selected.has(id))) return false;
	if (rule.unless?.some((id) => selected.has(id))) return false;
	return true;
}
