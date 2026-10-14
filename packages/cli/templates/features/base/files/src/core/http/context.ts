import type { Logger } from "#core/logging/logger";

export interface Principal {
	userId: string;
	orgId: string | null;
	roles: string[];
	kind: "user" | "service";
	claims: Record<string, unknown>;
}

export interface AppEnv {
	Variables: {
		requestId: string;
		logger: Logger;
		principal: Principal | null;
		language: string;
	};
}
