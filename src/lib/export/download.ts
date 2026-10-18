import type { ExportFile } from '$lib/contracts/my';

/** Saves text as a file through a temporary object URL. Browser only. */
export function downloadText(
	filename: string,
	content: string,
	mime = 'text/markdown;charset=utf-8',
): void {
	const url = URL.createObjectURL(new Blob([content], { type: mime }));
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.style.display = 'none';
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Joins all Markdown files into one document, each preceded by its path. No zip library is
 * bundled, so the export arrives as a single `all.md`; `backup.json` is downloaded separately.
 */
export function bundleMarkdown(files: ExportFile[]): string {
	return files
		.filter((file) => file.path.endsWith('.md'))
		.map((file) => `<!-- ${file.path} -->\n\n${file.content.trimEnd()}\n`)
		.join('\n---\n\n');
}

export function downloadZipLike(files: ExportFile[]): void {
	downloadText('all.md', bundleMarkdown(files));
}

/** Copies text to the clipboard; falls back to a hidden textarea where the API is missing. */
export async function copyText(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// Fall through to the textarea method.
	}
	try {
		const area = document.createElement('textarea');
		area.value = text;
		area.setAttribute('readonly', '');
		area.style.position = 'fixed';
		area.style.opacity = '0';
		document.body.append(area);
		area.select();
		const ok = document.execCommand('copy');
		area.remove();
		return ok;
	} catch {
		return false;
	}
}
