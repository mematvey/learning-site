/** Shortcut table from docs/mockups/CONTRACT.md («Шорткаты») and the help window groups. */

export interface ShortcutGroup {
	title: string;
	items: ReadonlyArray<readonly [spec: string, description: string]>;
}

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
	{
		title: 'Навигация',
		items: [
			['mod+k', 'Поиск'],
			['/', 'Поиск (фокус в поле)'],
			['1-5', 'Карта топика (главная)'],
			['[', 'Предыдущая глава'],
			[']', 'Следующая глава'],
			['g h', 'На главную'],
		],
	},
	{
		title: 'Чтение',
		items: [
			['j', 'Следующий раздел'],
			['k', 'Предыдущий раздел'],
			['l', 'Уровни объяснения'],
			['n', 'Заметка к выделению'],
			['m', 'Отметить пройденным'],
		],
	},
	{
		title: 'Лаб',
		items: [
			['mod+enter', 'Запустить код'],
			['mod+s', 'Сохранить черновик'],
			['mod+shift+backspace', 'Сбросить к стартовому коду'],
			['esc', 'Выйти из редактора'],
		],
	},
	{
		title: 'Вид',
		items: [
			['t', 'Сменить тему'],
			['?', 'Эта справка'],
			['esc', 'Закрыть окно'],
		],
	},
];

/** Selectors the global handler acts on. The module knows nothing about page internals. */
export const TARGET = {
	search: '[data-search]',
	themeToggle: '[data-theme-toggle]',
	levelsToggle: '[data-levels-toggle]',
	prev: 'a[data-prev]',
	next: 'a[data-next]',
	noteButton: '[data-note-btn]',
	markDone: '[data-mark-done]',
	home: 'a[data-home]',
	section: 'section[id]',
} as const;

/** Window in ms in which `h` must follow `g`. */
export const SEQUENCE_WINDOW_MS = 1000;

/** Height of the sticky header, used when scrolling to sections. */
export const HEAD_OFFSET = 72;
