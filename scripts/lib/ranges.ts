/**
 * Level ranges used by the content checks. Axis bounds mirror `src/lib/contracts/levels.ts`:
 * c is 1..4, d is 1..3. A range is an inclusive interval of slider positions.
 */
export interface Range {
	min: number;
	max: number;
}

export interface AxisRange {
	c: Range;
	d: Range;
}

export const C_BOUNDS: Range = { min: 1, max: 4 };
export const D_BOUNDS: Range = { min: 1, max: 3 };

export function fullRange(): AxisRange {
	return { c: { ...C_BOUNDS }, d: { ...D_BOUNDS } };
}

export function intersectRange(a: Range, b: Range): Range {
	return { min: Math.max(a.min, b.min), max: Math.min(a.max, b.max) };
}

export function intersect(a: AxisRange, b: AxisRange): AxisRange {
	return { c: intersectRange(a.c, b.c), d: intersectRange(a.d, b.d) };
}

/** True if every position of `inner` is inside `outer` (an empty `inner` is inside anything). */
export function within(inner: Range, outer: Range): boolean {
	return inner.min > inner.max || (inner.min >= outer.min && inner.max <= outer.max);
}
