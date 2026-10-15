import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLevels } from './store.svelte';
import { variantVisible } from './visibility';
import { LEVELS_STORAGE_KEY, readSavedLevels } from './storage';
import { DEFAULT_LEVELS, type LevelState } from '$lib/contracts/levels';

afterEach(() => {
	localStorage.clear();
	vi.restoreAllMocks();
});

describe('createLevels', () => {
	it('starts from defaults when nothing is set', () => {
		const store = createLevels({ search: '', writeUrl: () => {} });
		expect(store.applied).toEqual(DEFAULT_LEVELS);
		expect(store.dirty).toBe(false);
	});

	it('reads URL first, per axis, and ignores invalid values', () => {
		localStorage.setItem(LEVELS_STORAGE_KEY, JSON.stringify({ c: 4, d: 3 }));
		const store = createLevels({ search: '?c=3&d=9', writeUrl: () => {} });
		expect(store.applied).toEqual({ c: 3, d: 3 });
	});

	it('falls back to localStorage when there is no URL value', () => {
		localStorage.setItem(LEVELS_STORAGE_KEY, JSON.stringify({ c: 4, d: 2 }));
		const store = createLevels({ search: '', writeUrl: () => {} });
		expect(store.applied).toEqual({ c: 4, d: 2 });
	});

	it('survives a throwing localStorage', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect(readSavedLevels()).toBeUndefined();
		const store = createLevels({ search: '', writeUrl: () => {} });
		expect(store.applied).toEqual(DEFAULT_LEVELS);
	});

	it('tracks dirty state, clamps draft, and applies', () => {
		const writeUrl = vi.fn<(s: LevelState) => void>();
		const store = createLevels({ search: '', writeUrl });

		store.setDraft({ c: 9, d: 0 });
		expect(store.draft).toEqual({ c: 4, d: 1 });
		expect(store.dirty).toBe(true);
		expect(store.applied).toEqual(DEFAULT_LEVELS);
		expect(writeUrl).not.toHaveBeenCalled();

		store.apply();
		expect(store.applied).toEqual({ c: 4, d: 1 });
		expect(store.dirty).toBe(false);
		expect(writeUrl).toHaveBeenCalledWith({ c: 4, d: 1 });
		expect(JSON.parse(localStorage.getItem(LEVELS_STORAGE_KEY) ?? '{}')).toEqual({ c: 4, d: 1 });
	});

	it('saves through the progress store when given', async () => {
		const update = vi.fn().mockResolvedValue(undefined);
		const getSettings = vi.fn().mockResolvedValue({ levels: { c: 3, d: 2 } });
		const store = createLevels({
			search: '',
			writeUrl: () => {},
			progress: { getSettings, update } as never,
		});
		await vi.waitFor(() => expect(store.applied).toEqual({ c: 3, d: 2 }));

		store.setDraft({ c: 1 });
		store.apply();
		expect(update).toHaveBeenCalledWith({ settings: { levels: { c: 1, d: 2 } } });
	});

	it('keeps URL values over saved settings', async () => {
		const store = createLevels({
			search: '?c=2',
			writeUrl: () => {},
			progress: {
				getSettings: async () => ({ levels: { c: 4, d: 3 } }),
				update: async () => {},
			} as never,
		});
		await vi.waitFor(() => expect(store.applied).toEqual({ c: 2, d: 3 }));
	});
});

describe('variantVisible', () => {
	it('shows exactly one variant of a covering group', () => {
		const group = [{ c: '1' }, { c: '2-4' }];
		for (let c = 1; c <= 4; c++) {
			const visible = group.filter((v) => variantVisible(v, { c, d: 1 }));
			expect(visible).toHaveLength(1);
		}
		expect(variantVisible({ c: '1' }, { c: 1, d: 3 })).toBe(true);
		expect(variantVisible({ c: '2-4' }, { c: 1, d: 3 })).toBe(false);
	});

	it('respects the depth axis when both axes are given', () => {
		expect(variantVisible({ c: '2-4', d: '2-3' }, { c: 3, d: 1 })).toBe(false);
		expect(variantVisible({ c: '2-4', d: '2-3' }, { c: 3, d: 2 })).toBe(true);
	});

	it('treats invalid ranges as hidden', () => {
		expect(variantVisible({ c: '4-2' }, { c: 3, d: 1 })).toBe(false);
	});
});
