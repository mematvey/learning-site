/**
 * Math of the MLOps lifecycle demo: when manual releases stop fitting into a team's time,
 * and how long automation takes to pay back. All constants are teaching assumptions
 * (see the chapter `mlops/lifecycle`), not measurements.
 * Pure functions only: no DOM, no Svelte.
 */

export const MODELS_MIN = 1;
export const MODELS_MAX = 20;
export const MODELS_DEFAULT = 3;

/** Releases per model per month. The slider moves along this list (index). */
export const FREQS: readonly number[] = [0.25, 0.5, 1, 2, 4, 8];
export const FREQ_DEFAULT = 1;

export const TEAM_MIN = 1;
export const TEAM_MAX = 10;
export const TEAM_DEFAULT = 2;

/** Teaching assumption: working hours per person per month. */
export const HOURS_PER_PERSON = 160;
/** Teaching assumption: hours of manual work for one release. */
export const T_MANUAL = 16;
/** Teaching assumption: hours of work for one automated release. */
export const T_AUTO = 2;
/** Teaching assumption: one-off hours to set up the automation. */
export const SETUP_H = 80;
/** Teaching assumption: incident probability per model per month. */
export const INCIDENT_P = 0.05;
/** Teaching assumption: hours of work for one incident. */
export const INCIDENT_C = 40;

/** Share of team time at which manual work becomes a heavy load. */
export const LIMIT_SHARE = 0.6;
/** Share of team time at which manual work no longer fits. */
export const OVERLOAD_SHARE = 1;

export interface LifecycleDemoState {
	/** Models in production. */
	models: number;
	/** Releases per model per month; one of FREQS. */
	freq: number;
	/** People in the team. */
	team: number;
}

export const DEFAULT_STATE: LifecycleDemoState = {
	models: MODELS_DEFAULT,
	freq: FREQ_DEFAULT,
	team: TEAM_DEFAULT,
};

export type LoadStatus = 'ok' | 'limit' | 'overload';

export interface Load {
	/** Releases per month across all models. */
	releases: number;
	/** Manual release work per month, hours. */
	manualReleaseH: number;
	/** Expected incident work per month, hours (the same with or without automation). */
	incidentH: number;
	/** Manual total per month, hours. */
	manualH: number;
	/** Total per month with automated releases, hours. */
	autoH: number;
	/** Team working hours per month. */
	capacityH: number;
	manualShare: number;
	autoShare: number;
	status: LoadStatus;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Rounds to an integer and clamps to the models slider range. Non-finite input gives the default. */
export function snapModels(v: number): number {
	if (!Number.isFinite(v)) return MODELS_DEFAULT;
	return Math.round(clamp(v, MODELS_MIN, MODELS_MAX));
}

/** Rounds to an integer and clamps to the team slider range. Non-finite input gives the default. */
export function snapTeam(v: number): number {
	if (!Number.isFinite(v)) return TEAM_DEFAULT;
	return Math.round(clamp(v, TEAM_MIN, TEAM_MAX));
}

/** Nearest allowed frequency. Non-finite input gives the default. */
export function snapFreq(v: number): number {
	if (!Number.isFinite(v)) return FREQ_DEFAULT;
	let best: number = FREQ_DEFAULT;
	for (const f of FREQS) {
		if (Math.abs(f - v) < Math.abs(best - v)) best = f;
	}
	return best;
}

/** Index of a frequency in FREQS (the slider position). */
export function freqIndex(freq: number): number {
	const i = FREQS.indexOf(snapFreq(freq));
	return i < 0 ? 0 : i;
}

/** Expected incident hours per model per month: p × C. */
export function incidentHoursPerModel(): number {
	return INCIDENT_P * INCIDENT_C;
}

export function statusOf(share: number): LoadStatus {
	if (share >= OVERLOAD_SHARE) return 'overload';
	if (share >= LIMIT_SHARE) return 'limit';
	return 'ok';
}

/** Monthly load of the team for the given state. */
export function computeLoad(s: LifecycleDemoState): Load {
	const releases = s.models * s.freq;
	const manualReleaseH = releases * T_MANUAL;
	const incidentH = s.models * incidentHoursPerModel();
	const manualH = manualReleaseH + incidentH;
	const autoH = releases * T_AUTO + incidentH;
	const capacityH = s.team * HOURS_PER_PERSON;
	const manualShare = manualH / capacityH;
	return {
		releases,
		manualReleaseH,
		incidentH,
		manualH,
		autoH,
		capacityH,
		manualShare,
		autoShare: autoH / capacityH,
		status: statusOf(manualShare),
	};
}

/**
 * Largest number of models that manual work keeps within the team's time at this frequency.
 * Above this number the manual process stops working.
 */
export function maxManualModels(freq: number, team: number): number {
	const perModel = snapFreq(freq) * T_MANUAL + incidentHoursPerModel();
	return Math.floor((snapTeam(team) * HOURS_PER_PERSON) / perModel);
}

/**
 * Payback in months of automating one model's releases: S / (f × (T_m − T_a)).
 * S = setup hours, f = releases per month.
 */
export function paybackMonths(freq: number): number {
	return SETUP_H / (snapFreq(freq) * (T_MANUAL - T_AUTO));
}

/** The three reference cases of the chapter, computed by the same formula. */
export const PAYBACK_EXAMPLES: readonly { freq: number; months: number }[] = [1, 4, 0.25].map(
	(freq) => ({ freq, months: paybackMonths(freq) }),
);

/** Formats a number with a decimal comma, as in Russian text. */
export function formatRu(v: number, digits = 0): string {
	return v.toFixed(digits).replace('.', ',');
}

/** Frequency as text: "0,25", "1", "8". */
export function formatFreq(freq: number): string {
	const f = snapFreq(freq);
	return formatRu(f, f % 1 === 0 ? 0 : 2);
}

export function statusText(status: LoadStatus): string {
	if (status === 'overload') {
		return 'Ручной процесс не справляется: работы больше, чем времени в команде.';
	}
	if (status === 'limit') {
		return 'Ручной процесс на пределе: почти всё время команды уходит на выкладки и сбои.';
	}
	return 'Ручной процесс пока справляется.';
}

/** Text of the status line for screen readers. Numbers are computed, not typed. */
export function describeLifecycle(s: LifecycleDemoState, load: Load): string {
	const pct = Math.round(load.manualShare * 100);
	return (
		`Моделей: ${s.models}, выкладок в месяц на модель: ${formatFreq(s.freq)}, людей в команде: ${s.team}. ` +
		`Ручная работа: ${Math.round(load.manualH)} ч из ${load.capacityH} ч в месяц (${pct}%). ` +
		`С автоматизацией: ${Math.round(load.autoH)} ч (${Math.round(load.autoShare * 100)}%). ` +
		statusText(load.status)
	);
}
