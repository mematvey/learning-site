/** One problem found in the content tree. `file` is repo-relative, `line` is 1-based. */
export interface Diagnostic {
	file: string;
	line: number;
	message: string;
}

export function formatDiagnostic(d: Diagnostic): string {
	return `${d.file}:${d.line}: ${d.message}`;
}

/** 1-based line of the first line matching `pattern`, or `fallback` when nothing matches. */
export function lineOf(text: string | readonly string[], pattern: RegExp, fallback = 1): number {
	const lines = typeof text === 'string' ? text.split('\n') : text;
	const index = lines.findIndex((line) => pattern.test(line));
	return index === -1 ? fallback : index + 1;
}
