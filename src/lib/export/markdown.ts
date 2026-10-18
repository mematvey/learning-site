import { splitChapterId, type Note } from '$lib/contracts';
import type {
	Bookmark,
	Clarification,
	ExportFile,
	MyData,
	Situation,
	Wish,
} from '$lib/contracts/my';

export const EXPORT_SCHEMA_VERSION = 1;
export const USER_DATA_ROOT = 'user-data';

export interface ExportContext {
	chapterTitle(id: string): string;
	topicTitle(id: string): string;
	chapterHref(id: string, blockId?: string): string;
}

export interface ExportBundle {
	notes: Note[];
	my: MyData;
	/** ISO time written into the export. Defaults to now; pass it explicitly for stable output. */
	exportedAt?: string;
}

const KIND_LABEL: Record<Bookmark['kind'], string> = {
	block: 'блок',
	formula: 'формула',
	term: 'термин',
	figure: 'рисунок',
};
const WISH_STATUS_LABEL: Record<Wish['status'], string> = {
	idea: 'идея',
	drafting: 'в работе',
	covered: 'разобрано',
};
const SITUATION_STATUS_LABEL: Record<Situation['status'], string> = {
	open: 'открыта',
	answered: 'отвечена',
};
const NOTE_STATUS_LABEL: Record<Note['status'], string> = {
	open: 'открыта',
	answered: 'есть ответ',
};

function cmp(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function byCreated(a: { created: string; id: string }, b: { created: string; id: string }): number {
	return cmp(a.created, b.created) || cmp(a.id, b.id);
}

/** Groups items by key; groups are sorted by key, items keep their order. */
function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
	const groups = new Map<string, T[]>();
	for (const item of items) {
		const k = key(item);
		const list = groups.get(k);
		if (list) list.push(item);
		else groups.set(k, [item]);
	}
	return [...groups.entries()].sort(([a], [b]) => cmp(a, b));
}

/** Escapes characters that would start inline markdown in plain text. */
export function escapeInline(text: string): string {
	return text.replace(/[\\`*_[\]<>|~]/g, (ch) => `\\${ch}`);
}

/** Renders a fragment as a blockquote; every line is escaped so it stays literal text. */
export function quoteBlock(text: string): string {
	return text
		.split('\n')
		.map((line) => {
			const escaped = escapeInline(line).replace(/^(\s*)([#>+\-*]|\d+[.)])(?=\s|$)/, '$1\\$2');
			return `> ${escaped}`.trimEnd();
		})
		.join('\n');
}

/** Bullet list; continuation lines are indented so multi-line texts stay in the item. */
function bullets(items: string[]): string {
	return items.map((item) => `- ${item.trim().replace(/\n/g, '\n  ')}`).join('\n');
}

function link(label: string, href: string): string {
	return `[${escapeInline(label)}](${href})`;
}

const day = (iso: string): string => iso.slice(0, 10);

function listTopics(bundle: ExportBundle): string[] {
	const topics = new Set<string>();
	for (const note of bundle.notes) topics.add(splitChapterId(note.chapter).topic);
	const { bookmarks, wishes, situations, clarifications } = bundle.my;
	for (const item of [...bookmarks, ...wishes, ...situations, ...clarifications]) {
		topics.add(item.topic);
	}
	return [...topics].sort(cmp);
}

function render(blocks: string[]): string {
	return `${blocks.join('\n\n')}\n`;
}

function notesFile(topic: string, notes: Note[], ctx: ExportContext): string | undefined {
	if (notes.length === 0) return undefined;
	const blocks = [`# Заметки: ${escapeInline(ctx.topicTitle(topic))}`];
	for (const [chapter, items] of groupBy(notes, (n) => n.chapter)) {
		blocks.push(`## ${link(ctx.chapterTitle(chapter), ctx.chapterHref(chapter))}`);
		for (const note of items) {
			const orphan = note.anchor.position === 'orphaned' ? ', место не найдено' : '';
			blocks.push(`### ${day(note.created)} · ${NOTE_STATUS_LABEL[note.status]}${orphan}`);
			blocks.push(quoteBlock(note.anchor.exact));
			blocks.push(link('Открыть место', ctx.chapterHref(chapter, note.anchor.blockId)));
			if (note.text.trim()) blocks.push(note.text.trim());
		}
	}
	return render(blocks);
}

function bookmarksFile(topic: string, items: Bookmark[], ctx: ExportContext): string | undefined {
	if (items.length === 0) return undefined;
	const blocks = [`# Закладки: ${escapeInline(ctx.topicTitle(topic))}`];
	for (const [chapter, list] of groupBy(items, (b) => b.chapter)) {
		blocks.push(`## ${link(ctx.chapterTitle(chapter), ctx.chapterHref(chapter))}`);
		for (const bookmark of list) {
			blocks.push(`### ${KIND_LABEL[bookmark.kind]} · ${day(bookmark.created)}`);
			if (bookmark.quote) {
				blocks.push(
					bookmark.kind === 'formula'
						? `\`\`\`tex\n${bookmark.quote}\n\`\`\``
						: quoteBlock(bookmark.quote),
				);
			}
			if (bookmark.termId) blocks.push(`Термин: \`${bookmark.termId}\``);
			if (bookmark.comment.trim()) blocks.push(bookmark.comment.trim());
			blocks.push(link('Открыть место', ctx.chapterHref(chapter, bookmark.blockId)));
		}
	}
	return render(blocks);
}

function wishesFile(
	topic: string,
	wishes: Wish[],
	clarifications: Clarification[],
	ctx: ExportContext,
): string | undefined {
	if (wishes.length === 0) return undefined;
	const topicTitle = ctx.topicTitle(topic);
	const blocks = [
		`# Хочу разобрать: ${escapeInline(topicTitle)}`,
		`Черновики будущих глав (тема: ${topicTitle}). Каждый блок — основа для задания на новую главу: заголовок, вопрос, желаемые разделы и термины, заметки.`,
	];
	for (const wish of [...wishes].sort(byCreated)) {
		blocks.push(`## ${escapeInline(wish.title)}`);
		blocks.push(`Статус: ${WISH_STATUS_LABEL[wish.status]}`);
		if (wish.question.trim()) blocks.push(`**Вопрос:** ${wish.question.trim()}`);
		if (wish.wantedSections.length > 0) {
			blocks.push(`**Желаемые разделы:**\n${bullets(wish.wantedSections)}`);
		}
		if (wish.wantedTerms.length > 0) {
			blocks.push(`**Желаемые термины:**\n${bullets(wish.wantedTerms)}`);
		}
		if (wish.notes.trim()) blocks.push(`**Заметки:** ${wish.notes.trim()}`);
		const own = clarifications
			.filter((c) => c.target.kind === 'wish' && c.target.wishId === wish.id)
			.sort(byCreated);
		if (own.length > 0) {
			blocks.push(`**Уточнения:**\n${bullets(own.map((c) => `${day(c.created)}: ${c.text}`))}`);
		}
	}
	return render(blocks);
}

function situationsFile(
	topic: string,
	situations: Situation[],
	clarifications: Clarification[],
	wishes: Wish[],
	ctx: ExportContext,
): string | undefined {
	const topicSituations = situations.filter((s) => s.topic === topic).sort(byCreated);
	const topicClarifications = clarifications.filter((c) => c.topic === topic);
	const chapterClarifications = topicClarifications.filter((c) => c.target.kind === 'chapter');
	if (topicSituations.length === 0 && chapterClarifications.length === 0) return undefined;

	const chapters = new Set<string>();
	const wishIds = new Set<string>();
	for (const s of topicSituations) {
		if (s.target.kind === 'chapter') chapters.add(s.target.chapter);
		else wishIds.add(s.target.wishId);
	}
	for (const c of chapterClarifications) {
		if (c.target.kind === 'chapter') chapters.add(c.target.chapter);
	}

	const renderSituation = (s: Situation): string[] => {
		const own = topicClarifications
			.filter((c) => c.target.kind === 'situation' && c.target.situationId === s.id)
			.sort(byCreated);
		const out = [
			`### ${escapeInline(s.title)} · ${SITUATION_STATUS_LABEL[s.status]}`,
			`**Ситуация:** ${s.situation.trim()}`,
			`**Цель:** ${s.goal.trim()}`,
		];
		if (own.length > 0) {
			out.push(`**Уточнения:**\n${bullets(own.map((c) => `${day(c.created)}: ${c.text}`))}`);
		}
		return out;
	};

	const blocks = [`# Ситуации: ${escapeInline(ctx.topicTitle(topic))}`];
	for (const chapter of [...chapters].sort(cmp)) {
		blocks.push(`## ${link(ctx.chapterTitle(chapter), ctx.chapterHref(chapter))}`);
		const own = chapterClarifications
			.filter((c) => c.target.kind === 'chapter' && c.target.chapter === chapter)
			.sort(byCreated);
		if (own.length > 0) {
			blocks.push(
				`**Уточнения к главе:**\n${bullets(own.map((c) => `${day(c.created)}: ${c.text}`))}`,
			);
		}
		for (const s of topicSituations) {
			if (s.target.kind === 'chapter' && s.target.chapter === chapter) {
				blocks.push(...renderSituation(s));
			}
		}
	}

	const wishOrder = wishes
		.filter((w) => wishIds.has(w.id))
		.sort(byCreated)
		.map((w) => w.id);
	for (const wishId of wishOrder) {
		const wish = wishes.find((w) => w.id === wishId);
		const title = wish ? wish.title : 'удалённая желаемая глава';
		blocks.push(`## Желаемая глава: ${escapeInline(title)}`);
		for (const s of topicSituations) {
			if (s.target.kind === 'wish' && s.target.wishId === wishId) {
				blocks.push(...renderSituation(s));
			}
		}
	}
	return render(blocks);
}

function allFile(
	topics: string[],
	topicPaths: Map<string, string[]>,
	bundle: ExportBundle,
	ctx: ExportContext,
	exportedAt: string,
): string {
	const blocks = ['# Сводка: личные данные', `Экспорт: ${exportedAt}`];
	if (topics.length === 0) {
		blocks.push('Данных пока нет.');
		return render(blocks);
	}
	for (const topic of topics) {
		const notes = bundle.notes.filter((n) => splitChapterId(n.chapter).topic === topic);
		const { bookmarks, wishes, situations, clarifications } = bundle.my;
		const topicSituations = situations.filter((s) => s.topic === topic);
		const openSituations = topicSituations.filter((s) => s.status === 'open');
		blocks.push(`## ${escapeInline(ctx.topicTitle(topic))}`);
		blocks.push(
			bullets([
				`Заметки: ${notes.length}`,
				`Закладки: ${bookmarks.filter((b) => b.topic === topic).length}`,
				`Хочу разобрать: ${wishes.filter((w) => w.topic === topic).length}`,
				`Ситуации: ${topicSituations.length} (открытых: ${openSituations.length})`,
				`Уточнения: ${clarifications.filter((c) => c.topic === topic).length}`,
			]),
		);
		if (openSituations.length > 0) {
			blocks.push(`**Открытые ситуации:**\n${bullets(openSituations.map((s) => s.title))}`);
		}
		const paths = topicPaths.get(topic) ?? [];
		if (paths.length > 0) {
			blocks.push(`Файлы: ${paths.map((p) => `\`${p}\``).join(', ')}`);
		}
	}
	return render(blocks);
}

const README = render([
	'# Данные пользователя: инструкция для агента',
	'Это личные данные учебного сайта. Файлы только для чтения: источник правды — глава в репозитории и `backup.json`. Файлы создаются только для тем, где есть данные.',
	[
		'## Что здесь',
		bullets([
			'`all.md` — сводка по темам и открытым ситуациям.',
			'`<topic>/notes.md` — заметки к местам в главах; у открытых заметок нужен ответ.',
			'`<topic>/bookmarks.md` — закладки для повторения: блоки, формулы, термины, рисунки с комментариями.',
			'`<topic>/wishes.md` — желаемые главы («Хочу разобрать»): черновики заданий на новую главу.',
			'`<topic>/situations.md` — ситуации «что делать» к существующим главам и желаемым главам, с уточнениями.',
			'`backup.json` — полный экспорт в JSON (`notes` и `my`) для импорта обратно на сайт.',
		]),
	].join('\n'),
	[
		'## Как отвечать',
		bullets([
			'По-русски, опираясь на текст главы по ссылке из файла. Если главы нет в контексте, скажи об этом.',
			'Для заметок и ситуаций сохраняй ссылку на место, чтобы пользователь мог перейти к нему.',
			'Для желаемых глав предложи структуру будущей главы: разделы, термины, порядок изложения.',
			'Для ситуаций дай конкретный следующий шаг и что проверить; отделяй факты от рекомендаций.',
		]),
	].join('\n'),
]);

/**
 * Builds the export files: a README for the agent, a summary, per-topic Markdown files
 * (only for sections that have content) and `backup.json` for re-import.
 * Output order is deterministic: topics sorted by id, chapters by id, items by creation time.
 */
export function buildFiles(bundle: ExportBundle, ctx: ExportContext): ExportFile[] {
	const exportedAt = bundle.exportedAt ?? new Date().toISOString();
	const topics = listTopics(bundle);
	const topicFiles: ExportFile[] = [];
	const topicPaths = new Map<string, string[]>();

	for (const topic of topics) {
		const root = `${USER_DATA_ROOT}/${topic}`;
		const notes = bundle.notes
			.filter((n) => splitChapterId(n.chapter).topic === topic)
			.sort(byCreated);
		const bookmarks = bundle.my.bookmarks.filter((b) => b.topic === topic).sort(byCreated);
		const wishes = bundle.my.wishes.filter((w) => w.topic === topic);
		const clarifications = bundle.my.clarifications.filter((c) => c.topic === topic);
		const candidates: [string, string | undefined][] = [
			[`${root}/notes.md`, notesFile(topic, notes, ctx)],
			[`${root}/bookmarks.md`, bookmarksFile(topic, bookmarks, ctx)],
			[`${root}/wishes.md`, wishesFile(topic, wishes, clarifications, ctx)],
			[
				`${root}/situations.md`,
				situationsFile(topic, bundle.my.situations, clarifications, bundle.my.wishes, ctx),
			],
		];
		const paths: string[] = [];
		for (const [path, content] of candidates) {
			if (content === undefined) continue;
			topicFiles.push({ path, content });
			paths.push(path);
		}
		topicPaths.set(topic, paths);
	}

	const backup = {
		schemaVersion: EXPORT_SCHEMA_VERSION,
		exportedAt,
		notes: bundle.notes,
		my: bundle.my,
	};

	return [
		{ path: `${USER_DATA_ROOT}/README.md`, content: README },
		{
			path: `${USER_DATA_ROOT}/all.md`,
			content: allFile(topics, topicPaths, bundle, ctx, exportedAt),
		},
		...topicFiles,
		{ path: `${USER_DATA_ROOT}/backup.json`, content: `${JSON.stringify(backup, null, 2)}\n` },
	];
}
