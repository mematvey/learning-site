<script lang="ts">
	import type { Rational, SubQuestion } from '$lib/prob/types';
	import { formatDecimal, formatFraction } from './format';

	/** Exact answers, shown as soon as the parameters are valid. */
	let {
		questions,
		exact,
		valid,
	}: {
		questions: SubQuestion[];
		exact: Record<string, Rational>;
		valid: boolean;
	} = $props();
</script>

<div class="av" aria-live="polite">
	{#if valid}
		<dl class="av-list">
			{#each questions as q, i (q.key)}
				{@const r = exact[q.key]}
				<div class="av-row" style="--q: var(--cat-{Math.min(i + 1, 6)})">
					<dt class="av-label">
						<span class="av-mark" aria-hidden="true"></span>
						{q.key}) {q.label}
					</dt>
					<dd class="av-value">
						{#if r}
							<span class="av-frac">{formatFraction(r)}</span>
							<span class="av-dec">≈ {formatDecimal(r)}</span>
						{:else}
							<span class="av-dec">—</span>
						{/if}
					</dd>
				</div>
			{/each}
		</dl>
	{:else}
		<p class="av-hint">Исправьте параметры, чтобы увидеть ответы.</p>
	{/if}
</div>

<style>
	.av {
		margin-block: var(--space-3);
	}
	.av-list {
		display: grid;
		gap: var(--space-2);
		margin: 0;
	}
	.av-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: baseline;
		gap: var(--space-2) var(--space-4);
		padding: var(--space-2) var(--space-3);
		background: var(--surface-2);
		border-radius: var(--radius);
	}
	.av-label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--fs-base);
		min-width: 0;
	}
	.av-mark {
		flex: none;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--q);
	}
	.av-value {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2);
		justify-content: flex-end;
	}
	.av-frac {
		font-family: var(--font-mono);
		font-size: var(--fs-base);
		font-weight: 600;
		color: var(--text);
	}
	.av-dec {
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	.av-hint {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--warn);
	}
	@media (max-width: 420px) {
		.av-row {
			grid-template-columns: minmax(0, 1fr);
		}
		.av-value {
			justify-content: flex-start;
		}
	}
</style>
