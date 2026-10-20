<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		DEFAULT_CORRECT,
		G,
		advantages,
		barPercent,
		countCorrect,
		describeGroup,
		explainGroup,
		formatAdv,
		formatNum,
		groupStats,
		makeRewards,
		toggleReward,
		type Rewards,
	} from '$lib/demos/rl-reasoning';

	/** GRPO group demo: G answers with 0/1 rewards and their group-normalised advantages. Registers as `rl-reasoning`. */
	let { initial }: { initial?: { correct?: number } } = $props();

	const STEPS = 4;

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let rewards = $state<Rewards>(
		makeRewards(typeof initial?.correct === 'number' ? initial.correct : DEFAULT_CORRECT),
	);
	/** How many calculation steps are revealed (0 to STEPS). */
	let step = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const k = $derived(countCorrect(rewards));
	const adv = $derived(advantages(rewards));
	/** Answers with their advantages, index-safe for the template. */
	const cells = $derived(rewards.map((r, i) => ({ r, a: adv[i] ?? 0 })));
	const stats = $derived(groupStats(rewards));
	const degenerate = $derived(k === 0 || k === G);
	const note = $derived(explainGroup(rewards));
	const live = $derived(describeGroup(rewards));

	/** Calculation lines; line i is shown as done when i < step. */
	const lines = $derived([
		{
			title: 'Среднее',
			text: `p = k / G = ${k} / ${G} = ${formatNum(stats.p, 2)}`,
		},
		{
			title: 'Разброс',
			text: degenerate
				? 'std = 0: все награды одинаковы'
				: `std = √(p(1 − p)) = ${formatNum(stats.std, 3)}`,
		},
		{
			title: 'Преимущества',
			text: degenerate
				? 'каждое равно 0'
				: `верный: (1 − p) / std = ${formatNum(stats.posAdv, 2)}; неверный: −p / std = ${formatNum(stats.negAdv, 2)}`,
		},
		{
			title: 'Сумма',
			text: `сумма всех преимуществ = ${formatAdv(stats.sum)}`,
		},
	]);

	function setCorrect(n: number): void {
		rewards = makeRewards(n);
	}

	function flip(i: number): void {
		rewards = toggleReward(rewards, i);
	}

	function reset(): void {
		rewards = makeRewards(DEFAULT_CORRECT);
		step = 0;
	}

	function nextStep(): void {
		if (step < STEPS) step += 1;
	}

	function apply(patch: { correct?: number }): void {
		if (typeof patch.correct === 'number') setCorrect(patch.correct);
	}

	onMount(() => {
		return demos?.register('rl-reasoning', {
			set: (patch) => apply(patch as { correct?: number }),
		});
	});
</script>

<figure class="rl" id="demo-rl-reasoning" data-demo="rl-reasoning">
	<div class="rl-controls">
		<label class="rl-ctl">
			<span class="rl-label">Верных ответов <span class="rl-sym">k</span></span>
			<input
				class="rl-range"
				type="range"
				min="0"
				max={G}
				step="1"
				value={k}
				aria-valuetext="{k} из {G} верных"
				oninput={(e) => setCorrect(Number(e.currentTarget.value))}
			/>
			<output class="rl-val">{k} из {G}</output>
		</label>
		<button class="rl-btn" type="button" onclick={reset}>Сбросить</button>
	</div>
	<p class="rl-hint">
		Нажмите на ответ, чтобы сделать его верным или неверным. Ползунок задаёт число верных: первые k
		ответов становятся верными.
	</p>

	<div class="rl-chart" role="group" aria-label="Ответы группы и их преимущества">
		{#each cells as { r, a }, i (i)}
			<div class="rl-col">
				<div class="rl-track" aria-hidden="true">
					<div class="rl-half rl-up">
						{#if a > 0}
							<span class="rl-bar rl-bar-pos" style="height: {barPercent(a)}%"></span>
						{/if}
					</div>
					<div class="rl-half rl-down">
						{#if a < 0}
							<span class="rl-bar rl-bar-neg" style="height: {barPercent(a)}%"></span>
						{/if}
					</div>
					<span class="rl-zero"></span>
				</div>
				<span class="rl-num" class:is-pos={a > 0} class:is-neg={a < 0} aria-hidden="true"
					>{formatAdv(a)}</span
				>
				<button
					class="rl-ans"
					type="button"
					aria-pressed={r === 1}
					aria-label="Ответ {i + 1}, {r === 1 ? 'верный' : 'неверный'}, преимущество {formatAdv(a)}"
					onclick={() => flip(i)}
				>
					<span class="rl-ans-n">{i + 1}</span>
					<span class="rl-ans-v">{r === 1 ? 'верный' : 'неверный'}</span>
				</button>
			</div>
		{/each}
	</div>

	<p class="rl-note">
		<span class="rl-note-t">Причина и следствие.</span>
		{note}
	</p>

	<dl class="rl-stats">
		<dt>Среднее p</dt>
		<dd>{formatNum(stats.p, 2)}</dd>
		<dt>std = √(p(1 − p))</dt>
		<dd>{formatNum(stats.std, 3)}</dd>
		<dt>Преимущество верного</dt>
		<dd class="rl-pos">{formatAdv(stats.posAdv)}</dd>
		<dt>Преимущество неверного</dt>
		<dd class="rl-neg">{formatAdv(stats.negAdv)}</dd>
		<dt>Сумма преимуществ</dt>
		<dd>{formatAdv(stats.sum)}</dd>
	</dl>

	<section class="rl-steps" aria-label="Шаги расчёта">
		<h4 class="rl-steps-t">Шаги расчёта</h4>
		<ol class="rl-steps-list">
			{#each lines as line, i (i)}
				<li class="rl-step" class:is-done={i < step} aria-current={i === step ? 'step' : undefined}>
					<span class="rl-step-title">{line.title}:</span>
					<span class="rl-step-text">{line.text}</span>
				</li>
			{/each}
		</ol>
		<button class="rl-btn" type="button" onclick={nextStep} disabled={step >= STEPS}>
			{step >= STEPS ? 'Все шаги показаны' : `Показать шаг ${step + 1} из ${STEPS}`}
		</button>
	</section>

	<p class="rl-live" aria-live="polite">{live}</p>
</figure>

<style>
	.rl {
		margin: 0;
		padding: var(--space-6) var(--space-8) var(--space-8);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		line-height: 1.5;
		text-align: left;
		letter-spacing: normal;
		text-transform: none;
	}
	.rl :global(*),
	.rl :global(*::before),
	.rl :global(*::after) {
		box-sizing: border-box;
	}
	.rl p,
	.rl dl,
	.rl dd,
	.rl dt,
	.rl ol,
	.rl h4 {
		margin: 0;
	}
	.rl button {
		font: inherit;
	}
	.rl-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}
	.rl-note-t {
		font-weight: 600;
		color: var(--text);
	}

	/* Controls */
	.rl-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.rl-ctl {
		display: flex;
		flex: 1 1 260px;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
	}
	.rl-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.rl-range {
		flex: 1 1 140px;
		min-width: 0;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.rl-val {
		min-width: 6ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.rl-btn {
		height: 36px;
		padding: 0 var(--space-4);
		border: 1px solid var(--border-control);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.rl-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.rl-range:focus-visible,
	.rl-btn:focus-visible,
	.rl-ans:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.rl-hint {
		margin-top: var(--space-3);
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}

	/* Chart: one column per answer */
	.rl-chart {
		display: grid;
		grid-template-columns: repeat(8, minmax(0, 1fr));
		gap: var(--space-2);
		margin-top: var(--space-6);
	}
	.rl-col {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: var(--space-2);
		min-width: 0;
	}
	.rl-track {
		position: relative;
		height: 160px;
	}
	.rl-half {
		position: absolute;
		left: 0;
		right: 0;
		height: 50%;
	}
	.rl-up {
		top: 0;
		display: flex;
		align-items: flex-end;
	}
	.rl-down {
		bottom: 0;
		display: flex;
		align-items: flex-start;
	}
	.rl-bar {
		display: block;
		width: 100%;
		border-radius: 3px;
		transition: height var(--dur) var(--ease);
	}
	.rl-bar-pos {
		background: var(--ok);
	}
	.rl-bar-neg {
		background: var(--fail);
	}
	.rl-zero {
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 1px;
		background: var(--text-muted);
		opacity: 0.6;
	}
	.rl-num {
		text-align: center;
		font-family: var(--font-mono);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.rl-num.is-pos {
		color: var(--ok);
	}
	.rl-num.is-neg {
		color: var(--fail);
	}
	.rl-ans {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		min-height: 48px;
		padding: var(--space-1) 2px;
		border: 1px solid var(--border-control);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text-muted);
		font-size: 12px;
		line-height: 1.2;
		cursor: pointer;
		min-width: 0;
	}
	.rl-ans-n {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text);
	}
	.rl-ans[aria-pressed='true'] {
		border-color: var(--ok);
		color: color-mix(in srgb, var(--ok) 80%, #000);
		font-weight: 600;
	}

	/* Cause and effect, stats, steps */
	.rl .rl-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.rl .rl-steps .rl-btn {
		margin-top: var(--space-3);
	}
	.rl-stats {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.rl-stats dt {
		color: var(--text-muted);
	}
	.rl-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.rl-stats .rl-pos {
		color: var(--ok);
	}
	.rl-stats .rl-neg {
		color: var(--fail);
	}
	.rl-steps {
		margin-top: var(--space-6);
	}
	.rl-steps-t {
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: var(--space-2);
	}
	.rl-steps-list {
		display: grid;
		gap: var(--space-1);
		padding: 0;
		list-style: none;
		margin-bottom: var(--space-3);
	}
	.rl-step {
		padding: var(--space-1) var(--space-3);
		border-left: 3px solid var(--border);
		color: var(--text-muted);
		font-size: 13px;
		overflow-wrap: anywhere;
		transition: opacity var(--dur) var(--ease);
	}
	.rl-step.is-done {
		color: var(--text);
		border-left-color: var(--topic);
	}
	.rl-step-title {
		font-weight: 600;
		margin-right: var(--space-1);
	}
	.rl-step[aria-current='step'] {
		border-left-color: var(--topic);
	}
	.rl-live {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (prefers-reduced-motion: reduce) {
		.rl *,
		.rl *::before,
		.rl *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.rl {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.rl-chart {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: var(--space-3) var(--space-2);
		}
		.rl-ctl {
			flex-basis: 100%;
		}
	}
</style>
