import {
	AXIS_BOUNDS,
	DEFAULT_LEVELS,
	inRange,
	parseRange,
	type LevelRange,
	type LevelState,
} from '$lib/contracts/levels';

/** Range props of a `Variant`: `"n"` or `"a-b"`; a missing axis covers the whole axis. */
export interface VariantRanges {
	c?: string;
	d?: string;
}

function axisRange(text: string | undefined, axis: 'c' | 'd'): LevelRange | null {
	if (text === undefined) return { ...AXIS_BOUNDS[axis] };
	return parseRange(text, axis);
}

/** True when the state falls inside both ranges. Invalid ranges are never visible. */
export function variantVisible(ranges: VariantRanges, state: LevelState): boolean {
	const c = axisRange(ranges.c, 'c');
	const d = axisRange(ranges.d, 'd');
	if (!c || !d) return false;
	return inRange(c, state.c) && inRange(d, state.d);
}

/** Level used when the page is rendered outside a level provider (search index, previews). */
export const FALLBACK_LEVELS: LevelState = DEFAULT_LEVELS;
