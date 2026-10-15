import { describe, expect, it } from 'vitest';
import { clampStep, hasScheme, parseStepState } from './stepState';

describe('parseStepState', () => {
	it('splits scheme keys from demo state', () => {
		const parsed = parseStepState({
			active: ['Q', 'K', 'S', 'nope'],
			pill: true,
			scaled: true,
			d: 64,
		});
		expect(parsed.active).toEqual(['Q', 'K', 'S']);
		expect(parsed.pill).toBe(true);
		expect(parsed.demoPatch).toEqual({ scaled: true, d: 64 });
	});

	it('returns empty values for a missing state', () => {
		expect(parseStepState(undefined)).toEqual({ active: [], pill: false, demoPatch: {} });
	});

	it('ignores non-array active and non-boolean pill', () => {
		const parsed = parseStepState({ active: 'Q', pill: 'yes' });
		expect(parsed.active).toEqual([]);
		expect(parsed.pill).toBe(false);
	});
});

describe('clampStep', () => {
	it('keeps the index inside the list', () => {
		expect(clampStep(-3, 4)).toBe(0);
		expect(clampStep(9, 4)).toBe(3);
		expect(clampStep(2.7, 4)).toBe(2);
	});

	it('returns 0 for an empty list or NaN', () => {
		expect(clampStep(1, 0)).toBe(0);
		expect(clampStep(Number.NaN, 4)).toBe(0);
	});
});

describe('hasScheme', () => {
	it('is true only when a step declares active', () => {
		expect(hasScheme([{ title: 'a', text: 'b' }])).toBe(false);
		expect(hasScheme([{ title: 'a', text: 'b', state: { active: ['Q'] } }])).toBe(true);
	});
});
