import { randomFillSync } from "node:crypto";

/** UUIDv7: random but time-ordered, so sorting by id is sorting by creation time. */
export function newId(): string {
	const bytes = new Uint8Array(16);
	randomFillSync(bytes);
	const ms = BigInt(Date.now());
	for (let i = 0; i < 6; i++) bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
	const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
