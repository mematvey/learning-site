/**
 * Math of the serialization demo: varint bytes, the size of one record in JSON and protobuf,
 * and bytes read by a query in row and column layouts. Pure functions only: no DOM, no Svelte.
 * Record layout follows the chapter: protobuf `message Record { int32 id = 1; string name = 2; }`
 * in proto3, where fields equal to their default (0, empty string) are not written.
 */

/** Largest value the demo accepts for varint and `id`: int32 maximum, non-negative. */
export const INT_MAX = 2147483647;
/** Longest name the demo accepts, in characters. */
export const NAME_MAX = 40;
export const ROWS_MIN = 1;
export const ROWS_MAX = 100_000_000;
export const COLUMNS_MIN = 1;
export const COLUMNS_MAX = 8;
export const WIDTHS = [1, 2, 4, 8] as const;

export type Layout = 'row' | 'column';

export interface SerializationDemoState {
	/** Number for the varint encoder. */
	varintN: number;
	/** Field `id` of the record. */
	id: number;
	/** Field `name` of the record. */
	name: string;
	/** Rows in the table. */
	rows: number;
	/** Columns in the table (C). */
	columns: number;
	/** Columns the query needs (c). */
	wanted: number;
	/** Width of one value in bytes (w). */
	width: number;
}

export const DEFAULT_STATE: SerializationDemoState = {
	varintN: 150,
	id: 150,
	name: 'Ann',
	rows: 1_000_000,
	columns: 4,
	wanted: 1,
	width: 8,
};

function clampInt(v: number, lo: number, hi: number, fallback: number): number {
	if (!Number.isFinite(v)) return fallback;
	return Math.min(hi, Math.max(lo, Math.trunc(v)));
}

/** Integer in [0, INT_MAX]; non-finite input gives 0. */
export function clampInt32(v: number): number {
	return clampInt(v, 0, INT_MAX, 0);
}

/** Takes the first NAME_MAX characters (by code point, so emoji are not split). */
export function clampName(s: string): string {
	return Array.from(s).slice(0, NAME_MAX).join('');
}

/** Number of UTF-8 bytes of a string. */
export function utf8Bytes(s: string): number[] {
	return Array.from(new TextEncoder().encode(s));
}

/**
 * Varint: groups of 7 bits from the lowest, the top bit of each byte is the continuation flag
 * (1 if another byte follows). Input must be a non-negative integer up to INT_MAX.
 */
export function encodeVarint(n: number): number[] {
	if (!Number.isInteger(n) || n < 0) throw new RangeError('varint needs a non-negative integer');
	const out: number[] = [];
	let v = n;
	do {
		const low = v % 128;
		v = Math.floor(v / 128);
		out.push(v > 0 ? low | 0x80 : low);
	} while (v > 0);
	return out;
}

/** Bytes as lowercase hex pairs separated by spaces, for example `96 01`. */
export function toHex(bytes: readonly number[]): string {
	return bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

/** Bits of one byte, for example `10010110`. */
export function toBits(b: number): string {
	return b.toString(2).padStart(8, '0');
}

/** JSON text of the record with compact separators, as in the chapter's code. */
export function recordJson(id: number, name: string): string {
	return JSON.stringify({ id, name });
}

/** Size of the JSON text in bytes. */
export function jsonBytes(id: number, name: string): number {
	return utf8Bytes(recordJson(id, name)).length;
}

/** One written field of the protobuf record: its key, an optional length prefix and the value. */
export interface ProtoField {
	field: 'id' | 'name';
	key: number[];
	length: number[];
	value: number[];
}

/** Fields that protobuf (proto3) writes for the record. Default values are skipped. */
export function protoFields(id: number, name: string): ProtoField[] {
	const fields: ProtoField[] = [];
	if (id !== 0) {
		// field 1, wire type 0 (varint): (1 << 3) | 0 = 0x08
		fields.push({ field: 'id', key: [0x08], length: [], value: encodeVarint(id) });
	}
	const data = utf8Bytes(name);
	if (data.length > 0) {
		// field 2, wire type 2 (length-delimited): (2 << 3) | 2 = 0x12
		fields.push({ field: 'name', key: [0x12], length: encodeVarint(data.length), value: data });
	}
	return fields;
}

/** All bytes of the protobuf record, in field order. */
export function protoBytes(id: number, name: string): number[] {
	return protoFields(id, name).flatMap((f) => [...f.key, ...f.length, ...f.value]);
}

/** Bytes read per record by a query on `wanted` columns of `columns`, each of `width` bytes. */
export function bytesPerRecord(
	columns: number,
	width: number,
	layout: Layout,
	wanted: number,
): number {
	return layout === 'row' ? columns * width : wanted * width;
}

/**
 * Bytes read by a scan of the whole table, in the simplified model of the chapter:
 * no compression, no headers, no block skipping.
 */
export function bytesScanned(
	rows: number,
	columns: number,
	width: number,
	layout: Layout,
	wanted: number,
): number {
	return rows * bytesPerRecord(columns, width, layout, wanted);
}

/** Whether the cell of column `col` (0-based) is read in the given layout. */
export function cellRead(layout: Layout, col: number, wanted: number): boolean {
	return layout === 'row' || col < wanted;
}

/** Brings all table fields to their allowed ranges; `wanted` never exceeds `columns`. */
export function normalizeState(patch: Partial<SerializationDemoState>): SerializationDemoState {
	const s = { ...DEFAULT_STATE, ...patch };
	const columns = clampInt(s.columns, COLUMNS_MIN, COLUMNS_MAX, DEFAULT_STATE.columns);
	const width = (WIDTHS as readonly number[]).includes(s.width) ? s.width : DEFAULT_STATE.width;
	return {
		varintN: clampInt32(s.varintN),
		id: clampInt32(s.id),
		name: clampName(typeof s.name === 'string' ? s.name : ''),
		rows: clampInt(s.rows, ROWS_MIN, ROWS_MAX, DEFAULT_STATE.rows),
		columns,
		wanted: clampInt(s.wanted, COLUMNS_MIN, columns, 1),
		width,
	};
}
