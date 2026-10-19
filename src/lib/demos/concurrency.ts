/**
 * Pure model for ConcurrencyDemo. No real threads: the caller chooses the order of steps.
 * `counter += 1` is four bytecode steps (LOAD_GLOBAL, LOAD_CONST, BINARY_OP, STORE_GLOBAL).
 * An optional lock covers all four steps of one thread.
 */

export const STEPS = ['LOAD_GLOBAL', 'LOAD_CONST', 'BINARY_OP', 'STORE_GLOBAL'] as const;
export const STEP_COUNT = STEPS.length;
export const THREAD_NAMES = ['A', 'B', 'C', 'D'] as const;
export const MIN_THREADS = 2;
export const MAX_THREADS = 4;

/** Amdahl slider bounds: parallel share p and number of cores N. */
export const P_MIN = 0.5;
export const P_MAX = 0.99;
export const P_STEP = 0.01;
export const CORES_MIN = 1;
export const CORES_MAX = 100;

export interface ThreadState {
	/** Thread name: A, B, C, D. */
	readonly name: string;
	/** Index of the next step; STEP_COUNT when the thread has finished. */
	readonly pc: number;
	/** Value loaded by LOAD_GLOBAL, or null before it. */
	readonly read: number | null;
	/** Value computed by BINARY_OP, or null before it. */
	readonly sum: number | null;
}

export interface RunEvent {
	/** Index of the thread in `threads`. */
	readonly thread: number;
	/** Index of the step in STEPS. */
	readonly step: number;
	/** Counter value just before the step. */
	readonly counterBefore: number;
	/** Counter value just after the step. */
	readonly counterAfter: number;
	/** The thread's loaded value at this step (null before LOAD_GLOBAL). */
	readonly read: number | null;
	/** True for a STORE that writes a value computed from an outdated read. */
	readonly stale: boolean;
}

export interface RunState {
	readonly lock: boolean;
	readonly counter: number;
	/** Index of the thread holding the lock, or null. */
	readonly holder: number | null;
	readonly threads: readonly ThreadState[];
	readonly log: readonly RunEvent[];
}

function clampInt(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(max, Math.max(min, Math.round(value)));
}

/** Fresh run: every thread is at step 0, the counter is 0, nobody holds the lock. */
export function createRun(threadCount: number, lock: boolean): RunState {
	const count = clampInt(threadCount, MIN_THREADS, MAX_THREADS);
	const threads: ThreadState[] = [];
	for (let i = 0; i < count; i++) {
		threads.push({ name: THREAD_NAMES[i] ?? '?', pc: 0, read: null, sum: null });
	}
	return { lock, counter: 0, holder: null, threads, log: [] };
}

/** Thread is at its first step and waits because another thread holds the lock. */
/** Thread name by index, or '?' if the index is out of range. */
export function nameOf(run: RunState, t: number | null): string {
	if (t === null) return '?';
	return run.threads[t]?.name ?? '?';
}

export function isWaiting(run: RunState, t: number): boolean {
	const th = run.threads[t];
	if (!th || !run.lock || th.pc !== 0) return false;
	return run.holder !== null && run.holder !== t;
}

/** The thread can execute its next step now. */
export function canStep(run: RunState, t: number): boolean {
	const th = run.threads[t];
	if (!th || th.pc >= STEP_COUNT) return false;
	return !isWaiting(run, t);
}

export function isDone(run: RunState): boolean {
	return run.threads.every((th) => th.pc >= STEP_COUNT);
}

/** Expected final counter: every thread adds 1 once. */
export function expectedValue(run: RunState): number {
	return run.threads.length;
}

/** Executes the next step of thread `t`. Returns the same object if the step is not allowed. */
export function stepThread(run: RunState, t: number): RunState {
	const th = run.threads[t];
	if (!th || !canStep(run, t)) return run;
	const step = th.pc;
	const before = run.counter;
	let counter = before;
	let holder = run.holder;
	let next: ThreadState;
	let stale = false;

	if (run.lock && step === 0) holder = t;

	switch (step) {
		case 0:
			next = { ...th, pc: 1, read: before };
			break;
		case 1:
			next = { ...th, pc: 2 };
			break;
		case 2:
			next = { ...th, pc: 3, sum: (th.read ?? 0) + 1 };
			break;
		default:
			counter = th.sum ?? 0;
			stale = th.read !== before;
			next = { ...th, pc: STEP_COUNT };
			if (run.lock) holder = null;
	}

	const event: RunEvent = {
		thread: t,
		step,
		counterBefore: before,
		counterAfter: counter,
		read: th.read,
		stale,
	};
	return {
		lock: run.lock,
		counter,
		holder,
		threads: run.threads.map((x, i) => (i === t ? next : x)),
		log: [...run.log, event],
	};
}

/** Finishes the run with a random allowed step each time. `rand` returns values in [0, 1). */
export function runRandom(run: RunState, rand: () => number): RunState {
	let cur = run;
	while (!isDone(cur)) {
		const options: number[] = [];
		for (let t = 0; t < cur.threads.length; t++) {
			if (canStep(cur, t)) options.push(t);
		}
		if (options.length === 0) break;
		const pick = options[Math.min(options.length - 1, Math.floor(rand() * options.length))] ?? 0;
		cur = stepThread(cur, pick);
	}
	return cur;
}

/** Seeded PRNG (mulberry32) so that the statistics are reproducible. */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export interface LossStats {
	readonly threads: number;
	/** Share of random runs whose final counter is below the expected value. */
	readonly share: number;
	/** Mean number of lost updates per run. */
	readonly meanLost: number;
}

/** Statistics over random interleavings without a lock. Deterministic for a given seed. */
export function lossStats(threadCount: number, trials: number, seed: number): LossStats {
	const rand = mulberry32(seed);
	const base = createRun(threadCount, false);
	let lossy = 0;
	let lost = 0;
	for (let i = 0; i < trials; i++) {
		const done = runRandom(base, rand);
		const diff = expectedValue(done) - done.counter;
		if (diff > 0) lossy++;
		lost += diff;
	}
	return {
		threads: base.threads.length,
		share: lossy / trials,
		meanLost: lost / trials,
	};
}

/** Human-readable description of one step in the log. */
export function describeEvent(e: RunEvent, run: RunState): string {
	const name = nameOf(run, e.thread);
	switch (e.step) {
		case 0:
			return `${name}: LOAD_GLOBAL читает ${e.counterBefore}`;
		case 1:
			return `${name}: LOAD_CONST кладёт 1`;
		case 2:
			return `${name}: BINARY_OP ${e.read ?? 0} + 1 = ${(e.read ?? 0) + 1}`;
		default:
			return (
				`${name}: STORE_GLOBAL пишет ${e.counterAfter}` +
				(e.stale ? `, хотя счётчик уже был ${e.counterBefore}` : '')
			);
	}
}

/** Short explanation of the current state: cause and effect in one or two sentences. */
export function explain(run: RunState): string {
	const expected = expectedValue(run);
	const waiting = run.threads.findIndex((_, t) => isWaiting(run, t));
	if (waiting !== -1 && run.holder !== null) {
		return (
			`Поток ${nameOf(run, waiting)} ждёт блокировку, которую держит ` +
			`поток ${nameOf(run, run.holder)}: критическая секция идёт по одному потоку.`
		);
	}
	if (!isDone(run)) {
		return run.lock
			? 'Выберите поток для шага. Блокировка держится, пока поток не записал результат.'
			: 'Выберите поток для шага. Порядок шагов определяет итог.';
	}
	if (run.counter === expected) {
		return run.lock
			? `Блокировка: каждый поток читал уже записанное значение. Итог ${run.counter} совпадает с ожидаемым.`
			: `В этом порядке конфликта не было: итог ${run.counter} совпадает с ожидаемым.`;
	}
	const stale = run.log.find((e) => e.stale);
	if (stale) {
		const name = nameOf(run, stale.thread);
		const read = stale.read ?? 0;
		return (
			`Поток ${name} прочитал ${read}, записал ${read + 1}, когда счётчик уже был ` +
			`${stale.counterBefore}. Обновления, сделанные после чтения, потеряны: ` +
			`итог ${run.counter} вместо ${expected}.`
		);
	}
	return `Итог ${run.counter} вместо ${expected}.`;
}

/** Amdahl speedup for parallel share p on n cores. */
export function amdahl(p: number, n: number): number {
	return 1 / (1 - p + p / n);
}

/** Speedup limit for n -> infinity. */
export function amdahlLimit(p: number): number {
	return 1 / (1 - p);
}

/** Number with two decimals and a decimal comma, as in Russian text: 1,82. */
export function formatRu(x: number, digits = 2): string {
	return x.toFixed(digits).replace('.', ',');
}

export function clampP(p: number): number {
	if (!Number.isFinite(p)) return 0.9;
	const snapped = Math.round(p / P_STEP) * P_STEP;
	return Math.min(P_MAX, Math.max(P_MIN, Number(snapped.toFixed(2))));
}

export function clampCores(n: number): number {
	return clampInt(n, CORES_MIN, CORES_MAX);
}
