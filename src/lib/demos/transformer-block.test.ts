import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	DIM_DEFAULT,
	DIM_MAX,
	DIM_MIN,
	DIM_STEP,
	HEADS,
	MAIN_CHAIN,
	NODE_IDS,
	RESIDUAL,
	TOKENS_MAX,
	TOKENS_MIN,
	describeNode,
	formatShape,
	headShape,
	isNodeId,
	nodeInfo,
	paramsOf,
	snapDim,
	snapTokens,
	totalParams,
	cleanPath,
	mainChain,
	nodeOrder,
	residual,
} from './transformer-block';

describe('snapping of the sliders', () => {
	it('clamps tokens to the range and rounds to an integer', () => {
		expect(snapTokens(1)).toBe(TOKENS_MIN);
		expect(snapTokens(99)).toBe(TOKENS_MAX);
		expect(snapTokens(5.4)).toBe(5);
		expect(snapTokens(Number.NaN)).toBe(DEFAULT_STATE.tokens);
	});

	it('snaps the width to a multiple of the step inside the range', () => {
		expect(snapDim(0)).toBe(DIM_MIN);
		expect(snapDim(1000)).toBe(DIM_MAX);
		expect(snapDim(100)).toBe(96);
		expect(snapDim(Number.POSITIVE_INFINITY)).toBe(DIM_DEFAULT);
		for (let d = DIM_MIN; d <= DIM_MAX; d += DIM_STEP) {
			expect(d % HEADS).toBe(0);
		}
	});
});

describe('shapes', () => {
	it('the block keeps the shape [n, d] from input to output', () => {
		for (const id of NODE_IDS) {
			const info = nodeInfo(id, 7, 48);
			expect(formatShape(info.output)).toBe('[7, 48]');
			if (info.input) expect(formatShape(info.input)).toBe('[7, 48]');
		}
		expect(nodeInfo('x', 7, 48).output).toEqual(nodeInfo('add2', 7, 48).output);
	});

	it('splits the model width into h heads of width d / h', () => {
		expect(headShape(6, 64)).toEqual([HEADS, 6, 64 / HEADS]);
		const info = nodeInfo('attn', 6, 64);
		expect(info.detail.find((d) => d.label === 'головы Q, K, V')?.shape).toEqual([HEADS, 6, 16]);
		expect(info.detail.find((d) => d.label === 'веса внимания')?.shape).toEqual([HEADS, 6, 6]);
	});

	it('the MLP hidden layer is four times wider than d', () => {
		const hidden = nodeInfo('mlp', 6, 32).detail[0];
		expect(hidden?.shape).toEqual([6, 128]);
	});
});

describe('parameters', () => {
	it('gives 49728 parameters for d = 64 (two LayerNorms, MHA, MLP)', () => {
		// 2 LN * 2d = 256, MHA 4d² = 16384, MLP 8d² + 5d = 33088
		expect(paramsOf('ln1', 64)).toBe(128);
		expect(paramsOf('attn', 64)).toBe(16384);
		expect(paramsOf('mlp', 64)).toBe(33088);
		expect(totalParams(64)).toBe(49728);
	});

	it('sum and tensor nodes have no parameters', () => {
		expect(paramsOf('x', 64)).toBe(0);
		expect(paramsOf('add1', 64)).toBe(0);
		expect(paramsOf('add2', 64)).toBe(0);
	});
});

describe('graph', () => {
	it('each sum node has the main input and one residual input', () => {
		for (const sum of ['add1', 'add2'] as const) {
			const incomingMain = MAIN_CHAIN.filter(([, to]) => to === sum);
			const incomingRes = RESIDUAL.filter(([, to]) => to === sum);
			expect(incomingMain).toHaveLength(1);
			expect(incomingRes).toHaveLength(1);
		}
	});

	it('the residual of the first sum starts at the block input', () => {
		expect(RESIDUAL[0]).toEqual(['x', 'add1']);
	});

	it('the main chain visits every node in order', () => {
		const order = ['x', 'ln1', 'attn', 'add1', 'ln2', 'mlp', 'add2'];
		expect(MAIN_CHAIN.map(([from]) => from)).toEqual(order.slice(0, -1));
		expect(MAIN_CHAIN.at(-1)?.[1]).toBe('add2');
	});
});

describe('helpers', () => {
	it('recognises node ids and rejects anything else', () => {
		expect(isNodeId('attn')).toBe(true);
		expect(isNodeId('attention')).toBe(false);
		expect(isNodeId(3)).toBe(false);
	});

	it('describes the selected node with computed shapes', () => {
		const text = describeNode(nodeInfo('ln1', 6, 64));
		expect(text).toContain('[6, 64]');
		expect(text).toContain('параметров 128');
	});
});

describe('Post-LN variant', () => {
	it('moves both norms after the sums and keeps seven nodes', () => {
		expect(nodeOrder('post')).toEqual(['x', 'attn', 'add1', 'ln1', 'mlp', 'add2', 'ln2']);
		expect([...nodeOrder('post')].sort()).toEqual([...NODE_IDS].sort());
		expect(mainChain('post').at(-1)?.[1]).toBe('ln2');
		expect(residual('post')).toEqual([
			['x', 'add1'],
			['ln1', 'add2'],
		]);
	});

	it('has a norm-free path only in Pre-LN', () => {
		expect(cleanPath('pre')).toEqual(['x', 'add1', 'add2']);
		expect(cleanPath('post')).toEqual([]);
	});

	it('keeps shapes and parameters the same', () => {
		for (const id of NODE_IDS) {
			expect(nodeInfo(id, 5, 32, 'post').output).toEqual(nodeInfo(id, 5, 32, 'pre').output);
			expect(nodeInfo(id, 5, 32, 'post').params).toBe(nodeInfo(id, 5, 32, 'pre').params);
		}
	});
});
