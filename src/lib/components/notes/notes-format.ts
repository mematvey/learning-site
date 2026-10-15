/** Pure helpers for the margin notes UI. */

import type { NoteStatus } from '../../contracts';

/** Patch the note editor emits on save. */
export interface NotePatch {
	text: string;
	tags: string[];
	status: NoteStatus;
}

/** Splits a comma-separated tag field: trims, drops empty and duplicate tags. */
export function parseTags(input: string): string[] {
	const seen = new Set<string>();
	for (const raw of input.split(',')) {
		const tag = raw.trim();
		if (tag) seen.add(tag);
	}
	return [...seen];
}

/** Russian plural form: `plural(3, ['день', 'дня', 'дней'])` gives `'дня'`. */
export function plural(n: number, forms: [one: string, few: string, many: string]): string {
	const mod10 = n % 10;
	const mod100 = n % 100;
	if (mod10 === 1 && mod100 !== 11) return forms[0];
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
	return forms[2];
}

/** Relative age of a note: «только что», «3 часа назад», «2 дня назад». */
export function formatAgo(iso: string, now: Date = new Date()): string {
	const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
	if (!Number.isFinite(minutes) || minutes < 1) return 'только что';
	if (minutes < 60) return `${minutes} ${plural(minutes, ['минуту', 'минуты', 'минут'])} назад`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} ${plural(hours, ['час', 'часа', 'часов'])} назад`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days} ${plural(days, ['день', 'дня', 'дней'])} назад`;
	return new Date(iso).toLocaleDateString('ru-RU');
}

export interface StackItem {
	key: string;
	/** Desired top (px) from the anchored block. */
	top: number;
	height: number;
}

/**
 * Moves cards down so they do not overlap, keeping the order of their desired tops.
 * Returns the final top per key.
 */
export function stackTops(items: StackItem[], gap: number): Record<string, number> {
	const sorted = [...items].sort((a, b) => a.top - b.top);
	const result: Record<string, number> = {};
	let cursor = Number.NEGATIVE_INFINITY;
	for (const item of sorted) {
		const top = Math.max(item.top, cursor);
		result[item.key] = top;
		cursor = top + item.height + gap;
	}
	return result;
}
