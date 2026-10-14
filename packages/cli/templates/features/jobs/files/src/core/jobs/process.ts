import type { ConsumerDefinition, JobContext } from "#core/jobs/define";

export class UnknownTopicError extends Error {}

/** Validates and runs one job; shared by the worker and by tests. */
export async function processJob(
	consumers: ConsumerDefinition[],
	topic: string,
	data: unknown,
	ctx: JobContext,
): Promise<void> {
	const consumer = consumers.find((c) => c.topic === topic);
	if (!consumer) throw new UnknownTopicError(`No consumer for topic "${topic}"`);
	const parsed = consumer.schema.safeParse(data);
	if (!parsed.success) {
		throw new Error(`Invalid payload for ${topic}: ${parsed.error.message}`);
	}
	await consumer.handle(parsed.data, ctx);
}
