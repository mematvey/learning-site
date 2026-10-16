/**
 * Contract for interactive probability problems (topic `stats`).
 * Math lives in `src/lib/prob/*`, the shared card in `src/lib/components/problems/*`,
 * concrete problems in `src/lib/components/demos/ProbClassic<N>.svelte`.
 */

/** Exact rational number. `den > 0n`, reduced by gcd. */
export interface Rational {
	num: bigint;
	den: bigint;
}

/** Problem parameters: flat record of integers or decimals, edited in the parameter panel. */
export type ProblemParams = Record<string, number>;

/** One editable parameter in the panel. */
export interface ParamSpec {
	key: string;
	/** Russian label, e.g. «Абитуриентов». */
	label: string;
	min: number;
	max: number;
	step: number;
	/** `slider` for small ranges, `number` otherwise. */
	control?: 'slider' | 'number';
}

/** One step of a worked solution. Numbers are already substituted from the current params. */
export interface SolutionStep {
	/** Plain Russian text (no TeX). */
	text: string;
	/** Optional display formula in TeX (rendered with KaTeX at runtime). */
	tex?: string;
}

/** One sub-question of a problem (а, б, в…). */
export interface SubQuestion {
	/** `a`, `b`, `c`… */
	key: string;
	/** Short label, e.g. «все медалисты на одном факультете». */
	label: string;
}

/**
 * Definition of one problem: pure functions of the parameters, no DOM.
 * Every function must accept any params that pass `validate` without throwing.
 */
export interface ProblemDef<P extends ProblemParams = ProblemParams> {
	/** Stable id within the chapter: `p1`…`p9`. Used for progress and anchors (`#p1`). */
	id: string;
	title: string;
	defaults: P;
	params: ParamSpec[];
	questions: SubQuestion[];
	/** Human-readable validation errors (empty = valid), e.g. «медалистов больше, чем абитуриентов». */
	validate(params: P): string[];
	/** Exact answers by question key. */
	exact(params: P): Record<string, Rational>;
	/** One Monte-Carlo trial: for each question key, whether the event happened. */
	trial(params: P, rng: () => number): Record<string, boolean>;
	/** Short hint (no numbers needed). */
	hint: string;
	/** Worked solution per question key, with current numbers substituted. */
	steps(params: P): Record<string, SolutionStep[]>;
	/** Alternative method (shown at depth 3). */
	altSteps?(params: P): Record<string, SolutionStep[]>;
	/** Condition text with current numbers substituted (plain Russian, no TeX). */
	condition(params: P): string;
}

/** Progress of one simulation run. `series` holds [trials, empirical frequency] checkpoints. */
export interface SimulationState {
	trials: number;
	hits: Record<string, number>;
	series: Record<string, Array<[number, number]>>;
	running: boolean;
}
