/**
 * Model of the pipeline demo: a DAG of steps, step-by-step run, a failing step that blocks the release,
 * and a step cache keyed by the step's code version, its parameters and the keys of its inputs.
 * Pure functions only: no DOM, no Svelte.
 *
 * Graph: data -> features -> train -> evaluate -> deploy, and tests -> deploy.
 * A step runs only after all its dependencies are done. If a dependency failed or was blocked, the step is blocked.
 * A step whose key is already in the cache is taken from the cache and not run again.
 * The release (deploy) is allowed only when deploy itself and every step before it passed.
 */

export type StepId = 'data' | 'tests' | 'features' | 'train' | 'evaluate' | 'deploy';

export type StepStatus = 'pending' | 'ok' | 'cached' | 'fail' | 'blocked';

export interface StepDef {
	id: StepId;
	/** Russian label shown in the chart and in the description. */
	title: string;
	/** Steps whose results this step reads. */
	deps: readonly StepId[];
	/** Column of the chart (0 = left, the topological depth of the step). */
	col: number;
	/** Row of the chart (0 = main line, 1 = lower line). */
	row: number;
}

export interface PipelineDemoState {
	/** Step that fails on its next real run, or null when nothing fails. */
	fail: StepId | null;
}

export interface PipelineRun {
	/** Status of every step in the current run. */
	status: Record<StepId, StepStatus>;
	/** Key of the last successful run of each step. Survives a new run, cleared by reset. */
	cache: Partial<Record<StepId, string>>;
	/** Code version of each step. Editing the code increments it and changes the key. */
	revs: Record<StepId, number>;
}

export const STEPS: readonly StepDef[] = [
	{ id: 'data', title: 'Данные', deps: [], col: 0, row: 0 },
	{ id: 'tests', title: 'Тесты кода', deps: [], col: 0, row: 1 },
	{ id: 'features', title: 'Признаки', deps: ['data'], col: 1, row: 0 },
	{ id: 'train', title: 'Обучение', deps: ['features'], col: 2, row: 0 },
	{ id: 'evaluate', title: 'Оценка', deps: ['train'], col: 3, row: 0 },
	{ id: 'deploy', title: 'Выкладка', deps: ['evaluate', 'tests'], col: 4, row: 1 },
];

/** Steps that can be made to fail in the demo (the release itself is not a failure option). */
export const FAILABLE: readonly StepId[] = ['data', 'tests', 'features', 'train', 'evaluate'];

/** Step ids in the order of the definition. */
export const STEP_IDS: readonly StepId[] = STEPS.map((s) => s.id);

export function isStepId(v: unknown): v is StepId {
	return typeof v === 'string' && (STEP_IDS as readonly string[]).includes(v);
}

/** Accepts only known step ids or null. Anything else becomes null. */
export function isFail(v: unknown): v is StepId | null {
	return v === null || isStepId(v);
}

function def(id: StepId): StepDef {
	const d = STEPS.find((s) => s.id === id);
	if (!d) throw new Error(`unknown step ${id}`);
	return d;
}

/**
 * Topological order (Kahn's algorithm). Ties keep the order of the definition, so the order is deterministic.
 * Throws if the graph has a cycle.
 */
export function topoOrder(steps: readonly StepDef[] = STEPS): StepId[] {
	const indeg = new Map<StepId, number>(steps.map((s) => [s.id, s.deps.length]));
	const order: StepId[] = [];
	const done = new Set<StepId>();
	while (order.length < steps.length) {
		const next = steps.find((s) => !done.has(s.id) && (indeg.get(s.id) ?? 0) === 0);
		if (!next) throw new Error('pipeline graph has a cycle');
		done.add(next.id);
		order.push(next.id);
		for (const s of steps) {
			if (s.deps.includes(next.id)) indeg.set(s.id, (indeg.get(s.id) ?? 0) - 1);
		}
	}
	return order;
}

/** FNV-1a, 32 bits, as 8 hex digits. Deterministic, used only for cache keys in the demo. */
export function fnv1a(text: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Cache key of every step: hash of (step id, code version, keys of the inputs).
 * A change in a step or in any step above it changes its key and the keys of all steps below it.
 */
export function stepKeys(
	revs: Record<StepId, number>,
	steps: readonly StepDef[] = STEPS,
): Record<StepId, string> {
	const keys = {} as Record<StepId, string>;
	for (const id of topoOrder(steps)) {
		const d = steps.find((s) => s.id === id);
		if (!d) throw new Error(`unknown step ${id}`);
		const inputs = d.deps.map((x) => keys[x]).join(',');
		keys[id] = fnv1a(`${id}|rev=${revs[id]}|in=${inputs}`);
	}
	return keys;
}

export function initialRun(): PipelineRun {
	const status = {} as Record<StepId, StepStatus>;
	const revs = {} as Record<StepId, number>;
	for (const s of STEPS) {
		status[s.id] = 'pending';
		revs[s.id] = 0;
	}
	return { status, cache: {}, revs };
}

/** Same code and cache, every step pending again. Used before a new run. */
export function restart(run: PipelineRun): PipelineRun {
	const status = {} as Record<StepId, StepStatus>;
	for (const s of STEPS) status[s.id] = 'pending';
	return { ...run, status };
}

/** True when some step is still pending. */
export function hasPending(run: PipelineRun): boolean {
	return STEP_IDS.some((id) => run.status[id] === 'pending');
}

/** Runs the first pending step in topological order. Returns the same run when nothing is pending. */
export function runNext(
	run: PipelineRun,
	fail: StepId | null,
	steps: readonly StepDef[] = STEPS,
): PipelineRun {
	const order = topoOrder(steps);
	const id = order.find((x) => run.status[x] === 'pending');
	if (!id) return run;
	const d = steps.find((s) => s.id === id);
	if (!d) throw new Error(`unknown step ${id}`);
	const keys = stepKeys(run.revs, steps);
	const inputsOk = d.deps.every((x) => run.status[x] === 'ok' || run.status[x] === 'cached');

	let status: StepStatus;
	const cache = { ...run.cache };
	if (!inputsOk) {
		status = 'blocked';
	} else if (run.cache[id] === keys[id]) {
		status = 'cached';
	} else if (fail === id) {
		status = 'fail';
	} else {
		status = 'ok';
		cache[id] = keys[id];
	}
	return { ...run, status: { ...run.status, [id]: status }, cache };
}

/**
 * One click of "Шаг": starts a new run if the previous one is finished, then runs one step.
 */
export function advance(run: PipelineRun, fail: StepId | null): PipelineRun {
	const base = hasPending(run) ? run : restart(run);
	return runNext(base, fail);
}

/** "Весь прогон": a new run from the first step to the last. */
export function runAll(run: PipelineRun, fail: StepId | null): PipelineRun {
	let r = restart(run);
	while (hasPending(r)) r = runNext(r, fail);
	return r;
}

/** Edits the code of a step: its key changes, so it and all steps below it are no longer cached. */
export function editStep(run: PipelineRun, id: StepId): PipelineRun {
	return { ...restart(run), revs: { ...run.revs, [id]: run.revs[id] + 1 } };
}

/** The release is allowed only when deploy passed (run or cached), so every step before it passed too. */
export function released(run: PipelineRun): boolean {
	const s = run.status.deploy;
	return s === 'ok' || s === 'cached';
}

/** Short status word for the chart and the table. */
export function statusLabel(s: StepStatus): string {
	switch (s) {
		case 'ok':
			return 'выполнен';
		case 'cached':
			return 'из кеша';
		case 'fail':
			return 'упал';
		case 'blocked':
			return 'заблокирован';
		default:
			return 'не запущен';
	}
}

/** Step title by id. */
export function titleOf(id: StepId): string {
	return def(id).title;
}

/** Text for aria-live: what happened in the run and whether the release is blocked. */
export function describeRun(run: PipelineRun): string {
	const ids = STEP_IDS;
	const done = ids.filter((id) => run.status[id] !== 'pending').length;
	if (done === 0) return 'Пайплайн не запущен. Нажмите «Шаг» или «Весь прогон».';
	const failed = ids.find((id) => run.status[id] === 'fail');
	const cached = ids.filter((id) => run.status[id] === 'cached').length;
	const cacheText = cached > 0 ? ` Из кеша взято шагов: ${cached}.` : '';
	if (failed) {
		const blocked = ids.filter((id) => run.status[id] === 'blocked').length;
		return `Шаг «${titleOf(failed)}» упал. Выкладка заблокирована, шагов заблокировано: ${blocked}.${cacheText}`;
	}
	if (released(run)) {
		return `Все проверки прошли, модель выложена.${cacheText}`;
	}
	return `Выполнено шагов: ${done} из ${ids.length}.${cacheText}`;
}
