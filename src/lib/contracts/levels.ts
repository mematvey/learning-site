import { z } from 'zod';

/**
 * Level engine contract. Two axes:
 * - `c` (Сложность) 1..4
 * - `d` (Глубина) 1..3
 * Components `Level` / `Variant` and `?c=&d=` URL parameters use these helpers.
 */

export const AXES = ['c', 'd'] as const;
export type Axis = (typeof AXES)[number];

export const AXIS_BOUNDS = {
	c: { min: 1, max: 4 },
	d: { min: 1, max: 3 },
} as const satisfies Record<Axis, { min: number; max: number }>;

/** Axis titles (Russian UI). */
export const AXIS_TITLES = { c: 'Сложность', d: 'Глубина' } as const satisfies Record<Axis, string>;

/** Labels of each slider position, index = value - 1. */
export const AXIS_LABELS = {
	c: ['Интуиция', 'Основа', 'Формально', 'Исследователь'],
	d: ['Идея', 'Реализация', 'Железо'],
} as const satisfies Record<Axis, readonly string[]>;

export const DEFAULT_LEVELS: LevelState = { c: 2, d: 1 };

export const CLevel = z.number().int().min(AXIS_BOUNDS.c.min).max(AXIS_BOUNDS.c.max);
export const DLevel = z.number().int().min(AXIS_BOUNDS.d.min).max(AXIS_BOUNDS.d.max);

/** Applied slider positions. */
export const LevelState = z.object({ c: CLevel, d: DLevel });
export type LevelState = z.infer<typeof LevelState>;

/** Inclusive integer range on one axis. `"2-4"` -> {min:2,max:4}; `"1"` -> {min:1,max:1}. */
export type LevelRange = { min: number; max: number };

/** Returns the label of a position, e.g. `levelLabel('c', 3)` -> `Формально`. */
export function levelLabel(axis: Axis, value: number): string {
	return AXIS_LABELS[axis][value - 1] ?? '';
}

/** Parses `"n"` or `"a-b"` (a <= b, both inside the axis bounds). Returns null if invalid. */
export function parseRange(text: string, axis: Axis): LevelRange | null {
	const m = /^(\d+)(?:-(\d+))?$/.exec(text.trim());
	if (!m) return null;
	const min = Number(m[1]);
	const max = m[2] === undefined ? min : Number(m[2]);
	const { min: lo, max: hi } = AXIS_BOUNDS[axis];
	if (min > max || min < lo || max > hi) return null;
	return { min, max };
}

/** Inverse of `parseRange`: `{1,1}` -> `"1"`, `{2,4}` -> `"2-4"`. */
export function formatRange(range: LevelRange): string {
	return range.min === range.max ? String(range.min) : `${range.min}-${range.max}`;
}

/** Zod schema for a range string on a given axis (`Variant c="2-4"`). Output stays a string. */
export const rangeString = (axis: Axis) =>
	z.string().refine((s) => parseRange(s, axis) !== null, `invalid range for axis ${axis}`);
export const CRange = rangeString('c');
export const DRange = rangeString('d');

/** True if `value` lies inside the inclusive range. */
export function inRange(range: LevelRange, value: number): boolean {
	return value >= range.min && value <= range.max;
}

/**
 * Visibility of an additive `Level` layer: visible when every given minimum is reached (AND).
 * `isLevelVisible({c: 3}, {c: 2, d: 3})` -> false.
 */
export function isLevelVisible(min: { c?: number; d?: number }, state: LevelState): boolean {
	return state.c >= (min.c ?? AXIS_BOUNDS.c.min) && state.d >= (min.d ?? AXIS_BOUNDS.d.min);
}

/**
 * True if the given ranges cover the whole axis with no gaps and no overlaps.
 * Used by the content linter for a group of adjacent `Variant` blocks.
 */
export function coversAxis(ranges: readonly LevelRange[], axis: Axis): boolean {
	const sorted = [...ranges].sort((a, b) => a.min - b.min);
	let next: number = AXIS_BOUNDS[axis].min;
	for (const r of sorted) {
		if (r.min !== next) return false;
		next = r.max + 1;
	}
	return next === AXIS_BOUNDS[axis].max + 1;
}

/**
 * Reads levels from a URL query (`?c=2&d=3`). Accepts a query string (with or without `?`),
 * `URLSearchParams` or `URL`. Invalid or missing parameters are dropped silently:
 * the result contains only valid axes.
 */
export function levelsFromUrl(source: string | URLSearchParams | URL): Partial<LevelState> {
	const params =
		source instanceof URL
			? source.searchParams
			: typeof source === 'string'
				? new URLSearchParams(source.includes('?') ? source.slice(source.indexOf('?')) : source)
				: source;
	const result: Partial<LevelState> = {};
	for (const axis of AXES) {
		const raw = params.get(axis);
		if (raw === null || !/^\d+$/.test(raw)) continue;
		const value = Number(raw);
		const { min, max } = AXIS_BOUNDS[axis];
		if (value >= min && value <= max) result[axis] = value;
	}
	return result;
}

/** Serializes levels to a query string without `?`: `{c:2,d:3}` -> `c=2&d=3`. */
export function levelsToQuery(state: LevelState): string {
	return `c=${state.c}&d=${state.d}`;
}

/**
 * Source priority: URL, then saved progress, then defaults. Each axis is resolved independently.
 */
export function resolveLevels(
	fromUrl: Partial<LevelState>,
	saved?: Partial<LevelState> | null,
): LevelState {
	return {
		c: fromUrl.c ?? saved?.c ?? DEFAULT_LEVELS.c,
		d: fromUrl.d ?? saved?.d ?? DEFAULT_LEVELS.d,
	};
}
