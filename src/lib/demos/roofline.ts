/**
 * Math of the roofline demo: attainable performance of one kernel on one GPU.
 * Numbers are the ones quoted in the chapter (NVIDIA H100 SXM, product page, accessed 2026-10-18),
 * dense values only (no sparsity). Pure functions only: no DOM, no Svelte.
 */

/** HBM bandwidth, TB/s. Multiplying FLOP per byte by TB/s gives TFLOPS. */
export const HBM_BANDWIDTH_TBS = 3.35;

/** Compute units of the GPU that the demo draws roofs for. Peaks in TFLOPS, dense. */
export const UNITS = {
	fp32: { label: 'FP32, обычные ядра', tflops: 67 },
	fp16Tensor: { label: 'FP16, тензорные ядра', tflops: 989 },
} as const;

export type Unit = keyof typeof UNITS;

export function isUnit(v: unknown): v is Unit {
	return v === 'fp32' || v === 'fp16Tensor';
}

/** Domain of the plot, FLOP per byte (log axis). */
export const I_MIN = 0.01;
export const I_MAX = 10000;
/** Domain of the plot, TFLOPS (log axis). */
export const P_MIN = 0.01;
export const P_MAX = 1000;

/** Slider works on log10 of the intensity, so one step is a fixed ratio. */
export const EXP_MIN = Math.log10(I_MIN);
export const EXP_MAX = Math.log10(I_MAX);
export const EXP_STEP = 0.01;

/** Tick values on the log axes. */
export const X_TICKS: readonly number[] = [0.01, 0.1, 1, 10, 100, 1000, 10000];
export const Y_TICKS: readonly number[] = [0.01, 0.1, 1, 10, 100, 1000];

export const SOURCE_TEXT = 'NVIDIA H100 SXM, страница продукта, данные на 2026-10-18';
export const SOURCE_URL = 'https://www.nvidia.com/en-us/data-center/h100/';

export interface RooflineDemoState {
	/** Arithmetic intensity of the task, FLOP per byte. */
	intensity: number;
	/** Compute unit the task runs on: its roof is the one the point sits on. */
	unit: Unit;
}

/** Matrix multiply of two N×N FP16 matrices: 2N³ operations over 6N² bytes, so I = N / 3. */
export function gemmIntensity(n: number): number {
	return n / 3;
}

export const GEMM_N = 4096;

export interface KernelPreset {
	id: 'add' | 'gemm' | 'decode';
	/** Letter shown on the plot. */
	letter: 'A' | 'B' | 'C';
	label: string;
	intensity: number;
	unit: Unit;
}

/** The three example kernels of the chapter. */
export const KERNELS: readonly KernelPreset[] = [
	{ id: 'add', letter: 'A', label: 'Сложение векторов', intensity: 1 / 12, unit: 'fp32' },
	{
		id: 'gemm',
		letter: 'B',
		label: `Умножение матриц, N = ${GEMM_N}`,
		intensity: gemmIntensity(GEMM_N),
		unit: 'fp16Tensor',
	},
	{
		id: 'decode',
		letter: 'C',
		label: 'Декодирование, один запрос',
		intensity: 1,
		unit: 'fp16Tensor',
	},
];

export function kernelById(id: KernelPreset['id']): KernelPreset {
	const k = KERNELS.find((p) => p.id === id);
	if (!k) throw new Error(`unknown kernel ${id}`);
	return k;
}

/** Clamps to the plot domain. Non-finite input gives 1. */
export function clampIntensity(i: number): number {
	if (!Number.isFinite(i)) return 1;
	return Math.min(I_MAX, Math.max(I_MIN, i));
}

/** Intensity from a slider position (log10). */
export function intensityFromExp(e: number): number {
	if (!Number.isFinite(e)) return 1;
	return clampIntensity(10 ** Math.min(EXP_MAX, Math.max(EXP_MIN, e)));
}

/** Slider position (log10) of an intensity. */
export function expFromIntensity(i: number): number {
	return Math.log10(clampIntensity(i));
}

/** Peak of the unit, TFLOPS. */
export function peak(unit: Unit): number {
	return UNITS[unit].tflops;
}

/** Ridge point: intensity where the bandwidth roof meets the peak, FLOP per byte. */
export function ridgePoint(unit: Unit): number {
	return peak(unit) / HBM_BANDWIDTH_TBS;
}

/** Attainable performance by the roofline model, TFLOPS: min(peak, I × B). */
export function attainable(intensity: number, unit: Unit): number {
	return Math.min(peak(unit), intensity * HBM_BANDWIDTH_TBS);
}

/** Fraction of the unit's peak reachable at this intensity, 0..1. */
export function utilization(intensity: number, unit: Unit): number {
	return attainable(intensity, unit) / peak(unit);
}

/** Which limit is active: left of the ridge point memory, right of it (and at it) compute. */
export function bound(intensity: number, unit: Unit): 'memory' | 'compute' {
	return intensity < ridgePoint(unit) ? 'memory' : 'compute';
}

/** Corner points of a roof in data coordinates: a straight slope, a flat top (exact in log-log). */
export function roofPoints(unit: Unit): Array<{ x: number; y: number }> {
	const r = ridgePoint(unit);
	return [
		{ x: I_MIN, y: attainable(I_MIN, unit) },
		{ x: r, y: peak(unit) },
		{ x: I_MAX, y: peak(unit) },
	];
}

/** Position on a log axis in [0, 1] for a value inside [lo, hi]. */
export function logFraction(v: number, lo: number, hi: number): number {
	return (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));
}

export interface PlotBox {
	/** Full width of the SVG in px. */
	width: number;
	/** Full height of the SVG in px. */
	height: number;
	left: number;
	right: number;
	top: number;
	bottom: number;
}

/** X pixel of an intensity. */
export function xToPx(intensity: number, box: PlotBox): number {
	const w = box.width - box.left - box.right;
	return box.left + logFraction(clampIntensity(intensity), I_MIN, I_MAX) * w;
}

/** Y pixel of a performance value in TFLOPS. */
export function yToPx(tflops: number, box: PlotBox): number {
	const h = box.height - box.top - box.bottom;
	const v = Math.min(P_MAX, Math.max(P_MIN, tflops));
	return box.top + (1 - logFraction(v, P_MIN, P_MAX)) * h;
}

/** Number as text for the Russian UI: decimal comma, sensible digits. */
export function formatNumber(v: number): string {
	let s: string;
	if (v >= 100) s = String(Math.round(v));
	else if (v >= 1) s = v.toFixed(1);
	else s = v.toPrecision(2);
	return s.replace('.', ',');
}

/** Plain-language text of the current state, for aria-live and the stats. */
export function describeRoofline(intensity: number, unit: Unit): string {
	const b = bound(intensity, unit);
	const att = attainable(intensity, unit);
	const pct = Math.round(utilization(intensity, unit) * 100);
	const limit = b === 'memory' ? 'память' : 'вычисления';
	return (
		`Интенсивность ${formatNumber(intensity)} FLOP на байт, блок: ${UNITS[unit].label}. ` +
		`Предел: ${limit}. Достижимо ${formatNumber(att)} TFLOPS из ${peak(unit)} TFLOPS (${pct} %). ` +
		`Точка перегиба этого блока: ${formatNumber(ridgePoint(unit))} FLOP на байт.`
	);
}
