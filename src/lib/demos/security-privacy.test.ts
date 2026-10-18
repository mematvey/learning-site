import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STATE,
	MINIMAL_PERMISSIONS,
	TOOLS,
	type Permissions,
	authorize,
	describeState,
	documentLines,
	normalizeState,
	proposeCalls,
	runTurn,
} from './security-privacy';

describe('proposeCalls', () => {
	it('proposes only the read call when the document has no instruction', () => {
		expect(proposeCalls(false).map((c) => c.name)).toEqual(['search_docs']);
	});

	it('proposes the write call when the document carries the instruction', () => {
		expect(proposeCalls(true).map((c) => c.name)).toEqual(['search_docs', 'send_email']);
	});

	it('is deterministic for the same input', () => {
		expect(proposeCalls(true)).toEqual(proposeCalls(true));
	});
});

describe('authorize and runTurn', () => {
	it('denies the write call under minimal rights', () => {
		const d = runTurn({ withInjection: true, permissions: { ...MINIMAL_PERMISSIONS } });
		const send = d.find((x) => x.call.name === 'send_email');
		expect(send?.executed).toBe(false);
		expect(send?.reason).toContain('право выключено');
	});

	it('runs the write call only when its right is granted', () => {
		const d = runTurn({
			withInjection: true,
			permissions: { ...MINIMAL_PERMISSIONS, send_email: true },
		});
		expect(d.find((x) => x.call.name === 'send_email')?.executed).toBe(true);
	});

	it('does not run any write tool under minimal rights', () => {
		for (const tool of TOOLS.filter((t) => t.kind === 'write')) {
			const d = authorize({ name: tool.name, args: '' }, MINIMAL_PERMISSIONS);
			expect(d.executed).toBe(false);
		}
	});

	it('runs read calls under minimal rights', () => {
		const d = runTurn({ withInjection: true, permissions: { ...MINIMAL_PERMISSIONS } });
		expect(d.find((x) => x.call.name === 'search_docs')?.executed).toBe(true);
	});

	it('does not depend on what the model proposes beyond the rights check', () => {
		// The rights decide execution; changing the document changes only the proposals.
		const withRights = runTurn({
			withInjection: false,
			permissions: { ...MINIMAL_PERMISSIONS, send_email: true },
		});
		expect(withRights.map((d) => d.call.name)).toEqual(['search_docs']);
	});
});

describe('documentLines', () => {
	it('adds exactly one injected line when the instruction is on', () => {
		expect(documentLines(true).filter((l) => l.injected)).toHaveLength(1);
		expect(documentLines(false).some((l) => l.injected)).toBe(false);
	});
});

describe('normalizeState', () => {
	it('returns the defaults for an empty input', () => {
		expect(normalizeState(undefined)).toEqual(DEFAULT_STATE);
	});

	it('starts with the send right off', () => {
		expect(DEFAULT_STATE.permissions.send_email).toBe(false);
	});

	it('ignores unknown tools and non-boolean values', () => {
		const s = normalizeState({
			withInjection: 'yes' as unknown as boolean,
			permissions: { delete_all: true, send_email: 'on' } as unknown as Partial<Permissions>,
		});
		expect(s.withInjection).toBe(DEFAULT_STATE.withInjection);
		expect(s.permissions).toEqual(DEFAULT_STATE.permissions);
	});

	it('keeps valid partial permissions', () => {
		const s = normalizeState({ permissions: { send_email: true } });
		expect(s.permissions.send_email).toBe(true);
		expect(s.permissions.search_docs).toBe(true);
	});
});

describe('describeState', () => {
	it('names the proposed and denied calls', () => {
		const text = describeState(DEFAULT_STATE);
		expect(text).toContain('Модель предложила вызовы: search_docs, send_email');
		expect(text).toContain('Отклонено: send_email');
	});

	it('reports nothing denied when there is no instruction', () => {
		const text = describeState({ ...DEFAULT_STATE, withInjection: false });
		expect(text).toContain('Отклонено: ничего');
	});
});
