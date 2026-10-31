import type { z } from "zod";

/** Who a socket is: fixed when it connects, from its ticket. */
export interface SocketIdentity {
	userId: string;
	orgId: string;
}

type ParamsOf<P extends string> = P extends `${string}{${infer K}}${infer Rest}`
	? { [key in K]: string } & ParamsOf<Rest>
	: unknown;

export interface ChannelDefinition<
	P extends string = string,
	E extends Record<string, z.ZodType> = Record<string, z.ZodType>,
> {
	/** a dotted pattern with {params}, e.g. "survey.{surveyId}" */
	name: P;
	description: string;
	/** the events published on it, each with its payload schema */
	events: E;
	/** may this socket listen? (row-level checks: is the user in this survey's org team…) */
	authorize(
		who: SocketIdentity,
		params: ParamsOf<P> & Record<string, string>,
	): Promise<boolean> | boolean;
}

/** Default export of every `channels/*.ts`. */
export function defineChannel<const P extends string, E extends Record<string, z.ZodType>>(
	definition: ChannelDefinition<P, E>,
): ChannelDefinition<P, E> {
	return definition;
}

const PARAM = "[A-Za-z0-9_-]{1,128}";

/** The params when `channel` matches `pattern`, else null. Params can't hold "." or "|". */
export function matchChannel(pattern: string, channel: string): Record<string, string> | null {
	const names: string[] = [];
	const source = pattern
		.split(/(\{[A-Za-z][A-Za-z0-9_]*\})/)
		.map((part) => {
			const param = /^\{(.+)\}$/.exec(part);
			if (!param) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			names.push(param[1] as string);
			return `(${PARAM})`;
		})
		.join("");
	const match = new RegExp(`^${source}$`).exec(channel);
	if (!match) return null;
	return Object.fromEntries(names.map((name, i) => [name, match[i + 1] as string]));
}

/** "survey.{surveyId}" with { surveyId: "s1" } → "survey.s1"; throws on a param it can't carry. */
export function channelName(pattern: string, params: Record<string, string>): string {
	return pattern.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (_, key: string) => {
		const value = params[key];
		if (value === undefined || !new RegExp(`^${PARAM}$`).test(value))
			throw new Error(`Channel ${pattern} needs a valid "${key}"`);
		return value;
	});
}

// every room starts with the org, so a channel can never reach another tenant
export const userRoom = (who: SocketIdentity) => `o:${who.orgId}|user:${who.userId}`;
export const orgRoom = (orgId: string) => `o:${orgId}|org`;
export const channelRoom = (orgId: string, channel: string) => `o:${orgId}|ch:${channel}`;
