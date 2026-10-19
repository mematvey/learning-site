<script lang="ts">
	import {
		BATCH_T,
		EXAMPLE_T,
		MAX_K,
		N_CHOICES,
		type Routing,
		balanceStep,
		capacity,
		clampK,
		dropped,
		expertCounts,
		formatShare,
		imbalance,
		moveToken,
		paramCounts,
		snapN,
		uniformRouting,
	} from '$lib/demos/moe';

	/**
	 * Mixture of experts demo: N experts, top-k routing of a batch of tokens, active share of parameters.
	 * The user sets N and k, moves tokens to experts (drag, or select a token and press an expert),
	 * balances the load step by step and resets. Not registered in the demos registry: no text links to it yet.
	 */
	let { initial }: { initial?: { n?: number; k?: number } } = $props();

	/* svelte-ignore state_referenced_locally */
	let n = $state(snapN(initial?.n ?? 8));
	/* svelte-ignore state_referenced_locally */
	let k = $state(clampK(initial?.k ?? 2, snapN(initial?.n ?? 8)));
	/* svelte-ignore state_referenced_locally */
	let assign = $state<Routing>(
		uniformRouting(snapN(initial?.n ?? 8), clampK(initial?.k ?? 2, snapN(initial?.n ?? 8))),
	);
	let selected = $state<number | null>(null);
	let dragOver = $state<number | null>(null);
	let action = $state('');

	const nIndex = $derived((N_CHOICES as readonly number[]).indexOf(n));
	const kMax = $derived(Math.min(n, MAX_K));
	const params = $derived(paramCounts(n, k));
	const counts = $derived(expertCounts(assign, n));
	const shares = $derived(counts.map((c) => c / BATCH_T));
	const ideal = $derived(k / n);
	const cap = $derived(capacity(n, BATCH_T));
	const dropMask = $derived(dropped(assign, n, cap));
	const nDropped = $derived(dropMask.filter(Boolean).length);
	const primaryCounts = $derived.by(() => {
		const c = new Array<number>(n).fill(0);
		for (const row of assign) {
			const e = row[0] ?? 0;
			c[e] = (c[e] ?? 0) + 1;
		}
		return c;
	});
	const ratio = $derived(imbalance(assign, n));
	const hi = $derived(counts.indexOf(Math.max(...counts)));
	const capExample = $derived(capacity(n, EXAMPLE_T));
	const idealText = $derived(formatShare(ideal * 100));

	/** Text of the consequence: cause and effect of the current routing. */
	const notice = $derived.by(() => {
		const hiPct = formatShare((shares[hi] ?? 0) * 100);
		if (nDropped > 0) {
			return `Эксперт ${hi + 1} получает ${hiPct} % токенов при ёмкости ${cap}. ${nDropped} токенов не обработаны экспертом и проходят только через остаточную связь.`;
		}
		if (ratio > 1.05) {
			return `Нагрузка неравномерна: эксперт ${hi + 1} получает ${hiPct} % токенов, при равномерной нагрузке было бы ${idealText} %.`;
		}
		return `Нагрузка равномерна: каждый эксперт получает ${idealText} % токенов (k/N). Перекоса нет, переполнения нет.`;
	});

	function reset(): void {
		assign = uniformRouting(n, k);
		selected = null;
		action = 'Сброс: маршрутизация снова равномерная.';
	}

	function setN(idx: number): void {
		const next = N_CHOICES[idx];
		if (next === undefined) return;
		n = next;
		k = clampK(k, n);
		reset();
	}

	function setK(v: number): void {
		k = clampK(v, n);
		reset();
	}

	function moveTokenTo(t: number, e: number): void {
		const before = primaryOf(t);
		assign = moveToken(assign, t, e);
		selected = null;
		action =
			before === e
				? `Токен ${t + 1} уже у эксперта ${e + 1} первым.`
				: `Токен ${t + 1} переехал к эксперту ${e + 1}.`;
	}

	function pickToken(t: number): void {
		if (selected === t) {
			selected = null;
			action = 'Выбор токена снят.';
		} else {
			selected = t;
			action = `Токен ${t + 1} выбран. Нажмите эксперта, чтобы переместить его.`;
		}
	}

	function pickExpert(e: number): void {
		if (selected === null) {
			action = 'Сначала выберите токен (или перетащите его на эксперта).';
			return;
		}
		moveTokenTo(selected, e);
	}

	function balance(): void {
		const before = JSON.stringify(assign);
		assign = balanceStep(assign, n);
		action =
			JSON.stringify(assign) === before
				? 'Шаг балансировки не нужен: перенести токен некуда.'
				: 'Шаг балансировки: один токен перенесён от самого загруженного эксперта к наименее загруженному.';
	}

	function onDragStart(e: DragEvent, t: number): void {
		e.dataTransfer?.setData('text/plain', String(t));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function onDrop(e: DragEvent, target: number): void {
		e.preventDefault();
		dragOver = null;
		const t = Number(e.dataTransfer?.getData('text/plain'));
		if (Number.isInteger(t) && t >= 0 && t < BATCH_T) moveTokenTo(t, target);
	}

	/** Primary expert of a token: the first in its list. */
	function primaryOf(t: number): number {
		return assign[t]?.[0] ?? 0;
	}
</script>

<figure class="moe" id="demo-moe" data-demo="moe">
	<div class="moe-controls">
		<label class="moe-ctl">
			<span class="moe-label">Экспертов <span class="moe-sym">N</span></span>
			<input
				class="moe-range"
				type="range"
				min="0"
				max={N_CHOICES.length - 1}
				step="1"
				value={nIndex}
				aria-valuetext="N = {n}"
				oninput={(e) => setN(Number(e.currentTarget.value))}
			/>
			<output class="moe-val">{n}</output>
		</label>

		<label class="moe-ctl">
			<span class="moe-label">Активных на токен <span class="moe-sym">k</span></span>
			<input
				class="moe-range"
				type="range"
				min="1"
				max={kMax}
				step="1"
				value={k}
				aria-valuetext="k = {k}"
				oninput={(e) => setK(Number(e.currentTarget.value))}
			/>
			<output class="moe-val">{k}</output>
		</label>
	</div>

	<div class="moe-params">
		<p class="moe-row">
			<span class="moe-muted">Полные (память):</span>
			<span class="moe-mono">4d² + {n}·8d² = {params.total}d²</span>
		</p>
		<p class="moe-row">
			<span class="moe-muted">Активные (на токен):</span>
			<span class="moe-mono">4d² + {k}·8d² = {params.active}d²</span>
		</p>
		<div
			class="moe-bar"
			role="img"
			aria-label="Доля активных параметров {formatShare(params.share)} %"
		>
			<div class="moe-bar-fill" style:width="{params.share}%"></div>
		</div>
		<p class="moe-share">
			<span class="moe-big">{formatShare(params.share)} %</span>
			<span class="moe-muted">параметров работает на одном токене</span>
		</p>
	</div>

	<div class="moe-section">
		<p class="moe-h">Загрузка экспертов: доля токенов, которые к нему пришли</p>
		<div
			class="moe-experts"
			role="group"
			aria-label="Эксперты: нажмите, чтобы переместить выбранный токен"
		>
			{#each shares as s, i (i)}
				<button
					type="button"
					class="moe-expert"
					class:is-over={(primaryCounts[i] ?? 0) > cap}
					class:is-drop={dragOver === i}
					aria-label="Эксперт {i + 1}: {formatShare(s * 100)} % токенов"
					onclick={() => pickExpert(i)}
					ondragover={(e) => {
						e.preventDefault();
						dragOver = i;
					}}
					ondragleave={() => (dragOver = null)}
					ondrop={(e) => onDrop(e, i)}
				>
					<span class="moe-track">
						<span class="moe-fill" style:height="{Math.min(100, s * 100)}%"></span>
						<span class="moe-ideal" style:bottom="{Math.min(100, ideal * 100)}%"></span>
					</span>
					<span class="moe-etag">Э{i + 1}</span>
					<span class="moe-epct">{formatShare(s * 100)} %</span>
				</button>
			{/each}
		</div>
		<p class="moe-legend">
			<span class="moe-key moe-key-ideal" aria-hidden="true"></span>
			уровень равномерной загрузки k/N = {idealText} %
		</p>
	</div>

	<div class="moe-section">
		<p class="moe-h">
			Токены батча: перетащите токен на эксперта или выберите токен и нажмите эксперта
		</p>
		<div class="moe-tokens">
			{#each assign as row, t (t)}
				<button
					type="button"
					class="moe-token"
					class:is-selected={selected === t}
					class:is-dropped={dropMask[t]}
					aria-pressed={selected === t}
					aria-label="Токен {t + 1}, основной эксперт {primaryOf(t) +
						1}, всего экспертов {row.length}"
					draggable="true"
					ondragstart={(e) => onDragStart(e, t)}
					onclick={() => pickToken(t)}
				>
					<span class="moe-tn">{t + 1}</span>
					<span class="moe-tp">→Э{primaryOf(t) + 1}</span>
				</button>
			{/each}
		</div>
	</div>

	<div class="moe-foot">
		<p class="moe-cap">
			Ёмкость эксперта C = cf·T/N = {cap} токенов на батч из {BATCH_T}. При T = {EXAMPLE_T} и N = {n}:
			C = {capExample}.
		</p>
		<p class="moe-cap">Дисбаланс (максимум / среднее): {ratio.toFixed(2).replace('.', ',')}</p>
		<div class="moe-actions">
			<button type="button" class="moe-btn" onclick={balance}>Шаг балансировки</button>
			<button type="button" class="moe-btn moe-btn-primary" onclick={reset}>Сбросить</button>
		</div>
	</div>

	<p class="moe-live" aria-live="polite">{action} {notice}</p>

	<p class="moe-note">
		<strong>Что заметить:</strong> доля активных параметров падает, когда растёт N при том же k. Перекос
		нагрузки ведёт к переполнению ёмкости, и лишние токены остаются без обработки экспертом.
	</p>
</figure>

<style>
	.moe {
		margin: 0;
		padding: var(--space-6) var(--space-6) var(--space-6);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		line-height: 1.5;
		text-align: left;
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
	}
	.moe :global(*),
	.moe :global(*::before),
	.moe :global(*::after) {
		box-sizing: border-box;
	}
	.moe p {
		margin: 0;
	}
	.moe button {
		font: inherit;
	}
	.moe-muted {
		color: var(--text-muted);
	}
	.moe-mono {
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.moe-sym {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--text);
	}

	/* Controls */
	.moe-controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.moe-ctl {
		display: flex;
		flex: 1 1 220px;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		min-width: 0;
	}
	.moe-label {
		color: var(--text-muted);
	}
	.moe-range {
		flex: 1 1 140px;
		min-width: 120px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.moe-val {
		min-width: 3ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.moe-range:focus-visible,
	.moe-token:focus-visible,
	.moe-expert:focus-visible,
	.moe-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* Parameters */
	.moe-params {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4) 0;
	}
	.moe-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-3);
		justify-content: space-between;
	}
	.moe-bar {
		height: 14px;
		margin-top: var(--space-2);
		background: var(--surface-2);
		border: 1px solid var(--border-control);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.moe-bar-fill {
		height: 100%;
		background: var(--topic);
		transition: width var(--dur) var(--ease);
	}
	.moe-share {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1) var(--space-3);
	}
	.moe-big {
		font-family: var(--font-serif);
		font-size: 22px;
		font-weight: 600;
		color: var(--text);
	}

	/* Sections */
	.moe-section {
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
	.moe-h {
		margin-bottom: var(--space-3);
		color: var(--text);
		font-weight: 600;
	}

	/* Experts */
	.moe-experts {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
		gap: var(--space-2);
	}
	.moe-expert {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		min-width: 0;
		padding: var(--space-2) 2px;
		background: var(--bg);
		border: 1px solid var(--border-control);
		border-radius: var(--radius);
		color: var(--text);
		cursor: pointer;
		transition: background var(--dur-fast) var(--ease);
	}
	.moe-expert.is-drop {
		background: var(--topic-soft);
	}
	.moe-expert.is-over {
		border-color: var(--warn);
	}
	.moe-track {
		position: relative;
		display: block;
		width: 100%;
		height: 72px;
		background: var(--surface-2);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.moe-fill {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		background: var(--cat-1);
		transition: height var(--dur) var(--ease);
	}
	.moe-expert.is-over .moe-fill {
		background: var(--warn);
	}
	.moe-ideal {
		position: absolute;
		left: 0;
		right: 0;
		height: 0;
		border-top: 2px dashed var(--text);
		opacity: 0.6;
	}
	.moe-etag {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text);
	}
	.moe-epct {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.moe-legend {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.moe-key-ideal {
		display: inline-block;
		width: 16px;
		border-top: 2px dashed var(--text);
	}

	/* Tokens */
	.moe-tokens {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
		gap: var(--space-2);
	}
	.moe-token {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		min-width: 0;
		padding: 2px;
		background: var(--surface-2);
		border: 1px solid var(--border-control);
		border-radius: var(--radius-sm);
		color: var(--text);
		cursor: grab;
		touch-action: manipulation;
	}
	.moe-token.is-selected {
		background: var(--topic);
		border-color: var(--topic);
		color: var(--surface);
	}
	.moe-token.is-dropped {
		border-color: var(--warn);
		background: var(--warn-bg);
		color: var(--text);
	}
	.moe-tn {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
	}
	.moe-tp {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-muted);
	}
	.moe-token.is-selected .moe-tp {
		color: var(--surface);
	}

	/* Footer */
	.moe-foot {
		display: grid;
		gap: var(--space-2);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
	.moe-cap {
		color: var(--text-muted);
		font-size: 13px;
	}
	.moe-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	.moe-btn {
		min-height: 36px;
		padding: 0 var(--space-3);
		background: var(--surface);
		border: 1px solid var(--border-control);
		border-radius: var(--radius);
		color: var(--text);
		cursor: pointer;
	}
	.moe-btn-primary {
		background: var(--topic);
		border-color: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.moe-live {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
	}
	.moe-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.moe-note strong {
		color: var(--text);
	}

	@media (prefers-reduced-motion: reduce) {
		.moe *,
		.moe *::before,
		.moe *::after {
			transition: none !important;
		}
	}
</style>
