import type { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends Error {
	readonly status: ContentfulStatusCode;
	readonly code: string;
	readonly details?: unknown;

	constructor(status: ContentfulStatusCode, code: string, message: string, details?: unknown) {
		super(message);
		this.name = new.target.name;
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

export class ValidationError extends AppError {
	constructor(message = "Invalid request", details?: unknown) {
		super(400, "VALIDATION_ERROR", message, details);
	}
}

export class BusinessRuleError extends AppError {
	constructor(code: string, message: string, details?: unknown) {
		super(400, code, message, details);
	}
}

export class UnauthorizedError extends AppError {
	constructor(message = "Authentication required") {
		super(401, "UNAUTHORIZED", message);
	}
}

export class ForbiddenError extends AppError {
	constructor(message = "You do not have permission to do this") {
		super(403, "FORBIDDEN", message);
	}
}

export class NotFoundError extends AppError {
	constructor(resource = "Resource") {
		super(404, "NOT_FOUND", `${resource} not found`);
	}
}

export class ConflictError extends AppError {
	constructor(message = "Resource already exists", details?: unknown) {
		super(409, "CONFLICT", message, details);
	}
}
