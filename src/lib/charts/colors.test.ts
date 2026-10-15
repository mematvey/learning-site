import { describe, expect, it } from 'vitest';
import {
	contrastRatio,
	inkVarFor,
	mixHex,
	normalize,
	relativeLuminance,
	seqFill,
	seqHex,
} from './colors';

describe('colors', () => {
	it('mixes endpoints and midpoint in sRGB', () => {
		expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
		expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
		expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
	});

	it('clamps out-of-range values', () => {
		expect(seqHex(-3, 'light')).toBe(seqHex(0, 'light'));
		expect(seqHex(7, 'dark')).toBe(seqHex(1, 'dark'));
		expect(seqFill(2)).toContain('100%');
	});

	it('computes WCAG luminance and contrast', () => {
		expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
		expect(relativeLuminance('#000000')).toBe(0);
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
	});

	it('picks dark ink on light cells and light ink on dark cells', () => {
		// Light theme: low values are pale (dark text), high values are deep blue (light text).
		expect(inkVarFor(0, 'light')).toBe('var(--text)');
		expect(inkVarFor(1, 'light')).toBe('var(--surface)');
		// Dark theme: low values are near-black (light text), high values are pale blue (dark text).
		expect(inkVarFor(0, 'dark')).toBe('var(--text)');
		expect(inkVarFor(1, 'dark')).toBe('var(--bg)');
	});

	it('normalizes values and handles a degenerate domain', () => {
		expect(normalize(5, [0, 10])).toBe(0.5);
		expect(normalize(-1, [0, 10])).toBe(0);
		expect(normalize(3, [3, 3])).toBe(0.5);
	});
});
