/**
 * Math of the attention demo (port of `docs/mockups/attention-demo.js`).
 * Vectors Q and K are fixed pseudo-random Gaussians (seeded PRNG), so every page load shows
 * the same weights. Pure functions only: no DOM, no Svelte.
 */

export const TOKENS = ['кот', 'сел', 'на', 'коврик', 'потому', 'что'] as const;
export const TOKEN_COUNT = TOKENS.length;

export const D_MIN = 4;
export const D_MAX = 256;
export const D_STEP = 4;
export const SEED = 20240607;

/** Logical size of the arcs viewBox; the SVG scales it to the container width. */
export const ARC_VB_W = 1000;
export const ARC_VB_H = 170;

/** mulberry32: deterministic PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export interface AttentionVectors {
	/** Q[token] is a D_MAX-long vector. */
	Q: number[][];
	/** K[token] is a D_MAX-long vector. */
	K: number[][];
}

/** Standard normal N(0, 1) via Box-Muller on the given generator. */
function gauss(rand: () => number): number {
	let u = 0;
	while (u === 0) u = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/**
 * Builds Q and K. Components are N(0, 1), so Var(q·k) = d: without scaling the spread of
 * logits grows like sqrt(d). Generation order (Q then K per token) matches the mockup.
 */
export function makeVectors(seed: number = SEED): AttentionVectors {
	const rand = mulberry32(seed);
	const makeVec = (): number[] => {
		const v: number[] = [];
		for (let k = 0; k < D_MAX; k++) v.push(gauss(rand));
		return v;
	};
	const Q: number[][] = [];
	const K: number[][] = [];
	for (let t = 0; t < TOKEN_COUNT; t++) {
		Q.push(makeVec());
		K.push(makeVec());
	}
	return { Q, K };
}

/** Clamps a key dimension to the slider range and snaps it to the step of 4. */
export function snapD(d: number): number {
	const snapped = Math.round(d / D_STEP) * D_STEP;
	return Math.min(D_MAX, Math.max(D_MIN, snapped));
}

/** True for a valid query index. */
export function isQueryIndex(q: unknown): q is number {
	return typeof q === 'number' && Number.isInteger(q) && q >= 0 && q < TOKEN_COUNT;
}

/**
 * Weights A[i][j] = softmax_j(q_i·k_j / s), where s = sqrt(d) when scaled, otherwise 1.
 * Each row is normalised to sum to 1. The maximum is subtracted before exp for stability.
 */
export function attentionWeights(
	vectors: AttentionVectors,
	d: number,
	scaled: boolean,
): number[][] {
	const s = scaled ? 1 / Math.sqrt(d) : 1;
	const A: number[][] = [];
	for (let i = 0; i < TOKEN_COUNT; i++) {
		const qi = vectors.Q[i] ?? [];
		const z: number[] = [];
		let max = -Infinity;
		for (let j = 0; j < TOKEN_COUNT; j++) {
			const kj = vectors.K[j] ?? [];
			let dot = 0;
			for (let k = 0; k < d; k++) dot += (qi[k] ?? 0) * (kj[k] ?? 0);
			const logit = dot * s;
			z.push(logit);
			if (logit > max) max = logit;
		}
		let sum = 0;
		for (let j = 0; j < TOKEN_COUNT; j++) {
			const e = Math.exp((z[j] ?? 0) - max);
			z[j] = e;
			sum += e;
		}
		for (let j = 0; j < TOKEN_COUNT; j++) z[j] = (z[j] ?? 0) / sum;
		A.push(z);
	}
	return A;
}

export function sumOf(xs: readonly number[]): number {
	return xs.reduce((s, v) => s + v, 0);
}

/** Token indices sorted by weight in the row, strongest first. */
export function rowOrder(row: readonly number[]): number[] {
	return row.map((_, j) => j).sort((a, b) => (row[b] ?? 0) - (row[a] ?? 0));
}

/** Horizontal centre of token i in the arcs viewBox. */
export function tokenCenter(i: number): number {
	return ((i + 0.5) * ARC_VB_W) / TOKEN_COUNT;
}

/** Arc from query i to key j; for i === j a small loop above the token. */
export function arcPath(i: number, j: number): string {
	const x1 = tokenCenter(i);
	const x2 = tokenCenter(j);
	const y = ARC_VB_H - 2;
	if (i === j) {
		return `M${x1 - 8} ${y} C${x1 - 40} ${y - 80} ${x1 + 40} ${y - 80} ${x1 + 8} ${y}`;
	}
	const h = 14 + 0.12 * Math.abs(x2 - x1);
	return `M${x1} ${y} Q${(x1 + x2) / 2} ${y - 2 * h} ${x2} ${y}`;
}

/** Position of the weight label for arc i -> j. */
export function arcLabelPos(i: number, j: number): [number, number] {
	const x1 = tokenCenter(i);
	const x2 = tokenCenter(j);
	const y = ARC_VB_H - 2;
	if (i === j) return [x1, y - 68];
	const h = 14 + 0.12 * Math.abs(x2 - x1);
	return [(x1 + x2) / 2, y - h - 6];
}

/** Text of the «What to notice» line for the query row. */
export function describeRow(
	query: number,
	row: readonly number[],
	d: number,
	scaled: boolean,
): string {
	const top = rowOrder(row)[0] ?? 0;
	const topWeight = row[top] ?? 0;
	const sd = scaled ? 1 : Math.sqrt(d);
	let spread: string;
	if (scaled) {
		spread = 'Масштаб 1/√d держит разброс логитов около 1 при любом d, поэтому веса мягкие.';
	} else {
		spread =
			topWeight >= 0.9
				? `Без масштаба при этом d один ключ забрал ${topWeight.toFixed(2)}: распределение почти one-hot.`
				: 'Без масштаба разброс растёт как √d: при большом d веса схлопываются к одному ключу.';
	}
	return (
		`Что заметить: сильнее всего «${TOKENS[query] ?? ''}» смотрит на «${TOKENS[top] ?? ''}» ` +
		`(${topWeight.toFixed(2)}). Разброс логитов ≈ ${sd.toFixed(1)}. ${spread}`
	);
}
