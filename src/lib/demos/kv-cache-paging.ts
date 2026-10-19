/**
 * Math of the KV-cache paging demo: blocks of BLOCK tokens, block tables, prefix sharing.
 * Pure functions only: no DOM, no Svelte. Numbers follow the chapter compute/kv-cache-paging.
 */

/** Tokens per block. */
export const BLOCK = 16;
/** Size of the static reservation (max context length) that the demo compares against. */
export const STATIC_RESERVE = 2048;

export const REQUESTS_MIN = 1;
export const REQUESTS_MAX = 6;
export const PREFIX_MIN = 0;
export const PREFIX_MAX = 160;
export const TAIL_MIN = 0;
export const TAIL_MAX = 96;
/** Step of the prefix and tail controls; a multiple of BLOCK/2 keeps the picture readable. */
export const STEP = 8;
export const LENGTH_MIN = 1;
export const LENGTH_MAX = 512;
export const LENGTH_DEFAULT = 300;

export interface PagingState {
	/** Number of concurrent requests that share the same system prompt. */
	requests: number;
	/** Shared prefix length in tokens (the system prompt). */
	prefix: number;
	/** Private tail length of each request in tokens. */
	tail: number;
	/** Whether full prefix blocks are stored once and shared (prefix sharing). */
	share: boolean;
}

/** The chapter's example: 3 requests, 96 shared tokens (6 blocks), 40 private tokens (3 blocks). */
export const DEFAULT_STATE: PagingState = { requests: 3, prefix: 96, tail: 40, share: true };

export type StateKey = 'requests' | 'prefix' | 'tail';
export type SlotKind = 'prefix' | 'tail' | 'empty';

export interface PhysicalBlock {
	/** Index in the physical pool. */
	id: number;
	/** True for a prefix block stored once and referenced by every request. */
	shared: boolean;
	/** One entry per slot (BLOCK entries). */
	slots: SlotKind[];
}

export interface Layout {
	/** Physical pool; the index of a block equals its id. */
	blocks: PhysicalBlock[];
	/** Per request: block ids in token order (the block table). */
	tables: number[][];
}

export interface PagingStats {
	/** Blocks in the pool when sharing is on. */
	withShare: number;
	/** Blocks in the pool when sharing is off. */
	withoutShare: number;
	/** withoutShare - withShare. */
	saved: number;
	/** saved / withoutShare, in [0, 1]. */
	savedPct: number;
	/** Blocks that sharing stores once (shared prefix blocks), with sharing on. */
	sharedBlocks: number;
	/** Empty slots in the pool in the current mode. */
	emptySlots: number;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

function snapTo(v: number, lo: number, hi: number, step: number, fallback: number): number {
	if (!Number.isFinite(v)) return fallback;
	return clamp(Math.round(v / step) * step, lo, hi);
}

export function snapRequests(n: number): number {
	return snapTo(n, REQUESTS_MIN, REQUESTS_MAX, 1, DEFAULT_STATE.requests);
}

export function snapPrefix(p: number): number {
	return snapTo(p, PREFIX_MIN, PREFIX_MAX, STEP, DEFAULT_STATE.prefix);
}

export function snapTail(t: number): number {
	return snapTo(t, TAIL_MIN, TAIL_MAX, STEP, DEFAULT_STATE.tail);
}

export function snapLength(t: number): number {
	return snapTo(t, LENGTH_MIN, LENGTH_MAX, 1, LENGTH_DEFAULT);
}

/** A valid state from partial input; missing or broken fields take the default values. */
export function makeState(p: Partial<PagingState> = {}): PagingState {
	return {
		requests: snapRequests(p.requests ?? DEFAULT_STATE.requests),
		prefix: snapPrefix(p.prefix ?? DEFAULT_STATE.prefix),
		tail: snapTail(p.tail ?? DEFAULT_STATE.tail),
		share: typeof p.share === 'boolean' ? p.share : DEFAULT_STATE.share,
	};
}

/** One step of a control (+1 or -1), clamped and snapped. Returns the same object at a limit. */
export function stepState(state: PagingState, key: StateKey, dir: 1 | -1): PagingState {
	if (key === 'requests') {
		return { ...state, requests: snapRequests(state.requests + dir) };
	}
	if (key === 'prefix') {
		return { ...state, prefix: snapPrefix(state.prefix + dir * STEP) };
	}
	return { ...state, tail: snapTail(state.tail + dir * STEP) };
}

/** Blocks needed for `tokens` tokens: a partly filled last block still takes a whole block. */
export function blocksFor(tokens: number): number {
	if (tokens <= 0) return 0;
	return Math.ceil(tokens / BLOCK);
}

/** Free slots in the last block of a request of `tokens` tokens. */
export function emptySlots(tokens: number): number {
	if (tokens <= 0) return 0;
	return blocksFor(tokens) * BLOCK - tokens;
}

/** Share of a static reservation of `reserve` slots that stays idle for a request of `tokens`. */
export function staticIdle(tokens: number, reserve: number = STATIC_RESERVE): number {
	return (reserve - tokens) / reserve;
}

/**
 * Builds the physical pool and the block table of every request.
 * With sharing, the full prefix blocks (floor(prefix / BLOCK) of them) come first and are
 * referenced by all requests. Each request then gets its own blocks for the rest of its
 * tokens: the partial prefix block (if any) and the tail.
 */
export function buildLayout(state: PagingState): Layout {
	const n = snapRequests(state.requests);
	const prefix = snapPrefix(state.prefix);
	const tail = snapTail(state.tail);
	const sharedFull = state.share ? Math.floor(prefix / BLOCK) : 0;
	const sharedTokens = sharedFull * BLOCK;
	/** Tokens of one request that live in its own blocks. */
	const privateTokens = prefix - sharedTokens + tail;
	const privateBlocks = blocksFor(privateTokens);
	const total = prefix + tail;

	const blocks: PhysicalBlock[] = [];
	const sharedIds: number[] = [];
	for (let j = 0; j < sharedFull; j++) {
		sharedIds.push(blocks.length);
		blocks.push({ id: blocks.length, shared: true, slots: Array(BLOCK).fill('prefix') });
	}

	const tables: number[][] = [];
	for (let i = 0; i < n; i++) {
		const table = [...sharedIds];
		for (let j = 0; j < privateBlocks; j++) {
			const slots: SlotKind[] = [];
			for (let q = 0; q < BLOCK; q++) {
				// Position of this slot in the request's token stream.
				const pos = sharedTokens + j * BLOCK + q;
				if (pos < prefix) slots.push('prefix');
				else if (pos < total) slots.push('tail');
				else slots.push('empty');
			}
			table.push(blocks.length);
			blocks.push({ id: blocks.length, shared: false, slots });
		}
		tables.push(table);
	}
	return { blocks, tables };
}

/** Counts for both modes plus the current one, so the view can show cause and effect. */
export function statsFor(state: PagingState): PagingStats {
	const current = buildLayout(state);
	const on = buildLayout({ ...state, share: true });
	const off = buildLayout({ ...state, share: false });
	const withShare = on.blocks.length;
	const withoutShare = off.blocks.length;
	const saved = withoutShare - withShare;
	return {
		withShare,
		withoutShare,
		saved,
		savedPct: withoutShare > 0 ? saved / withoutShare : 0,
		sharedBlocks: on.blocks.filter((b) => b.shared).length,
		emptySlots: current.blocks.reduce((s, b) => s + b.slots.filter((k) => k === 'empty').length, 0),
	};
}

/** Slots of a single request of `tokens` tokens: every filled slot is a tail slot. */
export function singleBlocks(tokens: number): PhysicalBlock[] {
	const n = blocksFor(tokens);
	const blocks: PhysicalBlock[] = [];
	for (let j = 0; j < n; j++) {
		const slots: SlotKind[] = [];
		for (let q = 0; q < BLOCK; q++) {
			slots.push(j * BLOCK + q < tokens ? 'tail' : 'empty');
		}
		blocks.push({ id: j, shared: false, slots });
	}
	return blocks;
}

/**
 * One sentence on what the last change did: the cause (which control moved) and the effect
 * on the block count. Empty string when nothing changed.
 */
export function describeChange(prev: PagingState, next: PagingState): string {
	if (
		prev.requests === next.requests &&
		prev.prefix === next.prefix &&
		prev.tail === next.tail &&
		prev.share === next.share
	) {
		return '';
	}
	const before = buildLayout(prev).blocks.length;
	const after = buildLayout(next).blocks.length;
	const effect =
		after === before ? `блоков не прибавилось: ${before}` : `блоков ${before} → ${after}`;

	let cause: string;
	if (prev.share !== next.share) {
		cause = next.share
			? 'разделение включено: общий префикс хранится один раз'
			: 'разделение выключено: каждый запрос хранит префикс заново';
	} else if (prev.requests !== next.requests) {
		cause =
			next.requests > prev.requests
				? next.share
					? 'новый запрос берёт общие блоки и занимает только свой хвост'
					: 'новый запрос занимает свой полный набор блоков'
				: 'запрос ушёл, его блоки освобождены';
	} else if (prev.prefix !== next.prefix) {
		cause = `общий префикс ${next.prefix} токенов, полных общих блоков: ${Math.floor(next.prefix / BLOCK)}`;
	} else {
		cause =
			after === before
				? 'новые токены легли в свободные слоты последнего блока'
				: 'последний блок заполнился, понадобился новый блок';
	}
	return `${cause.charAt(0).toUpperCase()}${cause.slice(1)}; ${effect}.`;
}
