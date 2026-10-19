/**
 * Model of the CompileGraphs demo: one chain of N small operations run in four modes
 * (eager, compile, eager + CUDA graph, compile + CUDA graph). Time is in abstract units.
 * Closed forms follow the chapter (compute/compile-graphs); timelines are simulated
 * launch by launch and must end at the same total.
 * Pure functions only: no DOM, no Svelte.
 */

/** Launch overhead on the CPU side, per kernel (condition of the table). */
export const O_LAUNCH = 1;
/** Kernels after fusion in compiled mode. */
export const K_FUSED = 2;

export const N_MIN = 1;
export const N_MAX = 32;
export const N_DEFAULT = 8;

/** Work per kernel on the GPU side, in the same units. The slider walks these values. */
export const W_STEPS: readonly number[] = [0.25, 0.5, 1, 2, 5, 10, 20];
export const W_DEFAULT = 0.25;

export const B_MIN = 0;
export const B_MAX = 4;
export const B_DEFAULT = 0;

export type Mode = 'eager' | 'compile' | 'graph' | 'compile-graph';

export interface CompileGraphsState {
	/** torch.compile on. */
	compile: boolean;
	/** CUDA graph on. */
	graph: boolean;
	/** Number of operations in the chain. */
	n: number;
	/** Work per kernel, one of W_STEPS. */
	w: number;
	/** Number of graph breaks (only matters in compiled modes). */
	b: number;
}

export const DEFAULT_STATE: CompileGraphsState = {
	compile: false,
	graph: false,
	n: N_DEFAULT,
	w: W_DEFAULT,
	b: B_DEFAULT,
};

export const MODES: readonly Mode[] = ['eager', 'compile', 'graph', 'compile-graph'];

export const MODE_LABEL: Record<Mode, string> = {
	eager: 'eager',
	compile: 'compile',
	graph: 'eager с CUDA-графом',
	'compile-graph': 'compile с CUDA-графом',
};

export function modeOf(compile: boolean, graph: boolean): Mode {
	if (compile && graph) return 'compile-graph';
	if (compile) return 'compile';
	if (graph) return 'graph';
	return 'eager';
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to an integer in [N_MIN, N_MAX]. Non-finite input gives the default. */
export function snapN(n: number): number {
	if (!Number.isFinite(n)) return N_DEFAULT;
	return clamp(Math.round(n), N_MIN, N_MAX);
}

/** Rounds to an integer in [B_MIN, B_MAX]. Non-finite input gives the default. */
export function snapB(b: number): number {
	if (!Number.isFinite(b)) return B_DEFAULT;
	return clamp(Math.round(b), B_MIN, B_MAX);
}

/** Work value at a slider index. Out-of-range index gives the default. */
export function wAt(index: number): number {
	const v = W_STEPS[index];
	return v === undefined ? W_DEFAULT : v;
}

/** Index in W_STEPS of the nearest value. Non-finite input gives the default. */
export function wIndexOf(w: number): number {
	if (!Number.isFinite(w)) return W_STEPS.indexOf(W_DEFAULT);
	let best = 0;
	for (let i = 1; i < W_STEPS.length; i++) {
		if (Math.abs(wAt(i) - w) < Math.abs(wAt(best) - w)) best = i;
	}
	return best;
}

export interface Params {
	/** Operations in the chain. */
	n: number;
	/** Work per kernel. */
	w: number;
	/** Graph breaks in compiled modes. */
	b: number;
}

/** Eager: one launch per operation, the GPU waits when the launch is longer than the work. */
export function timeEager(p: Params, o: number = O_LAUNCH): number {
	return p.n * Math.max(o, p.w) + Math.min(o, p.w);
}

/** Compiled: fused kernels plus one extra launch per graph break. */
export function timeCompile(p: Params, o: number = O_LAUNCH, k: number = K_FUSED): number {
	return (k + p.b) * Math.max(o, p.w) + Math.min(o, p.w);
}

/** CUDA graph over the eager chain: one launch, then the kernels run back to back. */
export function timeGraph(p: Params, o: number = O_LAUNCH): number {
	return o + p.n * p.w;
}

/**
 * CUDA graph over the compiled kernels. The chapter's formula does not count graph breaks,
 * so `b` is not used here.
 */
export function timeCompileGraph(p: Params, o: number = O_LAUNCH, k: number = K_FUSED): number {
	return o + k * p.w;
}

/** Total time of every mode for the given parameters. */
export function allTotals(p: Params): Record<Mode, number> {
	return {
		eager: timeEager(p),
		compile: timeCompile(p),
		graph: timeGraph(p),
		'compile-graph': timeCompileGraph(p),
	};
}

export interface Span {
	start: number;
	end: number;
}

export interface Timeline {
	/** CPU busy intervals (launches). */
	cpu: Span[];
	/** GPU busy intervals (kernels). Gaps between them are GPU idle time. */
	gpu: Span[];
	/** End of the last kernel. */
	total: number;
}

/** One launch per kernel: the CPU issues kernels ahead, the GPU starts each one when it is free. */
function launchEach(count: number, o: number, w: number): Timeline {
	const cpu: Span[] = [];
	const gpu: Span[] = [];
	let gpuFree = 0;
	for (let i = 0; i < count; i++) {
		const issued = (i + 1) * o;
		cpu.push({ start: i * o, end: issued });
		const start = Math.max(issued, gpuFree);
		const end = start + w;
		gpu.push({ start, end });
		gpuFree = end;
	}
	return { cpu, gpu, total: gpuFree };
}

/** One launch for the whole graph, then the kernels run back to back on the GPU. */
function replayGraph(count: number, o: number, w: number): Timeline {
	const cpu: Span[] = [{ start: 0, end: o }];
	const gpu: Span[] = [];
	let t = o;
	for (let i = 0; i < count; i++) {
		gpu.push({ start: t, end: t + w });
		t += w;
	}
	return { cpu, gpu, total: t };
}

/** Launch-by-launch timeline of one mode. Its total equals the closed form of the mode. */
export function timeline(mode: Mode, p: Params, o: number = O_LAUNCH): Timeline {
	switch (mode) {
		case 'eager':
			return launchEach(p.n, o, p.w);
		case 'compile':
			return launchEach(K_FUSED + p.b, o, p.w);
		case 'graph':
			return replayGraph(p.n, o, p.w);
		case 'compile-graph':
			return replayGraph(K_FUSED, o, p.w);
	}
}

/** Formats a number for the Russian text: integers without decimals, others with two. */
export function fmt(x: number): string {
	if (Number.isInteger(x)) return String(x);
	return (Math.round(x * 100) / 100).toFixed(2).replace('.', ',');
}

/** The formula of the mode with the current numbers substituted. */
export function formulaText(mode: Mode, p: Params, o: number = O_LAUNCH): string {
	const mx = `max(${fmt(o)}; ${fmt(p.w)})`;
	const mn = `min(${fmt(o)}; ${fmt(p.w)})`;
	switch (mode) {
		case 'eager':
			return `T = N·${mx} + ${mn} = ${p.n}·${mx} + ${mn} = ${fmt(timeEager(p, o))}`;
		case 'compile':
			return `T = (K + B)·${mx} + ${mn} = (${K_FUSED} + ${p.b})·${mx} + ${mn} = ${fmt(timeCompile(p, o))}`;
		case 'graph':
			return `T = o + N·w = ${fmt(o)} + ${p.n}·${fmt(p.w)} = ${fmt(timeGraph(p, o))}`;
		case 'compile-graph':
			return `T = o + K·w = ${fmt(o)} + ${K_FUSED}·${fmt(p.w)} = ${fmt(timeCompileGraph(p, o))}`;
	}
}

/**
 * Cause and effect for the current numbers: which side is the bottleneck and what a
 * graph break adds. Numbers are computed, not typed.
 */
export function explain(mode: Mode, p: Params, o: number = O_LAUNCH): string {
	const parts: string[] = [];
	if (p.w < o) {
		parts.push(
			`Запуск (${fmt(o)}) дороже работы ядра (${fmt(p.w)}): GPU ждёт CPU, пустоты между ядрами на шкале — простой GPU.`,
		);
	} else {
		parts.push(
			`Работа ядра (${fmt(p.w)}) не короче запуска (${fmt(o)}): запуски скрыты работой, CUDA-граф почти ничего не меняет.`,
		);
	}
	if (mode === 'compile' && p.b > 0) {
		parts.push(
			`Разрывы графа (${p.b}) добавили ${p.b} запуск(а): +${fmt(p.b * Math.max(o, p.w))} к времени.`,
		);
	}
	if (mode === 'compile-graph' && p.b > 0) {
		parts.push('В модели CUDA-граф записан целиком, поэтому разрывы здесь не учитываются.');
	}
	return parts.join(' ');
}

/** Short sentence for the live region: the current mode and its time. */
export function summaryText(mode: Mode, p: Params, o: number = O_LAUNCH): string {
	const t = allTotals(p);
	return (
		`Режим ${MODE_LABEL[mode]}: время ${fmt(t[mode])} условных единиц. ` +
		`Для сравнения: eager ${fmt(t.eager)}, compile ${fmt(t.compile)}, ` +
		`eager с графом ${fmt(t.graph)}, compile с графом ${fmt(t['compile-graph'])}. ` +
		explain(mode, p, o)
	);
}
