import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	contrastRatio,
	inkVarFor,
	mixHex,
	normalize,
	relativeLuminance,
	seqFill,
	INK_HEX,
	SEQ,
	seqHex,
	type Theme,
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

/** Reads `--name: #rrggbb` from the root block (`light`) or the dark block of tokens.css. */
function cssToken(css: string, theme: Theme, name: string): string {
	const start = theme === 'light' ? css.indexOf(':root {') : css.indexOf("[data-theme='dark'] {");
	const end = css.indexOf('\n}', start);
	const block = css.slice(start, end);
	const line = block.split('\n').find((l) => l.includes(`--${name}:`)) ?? '';
	const m = /(#[0-9a-f]{6})/i.exec(line);
	if (!m) throw new Error(`token --${name} not found in ${theme} block`);
	return m[1] ?? '';
}

describe('colour mirrors of tokens.css', () => {
	const css = readFileSync(resolve(process.cwd(), 'src/lib/theme/tokens.css'), 'utf8');

	it('matches the sequential scale tokens', () => {
		for (const theme of ['light', 'dark'] as const) {
			expect(SEQ[theme]).toEqual([cssToken(css, theme, 'seq-0'), cssToken(css, theme, 'seq-1')]);
		}
	});

	it('matches the ink tokens', () => {
		expect(INK_HEX.light).toEqual({
			dark: cssToken(css, 'light', 'text'),
			light: cssToken(css, 'light', 'surface'),
		});
		expect(INK_HEX.dark).toEqual({
			dark: cssToken(css, 'dark', 'bg'),
			light: cssToken(css, 'dark', 'text'),
		});
	});
});
