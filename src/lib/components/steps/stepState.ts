import type { StepCardData } from '$lib/contracts/component-props';

/** Elements of the attention scheme that a step can highlight. */
export const SCHEME_IDS = ['Q', 'K', 'S', 'A', 'V', 'O', 'arrow'] as const;
export type SchemeId = (typeof SCHEME_IDS)[number];

/** Keys of `StepCardData.state` read by the widget itself. They are not passed to the demo. */
const META_KEYS: readonly string[] = ['active', 'pill'];

export interface StepHighlight {
	/** Scheme elements to highlight, in the order of the step. Unknown ids are dropped. */
	active: SchemeId[];
	/** Show the `÷ √d` pill (the scaling step). */
	pill: boolean;
	/** The rest of the state, passed to the registered demo. */
	demoPatch: Record<string, unknown>;
}

/**
 * Splits a step's `state` into scheme highlighting and demo state.
 * Scheme keys: `active: string[]` (ids from `SCHEME_IDS`), `pill: boolean`.
 */
export function parseStepState(state?: Record<string, unknown>): StepHighlight {
	const raw = state?.active;
	const active = Array.isArray(raw)
		? raw.filter(
				(id): id is SchemeId =>
					typeof id === 'string' && (SCHEME_IDS as readonly string[]).includes(id),
			)
		: [];
	const demoPatch: Record<string, unknown> = {};
	if (state) {
		for (const [key, value] of Object.entries(state)) {
			if (!META_KEYS.includes(key)) demoPatch[key] = value;
		}
	}
	return { active, pill: state?.pill === true, demoPatch };
}

/** Clamps a step index into `[0, count - 1]`; 0 for an empty list or a non-finite index. */
export function clampStep(index: number, count: number): number {
	if (count <= 0 || !Number.isFinite(index)) return 0;
	return Math.min(count - 1, Math.max(0, Math.trunc(index)));
}

/** The scheme figure is shown when at least one step declares `active`. */
export function hasScheme(steps: readonly StepCardData[]): boolean {
	return steps.some((step) => Array.isArray(step.state?.active));
}
