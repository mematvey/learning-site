import { describe, expect, it } from 'vitest';
import {
	DEFAULT_ANSWERS,
	type PlanStep,
	type StartTaskPlan,
	STEP_ORDER,
	buildPlan,
	clampCost,
	decisionThreshold,
	isAsymmetric,
	sanitizeAnswers,
} from './start-a-task';

function stepAt(plan: StartTaskPlan, index: number): PlanStep {
	const step = plan.steps[index];
	if (!step) throw new Error(`no step at index ${index}`);
	return step;
}

describe('decisionThreshold', () => {
	it('matches the chapter example: false alarm 1, miss 50 gives 1/51', () => {
		expect(decisionThreshold(1, 50)).toBeCloseTo(1 / 51, 10);
	});

	it('is 0.5 when both errors cost the same', () => {
		expect(decisionThreshold(7, 7)).toBeCloseTo(0.5, 10);
	});

	it('goes down when a miss gets more expensive', () => {
		expect(decisionThreshold(1, 10)).toBeLessThan(decisionThreshold(1, 2));
	});
});

describe('plan order', () => {
	it('always lists the steps as metric, split, baseline, model, checks', () => {
		const variants = [
			{},
			{
				data: 'timeseries',
				task: 'regression',
				costFP: 1,
				costFN: 20,
				time: 'days',
				size: 'small',
			},
			{
				data: 'tabular',
				task: 'classification',
				costFP: 30,
				costFN: 1,
				time: 'months',
				size: 'large',
			},
		] as const;
		for (const v of variants) {
			const plan = buildPlan(v);
			expect(plan.steps.map((s) => s.id)).toEqual([...STEP_ORDER]);
			expect(STEP_ORDER).toEqual(['metric', 'split', 'baseline', 'model', 'checks']);
		}
	});

	it('every step names at least one chapter reference', () => {
		const plan = buildPlan({});
		for (const step of plan.steps) {
			expect(step.refs.length).toBeGreaterThan(0);
			for (const ref of step.refs) expect(ref).toMatch(/^classic-ml\/[a-z-]+$/);
		}
	});
});

describe('asymmetric costs', () => {
	it('marks errors as asymmetric when the ratio is at least 3', () => {
		expect(isAsymmetric(1, 3)).toBe(true);
		expect(isAsymmetric(1, 2)).toBe(false);
		expect(isAsymmetric(5, 5)).toBe(false);
	});

	it('makes the metric step the main one and shows the threshold', () => {
		const plan = buildPlan({ task: 'classification', costFP: 1, costFN: 50 });
		const metric = stepAt(plan, 0);
		expect(plan.asymmetric).toBe(true);
		expect(metric.main).toBe(true);
		expect(metric.text).toContain('полноту');
		expect(metric.text).toContain('2,0%');
		expect(plan.threshold).toBeCloseTo(1 / 51, 10);
	});

	it('names precision when a false alarm is the costlier error', () => {
		const plan = buildPlan({ task: 'classification', costFP: 40, costFN: 2 });
		expect(stepAt(plan, 0).text).toContain('точность');
	});

	it('keeps the metric step secondary when costs are equal', () => {
		const plan = buildPlan({ task: 'classification', costFP: 1, costFN: 1 });
		expect(stepAt(plan, 0).main).toBe(false);
		expect(plan.threshold).toBeCloseTo(0.5, 10);
	});
});

describe('split, baseline and model depend on the answers', () => {
	it('uses a time-based split for time series and a stratified random split for tabular data', () => {
		expect(stepAt(buildPlan({ data: 'timeseries' }), 1).refs).toContain(
			'classic-ml/time-series-validation',
		);
		expect(stepAt(buildPlan({ data: 'tabular' }), 1).text).toContain('стратификацией');
	});

	it('starts with a linear model for the chosen task', () => {
		expect(stepAt(buildPlan({ task: 'classification' }), 3).refs).toContain(
			'classic-ml/logistic-regression',
		);
		expect(stepAt(buildPlan({ task: 'regression' }), 3).refs).toContain(
			'classic-ml/linear-regression',
		);
	});

	it('has no threshold for regression', () => {
		expect(buildPlan({ task: 'regression' }).threshold).toBeNull();
	});
});

describe('sanitizeAnswers', () => {
	it('falls back to defaults for missing or unknown values', () => {
		expect(sanitizeAnswers(undefined)).toEqual(DEFAULT_ANSWERS);
		const a = sanitizeAnswers({ data: 'image' as never, time: 'years' as never });
		expect(a.data).toBe(DEFAULT_ANSWERS.data);
		expect(a.time).toBe(DEFAULT_ANSWERS.time);
	});

	it('clamps costs to integers in the allowed range', () => {
		expect(clampCost(0)).toBe(1);
		expect(clampCost(-5)).toBe(1);
		expect(clampCost(2.6)).toBe(3);
		expect(clampCost(1e9)).toBe(1000);
		expect(clampCost(Number.NaN)).toBe(1);
	});
});
