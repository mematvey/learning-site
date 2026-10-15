<script lang="ts">
	import type { LabResultPanelProps } from '$lib/contracts/component-props';
	import type { Series, TestResult } from '$lib/contracts';
	import {
		countTests,
		firstFailedIndex,
		formatNumber,
		formatSeconds,
		summaryText,
	} from './lab/format';
	import SeriesChart from './lab/SeriesChart.svelte';

	/** Panels for a LabResult: summary, tests, diff, chart. */
	let { result, visualizers = [] }: LabResultPanelProps = $props();

	const counts = $derived(countTests(result.tests));
	const failIdx = $derived(firstFailedIndex(result.tests));
	const allOk = $derived(result.status === 'pass');

	const json = (v: unknown) => (v === undefined ? '—' : JSON.stringify(v));

	/** Curves bound by the lab: `curve` visualizers over `series.<name>` or all series. */
	const curves = $derived.by((): Array<{ title: string; series: Series[] }> => {
		const all = result.series ?? {};
		const out: Array<{ title: string; series: Series[] }> = [];
		for (const v of visualizers) {
			if (v.type !== 'curve' || !v.source.startsWith('series')) continue;
			const key = v.source.split('.')[1];
			const picked = key ? (all[key] ? [all[key]] : []) : Object.values(all);
			if (picked.length > 0) out.push({ title: key ?? 'Кривые', series: picked });
		}
		return out;
	});

	function testCellsRows(t: TestResult) {
		return t.diff?.cells ?? [];
	}
</script>

<section class="panel" aria-label="Результат лаба">
	{#if result.error}
		<p class="banner" role="alert">
			<b>{result.error.type}</b>: {result.error.message}
			{#if result.error.line}<span class="loc">строка {result.error.line}</span>{/if}
		</p>
	{/if}

	<div class="head">
		<span class="summary" class:is-ok={allOk} class:is-fail={!allOk}>
			<i aria-hidden="true"></i>
			{allOk ? 'Все тесты зелёные' : summaryText(counts.passed, counts.total)}
		</span>
		<span class="time">{formatSeconds(result.duration_ms)}</span>
	</div>

	{#if result.tests.length > 0}
		<ul class="tests">
			{#each result.tests as t, i (i)}
				{@const failed = t.status === 'fail' || t.status === 'error'}
				<li class="test" class:is-fail={failed}>
					<details open={i === failIdx}>
						<summary>
							<span class="mark" aria-hidden="true"
								>{failed ? '✕' : t.status === 'skipped' ? '–' : '✓'}</span
							>
							<code>{t.name}</code>
							<span class="desc"
								>{t.hidden ? 'скрытый тест' : t.status === 'pass' ? 'пройден' : t.status}</span
							>
						</summary>
						{#if failed}
							<div class="detail">
								{#if t.message}<p class="msg">{t.message}</p>{/if}
								{#if t.location}<p class="loc">{t.location.file}:{t.location.line}</p>{/if}
								{#if t.diff?.kind === 'array' && testCellsRows(t).length > 0}
									<table class="cmp">
										<thead>
											<tr><th>позиция</th><th>ожидалось</th><th>получено</th><th>разница</th></tr>
										</thead>
										<tbody>
											{#each testCellsRows(t) as c, ci (ci)}
												<tr>
													<td>[{c.index.join(', ')}]</td>
													<td>{formatNumber(c.expected)}</td>
													<td class="bad">{formatNumber(c.actual)}</td>
													<td class="bad">{Math.abs(c.expected - c.actual).toFixed(3)}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								{:else if t.expected !== undefined || t.actual !== undefined}
									<table class="cmp">
										<thead>
											<tr><th>ожидалось</th><th>получено</th></tr>
										</thead>
										<tbody>
											<tr><td>{json(t.expected)}</td><td class="bad">{json(t.actual)}</td></tr>
										</tbody>
									</table>
								{/if}
								{#if t.diff?.summary}<p class="msg">{t.diff.summary}</p>{/if}
							</div>
						{/if}
					</details>
				</li>
			{/each}
		</ul>
	{/if}

	{#each curves as c, ci (ci)}
		<div class="chart">
			<SeriesChart title={c.title} series={c.series} />
		</div>
	{/each}
</section>

<style>
	.panel {
		font: 14px/1.5 var(--font-sans);
		color: var(--text);
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}
	.summary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
		font-size: 15px;
	}
	.summary i {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: currentColor;
	}
	.summary.is-ok {
		color: var(--ok);
	}
	.summary.is-fail {
		color: var(--fail);
	}
	.time {
		font: 12.5px var(--font-mono);
		color: var(--text-muted);
	}
	.banner {
		margin: 0 0 12px;
		padding: 10px 12px;
		border-left: 3px solid var(--fail);
		background: color-mix(in srgb, var(--fail) 8%, transparent);
		border-radius: var(--radius-sm);
	}
	.tests {
		margin: 0;
		padding: 0;
		list-style: none;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.test + .test {
		border-top: 1px solid var(--border);
	}
	summary {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 12px;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	code {
		font: 13px var(--font-mono);
		background: transparent;
		padding: 0;
	}
	.mark {
		flex: none;
		width: 18px;
		height: 18px;
		display: inline-grid;
		place-items: center;
		border-radius: 50%;
		font: 700 11px/1 var(--font-sans);
		color: var(--surface);
		background: var(--ok);
	}
	.test.is-fail .mark {
		background: var(--fail);
	}
	.desc {
		margin-left: auto;
		font-size: 13px;
		color: var(--text-muted);
		text-align: right;
	}
	.detail {
		padding: 2px 12px 14px 40px;
		font-size: 13.5px;
	}
	.msg {
		margin: 0 0 6px;
	}
	.loc {
		margin: 0 0 10px;
		font: 12.5px var(--font-mono);
		color: var(--text-muted);
	}
	.cmp {
		border-collapse: collapse;
		font: 12.5px var(--font-mono);
		color: var(--text);
	}
	.cmp th {
		padding: 4px 12px 4px 0;
		text-align: left;
		font: 500 12px var(--font-sans);
		color: var(--text-muted);
	}
	.cmp td {
		padding: 4px 12px 4px 0;
		border-top: 1px solid var(--border);
		text-align: right;
	}
	.cmp td:first-child {
		text-align: left;
	}
	.cmp .bad {
		color: var(--fail);
		font-weight: 600;
	}
	.chart {
		margin-top: 16px;
	}
	@media (max-width: 560px) {
		.desc {
			display: none;
		}
		.detail {
			padding-left: 12px;
		}
	}
</style>
