import { describe, expect, it } from 'vitest';
import {
	K_MAX,
	K_MIN,
	NO_ANSWERS,
	PROMPT_TOKENS,
	RANKING,
	RELEVANT_TOTAL,
	TOKENS_PER_CHUNK,
	chooseApproach,
	describeK,
	formatRecall,
	inputTokens,
	recallAtK,
	recallCurve,
	relevantInTopK,
	snapK,
} from './llm-apps';

describe('recall@k', () => {
	it('matches the chapter: 3 of 10 at k = 5, 6 of 10 at k = 10', () => {
		expect(relevantInTopK(5)).toBe(3);
		expect(recallAtK(5)).toBeCloseTo(0.3, 12);
		expect(relevantInTopK(10)).toBe(6);
		expect(recallAtK(10)).toBeCloseTo(0.6, 12);
	});

	it('is non-decreasing and stays in [0, 1]', () => {
		const curve = recallCurve();
		expect(curve).toHaveLength(K_MAX - K_MIN + 1);
		for (let i = 1; i < curve.length; i++) {
			expect(curve[i] ?? 0).toBeGreaterThanOrEqual(curve[i - 1] ?? 0);
		}
		for (const r of curve) expect(r >= 0 && r <= 1).toBe(true);
	});

	it('plateaus: no new relevant fragment appears after the last relevant rank', () => {
		const lastRelevant = RANKING.lastIndexOf(true) + 1;
		expect(recallAtK(lastRelevant)).toBe(recallAtK(K_MAX));
		expect(recallAtK(K_MAX)).toBeLessThan(1);
	});

	it('is deterministic: the same ranking on every call', () => {
		expect(recallCurve()).toEqual(recallCurve());
	});
});

describe('input size', () => {
	it('matches the chapter: 2000 tokens at k = 5, 3500 at k = 10', () => {
		expect(TOKENS_PER_CHUNK).toBe(300);
		expect(PROMPT_TOKENS).toBe(500);
		expect(inputTokens(5)).toBe(2000);
		expect(inputTokens(10)).toBe(3500);
	});

	it('grows by one fragment size per unit of k', () => {
		for (let k = K_MIN; k < K_MAX; k++) {
			expect(inputTokens(k + 1) - inputTokens(k)).toBe(TOKENS_PER_CHUNK);
		}
	});
});

describe('snapK and formatting', () => {
	it('clamps to the range and rounds; non-finite input gives the default', () => {
		expect(snapK(0)).toBe(K_MIN);
		expect(snapK(999)).toBe(K_MAX);
		expect(snapK(4.6)).toBe(5);
		expect(snapK(Number.NaN)).toBe(5);
	});

	it('formats recall with a decimal comma', () => {
		expect(formatRecall(0.3)).toBe('0,30');
		expect(formatRecall(1)).toBe('1,00');
	});

	it('describes the state with computed numbers', () => {
		const text = describeK(10);
		expect(text).toContain('найдено 6 из 10');
		expect(text).toContain('recall@10 = 0,60');
		expect(text).toContain('3500');
		expect(describeK(K_MAX)).toContain(`нет ${RELEVANT_TOTAL - relevantInTopK(K_MAX)} из`);
	});
});

describe('chooseApproach', () => {
	it('gives a prompt when no answer is set', () => {
		expect(chooseApproach(NO_ANSWERS).approach).toBe('prompt');
	});

	it('gives RAG for outside facts that change', () => {
		expect(chooseApproach({ ...NO_ANSWERS, externalFacts: true }).approach).toBe('rag');
	});

	it('gives a workflow for fixed steps, also when retrieval is one of them', () => {
		const c = chooseApproach({ ...NO_ANSWERS, stepsFixed: true, externalFacts: true });
		expect(c.approach).toBe('workflow');
		expect(c.reason).toContain('шаг');
	});

	it('gives an agent when the model picks steps, and warns only for irreversible actions', () => {
		const plain = chooseApproach({ ...NO_ANSWERS, modelPicksSteps: true });
		expect(plain.approach).toBe('agent');
		expect(plain.warning).toBeNull();
		const risky = chooseApproach({ ...NO_ANSWERS, modelPicksSteps: true, irreversible: true });
		expect(risky.approach).toBe('agent');
		expect(risky.warning).not.toBeNull();
	});

	it('an agent answer wins over the others', () => {
		const all = {
			externalFacts: true,
			stepsFixed: true,
			modelPicksSteps: true,
			irreversible: false,
		};
		expect(chooseApproach(all).approach).toBe('agent');
	});

	it('irreversible without an agent gives no warning', () => {
		expect(chooseApproach({ ...NO_ANSWERS, irreversible: true }).warning).toBeNull();
	});
});
