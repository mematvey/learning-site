/**
 * Math of the memory-coalescing demo: which global-memory transactions one warp issues
 * for a strided float32 access, and how many of the fetched bytes are useful.
 * Pure functions only: no DOM, no Svelte.
 *
 * Model (simplified): thread t of the warp reads element (offset + t * stride) of a float32 array
 * (4 bytes). The base address is aligned to the segment size. The hardware issues one transaction
 * per aligned segment that holds at least one requested address; each transaction moves the whole
 * segment, so the bytes of the segment that nobody asked for are wasted.
 *
 * Hardware constants are typical values, not measurements made for this demo:
 * - WARP_SIZE = 32: the number of threads in a warp on NVIDIA GPUs.
 * - Segment 128 bytes: a common L1 cache-line size; 32 bytes is the smaller sector size.
 * Sources: CUDA C++ Programming Guide (warps, global memory access)
 *   https://docs.nvidia.com/cuda/cuda-c-programming-guide/index.html
 *   CUDA C++ Best Practices Guide (coalesced access to global memory)
 *   https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html
 */

/** Threads in a warp (typical value for NVIDIA GPUs). */
export const WARP_SIZE = 32;
/** Size of a float32 element in bytes. */
export const ELEM_BYTES = 4;

/** Segment sizes the demo offers: 32-byte sectors and 128-byte cache lines (typical values). */
export const SEGMENT_OPTIONS = [32, 128] as const;
export type SegmentBytes = (typeof SEGMENT_OPTIONS)[number];
export const DEFAULT_SEGMENT_BYTES: SegmentBytes = 128;

export const STRIDE_MIN = 1;
export const STRIDE_MAX = 32;
export const DEFAULT_STRIDE = 2;

/** Offset of the first element from the aligned base, in elements. */
export const OFFSET_MIN = 0;
export const OFFSET_MAX = 31;
export const DEFAULT_OFFSET = 0;

export interface CoalescingDemoState {
	/** Distance between the elements of consecutive threads, in elements. Integer in [STRIDE_MIN, STRIDE_MAX]. */
	stride: number;
	/** Index of thread 0's element, in elements. Integer in [OFFSET_MIN, OFFSET_MAX]. */
	offset: number;
	/** Segment (transaction) size in bytes. */
	segmentBytes: SegmentBytes;
}

export const DEFAULT_STATE: CoalescingDemoState = {
	stride: DEFAULT_STRIDE,
	offset: DEFAULT_OFFSET,
	segmentBytes: DEFAULT_SEGMENT_BYTES,
};

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
	return Math.min(hi, Math.max(lo, Math.round(v)));
}

/** Clamps and rounds a stride to [STRIDE_MIN, STRIDE_MAX]. Non-numbers give the default. */
export function snapStride(v: unknown): number {
	return clampInt(v, STRIDE_MIN, STRIDE_MAX, DEFAULT_STRIDE);
}

/** Clamps and rounds an offset to [OFFSET_MIN, OFFSET_MAX]. Non-numbers give the default. */
export function snapOffset(v: unknown): number {
	return clampInt(v, OFFSET_MIN, OFFSET_MAX, DEFAULT_OFFSET);
}

export function isSegmentBytes(v: unknown): v is SegmentBytes {
	return v === 32 || v === 128;
}

/** Merges a partial patch into the state; invalid fields are snapped or ignored. */
export function applyPatch(
	state: CoalescingDemoState,
	patch: Partial<CoalescingDemoState>,
): CoalescingDemoState {
	return {
		stride: patch.stride !== undefined ? snapStride(patch.stride) : state.stride,
		offset: patch.offset !== undefined ? snapOffset(patch.offset) : state.offset,
		segmentBytes: isSegmentBytes(patch.segmentBytes) ? patch.segmentBytes : state.segmentBytes,
	};
}

/** One thread's request: its byte address, the segment it falls in, and the element slot inside that segment. */
export interface Access {
	thread: number;
	address: number;
	segment: number;
	cell: number;
}

/** Addresses of the 32 threads of one warp. */
export function warpAccesses(stride: number, offset: number, segmentBytes: SegmentBytes): Access[] {
	const s = snapStride(stride);
	const o = snapOffset(offset);
	const out: Access[] = [];
	for (let t = 0; t < WARP_SIZE; t++) {
		const address = (o + t * s) * ELEM_BYTES;
		const segment = Math.floor(address / segmentBytes);
		out.push({
			thread: t,
			address,
			segment,
			cell: (address - segment * segmentBytes) / ELEM_BYTES,
		});
	}
	return out;
}

/** One memory transaction: an aligned segment and the threads that were served by it. */
export interface Transaction {
	/** Row number, 0-based, in order of increasing address. */
	index: number;
	/** Segment number: the segment covers bytes [segment * segmentBytes, (segment + 1) * segmentBytes). */
	segment: number;
	/** Which thread reads which element slot of this segment. */
	lanes: { thread: number; cell: number }[];
}

/** Groups the accesses of a warp by segment. Transactions are sorted by address. */
export function transactions(accesses: Access[]): Transaction[] {
	const bySegment = new Map<number, Transaction>();
	for (const a of accesses) {
		let tr = bySegment.get(a.segment);
		if (!tr) {
			tr = { index: 0, segment: a.segment, lanes: [] };
			bySegment.set(a.segment, tr);
		}
		tr.lanes.push({ thread: a.thread, cell: a.cell });
	}
	const sorted = [...bySegment.values()].sort((a, b) => a.segment - b.segment);
	sorted.forEach((tr, i) => {
		tr.index = i;
	});
	return sorted;
}

export interface CoalescingAnalysis {
	accesses: Access[];
	transactions: Transaction[];
	transactionCount: number;
	/** Element slots per segment: segmentBytes / ELEM_BYTES. */
	cellsPerSegment: number;
	/** Bytes the threads asked for: WARP_SIZE * ELEM_BYTES. */
	usefulBytes: number;
	/** Bytes moved by all transactions: transactionCount * segmentBytes. */
	movedBytes: number;
	/** Share of the moved bytes that were requested, in (0, 1]. */
	efficiency: number;
	/** Transactions needed when the same bytes are contiguous and aligned. */
	minTransactions: number;
}

/** Full picture of one warp access for the given state. */
export function analyse(state: CoalescingDemoState): CoalescingAnalysis {
	const segmentBytes = isSegmentBytes(state.segmentBytes)
		? state.segmentBytes
		: DEFAULT_SEGMENT_BYTES;
	const accesses = warpAccesses(state.stride, state.offset, segmentBytes);
	const trs = transactions(accesses);
	const usefulBytes = WARP_SIZE * ELEM_BYTES;
	const movedBytes = trs.length * segmentBytes;
	return {
		accesses,
		transactions: trs,
		transactionCount: trs.length,
		cellsPerSegment: segmentBytes / ELEM_BYTES,
		usefulBytes,
		movedBytes,
		efficiency: usefulBytes / movedBytes,
		minTransactions: Math.ceil(usefulBytes / segmentBytes),
	};
}

/** Efficiency as a percent with one decimal place, e.g. 50, 12.5, 3.1. */
export function efficiencyPercent(efficiency: number): number {
	return Math.round(efficiency * 1000) / 10;
}

/** Text for screen readers and the note under the demo. */
export function describeAccess(state: CoalescingDemoState): string {
	const a = analyse(state);
	const pct = efficiencyPercent(a.efficiency);
	const head = `Шаг ${state.stride}${state.offset > 0 ? `, сдвиг ${state.offset}` : ''}`;
	return `${head}: транзакций ${a.transactionCount} по ${state.segmentBytes} байт, нужно ${a.usefulBytes} байт. Полезных байт ${pct}%.`;
}
