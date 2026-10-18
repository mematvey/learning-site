import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
	AliasesFile,
	Benchmark,
	BlockId,
	ChapterFrontmatter,
	ChapterId,
	ChapterProgress,
	GlossaryFile,
	Lab,
	LabId,
	LabProgress,
	LabResult,
	LabResultSummary,
	Note,
	ProgressExport,
	Topic,
	WorkerRequest,
	WorkerResponse,
	coversAxis,
	formatRange,
	inRange,
	levelsFromUrl,
	levelsToQuery,
	parseRange,
	resolveAlias,
	resolveLevels,
	summarizeResult,
	isLevelVisible,
} from './index';
import chapterYaml from './fixtures/chapter-dl-attention.yaml?raw';
import topicYaml from './fixtures/topic-dl.yaml?raw';
import labYaml from './fixtures/lab-dl-attention-numpy.yaml?raw';
import labResultFail from './fixtures/lab-result-fail.json';
import labResultPass from './fixtures/lab-result-pass.json';
import note from './fixtures/note.json';
import progressChapter from './fixtures/progress-chapter.json';
import progressLab from './fixtures/progress-lab.json';
import benchmark from './fixtures/benchmark.json';

describe('fixtures pass their schemas', () => {
	it('chapter frontmatter', () => {
		expect(ChapterFrontmatter.parse(parse(chapterYaml)).id).toBe('dl/attention');
	});
	it('topic.yaml', () => {
		expect(Topic.parse(parse(topicYaml)).id).toBe('dl');
	});
	it('lab.yaml (defaults applied)', () => {
		expect(Lab.parse(parse(labYaml)).timeout).toBe(10);
	});
	it('LabResult: fail and pass', () => {
		expect(LabResult.parse(labResultFail).status).toBe('fail');
		expect(LabResult.parse(labResultPass).status).toBe('pass');
	});
	it('note, progress, benchmark', () => {
		expect(Note.parse(note).status).toBe('open');
		expect(ChapterProgress.parse(progressChapter).levels).toEqual({ c: 3, d: 2 });
		expect(LabProgress.parse(progressLab).passed).toBe(false);
		expect(Benchmark.parse(benchmark).hardware.gpu).toContain('RTX');
	});
	it('export format and summaries', () => {
		const exported = {
			format: 'learning-site-export',
			schemaVersion: 2,
			exportedAt: '2026-10-16T10:00:00Z',
			chapters: [progressChapter],
			labs: [progressLab],
			notes: [note],
		};
		expect(ProgressExport.parse(exported).notes).toHaveLength(1);
		const summary = summarizeResult(LabResult.parse(labResultFail));
		expect(LabResultSummary.safeParse(summary).success).toBe(true);
	});
	it('glossary and aliases', () => {
		const entry = {
			id: 'attention',
			term: 'внимание',
			term_en: 'attention',
			definition: 'Взвешенная смесь.',
		};
		expect(GlossaryFile.parse([entry])).toHaveLength(1);
		const aliases = AliasesFile.parse({ 'dl/scaled-attention': 'dl/attention' });
		expect(resolveAlias('dl/scaled-attention', aliases)).toBe('dl/attention');
		expect(resolveAlias('dl/other', aliases)).toBe('dl/other');
	});
	it('worker protocol', () => {
		expect(
			WorkerRequest.safeParse({ type: 'init', runtime: 'pyodide', packages: ['numpy'] }).success,
		).toBe(true);
		expect(
			WorkerResponse.safeParse({ type: 'result', requestId: 'r1', result: labResultPass }).success,
		).toBe(true);
	});
});

describe('invalid input is rejected', () => {
	it('ids', () => {
		expect(ChapterId.safeParse('attention').success).toBe(false);
		expect(ChapterId.safeParse('DL/attention').success).toBe(false);
		expect(LabId.safeParse('attention').success).toBe(false);
		expect(BlockId.safeParse('Para_3').success).toBe(false);
	});
	it('frontmatter id not matching topic', () => {
		const bad = { ...parse(chapterYaml), id: 'cs/attention' };
		expect(ChapterFrontmatter.safeParse(bad).success).toBe(false);
	});
	it('lab without starter', () => {
		const bad = { ...parse(labYaml) };
		delete bad.starter;
		expect(Lab.safeParse(bad).success).toBe(false);
	});
	it('LabResult: error status without error, array shape mismatch', () => {
		expect(LabResult.safeParse({ ...labResultFail, status: 'error' }).success).toBe(false);
		const arrays = { weights: { shape: [3, 3], dtype: 'float32', data: [1] } };
		expect(LabResult.safeParse({ ...labResultFail, arrays }).success).toBe(false);
	});
	it('note with bad ULID', () => {
		expect(Note.safeParse({ ...note, id: 'not-a-ulid' }).success).toBe(false);
	});
});

describe('level helpers', () => {
	it('parseRange', () => {
		expect(parseRange('2-4', 'c')).toEqual({ min: 2, max: 4 });
		expect(parseRange('1', 'd')).toEqual({ min: 1, max: 1 });
		expect(parseRange('3-2', 'c')).toBeNull();
		expect(parseRange('0', 'c')).toBeNull();
		expect(parseRange('1-4', 'd')).toBeNull();
		expect(parseRange('x', 'c')).toBeNull();
		expect(formatRange({ min: 2, max: 4 })).toBe('2-4');
		expect(formatRange({ min: 1, max: 1 })).toBe('1');
	});
	it('inRange, isLevelVisible, coversAxis', () => {
		const r = { min: 2, max: 4 };
		expect(inRange(r, 1)).toBe(false);
		expect(inRange(r, 2)).toBe(true);
		expect(inRange(r, 4)).toBe(true);
		expect(isLevelVisible({ c: 3 }, { c: 2, d: 3 })).toBe(false);
		expect(isLevelVisible({ c: 2, d: 2 }, { c: 2, d: 2 })).toBe(true);
		expect(
			coversAxis(
				[
					{ min: 1, max: 1 },
					{ min: 2, max: 4 },
				],
				'c',
			),
		).toBe(true);
		expect(
			coversAxis(
				[
					{ min: 1, max: 2 },
					{ min: 2, max: 4 },
				],
				'c',
			),
		).toBe(false);
		expect(
			coversAxis(
				[
					{ min: 1, max: 2 },
					{ min: 4, max: 4 },
				],
				'c',
			),
		).toBe(false);
	});
	it('URL functions', () => {
		expect(levelsFromUrl('?c=3&d=2')).toEqual({ c: 3, d: 2 });
		expect(levelsFromUrl(new URL('https://x.test/dl/attention/?c=9&d=2'))).toEqual({ d: 2 });
		expect(levelsFromUrl('c=abc')).toEqual({});
		expect(levelsToQuery({ c: 2, d: 1 })).toBe('c=2&d=1');
		expect(resolveLevels({ c: 4 }, { c: 1, d: 3 })).toEqual({ c: 4, d: 3 });
		expect(resolveLevels({}, null)).toEqual({ c: 2, d: 1 });
	});
});
