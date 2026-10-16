import { describe, expect, it } from 'vitest';
import {
	STEPS,
	advance,
	describeRun,
	editStep,
	fnv1a,
	initialRun,
	isFail,
	released,
	runAll,
	runNext,
	stepKeys,
	topoOrder,
	type PipelineRun,
	type StepDef,
	type StepId,
} from './pipelines-ci';

const FIRST_RUN_ORDER: StepId[] = ['data', 'tests', 'features', 'train', 'evaluate', 'deploy'];

describe('topoOrder', () => {
	it('puts every step after its dependencies', () => {
		const order = topoOrder();
		expect(order).toHaveLength(STEPS.length);
		for (const s of STEPS) {
			for (const d of s.deps) {
				expect(order.indexOf(d)).toBeLessThan(order.indexOf(s.id));
			}
		}
	});

	it('is deterministic and keeps the definition order for independent steps', () => {
		expect(topoOrder()).toEqual(FIRST_RUN_ORDER);
		expect(topoOrder()).toEqual(topoOrder());
	});

	it('throws on a cycle', () => {
		const cyclic: StepDef[] = [
			{ id: 'data', title: 'a', deps: ['train'], col: 0, row: 0 },
			{ id: 'train', title: 'b', deps: ['data'], col: 1, row: 0 },
		];
		expect(() => topoOrder(cyclic)).toThrow(/cycle/);
	});
});

describe('stepKeys', () => {
	it('is stable for the same revisions', () => {
		const revs = initialRun().revs;
		expect(stepKeys(revs)).toEqual(stepKeys(revs));
	});

	it('changes the edited step and every step below it, not the independent ones', () => {
		const base = stepKeys(initialRun().revs);
		const edited = stepKeys({ ...initialRun().revs, train: 1 });
		expect(edited.train).not.toBe(base.train);
		expect(edited.evaluate).not.toBe(base.evaluate);
		expect(edited.deploy).not.toBe(base.deploy);
		expect(edited.data).toBe(base.data);
		expect(edited.features).toBe(base.features);
		expect(edited.tests).toBe(base.tests);
	});

	it('gives a hash of exactly 8 hex digits', () => {
		expect(fnv1a('')).toMatch(/^[0-9a-f]{8}$/);
		expect(fnv1a('train|rev=0')).toBe(fnv1a('train|rev=0'));
		expect(fnv1a('train|rev=0')).not.toBe(fnv1a('train|rev=1'));
	});
});

describe('runNext and runAll', () => {
	it('runs all steps when nothing fails and releases the model', () => {
		const run = runAll(initialRun(), null);
		for (const id of FIRST_RUN_ORDER) expect(run.status[id]).toBe('ok');
		expect(released(run)).toBe(true);
	});

	it('runs one step at a time in topological order', () => {
		let run = initialRun();
		run = runNext(run, null);
		expect(run.status.data).toBe('ok');
		expect(run.status.features).toBe('pending');
		run = runNext(run, null);
		expect(run.status.tests).toBe('ok');
		expect(run.status.features).toBe('pending');
	});

	it('does nothing when no step is pending', () => {
		const done = runAll(initialRun(), null);
		expect(runNext(done, null)).toBe(done);
	});

	it('a failed evaluate blocks the release and does not put evaluate into the cache', () => {
		const run = runAll(initialRun(), 'evaluate');
		expect(run.status.evaluate).toBe('fail');
		expect(run.status.deploy).toBe('blocked');
		expect(released(run)).toBe(false);
		expect(run.cache.evaluate).toBeUndefined();
		expect(run.cache.train).toBeDefined();
	});

	it('a failed step blocks every step below it', () => {
		const run = runAll(initialRun(), 'features');
		expect(run.status.features).toBe('fail');
		expect(run.status.train).toBe('blocked');
		expect(run.status.evaluate).toBe('blocked');
		expect(run.status.deploy).toBe('blocked');
		expect(run.status.tests).toBe('ok');
	});

	it('a failed tests step blocks the release even when evaluate passed', () => {
		const run = runAll(initialRun(), 'tests');
		expect(run.status.evaluate).toBe('ok');
		expect(run.status.deploy).toBe('blocked');
		expect(released(run)).toBe(false);
	});
});

describe('step cache', () => {
	it('takes a step from the cache when its key did not change', () => {
		const first = runAll(initialRun(), null);
		const second = runAll(first, null);
		for (const id of FIRST_RUN_ORDER) expect(second.status[id]).toBe('cached');
		expect(released(second)).toBe(true);
	});

	it('a repeated run after a fix re-runs the failed step and its successors', () => {
		const broken = runAll(initialRun(), 'train');
		const fixed = runAll(broken, null);
		expect(fixed.status.data).toBe('cached');
		expect(fixed.status.features).toBe('cached');
		expect(fixed.status.train).toBe('ok');
		expect(fixed.status.evaluate).toBe('ok');
		expect(released(fixed)).toBe(true);
	});

	it('editing the code of a step re-runs it and every step below, but not the steps above', () => {
		const ran = runAll(initialRun(), null);
		const edited = runAll(editStep(ran, 'train'), null);
		expect(edited.status.data).toBe('cached');
		expect(edited.status.features).toBe('cached');
		expect(edited.status.train).toBe('ok');
		expect(edited.status.evaluate).toBe('ok');
		expect(edited.status.deploy).toBe('ok');
	});

	it('a cached step is not re-run, so a configured failure does not apply to it', () => {
		const ran = runAll(initialRun(), null);
		const again = runAll(ran, 'train');
		expect(again.status.train).toBe('cached');
		expect(released(again)).toBe(true);
	});
});

describe('advance', () => {
	it('starts a new run after a finished one and runs its first step', () => {
		const done = runAll(initialRun(), null);
		const next = advance(done, null);
		expect(next.status.data).toBe('cached');
		expect(next.status.tests).toBe('pending');
	});
});

describe('isFail', () => {
	it('accepts null and known step ids only', () => {
		expect(isFail(null)).toBe(true);
		expect(isFail('train')).toBe(true);
		expect(isFail('release')).toBe(false);
		expect(isFail(undefined)).toBe(false);
	});
});

describe('describeRun', () => {
	it('explains that nothing has run yet', () => {
		expect(describeRun(initialRun())).toMatch(/не запущен/);
	});

	it('names the failed step and says the release is blocked', () => {
		const run: PipelineRun = runAll(initialRun(), 'evaluate');
		const text = describeRun(run);
		expect(text).toMatch(/Оценка/);
		expect(text).toMatch(/заблокирована/);
	});

	it('says the model is released after a full successful run', () => {
		expect(describeRun(runAll(initialRun(), null))).toMatch(/выложена/);
	});
});
