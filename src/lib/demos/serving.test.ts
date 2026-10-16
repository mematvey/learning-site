import { describe, expect, it } from 'vitest';
import {
	BATCH_MAX,
	BATCH_MIN,
	DEFAULT_STATE,
	ERR_BASE,
	ERR_NEW_BAD,
	ERR_NEW_OK,
	RATE_MAX,
	RATE_MIN,
	REQ_PER_HOUR,
	SHARE_MAX,
	WORKERS,
	applyPatch,
	canaryMetrics,
	formatMs,
	pathMetrics,
	serviceMs,
	snapBatch,
	snapRate,
	snapShare,
} from './serving';

describe('snapping', () => {
	it('clamps batch to its range and rounds to an integer', () => {
		expect(snapBatch(0)).toBe(BATCH_MIN);
		expect(snapBatch(1000)).toBe(BATCH_MAX);
		expect(snapBatch(7.6)).toBe(8);
		expect(snapBatch(Number.NaN)).toBe(DEFAULT_STATE.batch);
	});

	it('snaps rate and share to their steps', () => {
		expect(snapRate(1)).toBe(RATE_MIN);
		expect(snapRate(10000)).toBe(RATE_MAX);
		expect(snapRate(123)).toBe(120);
		expect(snapShare(12)).toBe(10);
		expect(snapShare(999)).toBe(SHARE_MAX);
	});

	it('applyPatch changes only the given fields and ignores bad values', () => {
		const next = applyPatch(DEFAULT_STATE, { batch: 32, broken: true, share: 'x' });
		expect(next.batch).toBe(32);
		expect(next.broken).toBe(true);
		expect(next.share).toBe(DEFAULT_STATE.share);
		expect(next.rate).toBe(DEFAULT_STATE.rate);
	});
});

describe('pathMetrics', () => {
	it('online path has no batch fill wait', () => {
		const m = pathMetrics(1, 120);
		expect(m.fillMs).toBe(0);
		expect(m.serviceMs).toBe(serviceMs(1));
	});

	it('a larger batch raises capacity and adds fill wait', () => {
		const online = pathMetrics(1, 120);
		const batch = pathMetrics(16, 120);
		expect(batch.capacity).toBeGreaterThan(online.capacity);
		expect(batch.fillMs).toBeGreaterThan(0);
	});

	it('capacity is workers * batch / service time', () => {
		const m = pathMetrics(8, 120);
		expect(m.capacity).toBeCloseTo((WORKERS * 8) / (serviceMs(8) / 1000), 6);
	});

	it('latency grows with batch size at a fixed rate', () => {
		const a = pathMetrics(2, 120).latencyMs;
		const b = pathMetrics(32, 120).latencyMs;
		expect(b).toBeGreaterThan(a);
	});

	it('an overloaded online path is unstable and reports infinite latency', () => {
		const m = pathMetrics(1, 400);
		expect(m.stable).toBe(false);
		expect(m.latencyMs).toBe(Infinity);
		expect(formatMs(m.latencyMs)).toBe('очередь растёт');
	});

	it('the same overloaded rate is stable with a large enough batch', () => {
		expect(pathMetrics(16, 400).stable).toBe(true);
	});

	it('an empty queue has zero queue wait with a very small rate', () => {
		const m = pathMetrics(1, RATE_MIN);
		expect(m.queueMs).toBeLessThan(1);
	});
});

describe('canaryMetrics', () => {
	it('share 0 is off and sends all traffic to the baseline', () => {
		const m = canaryMetrics(0, true);
		expect(m.verdict).toBe('off');
		expect(m.canaryRequests).toBe(0);
		expect(m.errorsPerHour).toBeCloseTo(REQ_PER_HOUR * ERR_BASE, 6);
	});

	it('a small share waits for enough canary requests', () => {
		expect(canaryMetrics(5, true).verdict).toBe('wait');
	});

	it('a broken version is rolled back once the sample is large enough', () => {
		expect(canaryMetrics(10, true).verdict).toBe('rollback');
	});

	it('a healthy version is promoted (ok) at the same share', () => {
		expect(canaryMetrics(10, false).verdict).toBe('ok');
	});

	it('expected errors grow with the share of a broken version', () => {
		const low = canaryMetrics(5, true).errorsPerHour;
		const high = canaryMetrics(50, true).errorsPerHour;
		expect(high).toBeGreaterThan(low);
	});

	it('errors at share p are a weighted mix of both error rates', () => {
		const m = canaryMetrics(20, false);
		const expected = 0.8 * REQ_PER_HOUR * ERR_BASE + 0.2 * REQ_PER_HOUR * ERR_NEW_OK;
		expect(m.errorsPerHour).toBeCloseTo(expected, 6);
		expect(m.newErrRate).toBe(ERR_NEW_OK);
		expect(canaryMetrics(20, true).newErrRate).toBe(ERR_NEW_BAD);
	});
});
