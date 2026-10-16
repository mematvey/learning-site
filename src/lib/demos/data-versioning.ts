/**
 * Math of the data versioning demo: a small project history with two lanes, code commits and data commits.
 * An experiment is a function of (code version, data version, seed). Its fingerprint is a hash of exactly
 * these inputs, so a run is reproducible only when the same commits are used again.
 * Pure functions only: no DOM, no Svelte.
 *
 * Data: 60 two-class points with an informative feature f1 (scale about 1) and an uninformative feature
 * f2 (scale about 50). Data commits fix noisy labels and append a batch. Code commits pick k and whether
 * features are standardised. Hashes are FNV-1a over canonical text, so they are stable across page loads.
 */

import { mulberry32 } from './attention';

export type CodeId = 'c0' | 'c1' | 'c2';
export type DataId = 'd0' | 'd1' | 'd2';

export interface DataVersioningDemoState {
	/** Code commit used by the experiment. */
	code: CodeId;
	/** Data commit used by the experiment. */
	data: DataId;
	/** Seed of the train/test split, integer in [SEED_MIN, SEED_MAX]. */
	seed: number;
	/** Unversioned edit in the working copy of the data (not committed). */
	dirty: boolean;
}

export interface Sample {
	/** Informative feature, scale about 1. */
	f1: number;
	/** Uninformative feature with a large scale, about 50. */
	f2: number;
	label: 0 | 1;
}

export interface CodeCommit {
	id: CodeId;
	parent: CodeId | null;
	message: string;
	k: number;
	scale: boolean;
}

export interface DataCommit {
	id: DataId;
	parent: DataId | null;
	message: string;
}

export const CODE_COMMITS: readonly CodeCommit[] = [
	{ id: 'c0', parent: null, message: 'k = 3, признаки как есть', k: 3, scale: false },
	{
		id: 'c1',
		parent: 'c0',
		message: 'стандартизация признаков по обучающей части',
		k: 3,
		scale: true,
	},
	{ id: 'c2', parent: 'c1', message: 'k = 7', k: 7, scale: true },
];

export const DATA_COMMITS: readonly DataCommit[] = [
	{ id: 'd0', parent: null, message: 'первичная выгрузка: 60 строк, 4 метки с ошибкой' },
	{ id: 'd1', parent: 'd0', message: 'исправлены метки в 4 строках' },
	{ id: 'd2', parent: 'd1', message: 'добавлен батч: 20 строк' },
];

export const DATA_SEED = 4242;
export const BASE_SIZE = 60;
export const BATCH_SIZE = 20;
/** Rows whose labels are wrong in d0 and fixed in d1. */
export const NOISE_IDX: readonly number[] = [3, 17, 29, 44];
/** Row whose label the unversioned edit flips in the working copy. */
export const DIRTY_INDEX = 5;
/** Share of rows in the test part of the split. */
export const TEST_SHARE = 0.25;

export const SEED_MIN = 1;
export const SEED_MAX = 5;
export const DEFAULT_SEED = 1;
export const DEFAULT_STATE: DataVersioningDemoState = {
	code: 'c2',
	data: 'd2',
	seed: DEFAULT_SEED,
	dirty: false,
};

/** Experiments written to the journal: code commit, data commit, seed. */
export const PINNED_RUNS: readonly [CodeId, DataId, number][] = [
	['c0', 'd0', 1],
	['c1', 'd1', 1],
	['c2', 'd2', 1],
];

export function isCodeId(v: unknown): v is CodeId {
	return v === 'c0' || v === 'c1' || v === 'c2';
}

export function isDataId(v: unknown): v is DataId {
	return v === 'd0' || v === 'd1' || v === 'd2';
}

/** Clamps and rounds a seed to an integer in [SEED_MIN, SEED_MAX]. Non-numbers give the default. */
export function snapSeed(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_SEED;
	return Math.min(SEED_MAX, Math.max(SEED_MIN, Math.round(v)));
}

/** Merges a partial patch into a state, validating every field. */
export function applyPatch(
	state: DataVersioningDemoState,
	patch: Partial<DataVersioningDemoState>,
): DataVersioningDemoState {
	return {
		code: isCodeId(patch.code) ? patch.code : state.code,
		data: isDataId(patch.data) ? patch.data : state.data,
		seed: patch.seed === undefined ? state.seed : snapSeed(patch.seed),
		dirty: typeof patch.dirty === 'boolean' ? patch.dirty : state.dirty,
	};
}

/** FNV-1a 32-bit hash of a string, as 8 lowercase hex digits. */
export function fnv1a(text: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, '0');
}

export function codeCommit(id: CodeId): CodeCommit {
	return CODE_COMMITS.find((c) => c.id === id) ?? CODE_COMMITS[0]!;
}

export function dataCommit(id: DataId): DataCommit {
	return DATA_COMMITS.find((d) => d.id === id) ?? DATA_COMMITS[0]!;
}

/** Canonical text of a code commit: the inputs that the hash covers. */
export function codeSource(c: CodeCommit): string {
	return `k=${c.k};scale=${c.scale ? 'zscore' : 'none'};split=seed`;
}

export function codeHash(c: CodeCommit): string {
	return fnv1a(codeSource(c));
}

/** Gaussian N(0, 1) via Box-Muller on the given generator. */
function gauss(rand: () => number): number {
	const u = Math.max(rand(), 1e-12);
	const v = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function flip(label: 0 | 1): 0 | 1 {
	return label === 1 ? 0 : 1;
}

function makeSample(rand: () => number, label: 0 | 1): Sample {
	const f1 = (label === 1 ? 0.8 : -0.8) + 0.6 * gauss(rand);
	const f2 = 50 * gauss(rand);
	return { f1, f2, label };
}

/** Rows with correct labels: alternating classes, fixed seed. */
export function cleanBase(): Sample[] {
	const rand = mulberry32(DATA_SEED);
	return Array.from({ length: BASE_SIZE }, (_, i) => makeSample(rand, (i % 2) as 0 | 1));
}

/** Rows of d0: the clean base with wrong labels at NOISE_IDX. */
function noisyBase(): Sample[] {
	return cleanBase().map((s, i) => (NOISE_IDX.includes(i) ? { ...s, label: flip(s.label) } : s));
}

/** Batch appended by d2: its own seed, correct labels. */
export function batchSamples(): Sample[] {
	const rand = mulberry32(DATA_SEED + 1);
	return Array.from({ length: BATCH_SIZE }, (_, i) => makeSample(rand, (i % 2) as 0 | 1));
}

/** Committed content of a data version. */
export function datasetAt(id: DataId): Sample[] {
	const base = id === 'd0' ? noisyBase() : cleanBase();
	return id === 'd2' ? [...base, ...batchSamples()] : base;
}

/** Working copy: the committed rows, with the unversioned edit applied when `dirty`. */
export function workingDataset(id: DataId, dirty: boolean): Sample[] {
	const rows = datasetAt(id);
	if (!dirty) return rows;
	return rows.map((s, i) => (i === DIRTY_INDEX ? { ...s, label: flip(s.label) } : s));
}

/** Hash of the rows, with coordinates rounded to 4 decimals so the text is canonical. */
export function datasetHash(rows: readonly Sample[]): string {
	return fnv1a(rows.map((s) => `${s.f1.toFixed(4)},${s.f2.toFixed(4)},${s.label}`).join(';'));
}

export function dataHashOf(id: DataId): string {
	return datasetHash(datasetAt(id));
}

export function fingerprint(codeH: string, dataH: string, seed: number): string {
	return fnv1a(`${codeH}|${dataH}|${seed}`);
}

/** Train/test split by a seeded shuffle of row indices. Parts are disjoint and cover all rows. */
export function splitIndices(n: number, seed: number): { train: number[]; test: number[] } {
	const rand = mulberry32(seed);
	const idx = Array.from({ length: n }, (_, i) => i);
	for (let i = n - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		const a = idx[i] ?? 0;
		idx[i] = idx[j] ?? 0;
		idx[j] = a;
	}
	const nTest = Math.round(n * TEST_SHARE);
	return { train: idx.slice(nTest), test: idx.slice(0, nTest) };
}

function pick(rows: readonly Sample[], idx: readonly number[]): Sample[] {
	return idx.map((i) => rows[i]).filter((s): s is Sample => s !== undefined);
}

/** k-nearest-neighbour vote on (f1, f2). Ties go to the label of the nearest neighbour. */
export function knnPredict(
	train: readonly Sample[],
	q: { f1: number; f2: number },
	k: number,
): 0 | 1 {
	const ranked = train
		.map((s) => ({ d: (s.f1 - q.f1) ** 2 + (s.f2 - q.f2) ** 2, label: s.label }))
		.sort((a, b) => a.d - b.d);
	const top = ranked.slice(0, Math.max(1, Math.min(k, ranked.length)));
	const ones = top.reduce((acc, r) => acc + r.label, 0);
	const zeros = top.length - ones;
	if (ones === zeros) return top[0]?.label ?? 0;
	return ones > zeros ? 1 : 0;
}

export interface ExperimentResult {
	accuracy: number;
	correct: number;
	total: number;
	trainSize: number;
}

/**
 * Runs the experiment: split by seed, optional standardisation fitted on the train part, kNN with the
 * commit's k, accuracy on the test part.
 */
export function runExperiment(
	rows: readonly Sample[],
	code: CodeCommit,
	seed: number,
): ExperimentResult {
	const { train: trainIdx, test: testIdx } = splitIndices(rows.length, seed);
	let train = pick(rows, trainIdx);
	let test = pick(rows, testIdx);

	if (code.scale && train.length > 0) {
		const stats = (key: 'f1' | 'f2') => {
			const mean = train.reduce((acc, s) => acc + s[key], 0) / train.length;
			const variance = train.reduce((acc, s) => acc + (s[key] - mean) ** 2, 0) / train.length;
			return { mean, std: Math.sqrt(variance) || 1 };
		};
		const m1 = stats('f1');
		const m2 = stats('f2');
		const z = (s: Sample): Sample => ({
			f1: (s.f1 - m1.mean) / m1.std,
			f2: (s.f2 - m2.mean) / m2.std,
			label: s.label,
		});
		train = train.map(z);
		test = test.map(z);
	}

	let correct = 0;
	for (const s of test) {
		if (knnPredict(train, s, code.k) === s.label) correct++;
	}
	const total = test.length;
	return {
		accuracy: total === 0 ? 0 : correct / total,
		correct,
		total,
		trainSize: train.length,
	};
}

export interface RunRecord {
	fingerprint: string;
	code: CodeId;
	data: DataId;
	seed: number;
	accuracy: number;
}

/** Journal of recorded runs, computed from the committed versions (no dirty edits). */
export function buildJournal(): RunRecord[] {
	return PINNED_RUNS.map(([code, data, seed]) => {
		const c = codeCommit(code);
		const rows = datasetAt(data);
		return {
			fingerprint: fingerprint(codeHash(c), datasetHash(rows), seed),
			code,
			data,
			seed,
			accuracy: runExperiment(rows, c, seed).accuracy,
		};
	});
}

/** Journal entries are fixed by the pinned runs: computed once per module load. */
export const JOURNAL: readonly RunRecord[] = buildJournal();

export function findRecord(journal: readonly RunRecord[], fp: string): RunRecord | undefined {
	return journal.find((r) => r.fingerprint === fp);
}

export interface VersioningSummary {
	codeHash: string;
	/** Hash of the working copy the experiment reads. */
	dataHash: string;
	/** Hash of the committed data version. */
	committedDataHash: string;
	/** False when the working copy differs from the commit. */
	dataMatchesCommit: boolean;
	fingerprint: string;
	result: ExperimentResult;
	record: RunRecord | undefined;
	/** True when the fingerprint is in the journal and the recorded accuracy equals the fresh run. */
	reproducible: boolean;
}

/** Everything the panel shows for a state. Journal is a parameter so tests can pass their own. */
export function summarize(
	state: DataVersioningDemoState,
	journal: readonly RunRecord[] = JOURNAL,
): VersioningSummary {
	const c = codeCommit(state.code);
	const rows = workingDataset(state.data, state.dirty);
	const cH = codeHash(c);
	const dH = datasetHash(rows);
	const committedDataHash = dataHashOf(state.data);
	const fp = fingerprint(cH, dH, state.seed);
	const result = runExperiment(rows, c, state.seed);
	const record = findRecord(journal, fp);
	return {
		codeHash: cH,
		dataHash: dH,
		committedDataHash,
		dataMatchesCommit: dH === committedDataHash,
		fingerprint: fp,
		result,
		record,
		reproducible: record !== undefined && record.accuracy === result.accuracy,
	};
}

/** Text for the live region: what the state means for reproducibility. */
export function describeState(state: DataVersioningDemoState, s: VersioningSummary): string {
	const dataPart = s.dataMatchesCommit
		? `Данные совпадают с коммитом ${state.data}.`
		: `Рабочая копия отличается от коммита ${state.data}: хеш данных ${s.dataHash} вместо ${s.committedDataHash}.`;
	const runPart = s.reproducible
		? `Отпечаток ${s.fingerprint} есть в журнале, точность ${s.result.accuracy.toFixed(2)} совпадает: эксперимент воспроизводим.`
		: `Отпечаток ${s.fingerprint} не найден в журнале: по коммитам этот запуск не воспроизвести.`;
	return `${dataPart} ${runPart}`;
}
