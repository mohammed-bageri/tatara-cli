export function greet(name?: string): { message: string } {
	return { message: `Hello, ${name ?? "world"}!` };
}
