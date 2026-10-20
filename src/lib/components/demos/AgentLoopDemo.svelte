<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		BUDGET_MAX,
		BUDGET_MIN,
		BUDGET_STEP,
		DEFAULT_BUDGET,
		DEFAULT_MAX_STEPS,
		MAX_STEPS_MAX,
		MAX_STEPS_MIN,
		describeEvent,
		simulate,
		snapBudget,
		snapMaxSteps,
		type Decision,
		type LoopEvent,
	} from '$lib/demos/agents-runtime';

	/**
	 * Agent loop simulator: model, tool and observation, with a step limit, a token budget
	 * and an optional human confirmation before irreversible actions. Registers as demo `agent-loop`.
	 */
	let { initial }: { initial?: { maxSteps?: number; budget?: number; confirm?: boolean } } =
		$props();

	/** Pause between revealed events in step-by-step mode. */
	const STEP_MS = 900;

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let maxSteps = $state(snapMaxSteps(initial?.maxSteps ?? DEFAULT_MAX_STEPS));
	/* svelte-ignore state_referenced_locally */
	let budget = $state(snapBudget(initial?.budget ?? DEFAULT_BUDGET));
	/* svelte-ignore state_referenced_locally */
	let confirm = $state(initial?.confirm === true);
	let decision = $state<Decision>('none');
	/** Number of events on screen; null means the whole run is shown. */
	let revealed = $state<number | null>(null);
	let playing = $state(false);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const trace = $derived(simulate({ maxSteps, budget, confirm, decision }));
	const total = $derived(trace.events.length);
	const shownCount = $derived(revealed === null ? total : Math.min(revealed, total));
	const visible = $derived(trace.events.slice(0, shownCount));
	const last = $derived<LoopEvent | undefined>(visible[visible.length - 1]);
	const finished = $derived(shownCount >= total);
	const pending = $derived(last?.kind === 'approval');
	const stepsShown = $derived(visible.filter((e) => e.kind === 'model').length);
	const usedShown = $derived.by(() => {
		let u = 0;
		for (const e of visible) if (e.kind === 'model') u = e.used;
		return u;
	});
	const overBudget = $derived(usedShown > budget);
	const meterWidth = $derived(Math.min(100, (usedShown / budget) * 100));
	const statusText = $derived(
		last ? describeEvent(last) : 'Цикл ещё не запущен. Нажмите «Пошагово» или «Показать всё».',
	);
	const litModel = $derived(last?.kind === 'model' || last?.kind === 'answer');
	const litTool = $derived(last?.kind === 'tool');
	const litHuman = $derived(last?.kind === 'approval');

	/** Show the whole run and stop any stepping. */
	function resetView(): void {
		revealed = null;
		playing = false;
	}

	function setMaxSteps(v: number): void {
		maxSteps = snapMaxSteps(v);
		resetView();
	}

	function setBudget(v: number): void {
		budget = snapBudget(v);
		resetView();
	}

	function setConfirm(v: boolean): void {
		confirm = v;
		decision = 'none';
		resetView();
	}

	function decide(d: Exclude<Decision, 'none'>): void {
		decision = d;
		resetView();
	}

	function reset(): void {
		maxSteps = DEFAULT_MAX_STEPS;
		budget = DEFAULT_BUDGET;
		confirm = false;
		decision = 'none';
		resetView();
	}

	function reduceMotion(): boolean {
		return (
			typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
		);
	}

	/** Starts or pauses step-by-step reveal. With reduced motion the whole run is shown at once. */
	function play(): void {
		if (playing) {
			playing = false;
			return;
		}
		if (reduceMotion()) {
			resetView();
			return;
		}
		revealed = finished ? 0 : (revealed ?? 0);
		playing = true;
	}

	function next(): void {
		playing = false;
		revealed = Math.min(total, shownCount + 1);
	}

	function apply(patch: Record<string, unknown>): void {
		if (typeof patch.maxSteps === 'number') maxSteps = snapMaxSteps(patch.maxSteps);
		if (typeof patch.budget === 'number') budget = snapBudget(patch.budget);
		if (typeof patch.confirm === 'boolean') confirm = patch.confirm;
		decision = 'none';
		resetView();
	}

	$effect(() => {
		if (!playing) return;
		const id = setInterval(() => {
			const n = Math.min(total, shownCount + 1);
			revealed = n;
			if (n >= total || trace.events[n - 1]?.kind === 'approval') playing = false;
		}, STEP_MS);
		return () => clearInterval(id);
	});

	onMount(() => {
		return demos?.register('agent-loop', {
			set: (patch) => apply(patch as Record<string, unknown>),
		});
	});
</script>

<figure class="al" id="demo-agent-loop" data-demo="agent-loop">
	<div class="al-body">
		<div class="al-stage">
			<div class="al-loop" role="group" aria-label="Цикл агента">
				<div class="al-node" class:is-lit={litModel}>
					<span class="al-node-t">Модель</span>
					<span class="al-node-d">выбирает действие</span>
				</div>
				<span class="al-arrow" aria-hidden="true">→</span>
				<div class="al-node" class:is-lit={litTool}>
					<span class="al-node-t">Инструмент</span>
					<span class="al-node-d">выполняет вызов</span>
				</div>
				<span class="al-arrow" aria-hidden="true">→</span>
				<div class="al-node" class:is-lit={litTool}>
					<span class="al-node-t">Наблюдение</span>
					<span class="al-node-d">попадает в контекст</span>
				</div>
			</div>

			{#if confirm}
				<p class="al-human" class:is-lit={litHuman}>
					Человек: решает, выполнить ли необратимое действие refund
				</p>
			{/if}

			<dl class="al-stats">
				<dt>Шаг</dt>
				<dd>{stepsShown} из {maxSteps}</dd>
				<dt>Токены</dt>
				<dd class:is-over={overBudget}>{usedShown} из {budget}</dd>
			</dl>
			<div class="al-meter" aria-hidden="true">
				<span class="al-meter-fill" class:is-over={overBudget} style:width="{meterWidth}%"></span>
			</div>

			<p class="al-status" aria-live="polite" class:is-stop={last?.kind === 'stop'}>
				{statusText}
			</p>

			{#if pending}
				<div class="al-decision" role="group" aria-label="Решение человека">
					<button type="button" class="al-btn al-btn-primary" onclick={() => decide('approve')}
						>Разрешить</button
					>
					<button type="button" class="al-btn" onclick={() => decide('reject')}>Отклонить</button>
				</div>
			{/if}
		</div>

		<div class="al-side">
			<label class="al-ctl">
				<span class="al-label">Лимит шагов</span>
				<input
					class="al-range"
					type="range"
					min={MAX_STEPS_MIN}
					max={MAX_STEPS_MAX}
					step="1"
					value={maxSteps}
					oninput={(e) => setMaxSteps(Number(e.currentTarget.value))}
				/>
				<output class="al-val">{maxSteps}</output>
			</label>

			<label class="al-ctl">
				<span class="al-label">Бюджет, токенов</span>
				<input
					class="al-range"
					type="range"
					min={BUDGET_MIN}
					max={BUDGET_MAX}
					step={BUDGET_STEP}
					value={budget}
					oninput={(e) => setBudget(Number(e.currentTarget.value))}
				/>
				<output class="al-val">{budget}</output>
			</label>

			<label class="al-check">
				<input
					type="checkbox"
					checked={confirm}
					onchange={(e) => setConfirm(e.currentTarget.checked)}
				/>
				<span>Подтверждение человеком перед необратимым действием</span>
			</label>

			<div class="al-actions">
				<button type="button" class="al-btn al-btn-primary" onclick={play}>
					{playing ? 'Пауза' : 'Пошагово'}
				</button>
				<button
					type="button"
					class="al-btn"
					onclick={next}
					disabled={revealed === null || finished}
				>
					Дальше
				</button>
				<button type="button" class="al-btn" onclick={resetView} disabled={revealed === null}>
					Показать всё
				</button>
				<button type="button" class="al-btn" onclick={reset}>Сбросить</button>
			</div>
		</div>
	</div>

	<ol class="al-log" aria-label="Журнал шагов">
		{#each visible as ev, i (i)}
			<li class="al-log-i" class:is-stop={ev.kind === 'stop'}>{describeEvent(ev)}</li>
		{:else}
			<li class="al-log-empty">Журнал пуст.</li>
		{/each}
	</ol>
</figure>

<style>
	.al {
		margin: 0;
		padding: var(--space-6);
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
		min-width: 0;
		max-width: 100%;
		overflow-wrap: anywhere;
	}
	.al :global(*),
	.al :global(*::before),
	.al :global(*::after) {
		box-sizing: border-box;
	}
	.al dl,
	.al dd,
	.al dt,
	.al p,
	.al ol {
		margin: 0;
	}
	.al button {
		font: inherit;
	}

	.al-body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-6);
	}
	.al-stage,
	.al-side {
		min-width: 0;
	}
	@media (max-width: 480px) {
		.al-loop {
			flex-direction: column;
		}
		.al-arrow {
			align-self: center;
			transform: rotate(90deg);
		}
	}

	@media (min-width: 640px) {
		.al-body {
			grid-template-columns: minmax(0, 1fr) 240px;
			align-items: start;
		}
	}

	/* Loop row: model -> tool -> observation */
	.al-loop {
		display: flex;
		align-items: stretch;
		gap: var(--space-2);
	}
	.al-node {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		transition:
			background var(--dur) var(--ease),
			border-color var(--dur) var(--ease);
	}
	.al-node.is-lit {
		background: var(--topic-soft);
		border-color: var(--topic);
	}
	.al-node-t {
		font-weight: 600;
		font-size: 13px;
		overflow-wrap: normal;
		word-break: keep-all;
	}
	.al-node-d {
		color: var(--text-muted);
		font-size: 12px;
	}
	.al-arrow {
		flex: 0 0 auto;
		align-self: center;
		color: var(--text-muted);
	}

	.al-human {
		margin-top: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border: 1px dashed var(--border);
		border-radius: var(--radius);
		color: var(--text-muted);
		font-size: 13px;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.al-human.is-lit {
		background: var(--warn-bg);
		border-color: var(--warn);
		color: var(--text);
	}

	/* Stats and meter */
	.al-stats {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-4);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.al-stats dt {
		color: var(--text-muted);
		font-family: var(--font-sans);
	}
	.al-stats dd.is-over {
		color: var(--fail);
		font-weight: 600;
	}
	.al-meter {
		height: 8px;
		margin-top: var(--space-2);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 999px;
		overflow: hidden;
	}
	.al-meter-fill {
		display: block;
		height: 100%;
		background: var(--topic);
		transition: width var(--dur) var(--ease);
	}
	.al-meter-fill.is-over {
		background: var(--fail);
	}

	.al-status {
		margin-top: var(--space-4);
		padding: var(--space-3);
		border-left: 3px solid var(--topic);
		background: var(--topic-soft);
		border-radius: var(--radius-sm);
		font-size: 14px;
	}
	.al-status.is-stop {
		border-left-color: var(--warn);
		background: var(--warn-bg);
	}

	.al-decision {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}

	/* Side controls */
	.al-ctl {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-1) var(--space-3);
	}
	.al-ctl + .al-ctl {
		margin-top: var(--space-4);
	}
	.al-label {
		color: var(--text-muted);
	}
	.al-range {
		grid-column: 1 / -1;
		width: 100%;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.al-val {
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.al-check {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		margin-top: var(--space-4);
		color: var(--text);
		cursor: pointer;
	}
	.al-check input {
		margin-top: 4px;
		accent-color: var(--topic);
	}

	.al-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}
	.al-btn {
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: background var(--dur) var(--ease);
	}
	.al-btn:hover:not(:disabled) {
		border-color: var(--topic);
	}
	.al-btn-primary {
		background: var(--topic);
		border-color: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.al-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.al-btn:focus-visible,
	.al-range:focus-visible,
	.al-check input:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Log */
	.al-log {
		margin-top: var(--space-6);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
		list-style: none;
		display: grid;
		gap: var(--space-2);
		color: var(--text-muted);
		font-size: 13px;
	}
	.al-log-i {
		padding-left: var(--space-3);
		border-left: 2px solid var(--border);
	}
	.al-log-i.is-stop {
		color: var(--text);
		border-left-color: var(--warn);
	}
	.al-log-empty {
		color: var(--text-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.al *,
		.al *::before,
		.al *::after {
			transition: none !important;
		}
	}
</style>
