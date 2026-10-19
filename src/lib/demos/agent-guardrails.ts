/**
 * Logic of the agent guardrails demo: three capabilities of an agent and the lethal-trifecta check.
 * The model has one dangerous combination out of 2 · 2 · 2 = 8: all three capabilities present.
 * Pure functions only: no DOM, no Svelte.
 */

export const CAP_KEYS = ['data', 'untrusted', 'external'] as const;
export type CapKey = (typeof CAP_KEYS)[number];
export type Caps = Record<CapKey, boolean>;

/** Starting state: all three capabilities present, the dangerous case. */
export const DEFAULT_CAPS: Caps = { data: true, untrusted: true, external: true };

export const CAP_LABEL: Record<CapKey, string> = {
	data: 'Доступ к приватным данным',
	untrusted: 'Недоверенный ввод',
	external: 'Внешний канал отправки',
};

export const CAP_HINT: Record<CapKey, string> = {
	data: 'База клиентов, внутренняя wiki',
	untrusted: 'Письма, веб-страницы, документы, ответы других сервисов',
	external: 'Отправка письма или запрос к произвольному адресу, даже GET с данными в параметрах',
};

/** Short names for the combination grid. */
export const CAP_SHORT: Record<CapKey, string> = {
	data: 'данные',
	untrusted: 'вход',
	external: 'канал',
};

/** What a missing capability cuts from the leak path. */
const CUT: Record<CapKey, string> = {
	data: 'Приватных данных нет: вынести нечего, путь обрывается в начале.',
	untrusted:
		'Недоверенного входа нет: вредная инструкция не попадает в агента, путь не начинается.',
	external: 'Внешнего канала нет: данные не покидают систему, путь не доходит до выхода.',
};

export const OUTCOME_DANGER = 'Опасная комбинация';
export const OUTCOME_SAFE = 'Риск снят';

export type RowRole = 'link' | 'cut' | 'idle';

export const ROLE_TEXT: Record<RowRole, string> = {
	link: 'звено пути',
	cut: 'отсекает путь',
	idle: '—',
};

/** The dangerous case: every capability is present. */
export function hasLethalTrifecta(c: Caps): boolean {
	return c.data && c.untrusted && c.external;
}

/** All 2 · 2 · 2 = 8 combinations in binary order; `data` is the most significant bit. */
export function allCombinations(): Caps[] {
	const out: Caps[] = [];
	for (let n = 0; n < 8; n++) {
		out.push({ data: (n & 4) !== 0, untrusted: (n & 2) !== 0, external: (n & 1) !== 0 });
	}
	return out;
}

export function countDangerous(list: readonly Caps[] = allCombinations()): number {
	return list.filter(hasLethalTrifecta).length;
}

export function sameCaps(a: Caps, b: Caps): boolean {
	return CAP_KEYS.every((k) => a[k] === b[k]);
}

export function outcomeLabel(c: Caps): string {
	return hasLethalTrifecta(c) ? OUTCOME_DANGER : OUTCOME_SAFE;
}

/** Role of one row in the path: a link of the dangerous chain, a cut, or nothing. */
export function rowRole(c: Caps, k: CapKey): RowRole {
	if (!c[k]) return 'cut';
	return hasLethalTrifecta(c) ? 'link' : 'idle';
}

/** Cause and effect for the current state. Used as the live message under the table. */
export function describeCaps(c: Caps): string {
	const off = CAP_KEYS.filter((k) => !c[k]);
	if (off.length === 0) {
		return (
			'Опасная комбинация: текст из недоверенного источника может заставить агента ' +
			'вынести приватные данные через внешний канал.'
		);
	}
	const causes = off.map((k) => CUT[k]).join(' ');
	return `${causes} Путь утечки через инъекцию закрыт.`;
}

/** Accessible name of a combination cell, e.g. "данные: да, вход: нет, канал: да". */
export function comboLabel(c: Caps): string {
	const parts = CAP_KEYS.map((k) => `${CAP_SHORT[k]}: ${c[k] ? 'да' : 'нет'}`);
	return parts.join(', ') + (hasLethalTrifecta(c) ? ' — опасная комбинация' : '');
}

/**
 * Returns a copy of `prev` with the boolean fields of `patch` applied.
 * Non-boolean values are ignored, so a bad URL or text cannot break the state.
 */
export function patchCaps(prev: Caps, patch: Partial<Record<CapKey, unknown>>): Caps {
	const next: Caps = { ...prev };
	for (const k of CAP_KEYS) {
		const v = patch[k];
		if (typeof v === 'boolean') next[k] = v;
	}
	return next;
}
