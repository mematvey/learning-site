/**
 * Math of the trace waterfall demo: one request as a tree of spans on a common time axis.
 * The trace is MODEL data: the durations are chosen to illustrate the chapter's example,
 * they are not measured in a real system.
 * Pure functions only: no DOM, no Svelte.
 */

/** Base durations in seconds, as in the chapter's numeric example (sum of the sequential steps = 9.40 s). */
export const SEARCH_SEC = 0.35;
/** Second search, used only in the parallel mode. */
export const SEARCH_B_SEC = 0.3;
export const RERANK_SEC = 0.2;
export const LLM_SEC = 8.4;
export const CHECK_SEC = 0.45;
/** Speed-up factor for the search steps in the "fast search" switch. */
export const SPEEDUP = 2;

export interface TraceDemoState {
	/** Parallel mode: two searches start at the same time. */
	parallel: boolean;
	/** Search steps are SPEEDUP times faster. */
	fastSearch: boolean;
}

export type SpanKind = 'root' | 'search' | 'rerank' | 'llm' | 'check';

export interface Span {
	id: string;
	kind: SpanKind;
	/** Parent span id; null for the root. */
	parent: string | null;
	/** Seconds from the start of the request. */
	start: number;
	end: number;
}

export const ROOT_ID = 'answer';

export function isTraceDemoState(v: unknown): v is TraceDemoState {
	if (typeof v !== 'object' || v === null) return false;
	const s = v as Record<string, unknown>;
	return typeof s.parallel === 'boolean' && typeof s.fastSearch === 'boolean';
}

/** Rounds away floating-point noise (1e-6 s resolution). */
function round(v: number): number {
	return Math.round(v * 1e6) / 1e6;
}

/**
 * Builds the spans of one request. Sequential: search, rerank, llm and check follow each other.
 * Parallel: two searches start together, rerank waits for the longer one.
 * The root span `answer` covers the whole request.
 */
export function buildTrace(state: TraceDemoState): Span[] {
	const k = state.fastSearch ? 1 / SPEEDUP : 1;
	const searchA = round(SEARCH_SEC * k);
	const searchB = round(SEARCH_B_SEC * k);
	const spans: Span[] = [];

	spans.push({ id: 'retrieve', kind: 'search', parent: ROOT_ID, start: 0, end: searchA });
	let afterSearch = searchA;
	if (state.parallel) {
		spans.push({ id: 'retrieve-b', kind: 'search', parent: ROOT_ID, start: 0, end: searchB });
		afterSearch = Math.max(searchA, searchB);
	}

	const rerankEnd = round(afterSearch + RERANK_SEC);
	spans.push({ id: 'rerank', kind: 'rerank', parent: ROOT_ID, start: afterSearch, end: rerankEnd });
	const llmEnd = round(rerankEnd + LLM_SEC);
	spans.push({ id: 'llm', kind: 'llm', parent: ROOT_ID, start: rerankEnd, end: llmEnd });
	const checkEnd = round(llmEnd + CHECK_SEC);
	spans.push({ id: 'check', kind: 'check', parent: ROOT_ID, start: llmEnd, end: checkEnd });

	spans.unshift({ id: ROOT_ID, kind: 'root', parent: null, start: 0, end: checkEnd });
	return spans;
}

export function rootSpan(spans: readonly Span[]): Span {
	const root = spans.find((s) => s.parent === null);
	if (!root) throw new Error('trace has no root span');
	return root;
}

export function duration(span: Span): number {
	return round(span.end - span.start);
}

/** Total duration of the request (the root span). */
export function totalSeconds(spans: readonly Span[]): number {
	return duration(rootSpan(spans));
}

/** Sum of the durations of the child spans. Equals the root only when the steps are sequential. */
export function sumChildSeconds(spans: readonly Span[]): number {
	return round(spans.filter((s) => s.parent !== null).reduce((acc, s) => acc + duration(s), 0));
}

/** Share of a span in the request time: duration / root duration. */
export function shareOf(span: Span, spans: readonly Span[]): number {
	const total = totalSeconds(spans);
	return total > 0 ? duration(span) / total : 0;
}

/** Share of the model call (span `llm`). */
export function modelShare(spans: readonly Span[]): number {
	const llm = spans.find((s) => s.id === 'llm');
	if (!llm) throw new Error('trace has no llm span');
	return shareOf(llm, spans);
}

/** The child span with the longest duration: the bottleneck of the request. */
export function bottleneck(spans: readonly Span[]): Span {
	const children = spans.filter((s) => s.parent !== null);
	return children.reduce((best, s) => (duration(s) > duration(best) ? s : best));
}

/**
 * Seconds saved by making the search steps SPEEDUP times faster, for the given mode.
 * Sequential: 9.40 - 9.225 = 0.175 s.
 */
export function speedupSaving(parallel: boolean): number {
	const slow = totalSeconds(buildTrace({ parallel, fastSearch: false }));
	const fast = totalSeconds(buildTrace({ parallel, fastSearch: true }));
	return round(slow - fast);
}

/** Saving as a share of the slow request (0..1). */
export function speedupSavingShare(parallel: boolean): number {
	const slow = totalSeconds(buildTrace({ parallel, fastSearch: false }));
	return slow > 0 ? speedupSaving(parallel) / slow : 0;
}

/** Nearest-rank percentile: r = ceil(p * n / 100), value = r-th smallest. p in (0, 100]. */
export function percentile(values: readonly number[], p: number): number {
	if (values.length === 0) throw new Error('percentile of an empty list');
	const sorted = [...values].sort((a, b) => a - b);
	const n = sorted.length;
	const r = Math.min(n, Math.max(1, Math.ceil((p * n) / 100)));
	const value = sorted[r - 1];
	if (value === undefined) throw new Error('percentile index out of range');
	return value;
}

export function mean(values: readonly number[]): number {
	if (values.length === 0) return 0;
	return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Latency sample of one shift from the chapter: nine requests of 1.0 s and one of 9.0 s. */
export const TAIL_SAMPLE: readonly number[] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 9];

export interface LatencySummary {
	mean: number;
	p50: number;
	p90: number;
	p95: number;
	p99: number;
	max: number;
}

export function summarizeLatency(values: readonly number[]): LatencySummary {
	return {
		mean: mean(values),
		p50: percentile(values, 50),
		p90: percentile(values, 90),
		p95: percentile(values, 95),
		p99: percentile(values, 99),
		max: Math.max(...values),
	};
}

/** Russian decimal comma, fixed digits: fmt(9.4, 2) = "9,40". */
export function fmt(v: number, digits: number): string {
	return v.toFixed(digits).replace('.', ',');
}

/** Text of the live description under the waterfall. Numbers are computed, not typed. */
export function describeTrace(state: TraceDemoState): string {
	const spans = buildTrace(state);
	const total = totalSeconds(spans);
	const sum = sumChildSeconds(spans);
	const model = modelShare(spans);
	const top = bottleneck(spans);
	const head = `Модельная трасса. Корневой спан answer: ${fmt(total, 2)} с. `;
	const tail =
		`Узкое место: ${top.id}, ${fmt(duration(top), 2)} с. ` + `Доля модели: ${fmt(model, 2)}.`;
	if (state.parallel) {
		const shares =
			sum > total ? ' Сумма больше корня: шаги перекрываются, доли не складываются в 100%.' : '';
		return head + `Сумма длительностей шагов ${fmt(sum, 2)} с.` + shares + ' ' + tail;
	}
	return head + `Шаги идут один за другим, сумма ${fmt(sum, 2)} с совпадает с корнем. ` + tail;
}

/** Text describing the speed-up of the search steps. */
export function describeSpeedup(parallel: boolean): string {
	const saving = speedupSaving(parallel);
	const pct = speedupSavingShare(parallel) * 100;
	return (
		`Поиск вдвое быстрее экономит ${fmt(saving, 3)} с, это ${fmt(pct, 1)}% задержки: ` +
		'узкое место остаётся вызовом модели.'
	);
}
