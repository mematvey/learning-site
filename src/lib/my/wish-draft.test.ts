import { describe, expect, it } from 'vitest';
import type { Wish } from '$lib/contracts/my';
import {
	buildWishTask,
	joinList,
	resolveTarget,
	splitList,
	validateWishForm,
	wishDraftFromForm,
	wishFileName,
} from './wish-draft';

const wish: Wish = {
	schemaVersion: 1,
	id: '01HZX0000000000000000000AA',
	topic: 'dl',
	title: 'Нормализация слоёв',
	question: 'Зачем нужна batch norm, если есть layer norm?',
	wantedSections: ['Мотивация', 'Сравнение'],
	wantedTerms: ['batch-norm', 'layer-norm'],
	notes: 'Хочу с кодом',
	status: 'drafting',
	created: '2026-10-01T10:00:00Z',
	updated: '2026-10-01T10:00:00Z',
};

describe('splitList', () => {
	it('splits by lines, commas and semicolons, trims and dedupes', () => {
		expect(splitList(' Мотивация \n сравнение, Мотивация;; \n')).toEqual([
			'Мотивация',
			'сравнение',
		]);
	});

	it('returns an empty array for blank input', () => {
		expect(splitList('  \n ,')).toEqual([]);
	});

	it('joins items back one per line', () => {
		expect(joinList(['a', 'b'])).toBe('a\nb');
	});
});

describe('validateWishForm', () => {
	it('requires a title', () => {
		expect(validateWishForm({ title: '   ' })).not.toBeNull();
		expect(validateWishForm({ title: 'Тема' })).toBeNull();
	});

	it('rejects a title longer than 160 characters', () => {
		expect(validateWishForm({ title: 'я'.repeat(161) })).not.toBeNull();
	});
});

describe('wishDraftFromForm', () => {
	it('trims text and splits lists', () => {
		const draft = wishDraftFromForm('dl', {
			title: '  Тема ',
			question: ' Вопрос ',
			sections: 'A\nB',
			terms: 'x, y',
			notes: ' заметка ',
			status: 'idea',
		});
		expect(draft).toEqual({
			topic: 'dl',
			title: 'Тема',
			question: 'Вопрос',
			wantedSections: ['A', 'B'],
			wantedTerms: ['x', 'y'],
			notes: 'заметка',
			status: 'idea',
		});
	});
});

describe('buildWishTask', () => {
	it('renders title, question, sections, terms and notes', () => {
		const md = buildWishTask(wish);
		expect(md.startsWith('# Нормализация слоёв\n')).toBe(true);
		expect(md).toContain('## Вопрос\n\nЗачем нужна batch norm');
		expect(md).toContain('## Желаемые разделы\n\n- Мотивация\n- Сравнение');
		expect(md).toContain('## Желаемые термины\n\n- batch-norm\n- layer-norm');
		expect(md).toContain('## Заметки\n\nХочу с кодом');
		expect(md).toContain('Статус: Черновик');
	});

	it('marks empty parts as not specified', () => {
		const md = buildWishTask({
			...wish,
			question: '',
			wantedSections: [],
			wantedTerms: [],
			notes: '',
		});
		expect(md.match(/_не указано_/g)?.length).toBe(4);
	});
});

describe('wishFileName', () => {
	it('keeps letters of any alphabet in the slug', () => {
		expect(wishFileName('Нормализация слоёв')).toBe('wish-нормализация-слоёв.md');
	});

	it('falls back when nothing is left', () => {
		expect(wishFileName('!!!')).toBe('wish-untitled.md');
	});
});

describe('resolveTarget', () => {
	it('attaches to this chapter', () => {
		expect(resolveTarget({ choice: 'this', chapterId: 'dl/attention' })).toEqual({
			kind: 'chapter',
			chapter: 'dl/attention',
		});
	});

	it('needs another chapter for the chapter choice', () => {
		expect(resolveTarget({ choice: 'chapter', chapterId: 'dl/a' })).toBeNull();
		expect(resolveTarget({ choice: 'chapter', chapterId: 'dl/a', otherChapterId: 'dl/b' })).toEqual(
			{
				kind: 'chapter',
				chapter: 'dl/b',
			},
		);
	});

	it('needs a wish for the wish choice', () => {
		expect(resolveTarget({ choice: 'wish', chapterId: 'dl/a' })).toBeNull();
		expect(resolveTarget({ choice: 'wish', chapterId: 'dl/a', wishId: wish.id })).toEqual({
			kind: 'wish',
			wishId: wish.id,
		});
	});
});
