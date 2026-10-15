import { describe, expect, it } from 'vitest';
import { formatAgo, parseTags, plural, stackTops } from './notes-format';

describe('parseTags', () => {
	it('trims, drops empty and duplicate tags', () => {
		expect(parseTags(' вопрос, , идея ,вопрос,')).toEqual(['вопрос', 'идея']);
		expect(parseTags('')).toEqual([]);
	});
});

describe('plural and formatAgo', () => {
	it('uses the Russian plural forms', () => {
		const forms: [string, string, string] = ['день', 'дня', 'дней'];
		expect(plural(1, forms)).toBe('день');
		expect(plural(3, forms)).toBe('дня');
		expect(plural(11, forms)).toBe('дней');
		expect(plural(22, forms)).toBe('дня');
	});

	it('formats relative age', () => {
		const now = new Date('2026-10-16T12:00:00Z');
		expect(formatAgo('2026-10-16T11:59:30Z', now)).toBe('только что');
		expect(formatAgo('2026-10-16T09:00:00Z', now)).toBe('3 часа назад');
		expect(formatAgo('2026-10-14T12:00:00Z', now)).toBe('2 дня назад');
	});
});

describe('stackTops', () => {
	it('keeps desired tops when there is no overlap', () => {
		const tops = stackTops(
			[
				{ key: 'a', top: 0, height: 50 },
				{ key: 'b', top: 200, height: 50 },
			],
			12,
		);
		expect(tops).toEqual({ a: 0, b: 200 });
	});

	it('pushes overlapping cards down in order without overlap', () => {
		const tops = stackTops(
			[
				{ key: 'b', top: 40, height: 100 },
				{ key: 'a', top: 0, height: 100 },
				{ key: 'c', top: 60, height: 80 },
			],
			10,
		);
		expect(tops.a).toBe(0);
		expect(tops.b).toBe(110);
		expect(tops.c).toBe(220);
	});
});
