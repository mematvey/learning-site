/**
 * Math of the OS memory demo: a virtual address split into a page number and an offset (4 KB pages),
 * a page table with demand paging, LRU replacement and the count of page faults.
 * The RAM is a few frames; the page table is shown only for the pages the demo touches.
 * Pure functions only: no DOM, no Svelte.
 */

/** Page size: 4 KB. */
export const PAGE_SIZE = 4096;
/** Offset width: log2(PAGE_SIZE) = 12 bits. */
export const OFFSET_BITS = 12;
/** Width of the demo virtual address (bits). */
export const ADDR_BITS = 32;
export const MAX_ADDR = 2 ** ADDR_BITS - 1;
/** Size of one page table entry in the example (assumption, not a measurement). */
export const ENTRY_BYTES = 4;

/** Address shown in the input by default: its page is 0x12345, its offset is 0x678. */
export const DEFAULT_ADDR = 0x12345678;

export const FRAMES_MIN = 1;
export const FRAMES_MAX = 8;
export const FRAMES_DEFAULT = 4;
export const LOOP_MIN = 2;
export const LOOP_MAX = 8;
export const LOOP_DEFAULT = 5;
/** How many times the loop is appended by one click. */
export const LOOP_REPEATS = 3;

export interface OsMemoryDemoState {
	/** Number of physical frames (RAM size in pages). */
	frames: number;
	/** Number of distinct pages in the cyclic access pattern. */
	loopSize: number;
}

function clampInt(v: number, lo: number, hi: number, fallback: number): number {
	if (!Number.isFinite(v)) return fallback;
	return Math.min(hi, Math.max(lo, Math.round(v)));
}

export function snapFrames(n: number): number {
	return clampInt(n, FRAMES_MIN, FRAMES_MAX, FRAMES_DEFAULT);
}

export function snapLoop(n: number): number {
	return clampInt(n, LOOP_MIN, LOOP_MAX, LOOP_DEFAULT);
}

/** Splits a virtual address into the page number and the offset inside the page. */
export function splitAddress(addr: number): { page: number; offset: number } {
	return { page: Math.floor(addr / PAGE_SIZE), offset: addr % PAGE_SIZE };
}

/** Physical address from a frame number and an offset: frame * 4096 + offset. */
export function joinAddress(frame: number, offset: number): number {
	return frame * PAGE_SIZE + offset;
}

/**
 * Parses a hex address, with or without the 0x prefix, up to 8 digits (0 .. 0xFFFFFFFF).
 * Returns null for anything else.
 */
export function parseAddress(text: string): number | null {
	const t = text.trim().replace(/^0x/i, '');
	if (!/^[0-9a-f]{1,8}$/i.test(t)) return null;
	return parseInt(t, 16);
}

/** Lowercase hex with the 0x prefix, zero-padded to `width` digits. */
export function hex(n: number, width = 0): string {
	return '0x' + n.toString(16).padStart(width, '0');
}

/** Number of page table entries: 2^addrBits / pageSize (one entry per page). */
export function pageTableEntries(addrBits: number, pageSize: number = PAGE_SIZE): number {
	return 2 ** addrBits / pageSize;
}

/** Size of a flat page table in bytes, for the given entry size. */
export function pageTableBytes(
	addrBits: number,
	pageSize: number = PAGE_SIZE,
	entryBytes: number = ENTRY_BYTES,
): number {
	return pageTableEntries(addrBits, pageSize) * entryBytes;
}

export interface Resident {
	page: number;
	frame: number;
}

export interface AccessResult {
	/** Position of the access in the sequence, from 0. */
	index: number;
	page: number;
	/** True when the page was not in RAM: a page fault. */
	fault: boolean;
	/** Frame that holds the page after this access. */
	frame: number;
	/** Page removed from RAM by this access, or null. */
	evicted: number | null;
	/** Pages in RAM after this access, sorted by frame number. */
	resident: Resident[];
}

/**
 * Runs the access sequence with demand paging and LRU replacement: a page is loaded only when
 * it is accessed, a free frame (lowest number) is used first, and then the least recently used
 * page is evicted. Every first access to a page is a page fault.
 */
export function simulate(accesses: readonly number[], frames: number): AccessResult[] {
	const n = Math.max(1, Math.floor(frames));
	let slots: { page: number; frame: number; lastUse: number }[] = [];
	const out: AccessResult[] = [];

	accesses.forEach((page, index) => {
		const hit = slots.find((s) => s.page === page);
		let fault = false;
		let frame: number;
		let evicted: number | null = null;

		if (hit) {
			hit.lastUse = index;
			frame = hit.frame;
		} else {
			fault = true;
			if (slots.length < n) {
				const used = new Set(slots.map((s) => s.frame));
				frame = 0;
				while (used.has(frame)) frame++;
			} else {
				const victim = slots.reduce((a, b) => (b.lastUse < a.lastUse ? b : a));
				evicted = victim.page;
				frame = victim.frame;
				slots = slots.filter((s) => s !== victim);
			}
			slots.push({ page, frame, lastUse: index });
		}

		out.push({
			index,
			page,
			fault,
			frame,
			evicted,
			resident: slots
				.map((s) => ({ page: s.page, frame: s.frame }))
				.sort((a, b) => a.frame - b.frame),
		});
	});
	return out;
}

/** Pages in RAM after the first `pos` accesses. */
export function residentAt(steps: readonly AccessResult[], pos: number): Resident[] {
	const last = pos > 0 ? steps[pos - 1] : undefined;
	return last ? last.resident : [];
}

export interface Translation {
	page: number;
	offset: number;
	/** Frame of the page if it is in RAM, otherwise null. */
	frame: number | null;
	/** Physical address if the page is in RAM, otherwise null. */
	physical: number | null;
}

/** Translates a virtual address using the pages currently in RAM. */
export function translate(addr: number, resident: readonly Resident[]): Translation {
	const { page, offset } = splitAddress(addr);
	const hit = resident.find((r) => r.page === page);
	if (!hit) return { page, offset, frame: null, physical: null };
	return { page, offset, frame: hit.frame, physical: joinAddress(hit.frame, offset) };
}

/** Access sequence of a cyclic pattern: pages 0 .. loopSize-1, repeated `repeats` times. */
export function loopAccesses(loopSize: number, repeats: number = LOOP_REPEATS): number[] {
	const out: number[] = [];
	for (let r = 0; r < repeats; r++) {
		for (let p = 0; p < loopSize; p++) out.push(p);
	}
	return out;
}

export interface RunStats {
	accesses: number;
	faults: number;
	hits: number;
}

/** Counts accesses, page faults and hits in the given steps. */
export function countStats(steps: readonly AccessResult[]): RunStats {
	let faults = 0;
	for (const s of steps) if (s.fault) faults++;
	return { accesses: steps.length, faults, hits: steps.length - faults };
}

/**
 * Distinct pages the page table shows: the page of the address (if valid), the loop pages
 * and every page that was accessed. Sorted by page number.
 */
export function pageUniverse(
	addrPage: number | null,
	loopSize: number,
	accesses: readonly number[],
): number[] {
	const set = new Set<number>();
	if (addrPage !== null) set.add(addrPage);
	for (let p = 0; p < loopSize; p++) set.add(p);
	for (const p of accesses) set.add(p);
	return [...set].sort((a, b) => a - b);
}

/** One sentence about the access at a given step (or about the empty start). */
export function describeStep(step: AccessResult | null): string {
	if (!step) return 'Обращений ещё не было. Нажмите «Шаг» или обратитесь по адресу.';
	const p = hex(step.page);
	if (!step.fault) {
		return `Страница ${p} уже в RAM, в кадре ${step.frame}: попадание, страничного прерывания нет.`;
	}
	if (step.evicted === null) {
		return `Страницы ${p} нет в RAM: страничное прерывание. Свободный кадр ${step.frame} получает страницу с диска.`;
	}
	return (
		`Страницы ${p} нет в RAM: страничное прерывание. Кадр ${step.frame} освобождён от страницы ` +
		`${hex(step.evicted)} (давно не использовалась) и получает ${p}.`
	);
}

/** Rule for the cyclic pattern: what happens with LRU when the loop does not fit into RAM. */
export function describeLoop(frames: number, loopSize: number): string {
	if (loopSize > frames) {
		return (
			`Цикл из ${loopSize} страниц не помещается в ${frames} кадра. С LRU каждое обращение ` +
			`после первого прохода даёт страничное прерывание: вытесняется страница, которая нужна следующей.`
		);
	}
	return (
		`Цикл из ${loopSize} страниц помещается в ${frames} кадра. После первого прохода ` +
		`все обращения попадают в RAM, прерываний нет.`
	);
}
