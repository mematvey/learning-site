import { describe, expect, it } from 'vitest';
import type { Clarification, Situation } from '$lib/contracts/my';
import {
	clarificationsFor,
	groupSituations,
	situationDraftFromForm,
	validateSituationForm,
} from './situation-group';

const WISH_1 = '01HZX0000000000000000000W1';
const WISH_2 = '01HZX0000000000000000000W2';

let n = 0;
function situation(over: Partial<Situation> & Pick<Situation, 'target'>): Situation {
	n += 1;
	const created = `2026-10-${String(n).padStart(2, '0')}T10:00:00Z`;
	return {
		schemaVersion: 1,
		id: `01HZS${String(n).padStart(21, '0')}`,
		topic: 'dl',
		title: `Ситуация ${n}`,
		situation: 'Не понимаю',
		goal: 'Понять',
		status: 'open',
		created,
		updated: created,
		...over,
	};
}

const chapters = [
	{ id: 'dl/a', title: 'Глава A' },
	{ id: 'dl/b', title: 'Глава B' },
];
const wishes = [
	{ id: WISH_1, title: 'Желаемая 1' },
	{ id: WISH_2, title: 'Желаемая 2' },
];

describe('groupSituations', () => {
	it('orders chapters in reading order, then wishes, and omits empty groups', () => {
		const list = [
			situation({ target: { kind: 'wish', wishId: WISH_2 } }),
			situation({ target: { kind: 'chapter', chapter: 'dl/b' } }),
			situation({ target: { kind: 'chapter', chapter: 'dl/a' } }),
		];
		const groups = groupSituations(list, chapters, wishes);
		expect(groups.map((g) => g.key)).toEqual(['chapter:dl/a', 'chapter:dl/b', `wish:${WISH_2}`]);
		expect(groups[0]?.title).toBe('Глава A');
		expect(groups[2]?.kind).toBe('wish');
		expect(groups[2]?.title).toBe('Желаемая 2');
	});

	it('puts open situations first, then oldest first', () => {
		const late = situation({
			target: { kind: 'chapter', chapter: 'dl/a' },
			created: '2026-10-05T00:00:00Z',
		});
		const early = situation({
			target: { kind: 'chapter', chapter: 'dl/a' },
			created: '2026-10-02T00:00:00Z',
		});
		const answered = situation({
			target: { kind: 'chapter', chapter: 'dl/a' },
			status: 'answered',
			created: '2026-10-01T00:00:00Z',
		});
		const [group] = groupSituations([answered, late, early], chapters, wishes);
		expect(group?.situations.map((s) => s.id)).toEqual([early.id, late.id, answered.id]);
	});

	it('keeps situations of unknown targets at the end under their raw id', () => {
		const orphan = situation({ target: { kind: 'chapter', chapter: 'dl/gone' } });
		const groups = groupSituations([orphan], chapters, wishes);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.title).toBe('dl/gone');
	});
});

describe('clarificationsFor', () => {
	it('selects clarifications of exactly one target, oldest first', () => {
		const make = (id: string, target: Clarification['target'], created: string): Clarification => ({
			schemaVersion: 1,
			id: `01HZC${id.padStart(21, '0')}`,
			topic: 'dl',
			target,
			text: 'уточнение',
			created,
			updated: created,
		});
		const list = [
			make('1', { kind: 'chapter', chapter: 'dl/a' }, '2026-10-02T00:00:00Z'),
			make('2', { kind: 'chapter', chapter: 'dl/b' }, '2026-10-01T00:00:00Z'),
			make('3', { kind: 'chapter', chapter: 'dl/a' }, '2026-10-01T00:00:00Z'),
			make('4', { kind: 'situation', situationId: WISH_1 }, '2026-10-01T00:00:00Z'),
		];
		expect(clarificationsFor(list, { kind: 'chapter', chapter: 'dl/a' }).map((c) => c.id)).toEqual([
			list[2]?.id,
			list[0]?.id,
		]);
	});
});

describe('situation form', () => {
	it('requires a title and a description', () => {
		expect(validateSituationForm({ title: '', situation: 'x', goal: '' })).not.toBeNull();
		expect(validateSituationForm({ title: 'T', situation: ' ', goal: '' })).not.toBeNull();
		expect(validateSituationForm({ title: 'T', situation: 'x', goal: '' })).toBeNull();
	});

	it('builds a draft with the given target', () => {
		const draft = situationDraftFromForm(
			'dl',
			{ kind: 'chapter', chapter: 'dl/a' },
			{ title: ' T ', situation: ' S ', goal: ' G ' },
		);
		expect(draft).toEqual({
			topic: 'dl',
			target: { kind: 'chapter', chapter: 'dl/a' },
			title: 'T',
			situation: 'S',
			goal: 'G',
		});
	});
});
