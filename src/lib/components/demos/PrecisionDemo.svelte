<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		FORMATS,
		FORMAT_IDS,
		GROUPS,
		INT_BITS,
		type FormatId,
		type GroupKind,
		type IntBits,
		type PrecisionDemoState,
		DEFAULT_STATE,
		formatNumber,
		groupLabel,
		isFormatId,
		isGroupKind,
		isIntBits,
		makeVector,
		parseDecimal,
		quantTable,
		roundingReport,
		sanitizeState,
		unitRoundoff,
	} from '$lib/demos/precision-quantization';

	/** Number formats and quantization error. Registers itself as demo `precision-quantization`. */
	let { initial }: { initial?: Partial<PrecisionDemoState> } = $props();

	const PRESETS = [1000.7, 70000, 0.1, 100000, 0.000001];
	/** The vector is fixed, so the table never changes between page loads. */
	const quant = quantTable(makeVector());
	const maxErr = Math.max(...quant.map((r) => r.error));

	/* svelte-ignore state_referenced_locally */
	const start = sanitizeState(initial);
	let format = $state<FormatId>(start.format);
	let value = $state(start.value);
	/** Text in the number field; it may be incomplete while typing, so it is parsed separately. */
	let raw = $state(String(start.value).replace('.', ','));
	let rawValid = $state(true);
	let intBits = $state<IntBits>(start.intBits);
	let group = $state<GroupKind>(start.group);

	const fmt = $derived(FORMATS[format]);
	const rep = $derived(roundingReport(value, fmt));
	const signBits = $derived(rep.bits.slice(0, 1));
	const expBits = $derived(rep.bits.slice(1, 1 + fmt.expBits));
	const mantBits = $derived(rep.bits.slice(1 + fmt.expBits));
	const selected = $derived(quant.find((r) => r.bits === intBits && r.group === group));

	const liveFormat = $derived(
		rep.overflow
			? `${fmt.label}: число ${formatNumber(value)} больше максимума формата, результат ${formatNumber(rep.rounded)}.`
			: `${formatNumber(value)} в ${fmt.label} записывается как ${formatNumber(rep.rounded)}, относительная ошибка ${formatNumber(rep.relError * 100)} %.`,
	);
	const liveInt = $derived(
		`int${intBits}, ${groupLabel(group)}: относительная ошибка ${formatNumber((selected?.error ?? 0) * 100)} %.`,
	);

	function setFormat(f: FormatId): void {
		format = f;
	}

	function setValue(v: number): void {
		value = v;
		raw = String(v).replace('.', ',');
		rawValid = true;
	}

	function onInput(text: string): void {
		raw = text;
		const parsed = parseDecimal(text);
		rawValid = Number.isFinite(parsed);
		if (rawValid) value = parsed;
	}

	function reset(): void {
		format = DEFAULT_STATE.format;
		intBits = DEFAULT_STATE.intBits;
		group = DEFAULT_STATE.group;
		setValue(DEFAULT_STATE.value);
	}

	function apply(patch: Partial<PrecisionDemoState>): void {
		if (isFormatId(patch.format)) format = patch.format;
		if (typeof patch.value === 'number' && Number.isFinite(patch.value)) setValue(patch.value);
		if (isIntBits(patch.intBits)) intBits = patch.intBits;
		if (isGroupKind(patch.group)) group = patch.group;
	}

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);
	onMount(() => {
		return demos?.register('precision-quantization', {
			set: (patch) => apply(patch as Partial<PrecisionDemoState>),
		});
	});
</script>

<figure class="pq" id="demo-precision-quantization" data-demo="precision-quantization">
	<div class="pq-section">
		<div class="pq-row">
			<label class="pq-field-input">
				<span class="pq-label">Число</span>
				<input
					class="pq-input"
					type="text"
					inputmode="decimal"
					autocomplete="off"
					value={raw}
					aria-invalid={!rawValid}
					oninput={(e) => onInput(e.currentTarget.value)}
				/>
			</label>
			<div class="pq-presets" role="group" aria-label="Примеры чисел">
				{#each PRESETS as p (p)}
					<button type="button" class="pq-chip" onclick={() => setValue(p)}
						>{formatNumber(p)}</button
					>
				{/each}
			</div>
		</div>
		{#if !rawValid}
			<p class="pq-warn">
				Введите число, например 1000,7 или 1e-6. Пока показано последнее верное значение.
			</p>
		{/if}

		<div class="pq-seg-wrap">
			<span class="pq-label">Формат</span>
			<div class="pq-group" role="group" aria-label="Формат числа">
				{#each FORMAT_IDS as f (f)}
					<button
						type="button"
						class="pq-seg"
						aria-pressed={format === f}
						onclick={() => setFormat(f)}>{FORMATS[f].label}</button
					>
				{/each}
			</div>
		</div>

		<p class="pq-fmt-info">
			порядок {fmt.expBits} бит, мантисса {fmt.mantBits} бит, максимум
			<span class="pq-mono">{formatNumber(fmt.maxFinite)}</span>{fmt.hasInf
				? ''
				: ', бесконечности нет'}
		</p>

		<div class="pq-bits" style="grid-template-columns: 1fr {fmt.expBits}fr {fmt.mantBits}fr">
			<div class="pq-bitfield pq-bit-sign">
				<span class="pq-bitname">знак · 1 бит</span>
				<span class="pq-cells">{signBits}</span>
			</div>
			<div class="pq-bitfield pq-bit-exp">
				<span class="pq-bitname">порядок · {fmt.expBits} бит</span>
				<span class="pq-cells">{expBits}</span>
			</div>
			<div class="pq-bitfield pq-bit-mant">
				<span class="pq-bitname">мантисса · {fmt.mantBits} бит</span>
				<span class="pq-cells">{mantBits}</span>
			</div>
		</div>

		<dl class="pq-stats">
			<dt>Записано как</dt>
			<dd>{formatNumber(rep.rounded)}</dd>
			<dt>Абсолютная ошибка</dt>
			<dd>{formatNumber(rep.absError)}</dd>
			<dt>Относительная ошибка</dt>
			<dd>{formatNumber(rep.relError * 100)} %</dd>
			<dt>Граница u = 2<sup>−(m+1)</sup></dt>
			<dd>{formatNumber(unitRoundoff(fmt) * 100)} %</dd>
			<dt>Переполнение</dt>
			<dd>{rep.overflow ? 'да' : 'нет'}</dd>
		</dl>
		<p class="pq-live" aria-live="polite">{liveFormat}</p>
	</div>

	<div class="pq-section pq-int">
		<h4 class="pq-sub">Целочисленная квантизация: int8 против int4</h4>
		<p class="pq-muted">
			4096 значений, каждое 256-е увеличено в 20 раз. Ошибка: ‖x − x̂‖ / ‖x‖. Масштаб s = max|x| / (2<sup
				>b−1</sup
			> − 1).
		</p>

		<div class="pq-row">
			<div class="pq-group" role="group" aria-label="Число бит">
				{#each INT_BITS as b (b)}
					<button
						type="button"
						class="pq-seg"
						aria-pressed={intBits === b}
						onclick={() => (intBits = b)}>int{b}</button
					>
				{/each}
			</div>
			<div class="pq-group" role="group" aria-label="Группа для масштаба">
				{#each GROUPS as g (g)}
					<button
						type="button"
						class="pq-seg"
						aria-pressed={group === g}
						onclick={() => (group = g)}>{groupLabel(g)}</button
					>
				{/each}
			</div>
		</div>

		<ul class="pq-bars">
			{#each quant as r (r.bits + '-' + r.group)}
				<li class="pq-bar-row" class:is-sel={r.bits === intBits && r.group === group}>
					<span class="pq-bar-label">int{r.bits}, {groupLabel(r.group)}</span>
					<span class="pq-bar-track">
						<span class="pq-bar-fill" style="width: {(r.error / maxErr) * 100}%"></span>
					</span>
					<span class="pq-bar-val pq-mono">{formatNumber(r.error * 100)} %</span>
				</li>
			{/each}
		</ul>
		<p class="pq-live" aria-live="polite">{liveInt}</p>
	</div>

	<div class="pq-section pq-foot">
		<button type="button" class="pq-reset" onclick={reset}>Сбросить</button>
	</div>
</figure>

<style>
	.pq {
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
	.pq :global(*),
	.pq :global(*::before),
	.pq :global(*::after) {
		box-sizing: border-box;
	}
	.pq p,
	.pq dl,
	.pq dd,
	.pq dt,
	.pq ul,
	.pq li,
	.pq h4 {
		margin: 0;
	}
	.pq ul {
		padding: 0;
		list-style: none;
	}
	.pq button {
		font: inherit;
	}
	.pq-section {
		padding: var(--space-4) 0;
		border-bottom: 1px solid var(--border);
	}
	.pq-section:first-child {
		padding-top: 0;
	}
	.pq-foot {
		display: flex;
		justify-content: flex-end;
		border-bottom: 0;
		padding-bottom: 0;
	}
	.pq-mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.pq-muted {
		color: var(--text-muted);
	}
	.pq-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.pq-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-6);
	}
	.pq-field-input {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.pq-input {
		width: 150px;
		height: 34px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 14px;
	}
	.pq-input[aria-invalid='true'] {
		border-color: var(--warn);
	}
	.pq-presets {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.pq-chip {
		min-height: 34px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		cursor: pointer;
	}
	.pq-warn {
		margin-top: var(--space-2);
		color: var(--warn);
	}
	.pq-input:focus-visible,
	.pq-chip:focus-visible,
	.pq-seg:focus-visible,
	.pq-reset:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.pq-seg-wrap {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}
	.pq-group {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		gap: 2px;
	}
	.pq-seg {
		min-height: 34px;
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-muted);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.pq-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.pq-fmt-info {
		margin-top: var(--space-3);
		color: var(--text-muted);
	}
	.pq-fmt-info .pq-mono {
		color: var(--text);
	}

	/* Bit layout: widths are proportional to the number of bits */
	.pq-bits {
		display: grid;
		gap: 2px;
		margin-top: var(--space-4);
	}
	.pq-bitfield {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
		padding: var(--space-2);
		border-radius: var(--radius-sm);
	}
	.pq-bitname {
		color: var(--text-muted);
		font-size: 12px;
		line-height: 1.3;
	}
	.pq-cells {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text);
		overflow-wrap: anywhere;
		word-break: break-all;
		line-height: 1.4;
	}
	.pq-bit-sign {
		background: color-mix(in srgb, var(--cat-2) 18%, transparent);
	}
	.pq-bit-exp {
		background: color-mix(in srgb, var(--cat-1) 18%, transparent);
	}
	.pq-bit-mant {
		background: color-mix(in srgb, var(--cat-3) 18%, transparent);
	}
	.pq-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.pq-stats dt {
		color: var(--text-muted);
	}
	.pq-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}
	.pq-live {
		margin-top: var(--space-3);
		color: var(--text-muted);
	}

	/* Integer quantization bars */
	.pq-sub {
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: var(--space-2);
	}
	.pq-bars {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}
	.pq-bar-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) auto;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
	}
	.pq-bar-row.is-sel {
		background: var(--topic-soft);
		box-shadow: inset 2px 0 0 var(--topic);
	}
	.pq-bar-label {
		color: var(--text-muted);
		font-size: 13px;
		overflow-wrap: anywhere;
	}
	.pq-bar-track {
		height: 12px;
		background: var(--surface-2);
		border-radius: 999px;
		overflow: hidden;
	}
	.pq-bar-fill {
		display: block;
		height: 100%;
		background: var(--cat-1);
		border-radius: 999px;
		transition: width var(--dur) var(--ease);
	}
	.pq-bar-row.is-sel .pq-bar-fill {
		background: var(--topic);
	}
	.pq-bar-val {
		font-size: 13px;
		color: var(--text);
		white-space: nowrap;
	}

	.pq-reset {
		min-height: 34px;
		padding: 0 var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		cursor: pointer;
	}

	@media (prefers-reduced-motion: reduce) {
		.pq *,
		.pq *::before,
		.pq *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.pq {
			padding: var(--space-4);
		}
	}

	@media (max-width: 559px) {
		.pq-row {
			flex-direction: column;
			align-items: stretch;
		}
		.pq-field-input {
			flex-wrap: wrap;
		}
		.pq-input {
			width: 100%;
		}
		.pq-bar-row {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.pq-bar-track {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}
</style>
