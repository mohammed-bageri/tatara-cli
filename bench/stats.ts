/** Median of a non-empty list; the bench compares medians so one slow run can't fail a budget. */
export function median(samples: readonly number[]): number {
	if (samples.length === 0) throw new Error("median of an empty list");
	const sorted = [...samples].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2
		? (sorted[mid] as number)
		: ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}
