<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		CAP_HINT,
		CAP_KEYS,
		CAP_LABEL,
		DEFAULT_CAPS,
		ROLE_TEXT,
		type CapKey,
		type Caps,
		allCombinations,
		comboLabel,
		countDangerous,
		describeCaps,
		hasLethalTrifecta,
		outcomeLabel,
		patchCaps,
		rowRole,
		sameCaps,
	} from '$lib/demos/agent-guardrails';

	/**
	 * Agent guardrails demo: three capabilities of an agent and the lethal-trifecta check.
	 * Registers itself as demo `agent-guardrails`.
	 */
	let { initial }: { initial?: Partial<Record<CapKey, unknown>> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let caps = $state<Caps>(patchCaps(DEFAULT_CAPS, initial ?? {}));

	const combos = allCombinations();
	const dangerTotal = countDangerous(combos);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const danger = $derived(hasLethalTrifecta(caps));
	const outcome = $derived(outcomeLabel(caps));
	const message = $derived(describeCaps(caps));
	const isDefault = $derived(sameCaps(caps, DEFAULT_CAPS));

	function setCap(k: CapKey, value: boolean): void {
		caps = patchCaps(caps, { [k]: value });
	}

	function setCombo(c: Caps): void {
		caps = { ...c };
	}

	function reset(): void {
		caps = { ...DEFAULT_CAPS };
	}

	function bit(on: boolean): string {
		return on ? 'да' : 'нет';
	}

	onMount(() => {
		return demos?.register('agent-guardrails', {
			set: (patch) => {
				caps = patchCaps(caps, patch as Partial<Record<CapKey, unknown>>);
			},
		});
	});
</script>

<figure class="gr" id="demo-agent-guardrails" data-demo="agent-guardrails" class:is-danger={danger}>
	<table class="gr-table">
		<caption class="gr-caption">Свойства агента</caption>
		<thead>
			<tr>
				<th scope="col">Свойство</th>
				<th scope="col" class="gr-col-sw">Есть</th>
				<th scope="col" class="gr-col-role">Роль в пути</th>
			</tr>
		</thead>
		<tbody>
			{#each CAP_KEYS as k (k)}
				<tr class="gr-row" class:is-off={!caps[k]} data-role={rowRole(caps, k)}>
					<th scope="row" class="gr-name">
						<label for="gr-cap-{k}">{CAP_LABEL[k]}</label>
						<span class="gr-hint">{CAP_HINT[k]}</span>
					</th>
					<td class="gr-sw-cell">
						<input
							id="gr-cap-{k}"
							class="gr-switch"
							type="checkbox"
							role="switch"
							checked={caps[k]}
							onchange={(e) => setCap(k, e.currentTarget.checked)}
						/>
					</td>
					<td class="gr-role">{ROLE_TEXT[rowRole(caps, k)]}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<div class="gr-outcome" class:is-danger={danger}>
		<span class="gr-outcome-t">Итог</span>
		<strong class="gr-outcome-v">{outcome}</strong>
	</div>

	<p class="gr-msg" aria-live="polite">{message}</p>

	<div class="gr-combos">
		<div class="gr-combos-head">
			<p class="gr-combos-t">
				Сочетаний: {combos.length} (2 · 2 · 2), опасных: {dangerTotal}
			</p>
			<button type="button" class="gr-reset" onclick={reset} disabled={isDefault}>
				Сбросить
			</button>
		</div>
		<div class="gr-grid" role="group" aria-label="Все сочетания свойств">
			{#each combos as c, i (i)}
				<button
					type="button"
					class="gr-cell"
					class:is-danger={hasLethalTrifecta(c)}
					aria-pressed={sameCaps(c, caps)}
					aria-label={comboLabel(c)}
					onclick={() => setCombo(c)}
				>
					<span class="gr-bits">
						{#each CAP_KEYS as k (k)}
							<span class="gr-bit" class:is-on={c[k]}>{bit(c[k])}</span>
						{/each}
					</span>
					{#if hasLethalTrifecta(c)}
						<span class="gr-tag">опасно</span>
					{/if}
				</button>
			{/each}
		</div>
		<p class="gr-model">
			Модель учитывает только путь через инъекцию в текст. Опасно лишь сочетание, где есть все три
			свойства.
		</p>
	</div>
</figure>

<style>
	.gr {
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
	.gr :global(*),
	.gr :global(*::before),
	.gr :global(*::after) {
		box-sizing: border-box;
	}
	.gr p {
		margin: 0;
	}
	.gr button {
		font: inherit;
	}
	.gr :focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Table of capabilities */
	.gr-table {
		width: 100%;
		border-collapse: collapse;
	}
	.gr-caption {
		caption-side: top;
		text-align: left;
		margin-bottom: var(--space-3);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.gr-table th,
	.gr-table td {
		padding: var(--space-3) var(--space-2);
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
		text-align: left;
	}
	.gr-table thead th {
		padding-top: 0;
		color: var(--text-muted);
		font-size: 12px;
		font-weight: 500;
	}
	.gr-col-sw,
	.gr-sw-cell {
		width: 64px;
		text-align: center !important;
	}
	.gr-col-role {
		width: 130px;
	}
	.gr-name {
		font-weight: 400;
	}
	.gr-name label {
		display: block;
		color: var(--text);
		font-weight: 600;
		cursor: pointer;
	}
	.gr-hint {
		display: block;
		color: var(--text-muted);
		font-size: 12px;
	}
	.gr-role {
		color: var(--text-muted);
		font-size: 13px;
	}
	.gr-row[data-role='link'] .gr-role {
		color: var(--fail);
		font-weight: 600;
	}
	.gr-row[data-role='cut'] .gr-role {
		color: var(--ok);
		font-weight: 600;
	}
	.gr-row.is-off .gr-name label {
		color: var(--text-muted);
		text-decoration: line-through;
		text-decoration-color: var(--text-muted);
	}

	/* Switch */
	.gr-switch {
		appearance: none;
		position: relative;
		display: inline-block;
		width: 44px;
		height: 24px;
		margin: 0;
		border-radius: 999px;
		background: var(--surface-2);
		box-shadow: inset 0 0 0 1px var(--text-muted);
		cursor: pointer;
		transition: background var(--dur) var(--ease);
		flex: none;
	}
	.gr-switch::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--text-muted);
		transition:
			transform var(--dur) var(--ease),
			background var(--dur) var(--ease);
	}
	.gr-switch:checked {
		background: var(--topic);
		box-shadow: none;
	}
	.gr-switch:checked::after {
		transform: translateX(20px);
		background: var(--surface);
	}

	/* Outcome */
	.gr-outcome {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		transition:
			background var(--dur) var(--ease),
			border-color var(--dur) var(--ease);
	}
	.gr-outcome-t {
		color: var(--text-muted);
	}
	.gr-outcome-v {
		color: var(--ok);
		font-size: var(--fs-base);
	}
	.gr-outcome.is-danger {
		background: color-mix(in srgb, var(--fail) 10%, var(--surface));
		border-color: var(--fail);
	}
	.gr-outcome.is-danger .gr-outcome-v {
		color: var(--fail);
	}

	.gr-msg {
		margin-top: var(--space-3);
		color: var(--text);
		min-height: 3em;
	}

	/* Combinations */
	.gr-combos {
		margin-top: var(--space-5);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
	.gr-combos-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
		margin-bottom: var(--space-3);
	}
	.gr-combos-t {
		color: var(--text-muted);
	}
	.gr-reset {
		height: 32px;
		padding: 0 var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		cursor: pointer;
		transition: border-color var(--dur) var(--ease);
	}
	.gr-reset:hover:not(:disabled) {
		border-color: var(--topic);
	}
	.gr-reset:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.gr-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-2);
	}
	.gr-cell {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
		min-height: 52px;
		padding: var(--space-2) var(--space-3);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
		text-align: left;
		cursor: pointer;
		transition:
			border-color var(--dur) var(--ease),
			background var(--dur) var(--ease);
	}
	.gr-cell[aria-pressed='true'] {
		border-color: var(--topic);
		box-shadow: inset 0 0 0 1px var(--topic);
	}
	.gr-cell.is-danger {
		background: color-mix(in srgb, var(--fail) 10%, var(--surface));
	}
	.gr-bits {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-2);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.gr-bit {
		color: var(--text-muted);
	}
	.gr-bit.is-on {
		color: var(--text);
		font-weight: 600;
	}
	.gr-tag {
		color: var(--fail);
		font-size: 12px;
		font-weight: 600;
	}
	.gr-model {
		margin-top: var(--space-3);
		color: var(--text-muted);
		font-size: 12px;
	}

	.gr.is-danger {
		border-color: var(--fail);
	}

	@media (prefers-reduced-motion: reduce) {
		.gr *,
		.gr *::before,
		.gr *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.gr {
			padding: var(--space-4);
		}
	}

	@media (min-width: 560px) {
		.gr-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	@media (max-width: 420px) {
		.gr-col-role {
			width: 96px;
		}
		.gr-role {
			font-size: 12px;
		}
	}
</style>
