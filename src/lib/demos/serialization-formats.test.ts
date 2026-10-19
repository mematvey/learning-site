import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	bytesScanned,
	cellRead,
	clampName,
	encodeVarint,
	jsonBytes,
	normalizeState,
	protoBytes,
	recordJson,
	toHex,
} from './serialization-formats';

describe('encodeVarint', () => {
	it('encodes 150 and 300 exactly as in the chapter', () => {
		expect(toHex(encodeVarint(150))).toBe('96 01');
		expect(toHex(encodeVarint(300))).toBe('ac 02');
	});

	it('changes length at 127/128, 16383/16384, 2097151/2097152', () => {
		expect(encodeVarint(0)).toEqual([0]);
		expect(encodeVarint(127)).toHaveLength(1);
		expect(encodeVarint(128)).toHaveLength(2);
		expect(encodeVarint(16383)).toHaveLength(2);
		expect(encodeVarint(16384)).toHaveLength(3);
		expect(encodeVarint(2097151)).toHaveLength(3);
		expect(encodeVarint(2097152)).toHaveLength(4);
		expect(encodeVarint(2147483647)).toHaveLength(5);
	});

	it('sets the continuation bit on every byte except the last', () => {
		const bytes = encodeVarint(2147483647);
		bytes.slice(0, -1).forEach((b) => expect(b & 0x80).toBe(0x80));
		expect((bytes.at(-1) ?? 0x80) & 0x80).toBe(0);
	});

	it('rejects negative and non-integer input', () => {
		expect(() => encodeVarint(-1)).toThrow(RangeError);
		expect(() => encodeVarint(1.5)).toThrow(RangeError);
	});
});

describe('record size', () => {
	it('gives 23 bytes of JSON and 8 bytes of protobuf for {id: 150, name: "Ann"}', () => {
		expect(recordJson(150, 'Ann')).toBe('{"id":150,"name":"Ann"}');
		expect(jsonBytes(150, 'Ann')).toBe(23);
		expect(toHex(protoBytes(150, 'Ann'))).toBe('08 96 01 12 03 41 6e 6e');
		expect(protoBytes(150, 'Ann')).toHaveLength(8);
	});

	it('skips proto3 default values and counts UTF-8 bytes of the name', () => {
		expect(protoBytes(0, '')).toEqual([]);
		expect(protoBytes(0, 'Ä')).toEqual([0x12, 0x02, 0xc3, 0x84]);
	});
});

describe('bytesScanned', () => {
	it('reads 32 000 000 bytes row-wise and 8 000 000 column-wise for the chapter table', () => {
		expect(bytesScanned(1_000_000, 4, 8, 'row', 1)).toBe(32_000_000);
		expect(bytesScanned(1_000_000, 4, 8, 'column', 1)).toBe(8_000_000);
	});

	it('reads all columns in the row layout regardless of the query', () => {
		expect(bytesScanned(10, 4, 8, 'row', 2)).toBe(bytesScanned(10, 4, 8, 'row', 4));
		expect(cellRead('row', 3, 1)).toBe(true);
		expect(cellRead('column', 3, 1)).toBe(false);
	});
});

describe('normalizeState', () => {
	it('keeps the default state for an empty patch', () => {
		expect(normalizeState({})).toEqual(DEFAULT_STATE);
	});

	it('clamps numbers, keeps wanted within columns and rejects unknown widths', () => {
		const s = normalizeState({ id: -5, columns: 99, wanted: 99, width: 3, rows: 0 });
		expect(s.id).toBe(0);
		expect(s.columns).toBe(8);
		expect(s.wanted).toBe(8);
		expect(s.width).toBe(DEFAULT_STATE.width);
		expect(s.rows).toBe(1);
	});

	it('does not split a character when cutting the name', () => {
		const cut = clampName('🙂'.repeat(50));
		expect(Array.from(cut)).toHaveLength(40);
		expect(cut).toBe('🙂'.repeat(40));
	});
});
