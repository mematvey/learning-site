import { describe, expect, it } from 'vitest';
import {
	ANSWER_DONE,
	ANSWER_REJECTED,
	simulate,
	snapBudget,
	snapMaxSteps,
	type LoopOptions,
} from './agents-runtime';

const base: LoopOptions = { maxSteps: 5, budget: 2000, confirm: false, decision: 'none' };

describe('simulate', () => {
	it('reaches the answer with default limits and counts the reply tokens', () => {
		const t = simulate(base);
		expect(t.reason).toBe('answer');
		expect(t.steps).toBe(4);
		expect(t.used).toBe(1960);
		const last = t.events[t.events.length - 1];
		expect(last).toEqual({ kind: 'answer', step: 4, text: ANSWER_DONE });
	});

	it('stops at the step limit without an answer when the limit is three', () => {
		const t = simulate({ ...base, maxSteps: 3 });
		expect(t.reason).toBe('max_steps');
		expect(t.steps).toBe(3);
		expect(t.events.some((e) => e.kind === 'answer')).toBe(false);
		const last = t.events[t.events.length - 1];
		expect(last).toEqual({ kind: 'stop', step: 3, reason: 'max_steps' });
		// The third step still runs its tool before the loop ends.
		expect(t.events).toContainEqual(
			expect.objectContaining({ kind: 'tool', step: 3, tool: 'refund', executed: true }),
		);
	});

	it('stops on the budget before the irreversible tool runs', () => {
		const t = simulate({ ...base, budget: 1000 });
		expect(t.reason).toBe('budget');
		expect(t.used).toBe(1580);
		expect(t.events[t.events.length - 1]).toEqual({ kind: 'stop', step: 3, reason: 'budget' });
		expect(t.events.some((e) => e.kind === 'tool' && e.tool === 'refund')).toBe(false);
	});

	it('treats used == budget as allowed and used > budget as a stop', () => {
		expect(simulate({ ...base, budget: 1960 }).reason).toBe('answer');
		const over = simulate({ ...base, budget: 1900 });
		expect(over.reason).toBe('budget');
		expect(over.steps).toBe(4);
	});

	it('pauses before the irreversible action when confirmation is on', () => {
		const t = simulate({ ...base, confirm: true, decision: 'none' });
		expect(t.reason).toBe('approval');
		expect(t.events[t.events.length - 1]).toEqual({ kind: 'approval', step: 3, tool: 'refund' });
		expect(t.events.some((e) => e.kind === 'tool' && e.tool === 'refund')).toBe(false);
	});

	it('keeps the model answer the same after approval', () => {
		const off = simulate(base);
		const approved = simulate({ ...base, confirm: true, decision: 'approve' });
		expect(approved.reason).toBe('answer');
		const answerOff = off.events.find((e) => e.kind === 'answer');
		const answerOn = approved.events.find((e) => e.kind === 'answer');
		expect(answerOn).toEqual(answerOff);
	});

	it('changes the answer and skips the refund after rejection', () => {
		const t = simulate({ ...base, confirm: true, decision: 'reject' });
		expect(t.reason).toBe('answer');
		expect(t.events).toContainEqual(
			expect.objectContaining({ kind: 'tool', tool: 'refund', executed: false }),
		);
		expect(t.events).toContainEqual({ kind: 'answer', step: 4, text: ANSWER_REJECTED });
	});
});

describe('snap helpers', () => {
	it('clamps the step limit and rounds it', () => {
		expect(snapMaxSteps(0)).toBe(1);
		expect(snapMaxSteps(9)).toBe(6);
		expect(snapMaxSteps(2.6)).toBe(3);
		expect(snapMaxSteps(Number.NaN)).toBe(5);
	});

	it('snaps the budget to the 100-token grid inside the range', () => {
		expect(snapBudget(1049)).toBe(1000);
		expect(snapBudget(1051)).toBe(1100);
		expect(snapBudget(10)).toBe(300);
		expect(snapBudget(99999)).toBe(2000);
		expect(snapBudget(Number.NaN)).toBe(2000);
	});
});
