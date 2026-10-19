/**
 * Math of the MoE demo: parameter counts, top-k routing of a fixed token batch, expert load,
 * capacity overflow and one balancing step. Pure functions only: no DOM, no Svelte.
 *
 * Units: parameters are counted in multiples of d² (d = model width).
 * Attention takes 4d², one expert (hidden width 4d) takes 8d², as in the chapter example.
 */

/** Shared part of one layer (attention, embeddings, norms), in d². */
export const P_SHARED = 4;
/** One expert, in d². */
export const P_EXPERT = 8;

/** Allowed numbers of experts N on the slider. */
export const N_CHOICES = [2, 4, 8, 16, 32, 64] as const;
export const MAX_K = 8;
/** Tokens in the demo batch. Chosen so that round-robin routing is exact for every N in N_CHOICES. */
export const BATCH_T = 32;
/** Capacity factor cf from the chapter. */
export const CAPACITY_FACTOR = 1.25;
/** Batch size of the chapter example for the capacity readout. */
export const EXAMPLE_T = 1024;

/** Routing of a batch: `assign[t]` is the list of k experts of token t; the first one is primary. */
export type Routing = number[][];

export interface ParamCounts {
	total: number;
	active: number;
	/** Active share in percent, unrounded. */
	share: number;
}

/** Snaps a value to an allowed N. Unknown values fall back to 8. */
export function snapN(n: number): number {
	return (N_CHOICES as readonly number[]).includes(n) ? n : 8;
}

/** Keeps k in [1, min(N, MAX_K)] and integer. */
export function clampK(k: number, n: number): number {
	const hi = Math.min(n, MAX_K);
	if (!Number.isFinite(k)) return 1;
	return Math.min(hi, Math.max(1, Math.round(k)));
}

/** P_total = P_sh + N·P_exp, P_active = P_sh + k·P_exp, in d². */
export function paramCounts(n: number, k: number): ParamCounts {
	const total = P_SHARED + n * P_EXPERT;
	const active = P_SHARED + k * P_EXPERT;
	return { total, active, share: (100 * active) / total };
}

/**
 * Share as text for the reader: one decimal below 10 %, integer above.
 * Uses a decimal comma, as in Russian text ("3,9 %", "29 %").
 */
export function formatShare(percent: number): string {
	const v = percent < 10 ? Math.round(percent * 10) / 10 : Math.round(percent);
	return String(v).replace('.', ',');
}

/** Capacity per expert for a batch of t tokens: ceil(cf·T/N). Ceil keeps it at least 1 for small batches. */
export function capacity(n: number, t: number, cf: number = CAPACITY_FACTOR): number {
	return Math.ceil((cf * t) / n);
}

/**
 * Even routing: token t takes experts (t + j·⌊N/k⌋) mod N for j = 0..k-1.
 * The primary expert (j = 0) is then spread evenly over the batch, so no expert overflows
 * under uniform routing, and every expert gets k·T/N slots when N divides T·k evenly.
 * The k experts of a token are distinct because the offsets are distinct.
 */
export function uniformRouting(n: number, k: number, t: number = BATCH_T): Routing {
	const step = Math.floor(n / k);
	const assign: Routing = [];
	for (let i = 0; i < t; i++) {
		const row: number[] = [];
		for (let j = 0; j < k; j++) row.push((i + j * step) % n);
		assign.push(row);
	}
	return assign;
}

/** Number of tokens that have each expert among their k experts. */
export function expertCounts(assign: Routing, n: number): number[] {
	const counts = new Array<number>(n).fill(0);
	for (const row of assign) for (const e of row) counts[e] = (counts[e] ?? 0) + 1;
	return counts;
}

/** Share of the batch that reached each expert: count / T. Uniform top-k gives k/N. */
export function expertShares(assign: Routing, n: number): number[] {
	const t = assign.length;
	return expertCounts(assign, n).map((c) => (t === 0 ? 0 : c / t));
}

/** Max load over mean load: 1 means perfectly even. */
export function imbalance(assign: Routing, n: number): number {
	const counts = expertCounts(assign, n);
	const total = counts.reduce((s, c) => s + c, 0);
	if (total === 0) return 1;
	const mean = total / n;
	return Math.max(...counts) / mean;
}

/**
 * Moves token t to expert e (drag and drop). If e is already one of the token's experts,
 * it becomes primary by swapping positions. Otherwise e replaces the primary expert.
 * Returns a new routing; the input is not changed.
 */
export function moveToken(assign: Routing, t: number, e: number): Routing {
	const next = assign.map((row) => row.slice());
	const row = next[t];
	if (!row || row[0] === e) return next;
	const first = row[0];
	if (first === undefined) return next;
	const pos = row.indexOf(e);
	if (pos >= 0) {
		row[0] = e;
		row[pos] = first;
	} else {
		row[0] = e;
	}
	return next;
}

/**
 * Which tokens are dropped. Primary dispatch only: token t goes to its primary expert in order;
 * once that expert has `cap` tokens, later tokens are not processed by it (they pass through the residual).
 */
export function dropped(assign: Routing, n: number, cap: number): boolean[] {
	const used = new Array<number>(n).fill(0);
	return assign.map((row) => {
		const e = row[0] ?? 0;
		if ((used[e] ?? 0) < cap) {
			used[e] = (used[e] ?? 0) + 1;
			return false;
		}
		return true;
	});
}

/**
 * One balancing step: in the most loaded expert's tokens, replace it by the least loaded expert
 * (the token must not already have that expert). Returns the routing unchanged if no move is possible.
 */
export function balanceStep(assign: Routing, n: number): Routing {
	const counts = expertCounts(assign, n);
	const cnt = (e: number): number => counts[e] ?? 0;
	let hi = 0;
	let lo = 0;
	for (let e = 1; e < n; e++) {
		if (cnt(e) > cnt(hi)) hi = e;
		if (cnt(e) < cnt(lo)) lo = e;
	}
	if (cnt(hi) - cnt(lo) < 2) return assign.map((row) => row.slice());
	const next = assign.map((row) => row.slice());
	for (const row of next) {
		if (row.includes(hi) && !row.includes(lo)) {
			row[row.indexOf(hi)] = lo;
			return next;
		}
	}
	return next;
}
