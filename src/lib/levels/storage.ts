import { LevelState, type LevelState as LevelStateType } from '$lib/contracts/levels';

/** localStorage key used when no `ProgressStore` is given. */
export const LEVELS_STORAGE_KEY = 'learning-site:levels';

/** Reads saved levels from localStorage. Returns undefined on any failure or invalid data. */
export function readSavedLevels(): Partial<LevelStateType> | undefined {
	try {
		const raw = globalThis.localStorage?.getItem(LEVELS_STORAGE_KEY);
		if (!raw) return undefined;
		const parsed = LevelState.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : undefined;
	} catch {
		return undefined;
	}
}

/** Saves levels to localStorage. Failures (private mode, blocked storage) are ignored. */
export function writeSavedLevels(state: LevelStateType): void {
	try {
		globalThis.localStorage?.setItem(LEVELS_STORAGE_KEY, JSON.stringify(state));
	} catch {
		/* storage unavailable: levels live only in the URL and in memory */
	}
}
