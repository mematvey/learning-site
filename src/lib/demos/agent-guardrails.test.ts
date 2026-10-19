import { describe, expect, it } from 'vitest';
import {
	DEFAULT_CAPS,
	allCombinations,
	comboLabel,
	countDangerous,
	describeCaps,
	hasLethalTrifecta,
	outcomeLabel,
	patchCaps,
	rowRole,
	sameCaps,
	type Caps,
} from './agent-guardrails';

describe('combinations', () => {
	it('gives 2 · 2 · 2 = 8 distinct combinations', () => {
		const list = allCombinations();
		expect(list).toHaveLength(8);
		const keys = new Set(list.map((c) => `${c.data}${c.untrusted}${c.external}`));
		expect(keys.size).toBe(8);
	});

	it('has exactly one dangerous combination: all three capabilities present', () => {
		expect(countDangerous()).toBe(1);
		const danger = allCombinations().filter(hasLethalTrifecta);
		expect(danger).toEqual([{ data: true, untrusted: true, external: true }]);
	});

	it('starts in the dangerous case', () => {
		expect(hasLethalTrifecta(DEFAULT_CAPS)).toBe(true);
		expect(outcomeLabel(DEFAULT_CAPS)).toBe('Опасная комбинация');
	});
});

describe('single missing capability', () => {
	const cases: Array<keyof Caps> = ['data', 'untrusted', 'external'];

	for (const k of cases) {
		it(`removes the risk when only ${k} is off`, () => {
			const c = { ...DEFAULT_CAPS, [k]: false };
			expect(hasLethalTrifecta(c)).toBe(false);
			expect(outcomeLabel(c)).toBe('Риск снят');
			expect(rowRole(c, k)).toBe('cut');
			for (const other of cases.filter((x) => x !== k)) {
				expect(rowRole(c, other)).toBe('idle');
			}
		});
	}

	it('marks every row as a link of the path in the dangerous case', () => {
		for (const k of cases) {
			expect(rowRole(DEFAULT_CAPS, k)).toBe('link');
		}
	});

	it('explains which link is cut', () => {
		const text = describeCaps({ ...DEFAULT_CAPS, untrusted: false });
		expect(text).toContain('Недоверенного входа нет');
		expect(text).toContain('Путь утечки через инъекцию закрыт.');
	});
});

describe('describeCaps', () => {
	it('gives a non-empty message for every combination', () => {
		for (const c of allCombinations()) {
			expect(describeCaps(c).length).toBeGreaterThan(0);
		}
	});

	it('names the dangerous case', () => {
		expect(describeCaps(DEFAULT_CAPS)).toContain('Опасная комбинация');
	});
});

describe('patchCaps and helpers', () => {
	it('applies boolean fields and ignores anything else', () => {
		const next = patchCaps(DEFAULT_CAPS, { external: false, data: 'no' as unknown as boolean });
		expect(next).toEqual({ data: true, untrusted: true, external: false });
	});

	it('does not mutate the previous state', () => {
		const prev: Caps = { ...DEFAULT_CAPS };
		patchCaps(prev, { data: false });
		expect(prev.data).toBe(true);
	});

	it('compares states and labels combinations', () => {
		expect(sameCaps(DEFAULT_CAPS, { data: true, untrusted: true, external: true })).toBe(true);
		expect(comboLabel(DEFAULT_CAPS)).toContain('опасная комбинация');
		expect(comboLabel({ data: true, untrusted: false, external: true })).not.toContain('опасная');
	});
});
