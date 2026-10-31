import { createTestUser, sessionHeaders } from "@tatara/auth/testing";
import { staffAuth } from "#modules/staff/services/auth";

/** Headers that authenticate as a new staff member on the admin app. */
export async function asStaff(options: { role?: string } = {}): Promise<Record<string, string>> {
	const userId = await createTestUser(staffAuth, { fields: { role: options.role ?? "staff" } });
	return sessionHeaders(staffAuth, userId);
}
