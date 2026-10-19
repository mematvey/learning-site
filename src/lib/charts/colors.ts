/**
 * Colour helpers for charts. Rendering always uses CSS tokens (`var(--…)`, `color-mix`).
 * The hex values below are the only JS copy of the tokens in `src/lib/theme/tokens.css`; they are
 * used to decide which ink is readable on a computed background. `colors.test.ts` fails when they
 * drift from the CSS file, so the CSS stays the single source of truth.
 */

export type Theme = 'light' | 'dark';

/** Sequential scale endpoints, `--seq-0` → `--seq-1` (mirror of tokens.css). */
export const SEQ: Record<Theme, [string, string]> = {
	light: ['#f5eee2', '#27408b'],
	dark: ['#221f1a', '#9db7ff'],
};

/** Ink candidates: `dark` is the dark text colour, `light` the light one, per theme (mirror of tokens.css). */
export const INK_HEX: Record<Theme, { dark: string; light: string }> = {
	light: { dark: '#211c16', light: '#fffdf8' },
	dark: { dark: '#15130f', light: '#eee7db' },
};

const INK_VAR: Record<Theme, { dark: string; light: string }> = {
	light: { dark: 'var(--text)', light: 'var(--surface)' },
	dark: { dark: 'var(--bg)', light: 'var(--text)' },
};

export function clamp01(t: number): number {
	if (Number.isNaN(t)) return 0;
	return Math.min(1, Math.max(0, t));
}

export function parseHex(hex: string): [number, number, number] {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex);
	if (!m) throw new Error(`Expected #rrggbb colour, got "${hex}"`);
	const n = parseInt(m[1] ?? '0', 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
	return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

/** Linear sRGB mix, `t = 0` gives `a`, `t = 1` gives `b`. */
export function mixHex(a: string, b: string, t: number): string {
	const k = clamp01(t);
	const [ar, ag, ab] = parseHex(a);
	const [br, bg, bb] = parseHex(b);
	return toHex([ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k]);
}

/** WCAG relative luminance of a `#rrggbb` colour. */
export function relativeLuminance(hex: string): number {
	const [r, g, b] = parseHex(hex);
	const lin = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Hex colour on the sequential scale for a normalized value `t` in [0, 1]. */
export function seqHex(t: number, theme: Theme): string {
	return mixHex(SEQ[theme][0], SEQ[theme][1], t);
}

/** CSS fill on the sequential scale; same mix as `seqHex`, expressed with tokens. */
export function seqFill(t: number): string {
	const pct = Math.round(clamp01(t) * 100);
	return `color-mix(in srgb, var(--seq-1) ${pct}%, var(--seq-0))`;
}

/** CSS colour for text drawn on top of the sequential fill at `t`: whichever ink contrasts more. */
export function inkVarFor(t: number, theme: Theme): string {
	const bg = seqHex(t, theme);
	const ink = INK_HEX[theme];
	return contrastRatio(bg, ink.dark) >= contrastRatio(bg, ink.light)
		? INK_VAR[theme].dark
		: INK_VAR[theme].light;
}

/** Normalizes `v` to [0, 1] inside `domain`; a degenerate domain maps to 0.5. */
export function normalize(v: number, domain: [number, number]): number {
	const [d0, d1] = domain;
	if (d1 === d0) return 0.5;
	return clamp01((v - d0) / (d1 - d0));
}
