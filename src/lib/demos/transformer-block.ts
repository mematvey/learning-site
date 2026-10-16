/**
 * Math of the transformer block demo. The block is pre-LN:
 *   h = x + MHA(LN(x)),   y = h + MLP(LN(h)).
 * Tensors are shown without the batch axis: a token matrix is [n, d] (n tokens, d model width).
 * All shapes and parameter counts are computed here, not typed by hand.
 * Pure functions only: no DOM, no Svelte.
 */

/** Number of heads h in the attention node. Divides every allowed model width. */
export const HEADS = 4;
/** The MLP hidden layer is MLP_EXPANSION times wider than d. */
export const MLP_EXPANSION = 4;

export const TOKENS_MIN = 2;
export const TOKENS_MAX = 12;
export const TOKENS_DEFAULT = 6;

export const DIM_MIN = 16;
export const DIM_MAX = 128;
export const DIM_STEP = 16;
export const DIM_DEFAULT = 64;

export const NODE_IDS = ['x', 'ln1', 'attn', 'add1', 'ln2', 'mlp', 'add2'] as const;
export type NodeId = (typeof NODE_IDS)[number];

export type NodeKind = 'tensor' | 'norm' | 'attn' | 'mlp' | 'sum';

export interface TransformerBlockDemoState {
	/** Selected node of the diagram. */
	node: NodeId;
	/** Number of tokens n. */
	tokens: number;
	/** Model width d. */
	dim: number;
}

export const DEFAULT_STATE: TransformerBlockDemoState = {
	node: 'attn',
	tokens: TOKENS_DEFAULT,
	dim: DIM_DEFAULT,
};

/** Short node labels for the diagram. */
export const NODE_LABEL: Record<NodeId, string> = {
	x: 'Вход x',
	ln1: 'LayerNorm 1',
	attn: 'Внимание (MHA)',
	add1: 'Сумма 1',
	ln2: 'LayerNorm 2',
	mlp: 'MLP',
	add2: 'Сумма 2',
};

/** Main data path, in order. Each pair is [from, to]. */
export const MAIN_CHAIN: ReadonlyArray<readonly [NodeId, NodeId]> = [
	['x', 'ln1'],
	['ln1', 'attn'],
	['attn', 'add1'],
	['add1', 'ln2'],
	['ln2', 'mlp'],
	['mlp', 'add2'],
];

/** Residual (skip) connections: the sum nodes take a second input from here. */
export const RESIDUAL: ReadonlyArray<readonly [NodeId, NodeId]> = [
	['x', 'add1'],
	['add1', 'add2'],
];

export type Shape = readonly number[];

export function isNodeId(v: unknown): v is NodeId {
	return typeof v === 'string' && (NODE_IDS as readonly string[]).includes(v);
}

function snapInt(v: number, lo: number, hi: number, fallback: number): number {
	if (!Number.isFinite(v)) return fallback;
	return Math.min(hi, Math.max(lo, Math.round(v)));
}

/** Rounds to an integer in the token slider range. Non-finite input gives the default. */
export function snapTokens(n: number): number {
	return snapInt(n, TOKENS_MIN, TOKENS_MAX, TOKENS_DEFAULT);
}

/** Rounds to the nearest multiple of DIM_STEP inside the d slider range. Non-finite gives the default. */
export function snapDim(d: number): number {
	if (!Number.isFinite(d)) return DIM_DEFAULT;
	const k = Math.round(d / DIM_STEP);
	return Math.min(DIM_MAX, Math.max(DIM_MIN, k * DIM_STEP));
}

/** Text form of a shape, e.g. `[6, 64]`. */
export function formatShape(s: Shape): string {
	return `[${s.join(', ')}]`;
}

/** Shape of the split heads: [h, n, d / h]. */
export function headShape(tokens: number, dim: number): Shape {
	return [HEADS, tokens, dim / HEADS];
}

/**
 * Learnable parameters of a node, biases included, without a batch axis.
 * LayerNorm: γ and β, 2d. MHA: W_Q, W_K, W_V, W_O, 4d². MLP: 2 layers with biases, 8d² + 5d.
 */
export function paramsOf(id: NodeId, dim: number): number {
	switch (id) {
		case 'ln1':
		case 'ln2':
			return 2 * dim;
		case 'attn':
			return 4 * dim * dim;
		case 'mlp':
			return 2 * MLP_EXPANSION * dim * dim + MLP_EXPANSION * dim + dim;
		default:
			return 0;
	}
}

/** Total learnable parameters of the block. */
export function totalParams(dim: number): number {
	return (['ln1', 'attn', 'ln2', 'mlp'] as const).reduce((s, id) => s + paramsOf(id, dim), 0);
}

export interface NodeDetail {
	label: string;
	shape: Shape;
}

export interface NodeInfo {
	id: NodeId;
	kind: NodeKind;
	/** Full name for the panel. */
	title: string;
	/** Operation of the node, in words. */
	op: string;
	/** Input shape; null for the block input. Sum nodes take two inputs of the same shape. */
	input: Shape | null;
	output: Shape;
	/** Intermediate tensors inside the node. */
	detail: NodeDetail[];
	params: number;
}

/** Shapes, operation and parameter count of one node for the given n and d. */
export function nodeInfo(id: NodeId, tokens: number, dim: number): NodeInfo {
	const td: Shape = [tokens, dim];
	const params = paramsOf(id, dim);
	switch (id) {
		case 'x':
			return {
				id,
				kind: 'tensor',
				title: 'Вход x',
				op: 'Вектор каждого токена: эмбеддинг плюс позиционное кодирование. Блок не меняет форму, поэтому блоки ставятся в стек.',
				input: null,
				output: td,
				detail: [],
				params,
			};
		case 'ln1':
		case 'ln2':
			return {
				id,
				kind: 'norm',
				title: id === 'ln1' ? 'LayerNorm 1' : 'LayerNorm 2',
				op:
					id === 'ln1'
						? 'Нормализация признаков каждого токена отдельно: вычитается среднее, делится на σ, затем γ и β. Выход уходит во внимание, вход x идёт по остаточной связи.'
						: 'Та же нормализация перед MLP, но уже от h. Своя пара γ и β.',
				input: td,
				output: td,
				detail: [],
				params,
			};
		case 'attn':
			return {
				id,
				kind: 'attn',
				title: 'Многоголовое внимание (MHA)',
				op: 'Q, K, V получаются умножением входа на W_Q, W_K, W_V (d × d). Каждый делится на h голов по d/h признаков. В голове softmax(QKᵀ/√d_k)·V, затем головы склеиваются и умножаются на W_O.',
				input: td,
				output: td,
				detail: [
					{ label: 'Q, K, V', shape: td },
					{ label: 'головы Q, K, V', shape: headShape(tokens, dim) },
					{ label: 'веса внимания', shape: [HEADS, tokens, tokens] },
					{ label: 'склейка голов', shape: td },
				],
				params,
			};
		case 'add1':
			return {
				id,
				kind: 'sum',
				title: 'Сумма 1 (остаток)',
				op: 'Поэлементное сложение входа блока и выхода внимания: h = x + MHA(LN(x)). Формы совпадают, поэтому сложение возможно без проекций.',
				input: td,
				output: td,
				detail: [],
				params,
			};
		case 'mlp':
			return {
				id,
				kind: 'mlp',
				title: 'MLP (полносвязная сеть)',
				op: 'Линейный слой d → 4d, функция активации GELU, линейный слой 4d → d. Каждый токен обрабатывается независимо: здесь токены не обмениваются информацией.',
				input: td,
				output: td,
				detail: [{ label: 'скрытый слой', shape: [tokens, MLP_EXPANSION * dim] }],
				params,
			};
		case 'add2':
			return {
				id,
				kind: 'sum',
				title: 'Сумма 2 (остаток)',
				op: 'y = h + MLP(LN(h)). Выход имеет ту же форму, что вход, и подаётся в следующий блок.',
				input: td,
				output: td,
				detail: [],
				params,
			};
	}
}

/** Text for the aria-live line under the diagram. Numbers are computed. */
export function describeNode(info: NodeInfo): string {
	const inPart = info.input ? `вход ${formatShape(info.input)}, ` : '';
	const paramPart = info.params > 0 ? `, параметров ${info.params.toLocaleString('en-US')}` : '';
	return `${info.title}: ${inPart}выход ${formatShape(info.output)}${paramPart}.`;
}
