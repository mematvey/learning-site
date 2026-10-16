/**
 * Math of the backprop demo: a tiny computation graph with one neuron and a squared loss
 *   m = w·x,  s = m + b,  a = σ(s),  d = a − y,  L = d².
 * Forward values and gradients ∂L/∂node are closed-form. The demo walks through the graph
 * step by step: steps 1–5 are the forward pass, steps 6–10 the backward pass.
 * Pure functions only: no DOM, no Svelte.
 */

export const PARAM_MIN = -2;
export const PARAM_MAX = 2;
export const PARAM_STEP = 0.1;
export const TARGET_MIN = 0;
export const TARGET_MAX = 1;

/** Number of steps after the start: 5 forward + 5 backward. */
export const STEP_MAX = 10;

/** Input nodes: the sliders. */
export type ParamKey = 'x' | 'w' | 'b' | 'y';
/** Operation nodes, in forward order. */
export type OpNode = 'm' | 's' | 'a' | 'd' | 'L';
export type GraphNode = ParamKey | OpNode;

/** Forward pass order: step k (1-based) computes FORWARD_ORDER[k - 1]. */
export const FORWARD_ORDER: readonly OpNode[] = ['m', 's', 'a', 'd', 'L'];
/** Backward pass order: step 5 + k (1-based) handles BACKWARD_ORDER[k - 1]. */
export const BACKWARD_ORDER: readonly OpNode[] = ['L', 'd', 'a', 's', 'm'];

/** State of `BackpropDemo`. Chapter text drives it through `DemoLink` (`set(patch)`). */
export interface BackpropDemoState {
	/** Input x. */
	x: number;
	/** Weight w. */
	w: number;
	/** Bias b. */
	b: number;
	/** Target y in [0, 1]. */
	y: number;
	/** Number of executed steps, 0..STEP_MAX. */
	step: number;
}

export const DEFAULT_STATE: BackpropDemoState = { x: 2, w: 0.5, b: -0.3, y: 1, step: 0 };

export type Params = Pick<BackpropDemoState, 'x' | 'w' | 'b' | 'y'>;

export interface Forward {
	m: number;
	s: number;
	a: number;
	d: number;
	L: number;
}

/** Gradient of the loss with respect to every node: `grad[node] = ∂L/∂node`. */
export type Gradients = Record<GraphNode, number>;

export function sigmoid(z: number): number {
	return 1 / (1 + Math.exp(-z));
}

/** Rounds to one decimal and clamps into [min, max]. Non-finite input gives `fallback`. */
function snapTo(value: number, min: number, max: number, fallback: number): number {
	if (!Number.isFinite(value)) return fallback;
	const fixed = Number((Math.round(value / PARAM_STEP) * PARAM_STEP).toFixed(2));
	return Math.min(max, Math.max(min, fixed));
}

export function snapParam(value: number): number {
	return snapTo(value, PARAM_MIN, PARAM_MAX, 0);
}

export function snapTarget(value: number): number {
	return snapTo(value, TARGET_MIN, TARGET_MAX, 1);
}

/** Clamps the step to 0..STEP_MAX and makes it an integer. Non-finite input gives 0. */
export function snapStep(step: number): number {
	if (!Number.isFinite(step)) return 0;
	return Math.min(STEP_MAX, Math.max(0, Math.round(step)));
}

/** Builds a full valid state from a partial patch, keeping defaults for missing fields. */
export function normalizeState(patch?: Partial<BackpropDemoState>): BackpropDemoState {
	return {
		x: snapParam(patch?.x ?? DEFAULT_STATE.x),
		w: snapParam(patch?.w ?? DEFAULT_STATE.w),
		b: snapParam(patch?.b ?? DEFAULT_STATE.b),
		y: snapTarget(patch?.y ?? DEFAULT_STATE.y),
		step: snapStep(patch?.step ?? DEFAULT_STATE.step),
	};
}

export function forward(p: Params): Forward {
	const m = p.w * p.x;
	const s = m + p.b;
	const a = sigmoid(s);
	const d = a - p.y;
	const L = d * d;
	return { m, s, a, d, L };
}

/**
 * Reverse-mode pass by the chain rule. Each line is one node's local derivative
 * applied to the gradient coming from its output.
 */
export function backward(p: Params, f: Forward): Gradients {
	const dL = 1; // seed: ∂L/∂L
	const dd = dL * 2 * f.d; // L = d²
	const da = dd; // d = a − y
	const dy = -dd;
	const ds = da * f.a * (1 - f.a); // a = σ(s), σ' = σ(1 − σ)
	const dm = ds; // s = m + b: addition passes the gradient through
	const db = ds;
	const dw = dm * p.x; // m = w·x
	const dx = dm * p.w;
	return { L: dL, d: dd, a: da, y: dy, s: ds, m: dm, b: db, w: dw, x: dx };
}

/** True when the forward value of `node` is known after `step` steps. Inputs are always known. */
export function forwardDone(node: GraphNode, step: number): boolean {
	if (!isOpNode(node)) return true;
	return step >= FORWARD_ORDER.indexOf(node) + 1;
}

/** True when the gradient of `node` has been computed after `step` steps (its consumer's backward step ran). */
export function backwardDone(node: OpNode, step: number): boolean {
	return step >= FORWARD_ORDER.length + BACKWARD_ORDER.indexOf(node) + 1;
}

export function isOpNode(node: GraphNode): node is OpNode {
	return (FORWARD_ORDER as readonly string[]).includes(node);
}

/** The node processed by step k: forward for 1..5, backward for 6..10, null for 0. */
export function nodeAtStep(step: number): { dir: 'forward' | 'backward'; node: OpNode } | null {
	const k = snapStep(step);
	if (k === 0) return null;
	if (k <= FORWARD_ORDER.length) return { dir: 'forward', node: FORWARD_ORDER[k - 1] as OpNode };
	return {
		dir: 'backward',
		node: BACKWARD_ORDER[k - FORWARD_ORDER.length - 1] as OpNode,
	};
}

/** Formats a number with a typographic minus sign. */
export function fmt(value: number, digits = 2): string {
	return value.toFixed(digits).replace('-', '−');
}

/** Text for the current step. Numbers are computed, not typed. */
export function describeStep(state: BackpropDemoState): string {
	const p = normalizeState(state);
	const f = forward(p);
	const g = backward(p, f);
	switch (snapStep(p.step)) {
		case 0:
			return `Входы заданы: w = ${fmt(p.w)}, x = ${fmt(p.x)}, b = ${fmt(p.b)}, y = ${fmt(p.y)}. Вычислений ещё нет.`;
		case 1:
			return `Прямой проход, узел m: m = w · x = ${fmt(f.m)}.`;
		case 2:
			return `Узел s: s = m + b = ${fmt(f.s)}.`;
		case 3:
			return `Узел a: a = σ(s) = ${fmt(f.a, 3)}.`;
		case 4:
			return `Узел d: d = a − y = ${fmt(f.d, 3)}.`;
		case 5:
			return `Узел L: L = d² = ${fmt(f.L, 3)}. Прямой проход закончен, идём назад.`;
		case 6:
			return `Обратный проход, узел L: ∂L/∂d = 2d = ${fmt(g.d, 3)}.`;
		case 7:
			return `Узел d: ∂L/∂a = ${fmt(g.a, 3)}, ∂L/∂y = −∂L/∂d = ${fmt(g.y, 3)}.`;
		case 8:
			return `Узел a: ∂L/∂s = ∂L/∂a · a(1 − a) = ${fmt(g.s, 3)}.`;
		case 9:
			return `Узел s: ∂L/∂m = ∂L/∂s = ${fmt(g.m, 3)}, ∂L/∂b = ${fmt(g.b, 3)}. Сумма передаёт градиент без изменений.`;
		default:
			return `Узел m: ∂L/∂w = ∂L/∂m · x = ${fmt(g.w, 3)}, ∂L/∂x = ∂L/∂m · w = ${fmt(g.x, 3)}. Все градиенты найдены.`;
	}
}
