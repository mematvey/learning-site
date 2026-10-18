import { describe, expect, it } from 'vitest';
import type { Note } from '$lib/contracts';
import type { Bookmark, Clarification, MyData, Situation, Wish } from '$lib/contracts/my';
import { buildFiles, quoteBlock, type ExportBundle, type ExportContext } from './markdown';

const ulid = (n: number): string => String(n).padStart(26, '0');
const WHEN = '2026-10-16T10:00:00Z';
const LATER = '2026-10-17T10:00:00Z';

const ctx: ExportContext = {
	chapterTitle: (id) =>
		(
			({
				'dl/attention': 'Внимание',
				'dl/cnn': 'Свёртки',
				'classic-ml/trees': 'Деревья',
			}) as Record<string, string>
		)[id] ?? id,
	topicTitle: (id) => (id === 'dl' ? 'DL Theory' : id === 'classic-ml' ? 'Classic ML' : id),
	chapterHref: (id, blockId) => (blockId ? `/${id}#${blockId}` : `/${id}`),
};

function note(n: number, chapter: string, text: string, created = WHEN, exact = 'скалярное'): Note {
	return {
		schemaVersion: 1,
		id: ulid(n),
		chapter: chapter as Note['chapter'],
		anchor: { blockId: 'scores-def', exact, prefix: '', suffix: '' },
		text,
		status: 'open',
		created,
		updated: created,
	};
}

const wish: Wish = {
	schemaVersion: 1,
	id: ulid(101),
	topic: 'dl',
	title: 'Трансформеры с нуля',
	question: 'Как устроен декодер?',
	wantedSections: ['Маски', 'Декодер'],
	wantedTerms: ['causal-mask'],
	notes: 'Связать с вниманием',
	status: 'drafting',
	created: WHEN,
	updated: WHEN,
};

const bookmarks: Bookmark[] = [
	{
		schemaVersion: 1,
		id: ulid(301),
		kind: 'block',
		topic: 'dl',
		chapter: 'dl/attention',
		blockId: 'scores-def',
		quote: 'скалярное произведение',
		comment: 'ключевая формула',
		created: WHEN,
		updated: WHEN,
	},
	{
		schemaVersion: 1,
		id: ulid(302),
		kind: 'formula',
		topic: 'dl',
		chapter: 'dl/attention',
		blockId: 'eq-attn',
		quote: '\\mathrm{softmax}(QK^T)',
		comment: '',
		created: LATER,
		updated: LATER,
	},
];

const situations: Situation[] = [
	{
		schemaVersion: 1,
		id: ulid(201),
		topic: 'dl',
		target: { kind: 'chapter', chapter: 'dl/attention' },
		title: 'Не сходится размерность',
		situation: 'Матрица 4x4 не умножается на вектор',
		goal: 'Понять формы тензоров',
		status: 'open',
		created: WHEN,
		updated: WHEN,
	},
	{
		schemaVersion: 1,
		id: ulid(202),
		topic: 'dl',
		target: { kind: 'wish', wishId: ulid(101) },
		title: 'Где маска',
		situation: 'Не понимаю, где применяется маска',
		goal: 'Понять место маски',
		status: 'answered',
		created: LATER,
		updated: LATER,
	},
];

const clarifications: Clarification[] = [
	{
		schemaVersion: 1,
		id: ulid(401),
		topic: 'dl',
		target: { kind: 'chapter', chapter: 'dl/attention' },
		text: 'Уточнение к главе',
		created: WHEN,
		updated: WHEN,
	},
	{
		schemaVersion: 1,
		id: ulid(402),
		topic: 'dl',
		target: { kind: 'situation', situationId: ulid(201) },
		text: 'Размер головы 64',
		created: LATER,
		updated: LATER,
	},
	{
		schemaVersion: 1,
		id: ulid(403),
		topic: 'dl',
		target: { kind: 'wish', wishId: ulid(101) },
		text: 'Нужно про GPT',
		created: LATER,
		updated: LATER,
	},
];

const fullMy: MyData = { bookmarks, wishes: [wish], situations, clarifications };

function bundle(overrides: Partial<ExportBundle> = {}): ExportBundle {
	return {
		notes: [note(1, 'dl/attention', 'Почему делим на корень?')],
		my: fullMy,
		exportedAt: '2026-10-18T12:00:00Z',
		...overrides,
	};
}

const byPath = (files: { path: string; content: string }[], path: string): string => {
	const file = files.find((f) => f.path === path);
	if (!file) throw new Error(`no file ${path}`);
	return file.content;
};

describe('buildFiles structure', () => {
	it('lists files in deterministic order, one set per topic', () => {
		const files = buildFiles(
			bundle({ notes: [note(1, 'dl/attention', 'a'), note(2, 'classic-ml/trees', 'b')] }),
			ctx,
		);
		expect(files.map((f) => f.path)).toEqual([
			'user-data/README.md',
			'user-data/all.md',
			'user-data/classic-ml/notes.md',
			'user-data/dl/notes.md',
			'user-data/dl/bookmarks.md',
			'user-data/dl/wishes.md',
			'user-data/dl/situations.md',
			'user-data/backup.json',
		]);
	});

	it('skips sections without content', () => {
		const files = buildFiles(
			{
				notes: [note(1, 'classic-ml/trees', 'only notes')],
				my: { bookmarks: [], wishes: [], situations: [], clarifications: [] },
				exportedAt: WHEN,
			},
			ctx,
		);
		expect(files.map((f) => f.path)).toEqual([
			'user-data/README.md',
			'user-data/all.md',
			'user-data/classic-ml/notes.md',
			'user-data/backup.json',
		]);
	});

	it('writes a summary and no topic files for an empty export', () => {
		const files = buildFiles(
			{
				notes: [],
				my: { bookmarks: [], wishes: [], situations: [], clarifications: [] },
				exportedAt: WHEN,
			},
			ctx,
		);
		expect(files.map((f) => f.path)).toEqual([
			'user-data/README.md',
			'user-data/all.md',
			'user-data/backup.json',
		]);
		expect(byPath(files, 'user-data/all.md')).toContain('Данных пока нет.');
	});

	it('is deterministic for the same input', () => {
		expect(buildFiles(bundle(), ctx)).toEqual(buildFiles(bundle(), ctx));
	});
});

describe('markdown content', () => {
	it('renders notes with chapter and block links, sorted by creation time', () => {
		const files = buildFiles(
			bundle({
				notes: [
					note(2, 'dl/attention', 'второй вопрос', LATER),
					note(1, 'dl/attention', 'первый вопрос', WHEN),
				],
			}),
			ctx,
		);
		const notes = byPath(files, 'user-data/dl/notes.md');
		expect(notes).toContain('## [Внимание](/dl/attention)');
		expect(notes).toContain('[Открыть место](/dl/attention#scores-def)');
		expect(notes.indexOf('первый вопрос')).toBeLessThan(notes.indexOf('второй вопрос'));
		expect(notes).toContain('### 2026-10-16 · открыта');
	});

	it('escapes markdown in quotes and keeps them as blockquotes', () => {
		const quoted = note(3, 'dl/attention', 'текст', WHEN, '*важно* [x] # не заголовок');
		const files = buildFiles(bundle({ notes: [quoted] }), ctx);
		const notes = byPath(files, 'user-data/dl/notes.md');
		expect(notes).toContain('> \\*важно\\* \\[x\\] # не заголовок');
		expect(quoteBlock('line one\n- item')).toBe('> line one\n> \\- item');
	});

	it('puts formulas into tex code blocks and lists bookmark links', () => {
		const files = buildFiles(bundle(), ctx);
		const marks = byPath(files, 'user-data/dl/bookmarks.md');
		expect(marks).toContain('```tex\n\\mathrm{softmax}(QK^T)\n```');
		expect(marks).toContain('[Открыть место](/dl/attention#eq-attn)');
		expect(marks).toContain('ключевая формула');
	});

	it('writes wishes as chapter drafts with question, sections, terms, notes and status', () => {
		const files = buildFiles(bundle(), ctx);
		const wishes = byPath(files, 'user-data/dl/wishes.md');
		expect(wishes).toContain('# Хочу разобрать: DL Theory');
		expect(wishes).toContain('## Трансформеры с нуля');
		expect(wishes).toContain('Статус: в работе');
		expect(wishes).toContain('**Вопрос:** Как устроен декодер?');
		expect(wishes).toContain('**Желаемые разделы:**\n- Маски\n- Декодер');
		expect(wishes).toContain('**Желаемые термины:**\n- causal-mask');
		expect(wishes).toContain('**Заметки:** Связать с вниманием');
		expect(wishes).toContain('**Уточнения:**\n- 2026-10-17: Нужно про GPT');
	});

	it('groups situations by chapter and by wished chapter, with clarifications', () => {
		const files = buildFiles(bundle(), ctx);
		const situationsMd = byPath(files, 'user-data/dl/situations.md');
		expect(situationsMd).toContain('## [Внимание](/dl/attention)');
		expect(situationsMd).toContain('**Уточнения к главе:**\n- 2026-10-16: Уточнение к главе');
		expect(situationsMd).toContain('### Не сходится размерность · открыта');
		expect(situationsMd).toContain('**Цель:** Понять формы тензоров');
		expect(situationsMd).toContain('**Уточнения:**\n- 2026-10-17: Размер головы 64');
		expect(situationsMd).toContain('## Желаемая глава: Трансформеры с нуля');
		expect(situationsMd).toContain('### Где маска · отвечена');
	});

	it('writes backup.json with schema version, export time and all data', () => {
		const files = buildFiles(bundle(), ctx);
		const backup = JSON.parse(byPath(files, 'user-data/backup.json')) as Record<string, unknown>;
		expect(backup.schemaVersion).toBe(1);
		expect(backup.exportedAt).toBe('2026-10-18T12:00:00Z');
		expect(backup.notes).toHaveLength(1);
		expect(backup.my).toEqual(fullMy);
	});

	it('keeps the summary stable', () => {
		const files = buildFiles(bundle(), ctx);
		expect(byPath(files, 'user-data/all.md')).toMatchSnapshot();
	});
});
