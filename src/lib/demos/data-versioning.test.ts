import { describe, expect, it } from 'vitest';
import {
	BASE_SIZE,
	BATCH_SIZE,
	CODE_COMMITS,
	DEFAULT_STATE,
	DIRTY_INDEX,
	JOURNAL,
	NOISE_IDX,
	SEED_MAX,
	SEED_MIN,
	applyPatch,
	codeCommit,
	codeHash,
	datasetAt,
	datasetHash,
	describeState,
	findRecord,
	fingerprint,
	fnv1a,
	knnPredict,
	runExperiment,
	snapSeed,
	splitIndices,
	summarize,
	workingDataset,
} from './data-versioning';

describe('fnv1a', () => {
	it('gives 8 hex digits and is deterministic', () => {
		expect(fnv1a('abc')).toMatch(/^[0-9a-f]{8}$/);
		expect(fnv1a('abc')).toBe(fnv1a('abc'));
		expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
	});

	it('matches the reference value for the empty string', () => {
		expect(fnv1a('')).toBe('811c9dc5');
	});
});

describe('data versions', () => {
	it('sizes: d0 and d1 have the base rows, d2 adds the batch', () => {
		expect(datasetAt('d0')).toHaveLength(BASE_SIZE);
		expect(datasetAt('d1')).toHaveLength(BASE_SIZE);
		expect(datasetAt('d2')).toHaveLength(BASE_SIZE + BATCH_SIZE);
	});

	it('d1 differs from d0 only in the labels of the noisy rows', () => {
		const d0 = datasetAt('d0');
		const d1 = datasetAt('d1');
		const changed = d0.map((s, i) => (s.label !== d1[i]?.label ? i : -1)).filter((i) => i >= 0);
		expect(changed).toEqual([...NOISE_IDX]);
		d0.forEach((s, i) => {
			expect(d1[i]?.f1).toBe(s.f1);
			expect(d1[i]?.f2).toBe(s.f2);
		});
	});

	it('d2 keeps the rows of d1 as a prefix', () => {
		expect(datasetAt('d2').slice(0, BASE_SIZE)).toEqual(datasetAt('d1'));
	});

	it('hashes differ between data commits', () => {
		const h = new Set([
			datasetHash(datasetAt('d0')),
			datasetHash(datasetAt('d1')),
			datasetHash(datasetAt('d2')),
		]);
		expect(h.size).toBe(3);
	});

	it('unversioned edit changes the hash of the working copy only', () => {
		const committed = datasetHash(datasetAt('d2'));
		const dirty = datasetHash(workingDataset('d2', true));
		expect(dirty).not.toBe(committed);
		expect(datasetHash(workingDataset('d2', false))).toBe(committed);
		const rows = workingDataset('d2', true);
		expect(rows[DIRTY_INDEX]?.label).not.toBe(datasetAt('d2')[DIRTY_INDEX]?.label);
	});
});

describe('split', () => {
	it('is deterministic for a seed and partitions all rows', () => {
		const a = splitIndices(80, 3);
		const b = splitIndices(80, 3);
		expect(a).toEqual(b);
		expect(a.test).toHaveLength(20);
		expect(a.train).toHaveLength(60);
		expect(new Set([...a.train, ...a.test]).size).toBe(80);
	});

	it('different seeds give different test parts', () => {
		expect(splitIndices(80, 1).test).not.toEqual(splitIndices(80, 2).test);
	});
});

describe('knnPredict', () => {
	const train = [
		{ f1: 0, f2: 0, label: 0 as const },
		{ f1: 1, f2: 0, label: 1 as const },
		{ f1: 2, f2: 0, label: 1 as const },
	];

	it('votes among the k nearest rows', () => {
		expect(knnPredict(train, { f1: 1.9, f2: 0 }, 3)).toBe(1);
		expect(knnPredict(train, { f1: -0.5, f2: 0 }, 1)).toBe(0);
	});

	it('breaks a tie with the nearest neighbour', () => {
		// k = 2: nearest is label 0 (distance 0.2), second is label 1; tie goes to the nearest.
		expect(knnPredict(train, { f1: 0.2, f2: 0 }, 2)).toBe(0);
	});

	it('clamps k larger than the train set', () => {
		expect(knnPredict(train, { f1: 0.9, f2: 0 }, 99)).toBe(1);
	});
});

describe('runExperiment', () => {
	it('is deterministic for the same inputs', () => {
		const rows = datasetAt('d1');
		const c = codeCommit('c1');
		expect(runExperiment(rows, c, 2)).toEqual(runExperiment(rows, c, 2));
	});

	it('accuracy is correct / total and total is the test part', () => {
		const r = runExperiment(datasetAt('d0'), codeCommit('c0'), 1);
		expect(r.total).toBe(Math.round(BASE_SIZE * 0.25));
		expect(r.accuracy).toBeCloseTo(r.correct / r.total, 12);
	});

	it('standardisation removes the dominance of the large-scale feature', () => {
		// Summed over all seeds: the uninformative feature with scale 50 ruins the raw distance.
		const rows = datasetAt('d1');
		let raw = 0;
		let scaled = 0;
		for (let seed = SEED_MIN; seed <= SEED_MAX; seed++) {
			raw += runExperiment(rows, codeCommit('c0'), seed).accuracy;
			scaled += runExperiment(rows, codeCommit('c1'), seed).accuracy;
		}
		expect(scaled).toBeGreaterThan(raw);
	});
});

describe('fingerprint and journal', () => {
	it('changes with any of the three inputs', () => {
		const base = fingerprint('aaaaaaaa', 'bbbbbbbb', 1);
		expect(fingerprint('aaaaaaa0', 'bbbbbbbb', 1)).not.toBe(base);
		expect(fingerprint('aaaaaaaa', 'bbbbbbb0', 1)).not.toBe(base);
		expect(fingerprint('aaaaaaaa', 'bbbbbbbb', 2)).not.toBe(base);
	});

	it('code hash differs between code commits', () => {
		const hashes = CODE_COMMITS.map((c) => codeHash(c));
		expect(new Set(hashes).size).toBe(CODE_COMMITS.length);
	});

	it('journal holds the pinned committed runs', () => {
		expect(JOURNAL).toHaveLength(3);
		for (const rec of JOURNAL) {
			const s = summarize(
				{ code: rec.code, data: rec.data, seed: rec.seed, dirty: false },
				JOURNAL,
			);
			expect(s.record?.fingerprint).toBe(rec.fingerprint);
			expect(s.reproducible).toBe(true);
		}
	});

	it('default state is a recorded, reproducible run', () => {
		const s = summarize(DEFAULT_STATE);
		expect(s.dataMatchesCommit).toBe(true);
		expect(s.reproducible).toBe(true);
	});

	it('unversioned edit breaks the match with the journal', () => {
		const s = summarize({ ...DEFAULT_STATE, dirty: true });
		expect(s.dataMatchesCommit).toBe(false);
		expect(s.record).toBeUndefined();
		expect(s.reproducible).toBe(false);
		expect(describeState({ ...DEFAULT_STATE, dirty: true }, s)).toMatch(/Рабочая копия отличается/);
	});

	it('findRecord returns undefined for an unknown fingerprint', () => {
		expect(findRecord(JOURNAL, '00000000')).toBeUndefined();
	});
});

describe('state patches', () => {
	it('snaps seeds into range and ignores bad values', () => {
		expect(snapSeed(0)).toBe(SEED_MIN);
		expect(snapSeed(99)).toBe(SEED_MAX);
		expect(snapSeed(2.6)).toBe(3);
		expect(snapSeed(Number.NaN)).toBe(1);
	});

	it('applyPatch validates ids and keeps untouched fields', () => {
		const next = applyPatch(DEFAULT_STATE, { code: 'bogus' as never, seed: 4, dirty: true });
		expect(next).toEqual({
			code: DEFAULT_STATE.code,
			data: DEFAULT_STATE.data,
			seed: 4,
			dirty: true,
		});
	});
});
