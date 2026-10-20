import { describe, expect, it } from 'vitest';
import {
	BISQ_C,
	EPS_DEFAULT,
	HUBER_C,
	cachedLocValue,
	fillLocValues,
	locValue,
	medianValue,
	snapEps,
} from './location-grid';

describe('location efficiency factors at eps = 0.05', () => {
	it('matches the notebook table', () => {
		expect(locValue(EPS_DEFAULT, { kind: 'huber', c: HUBER_C })).toBeCloseTo(0.72445, 4);
		expect(locValue(EPS_DEFAULT, { kind: 'bisquare', c: BISQ_C })).toBeCloseTo(0.716601, 4);
		expect(locValue(EPS_DEFAULT, { kind: 'huber', c: 0.8 })).toBeCloseTo(0.769102, 4);
		expect(locValue(EPS_DEFAULT, { kind: 'bisquare', c: 2 })).toBeCloseTo(1.073196, 4);
		expect(medianValue(EPS_DEFAULT)).toBeCloseTo(1.07037, 4);
	});

	it('caches values and fills them in chunks', async () => {
		const pts = [0.6, 0.7, 0.9].map((c) => ({ kind: 'huber' as const, c }));
		let chunks = 0;
		const ok = await fillLocValues(0.12, pts, {
			chunk: 2,
			onChunk: () => chunks++,
		});
		expect(ok).toBe(true);
		expect(chunks).toBe(2);
		for (const p of pts) expect(cachedLocValue(0.12, p)).toBeDefined();
	});

	it('stops filling when the request is no longer current', async () => {
		const pts = [1.1, 1.2, 1.3, 1.4].map((c) => ({ kind: 'huber' as const, c }));
		let calls = 0;
		const ok = await fillLocValues(0.2, pts, {
			chunk: 1,
			isCurrent: () => ++calls <= 2,
		});
		expect(ok).toBe(false);
		expect(cachedLocValue(0.2, pts[3]!)).toBeUndefined();
	});

	it('snaps eps to the slider grid', () => {
		expect(snapEps(0.123)).toBe(0.12);
		expect(snapEps(-1)).toBe(0);
		expect(snapEps(5)).toBe(0.3);
	});
});
