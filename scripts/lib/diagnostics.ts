/**
 * One problem found in the content tree. `file` is repo-relative, `line` is 1-based.
 * `severity` defaults to `error`; a `warning` is printed but does not fail the check.
 */
export interface Diagnostic {
	file: string;
	line: number;
	message: string;
	severity?: 'error' | 'warning';
}

export function isError(d: Diagnostic): boolean {
	return d.severity !== 'warning';
}

export function formatDiagnostic(d: Diagnostic): string {
	const prefix = isError(d) ? '' : 'предупреждение: ';
	return `${d.file}:${d.line}: ${prefix}${d.message}`;
}

/** 1-based line of the first line matching `pattern`, or `fallback` when nothing matches. */
export function lineOf(text: string | readonly string[], pattern: RegExp, fallback = 1): number {
	const lines = typeof text === 'string' ? text.split('\n') : text;
	const index = lines.findIndex((line) => pattern.test(line));
	return index === -1 ? fallback : index + 1;
}
