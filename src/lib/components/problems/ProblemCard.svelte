<script lang="ts">
	import { getContext, onMount, type Snippet } from 'svelte';
	import { CHAPTER_CONTEXT, type ChapterContext } from '$lib/contracts/context';
	import { FALLBACK_LEVELS, useLevels } from '$lib/levels';
	import type { ProblemDef, ProblemParams, Rational } from '$lib/prob/types';
	import Experiment from './Experiment.svelte';
	import ParamPanel from './ParamPanel.svelte';
	import Spoilers from './Spoilers.svelte';
	import { getProblems, markProblem } from './progress';

	/**
	 * One interactive problem: condition, parameters, exact answers, optional visualization,
	 * Monte-Carlo experiment, worked solution, and a «Решил» mark stored in progress.
	 */
	let {
		problem,
		viz,
	}: {
		problem: ProblemDef;
		viz?: Snippet<[ProblemParams]>;
	} = $props();

	const chapter = getContext<ChapterContext | undefined>(CHAPTER_CONTEXT);
	const levels = useLevels();
	const depth = $derived((levels?.applied ?? FALLBACK_LEVELS).d);
	const number = $derived(problem.id.replace(/^p/, ''));

	// The props only seed the parameters: the card owns them afterwards.
	/* svelte-ignore state_referenced_locally */
	let params: ProblemParams = $state({ ...problem.defaults });
	/* svelte-ignore state_referenced_locally */
	let lastValid: ProblemParams = $state({ ...problem.defaults });
	let solved = $state(false);

	/** Range problems from the panel first; the problem's own `validate` runs only inside the range. */
	const rangeIssues = $derived(
		problem.params.flatMap((spec) => {
			const v = params[spec.key] ?? Number.NaN;
			return v < spec.min || v > spec.max
				? [`${spec.label}: допустимо от ${spec.min} до ${spec.max}`]
				: [];
		}),
	);
	const issues = $derived(rangeIssues.length ? rangeIssues : problem.validate(params));
	const valid = $derived(issues.length === 0);

	$effect(() => {
		if (valid) lastValid = { ...params };
	});

	/** Parameters that every derived text and function uses: the last valid set while the input is invalid. */
	const safe = $derived<ProblemParams>(valid ? params : lastValid);
	const condition = $derived(problem.condition(safe));
	const exact = $derived<Record<string, Rational>>(valid ? problem.exact(params) : {});
	const paramsKey = $derived(JSON.stringify(params));

	onMount(() => {
		const id = chapter?.id;
		if (!id) return;
		// Progress is optional: without a store the card still works.
		getProblems(id)
			.then((map) => {
				solved = Boolean(map[problem.id]?.solved);
			})
			.catch(() => undefined);
	});

	function onChange(key: string, value: number): void {
		params[key] = value;
	}

	function reset(): void {
		params = { ...problem.defaults };
	}

	function toggleSolved(): void {
		const id = chapter?.id;
		const next = !solved;
		solved = next;
		if (!id) return;
		markProblem(id, problem.id, { solved: next }).catch(() => {
			solved = !next;
		});
	}

	function onReveal(): void {
		const id = chapter?.id;
		if (!id) return;
		markProblem(id, problem.id, { revealed: true }).catch(() => undefined);
	}
</script>

<section class="pc" id={problem.id} data-problem={problem.id} aria-labelledby="{problem.id}-title">
	<header class="pc-head">
		<div class="pc-titles">
			<p class="pc-kicker">Задача {number}</p>
			<h3 class="pc-title" id="{problem.id}-title">{problem.title}</h3>
		</div>
		<button
			type="button"
			class="pc-solved"
			aria-pressed={solved}
			data-solved={solved || undefined}
			onclick={toggleSolved}
		>
			Решил ✓
		</button>
	</header>

	<div class="pc-condition" data-block id="{problem.id}-condition">
		<p>{condition}</p>
	</div>

	<ParamPanel
		idPrefix={problem.id}
		specs={problem.params}
		{params}
		{issues}
		{onChange}
		onReset={reset}
	/>

	<Spoilers {problem} params={safe} {exact} {valid} {depth} {onReveal}>
		{#snippet extra()}
			{#if viz}
				<div class="pc-viz">{@render viz(safe)}</div>
			{/if}
			<Experiment {problem} params={safe} {exact} {valid} {paramsKey} />
		{/snippet}
	</Spoilers>
</section>

<style>
	.pc {
		display: grid;
		gap: var(--space-4);
		padding: var(--space-6);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		scroll-margin-top: 96px;
		min-width: 0;
	}
	.pc-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.pc-kicker {
		margin: 0;
		font-size: var(--fs-sm);
		font-weight: 600;
		color: var(--topic);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.pc-title {
		margin: var(--space-1) 0 0;
		font-family: var(--font-serif);
		font-size: var(--fs-h3);
		font-weight: 600;
		line-height: 1.2;
		color: var(--text);
	}
	.pc-solved {
		font: inherit;
		font-size: var(--fs-sm);
		font-weight: 600;
		color: var(--topic);
		background: var(--topic-soft);
		border: 1px solid var(--topic);
		border-radius: var(--radius);
		padding: var(--space-1) var(--space-3);
		cursor: pointer;
	}
	.pc-solved[aria-pressed='true'] {
		color: var(--surface);
		background: var(--topic);
	}
	.pc-solved:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.pc-condition {
		font-size: var(--fs-base);
		line-height: 1.6;
		color: var(--text);
	}
	.pc-condition p {
		margin: 0;
	}
	.pc-viz {
		min-width: 0;
		overflow-x: auto;
	}
	@media (max-width: 420px) {
		.pc {
			padding: var(--space-4);
		}
	}
</style>
