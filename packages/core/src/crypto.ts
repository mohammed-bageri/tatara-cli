import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
	randomInt,
	timingSafeEqual,
} from "node:crypto";

/** Ambiguous-free uppercase letters and digits (no 0/O, 1/I/L), for codes people type. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** `length` characters from `alphabet`, each uniformly random (no modulo bias). */
export function randomCode(length: number, alphabet = CODE_ALPHABET): string {
	if (!(Number.isInteger(length) && length > 0)) throw new Error("A code needs a positive length");
	if (alphabet.length < 2) throw new Error("A code alphabet needs at least two characters");
	let out = "";
	for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
	return out;
}

/** A one-time numeric code, e.g. for SMS sign-in. */
export const numericCode = (length = 6) => randomCode(length, "0123456789");

/** An unguessable token for links and API keys (base64url, `bytes` of randomness). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** What to store to look a token up later without storing the token itself. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("base64url");

/** Compares secrets without leaking, through timing, how much of them matched. */
export function safeEqual(a: string, b: string): boolean {
	const x = createHash("sha256").update(a).digest();
	const y = createHash("sha256").update(b).digest();
	return timingSafeEqual(x, y);
}

export interface Encryption {
	/** `enc1.<keyId>.<iv>.<ciphertext+tag>`: AES-256-GCM with the current key */
	encrypt(plaintext: string): string;
	/** decrypts with whichever key it was encrypted with; throws when it was tampered with */
	decrypt(sealed: string): string;
}

/**
 * Secrets at rest (OAuth tokens, API keys of other services). `keys` is "id:base64key,…", 32-byte
 * keys, the first one current: add a new key in front to rotate, keep the old ones to read.
 */
export function createEncryption(keys: string): Encryption {
	const parsed = keys
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map((entry) => {
			const at = entry.indexOf(":");
			const id = entry.slice(0, at);
			const key = Buffer.from(entry.slice(at + 1), "base64");
			if (at < 1 || !/^[A-Za-z0-9_-]+$/.test(id) || key.length !== 32)
				throw new Error("Encryption keys are id:base64, each key 32 bytes");
			return [id, key] as const;
		});
	if (new Set(parsed.map(([id]) => id)).size !== parsed.length)
		throw new Error("An encryption key id is listed twice");
	const current = parsed[0];
	if (!current) throw new Error("No encryption key");
	const byId = new Map(parsed);
	return {
		encrypt(plaintext) {
			const iv = randomBytes(12);
			const cipher = createCipheriv("aes-256-gcm", current[1], iv);
			cipher.setAAD(Buffer.from(current[0]));
			const body = Buffer.concat([
				cipher.update(plaintext, "utf8"),
				cipher.final(),
				cipher.getAuthTag(),
			]);
			return `enc1.${current[0]}.${iv.toString("base64url")}.${body.toString("base64url")}`;
		},
		decrypt(sealed) {
			const [version, id = "", iv = "", body = ""] = sealed.split(".");
			const key = byId.get(id);
			if (version !== "enc1" || !key) throw new Error("Can't decrypt: unknown format or key");
			const data = Buffer.from(body, "base64url");
			if (data.length < 16) throw new Error("Can't decrypt: too short");
			const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"), {
				authTagLength: 16,
			});
			decipher.setAAD(Buffer.from(id));
			decipher.setAuthTag(data.subarray(data.length - 16));
			return Buffer.concat([
				decipher.update(data.subarray(0, data.length - 16)),
				decipher.final(),
			]).toString("utf8");
		},
	};
}
