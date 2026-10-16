/**
 * Chunked Monte-Carlo runner. Work is split into chunks separated by `setTimeout(0)`,
 * so the UI thread stays responsive while the run is in progress.
 */
import { mulberry32 } from './rng';
import type { SimulationState } from './types';

/** One trial: returns, for each question key, whether its event happened. */
export type TrialFn = (rng: () => number) => Record<string, boolean>;

export interface SimulationOptions {
	trials: number;
	trial: TrialFn;
	/** Seed for the PRNG; random when omitted. */
	seed?: number;
	/** Trials per chunk between yields to the event loop. */
	chunk?: number;
	onProgress?: (state: SimulationState) => void;
}

export interface SimulationHandle {
	/** Stops after the current chunk; `done` resolves with the partial state. */
	cancel(): void;
	done: Promise<SimulationState>;
}

/**
 * Trial numbers for the convergence plot: about `points` values on a log scale
 * from 1 to `trials`, ascending, always ending with `trials`.
 */
export function checkpoints(trials: number, points = 150): number[] {
	if (!Number.isSafeInteger(trials) || trials < 1) throw new RangeError('trials must be ≥ 1');
	const set = new Set<number>([trials]);
	const logMax = Math.log10(trials);
	for (let i = 0; i < points; i++) {
		const cp = Math.round(10 ** (points === 1 ? 0 : (i * logMax) / (points - 1)));
		set.add(Math.min(Math.max(cp, 1), trials));
	}
	return [...set].sort((a, b) => a - b);
}

export function runSimulation(opts: SimulationOptions): SimulationHandle {
	const { trials, trial, onProgress } = opts;
	const chunk = opts.chunk ?? 2000;
	if (!Number.isSafeInteger(trials) || trials < 1) throw new RangeError('trials must be ≥ 1');
	if (!Number.isSafeInteger(chunk) || chunk < 1) throw new RangeError('chunk must be ≥ 1');

	const rng = mulberry32(opts.seed ?? Math.floor(Math.random() * 2 ** 32));
	const cps = checkpoints(trials);
	let cpIdx = 0;
	let cancelled = false;

	const state: SimulationState = { trials: 0, hits: {}, series: {}, running: true };
	const snapshot = (): SimulationState => ({
		trials: state.trials,
		hits: { ...state.hits },
		series: Object.fromEntries(Object.entries(state.series).map(([k, v]) => [k, [...v]])),
		running: state.running,
	});

	let resolveDone: (s: SimulationState) => void = () => {};
	const done = new Promise<SimulationState>((resolve) => {
		resolveDone = resolve;
	});

	const finish = () => {
		state.running = false;
		const final = snapshot();
		onProgress?.(final);
		resolveDone(final);
	};

	const step = () => {
		if (cancelled) {
			finish();
			return;
		}
		const end = Math.min(state.trials + chunk, trials);
		while (state.trials < end) {
			const result = trial(rng);
			state.trials++;
			for (const key of Object.keys(result)) {
				if (!(key in state.hits)) {
					state.hits[key] = 0;
					state.series[key] = [];
				}
			}
			for (const key of Object.keys(state.hits)) {
				if (result[key]) state.hits[key] = (state.hits[key] ?? 0) + 1;
			}
			if (cpIdx < cps.length && cps[cpIdx] === state.trials) {
				for (const key of Object.keys(state.hits)) {
					state.series[key]?.push([state.trials, (state.hits[key] ?? 0) / state.trials]);
				}
				cpIdx++;
			}
		}
		onProgress?.(snapshot());
		if (state.trials >= trials) finish();
		else setTimeout(step, 0);
	};

	setTimeout(step, 0);

	return {
		cancel() {
			cancelled = true;
		},
		done,
	};
}
