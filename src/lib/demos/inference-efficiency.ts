/**
 * Math of the inference-efficiency demo: KV-cache size by attention variant and context length,
 * and expected accepted tokens in speculative decoding. Pure functions only: no DOM, no Svelte.
 * The model is fixed (the numbers used in the chapter text), so every page load shows the same picture.
 */

/** Reference model from the chapter: 32 layers, 32 heads of 128 dims, FP16 (2 bytes per element). */
export const MODEL = {
	layers: 32,
	heads: 32,
	headDim: 128,
	bytesPerElem: 2,
} as const;

export const ATTENTION_KINDS = ['mha', 'gqa', 'mqa'] as const;
export type AttentionKind = (typeof ATTENTION_KINDS)[number];

/** Number of key/value groups for each variant: MHA keeps one pair per head, GQA uses 8 groups, MQA one. */
export const KV_GROUPS: Record<AttentionKind, number> = {
	mha: MODEL.heads,
	gqa: 8,
	mqa: 1,
};

export const ATTENTION_LABEL: Record<AttentionKind, string> = {
	mha: 'MHA',
	gqa: 'GQA',
	mqa: 'MQA',
};

export function isAttentionKind(v: unknown): v is AttentionKind {
	return v === 'mha' || v === 'gqa' || v === 'mqa';
}

export const MIN_CONTEXT = 256;
export const MAX_CONTEXT = 32768;
export const CONTEXT_STEP = 256;
export const DEFAULT_CONTEXT = 4096;

/** Draft tokens per speculative step, fixed in the demo. */
export const SPEC_K = 4;
export const ALPHA_MIN = 0;
export const ALPHA_MAX = 1;
export const ALPHA_STEP = 0.05;
export const DEFAULT_ALPHA = 0.8;

export const DEFAULT_ATTENTION: AttentionKind = 'mha';

export interface InferenceDemoState {
	/** Context length in tokens. */
	context: number;
	/** Attention variant whose cache is drawn as the selected line. */
	attention: AttentionKind;
	/** Acceptance rate: probability that the large model accepts one drafted token. */
	alpha: number;
}

export const DEFAULT_STATE: InferenceDemoState = {
	context: DEFAULT_CONTEXT,
	attention: DEFAULT_ATTENTION,
	alpha: DEFAULT_ALPHA,
};

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to the context step and clamps to the slider range. Non-finite input gives the default. */
export function snapContext(n: number): number {
	if (!Number.isFinite(n)) return DEFAULT_CONTEXT;
	const snapped = Math.round(clamp(n, MIN_CONTEXT, MAX_CONTEXT) / CONTEXT_STEP) * CONTEXT_STEP;
	return clamp(snapped, MIN_CONTEXT, MAX_CONTEXT);
}

/** Rounds to the acceptance step and clamps to [0, 1]. Non-finite input gives the default. */
export function snapAlpha(a: number): number {
	if (!Number.isFinite(a)) return DEFAULT_ALPHA;
	const snapped = Math.round(clamp(a, ALPHA_MIN, ALPHA_MAX) / ALPHA_STEP) * ALPHA_STEP;
	return Math.round(clamp(snapped, ALPHA_MIN, ALPHA_MAX) * 100) / 100;
}

/** Bytes of KV-cache for one token in one sequence, summed over all layers. */
export function kvBytesPerToken(groups: number, model: typeof MODEL = MODEL): number {
	return 2 * model.layers * groups * model.headDim * model.bytesPerElem;
}

/** KV-cache bytes for one sequence of `context` tokens with the given attention variant. */
export function kvCacheBytes(context: number, kind: AttentionKind): number {
	return context * kvBytesPerToken(KV_GROUPS[kind]);
}

const KIB = 1024;
const MIB = KIB * KIB;
const GIB = KIB * MIB;

/** Formats a number with a decimal comma and at most one decimal (`2`, `0,5`, `512`). */
function formatShort(v: number): string {
	const digits = v >= 10 ? 0 : 1;
	let s = v.toFixed(digits);
	if (s.includes('.')) s = s.replace(/\.?0+$/, '');
	return s.replace('.', ',');
}

/** Binary units as in the chapter text: 512 КиБ, 64 МиБ, 2 ГиБ. */
export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes < 0) return '0 Б';
	if (bytes < KIB) return `${Math.round(bytes)} Б`;
	if (bytes < MIB) return `${formatShort(bytes / KIB)} КиБ`;
	if (bytes < GIB) return `${formatShort(bytes / MIB)} МиБ`;
	return `${formatShort(bytes / GIB)} ГиБ`;
}

/** Integer with a non-breaking space as the thousands separator: 4 096. */
export function formatInt(n: number): string {
	return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Fixed decimals with a decimal comma: 3,36. */
export function formatFixed(v: number, digits: number): string {
	return v.toFixed(digits).replace('.', ',');
}

/**
 * Expected number of tokens produced by one call of the large model:
 * sum over i = 0..k of alpha^i = (1 - alpha^(k+1)) / (1 - alpha).
 * With alpha = 1 every draft is accepted and the result is k + 1.
 */
export function expectedAccepted(alpha: number, k: number = SPEC_K): number {
	const a = clamp(Number.isFinite(alpha) ? alpha : 0, 0, 1);
	if (a >= 1) return k + 1;
	return (1 - a ** (k + 1)) / (1 - a);
}

export interface Point {
	x: number;
	y: number;
}

/** Linear map from a data domain to a pixel range. */
export function scaleLinear(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
	const span = d1 - d0;
	return (v) => (span === 0 ? r0 : r0 + ((v - d0) * (r1 - r0)) / span);
}

/** SVG path for a polyline: `M x y L x y ...`, coordinates with one decimal. */
export function linePath(points: readonly Point[]): string {
	return points
		.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
		.join(' ');
}

/**
 * Points of the KV-cache line for one variant. The cache grows linearly with the context,
 * so the line is exact between 0 and MAX_CONTEXT.
 */
export function kvSeries(kind: AttentionKind): Point[] {
	return [
		{ x: 0, y: 0 },
		{ x: MAX_CONTEXT, y: kvCacheBytes(MAX_CONTEXT, kind) },
	];
}

/** Points of expectedAccepted(alpha) for alpha in [0, 1], used for the right-hand curve. */
export function acceptCurve(k: number = SPEC_K, samples = 50): Point[] {
	const pts: Point[] = [];
	for (let i = 0; i <= samples; i++) {
		const a = i / samples;
		pts.push({ x: a, y: expectedAccepted(a, k) });
	}
	return pts;
}

/** Plot-box sizes shared by both charts (SVG viewBox units). */
export const CHART_W = 320;
export const CHART_H = 190;
export const PAD = { left: 56, right: 12, top: 14, bottom: 30 };

/** Scale of the context chart: x = context length, y = cache bytes (fixed domain, no jumps). */
export function contextScales() {
	const yMax = kvCacheBytes(MAX_CONTEXT, 'mha');
	return {
		x: scaleLinear(0, MAX_CONTEXT, PAD.left, CHART_W - PAD.right),
		y: scaleLinear(0, yMax, CHART_H - PAD.bottom, PAD.top),
		yMax,
	};
}

/** Scale of the acceptance chart: x = alpha in [0, 1], y = expected tokens in [0, k + 1]. */
export function acceptScales(k: number = SPEC_K) {
	return {
		x: scaleLinear(0, 1, PAD.left, CHART_W - PAD.right),
		y: scaleLinear(0, k + 1, CHART_H - PAD.bottom, PAD.top),
	};
}

/** Text of the live region: the state in words, numbers computed from the state. */
export function describeState(state: InferenceDemoState): string {
	const bytesPerToken = kvBytesPerToken(KV_GROUPS[state.attention]);
	const cache = kvCacheBytes(state.context, state.attention);
	const accepted = expectedAccepted(state.alpha);
	return (
		`Контекст ${formatInt(state.context)} токенов, ${ATTENTION_LABEL[state.attention]}: ` +
		`KV-кэш ${formatBytes(cache)} (${formatBytes(bytesPerToken)} на токен). ` +
		`Доля принятия ${formatFixed(state.alpha, 2)}, черновых токенов ${SPEC_K}: ` +
		`в среднем ${formatFixed(accepted, 2)} токена за один вызов большой модели.`
	);
}
