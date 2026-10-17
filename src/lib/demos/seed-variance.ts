/**
 * Seed variance demo: the same two configurations trained with several seeds.
 * Pure functions only. The accuracies are simulated: a fixed true mean per configuration plus
 * Gaussian noise that stands for the randomness of initialisation and batch order.
 */

import { mulberry32 } from './attention';

export const SEED_COUNT = 5;
export const NOISE_SD = 0.006;
export const CONFIGS = [
	{ id: 'A', label: 'Конфигурация A', mean: 0.884 },
	{ id: 'B', label: 'Конфигурация B', mean: 0.88 },
] as const;
export type ConfigId = (typeof CONFIGS)[number]['id'];

export interface SeedState {
	/** How many seeds are shown, 1..SEED_COUNT. */
	seeds: number;
}

export const DEFAULT_SEED_STATE: SeedState = { seeds: SEED_COUNT };

export function snapSeeds(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return SEED_COUNT;
	return Math.min(SEED_COUNT, Math.max(1, Math.round(v)));
}

export function sanitizeSeedState(patch: Partial<SeedState> | undefined): SeedState {
	return { seeds: patch?.seeds === undefined ? SEED_COUNT : snapSeeds(patch.seeds) };
}

function gauss(rand: () => number): number {
	const u = Math.max(rand(), 1e-12);
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Fixed val_acc values per configuration, one per seed. Identical on every call. */
export function makeSeedRuns(base = 6): Record<ConfigId, number[]> {
	const out = { A: [] as number[], B: [] as number[] };
	CONFIGS.forEach((c, ci) => {
		const rand = mulberry32(base * 1000 + ci);
		for (let s = 0; s < SEED_COUNT; s++) {
			out[c.id].push(Math.round((c.mean + NOISE_SD * gauss(rand)) * 10000) / 10000);
		}
	});
	return out;
}

export interface Spread {
	n: number;
	mean: number;
	min: number;
	max: number;
	sd: number;
}

/** Mean, range and sample standard deviation (n - 1; zero for one value). */
export function spread(values: readonly number[]): Spread {
	const n = values.length;
	if (n === 0) return { n: 0, mean: NaN, min: NaN, max: NaN, sd: NaN };
	const mean = values.reduce((a, b) => a + b, 0) / n;
	const ss = values.reduce((a, b) => a + (b - mean) ** 2, 0);
	return {
		n,
		mean,
		min: Math.min(...values),
		max: Math.max(...values),
		sd: n > 1 ? Math.sqrt(ss / (n - 1)) : 0,
	};
}

export interface SeedSummary {
	a: Spread;
	b: Spread;
	/** Winner by the first seed alone. */
	firstSeedWinner: ConfigId;
	/** Winner by the mean over the shown seeds. */
	meanWinner: ConfigId;
	/** True when the min-max ranges of A and B intersect. */
	overlap: boolean;
}

export function summarizeSeeds(runs: Record<ConfigId, number[]>, state: SeedState): SeedSummary {
	const a = runs.A.slice(0, state.seeds);
	const b = runs.B.slice(0, state.seeds);
	const sa = spread(a);
	const sb = spread(b);
	return {
		a: sa,
		b: sb,
		firstSeedWinner: (b[0] ?? 0) > (a[0] ?? 0) ? 'B' : 'A',
		meanWinner: sb.mean > sa.mean ? 'B' : 'A',
		overlap: sa.min <= sb.max && sb.min <= sa.max,
	};
}

export function describeSeeds(s: SeedSummary): string {
	const pct = (v: number): string => (v * 100).toFixed(1);
	const head = `A: ${pct(s.a.min)}–${pct(s.a.max)} %, B: ${pct(s.b.min)}–${pct(s.b.max)} %.`;
	if (s.a.n === 1) {
		return `${head} По одному запуску побеждает ${s.firstSeedWinner}, но разброса не видно.`;
	}
	return s.overlap
		? `${head} Диапазоны пересекаются: разница средних не отличима от разброса по сидам.`
		: `${head} Диапазоны не пересекаются: разница больше разброса по сидам.`;
}
