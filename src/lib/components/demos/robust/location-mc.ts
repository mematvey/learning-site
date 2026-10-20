/**
 * Monte-Carlo check of the location asymptotic factors for the location-efficiency demo:
 * n * Var(estimate) / sigma^2 over R replicate samples, compared with the theoretical V_mu.
 * Chunked with event-loop yields so that the page stays responsive. Pure logic, no DOM.
 */
import { locationIrls, mScale, mean, median, rho, sd } from '$lib/demos/robust-core';
import { mulberry32 } from '$lib/prob/rng';
import {
	BISQ_C,
	HUBER_C,
	locValue,
	medianValue,
	mixtureFor,
	yieldToEventLoop,
} from './location-grid';

export const MC_R = 300;
export const MC_N = 500;
export const MC_SEED = 20260;
/** Location and scale of the simulated sample (the notebook's MU and SIGMA). */
export const MU_TRUE = 2;
export const SIGMA_TRUE = 3;
/** Bisquare rho of the scale estimate and its tuning constant (notebook section 2). */
export const SCALE_RHO_C = 1.54764;

export interface McRow {
	name: string;
	/** Empirical n * Var / sigma^2 over the replicates. */
	emp: number;
	/** Asymptotic factor for the same contamination level. */
	theory: number;
}

export interface McResult {
	eps: number;
	R: number;
	n: number;
	/** Calibration constant b_F = E_F rho(U) used for the scale estimate. */
	bF: number;
	rows: McRow[];
}

export interface McOptions {
	R?: number;
	n?: number;
	seed?: number;
	/** Replicates per event-loop task. */
	chunk?: number;
	onProgress?: (done: number) => void;
	/** Checked after every chunk; a cancelled run resolves to null. */
	isCancelled?: () => boolean;
}

/**
 * Runs R replicates at contamination `eps`. Scale: bisquare M-scale calibrated by b_F from the
 * model. Estimators: mean, median, Huber(1.5) and bisquare(4.685) at that scale.
 */
export async function runLocationMc(eps: number, o: McOptions = {}): Promise<McResult | null> {
	const R = o.R ?? MC_R;
	const n = o.n ?? MC_N;
	const chunk = o.chunk ?? 10;
	const isCancelled = o.isCancelled ?? (() => false);
	const m = mixtureFor(eps);
	const bF = m.expect((u) => rho('bisquare', u, SCALE_RHO_C));
	const rng = mulberry32(o.seed ?? MC_SEED);

	const stores = [0, 1, 2, 3].map(() => new Float64Array(R));
	for (let r = 0; r < R; r++) {
		const x = m.sampleX(n, rng, MU_TRUE, SIGMA_TRUE);
		const s = mScale(x, { kind: 'bisquare', c: SCALE_RHO_C, b: bF });
		stores[0]![r] = mean(x);
		stores[1]![r] = median(x);
		stores[2]![r] = locationIrls(x, s, { kind: 'huber', c: HUBER_C }).mu;
		stores[3]![r] = locationIrls(x, s, { kind: 'bisquare', c: BISQ_C }).mu;
		if ((r + 1) % chunk === 0 || r + 1 === R) {
			o.onProgress?.(r + 1);
			await yieldToEventLoop();
			if (isCancelled()) return null;
		}
	}

	const sigma2 = SIGMA_TRUE * SIGMA_TRUE;
	const theory = [
		1,
		medianValue(eps),
		locValue(eps, { kind: 'huber', c: HUBER_C }),
		locValue(eps, { kind: 'bisquare', c: BISQ_C }),
	];
	const names = ['Среднее', 'Медиана', 'Хубер, c = 1.5', 'Tukey bisquare, c = 4.685'];
	const rows: McRow[] = names.map((name, k) => {
		const s = sd(stores[k]!);
		return { name, emp: (n * s * s) / sigma2, theory: theory[k]! };
	});
	return { eps, R, n, bF, rows };
}
