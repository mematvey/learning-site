import { getContext, setContext } from 'svelte';
import type { ProgressStore } from '$lib/contracts/interfaces';
import { LEVELS_CONTEXT, type LevelsContext } from '$lib/contracts/context';
import {
	AXIS_BOUNDS,
	levelsFromUrl,
	resolveLevels,
	type Axis,
	type LevelState,
} from '$lib/contracts/levels';
import { readSavedLevels, writeSavedLevels } from './storage';
import { writeLevelsToUrl } from './url';

/** The part of `ProgressStore` the levels store uses. */
export type LevelsPersistence = Pick<ProgressStore, 'getSettings' | 'update'>;

export interface LevelsOptions {
	/** Saved settings. Without it, localStorage is used as a fallback. */
	progress?: LevelsPersistence | null;
	/** Query string to read (`?c=&d=`). Defaults to `window.location.search`. */
	search?: string;
	/** Writes the applied state to the URL. Defaults to `replaceState` from `$app/navigation`. */
	writeUrl?: (state: LevelState) => void;
}

export type LevelsStore = LevelsContext;

function clampAxis(axis: Axis, value: number): number {
	const { min, max } = AXIS_BOUNDS[axis];
	return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Level state: applied levels, draft from the sliders, and `apply()`.
 * Initial value: URL, then saved settings, then defaults (per axis).
 */
export function createLevels(options: LevelsOptions = {}): LevelsStore {
	const search = options.search ?? (typeof window === 'undefined' ? '' : window.location.search);
	const fromUrl = levelsFromUrl(search);
	const progress = options.progress ?? null;
	const writeUrl = options.writeUrl ?? writeLevelsToUrl;

	let applied = $state<LevelState>(resolveLevels(fromUrl, progress ? null : readSavedLevels()));
	let draft = $state<LevelState>({ ...applied });
	let touched = false;

	// Saved settings arrive asynchronously; they only fill axes that the URL does not set.
	if (progress) {
		progress
			.getSettings()
			.then((settings) => {
				if (touched || !settings?.levels) return;
				const next = resolveLevels(fromUrl, settings.levels);
				applied = next;
				draft = { ...next };
			})
			.catch(() => {
				/* unreadable settings: keep URL/default values */
			});
	}

	return {
		get applied() {
			return applied;
		},
		get draft() {
			return draft;
		},
		get dirty() {
			return draft.c !== applied.c || draft.d !== applied.d;
		},
		setDraft(patch) {
			draft = {
				c: patch.c === undefined ? draft.c : clampAxis('c', patch.c),
				d: patch.d === undefined ? draft.d : clampAxis('d', patch.d),
			};
		},
		apply() {
			touched = true;
			const next: LevelState = { c: draft.c, d: draft.d };
			applied = next;
			writeUrl(next);
			if (progress) {
				progress.update({ settings: { levels: next } }).catch(() => {
					/* read-only or failed write: the URL still carries the state */
				});
			} else {
				writeSavedLevels(next);
			}
		},
	};
}

/** Creates the level store and provides it to child components (`Level`, `Variant`, `LevelPopover`). */
export function provideLevels(options: LevelsOptions = {}): LevelsStore {
	const store = createLevels(options);
	setContext(LEVELS_CONTEXT, store);
	return store;
}

/** The provided level store, or undefined outside a `provideLevels()` tree. */
export function useLevels(): LevelsContext | undefined {
	return getContext<LevelsContext | undefined>(LEVELS_CONTEXT);
}
