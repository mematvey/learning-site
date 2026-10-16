<script lang="ts">
	import type { ParamSpec, ProblemParams } from '$lib/prob/types';

	/** Editable parameters of one problem. Values are owned by the card; this panel only reports changes. */
	let {
		idPrefix,
		specs,
		params,
		issues,
		onChange,
		onReset,
	}: {
		idPrefix: string;
		specs: ParamSpec[];
		params: ProblemParams;
		issues: string[];
		onChange: (key: string, value: number) => void;
		onReset: () => void;
	} = $props();

	function read(spec: ParamSpec, raw: string): void {
		const value = Number(raw);
		// Empty or partial input is ignored: the last finite value stays in force.
		if (raw.trim() !== '' && Number.isFinite(value)) onChange(spec.key, value);
	}
</script>

<div class="pp">
	<div class="pp-grid">
		{#each specs as spec (spec.key)}
			{@const id = `${idPrefix}-${spec.key}`}
			<div class="pp-field">
				<label class="pp-label" for={id}>{spec.label}</label>
				{#if spec.control === 'slider'}
					<div class="pp-slider">
						<input
							{id}
							type="range"
							min={spec.min}
							max={spec.max}
							step={spec.step}
							value={params[spec.key]}
							oninput={(e) => read(spec, e.currentTarget.value)}
						/>
						<output class="pp-value" for={id}>{params[spec.key]}</output>
					</div>
				{:else}
					<input
						{id}
						class="pp-number"
						type="number"
						inputmode="decimal"
						min={spec.min}
						max={spec.max}
						step={spec.step}
						value={params[spec.key]}
						oninput={(e) => read(spec, e.currentTarget.value)}
					/>
				{/if}
			</div>
		{/each}
	</div>

	<div class="pp-foot">
		<div class="pp-issues" aria-live="polite">
			{#each issues as issue (issue)}
				<p class="pp-issue">{issue}</p>
			{/each}
		</div>
		<button type="button" class="pp-reset" onclick={onReset}>Вернуть из условия</button>
	</div>
</div>

<style>
	.pp {
		display: grid;
		gap: var(--space-3);
		margin-block: var(--space-4);
	}
	.pp-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--space-3) var(--space-6);
	}
	.pp-field {
		display: grid;
		gap: var(--space-1);
		min-width: 0;
	}
	.pp-label {
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.pp-slider {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.pp-slider input {
		flex: 1;
		min-width: 0;
		accent-color: var(--topic);
	}
	.pp-value {
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		min-width: 3ch;
		text-align: right;
	}
	.pp-number {
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--text);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: var(--space-1) var(--space-2);
		width: 100%;
		max-width: 12rem;
	}
	.pp-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.pp-issues {
		display: grid;
		gap: var(--space-1);
	}
	.pp-issue {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--warn);
	}
	.pp-reset {
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--text-muted);
		background: none;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: var(--space-1) var(--space-3);
		cursor: pointer;
	}
	.pp-reset:hover {
		color: var(--text);
	}
	:where(.pp input, .pp-reset):focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
