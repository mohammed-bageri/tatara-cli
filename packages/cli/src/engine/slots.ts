const MARKER = /^(\s*)(?:\/\/|#|<!--)\s*tatara:slot\s+([\w-]+)\s*(?:-->)?\s*$/;

export interface SlotFill {
	slot: string;
	content: string;
	order: number;
}

/** Replaces every `tatara:slot <name>` marker line with its contributions (or nothing). */
export function fillSlots(text: string, fills: SlotFill[]): string {
	const bySlot = new Map<string, SlotFill[]>();
	for (const fill of fills) {
		const list = bySlot.get(fill.slot) ?? [];
		list.push(fill);
		bySlot.set(fill.slot, list);
	}
	const out: string[] = [];
	for (const line of text.split("\n")) {
		const match = MARKER.exec(line);
		if (!match) {
			out.push(line);
			continue;
		}
		const indent = match[1] ?? "";
		const contributions = (bySlot.get(match[2] ?? "") ?? []).sort((a, b) => a.order - b.order);
		const seen = new Set<string>();
		for (const c of contributions) {
			// the same import contributed by two features is inserted once
			if (seen.has(c.content)) continue;
			seen.add(c.content);
			for (const contentLine of c.content.replace(/\n$/, "").split("\n")) {
				out.push(contentLine.length > 0 ? indent + contentLine : "");
			}
		}
	}
	return out.join("\n");
}

export function hasSlots(text: string): boolean {
	return text.split("\n").some((line) => MARKER.test(line));
}
