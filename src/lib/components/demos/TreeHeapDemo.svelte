<script lang="ts">
	import {
		BALANCED_KEYS,
		DRAW_W,
		K_MAX,
		K_MIN,
		SORTED_KEYS,
		bstSteps,
		heapGeometry,
		type BstStep,
		layoutTree,
		parseKeys,
		topKSteps,
	} from '$lib/demos/trees-heaps';

	/** Binary search tree insertion and top-k with a min-heap, both driven by one step counter. */

	const EMPTY_STEP: BstStep = { root: null, path: [], levels: 0, inserted: null };
	const SORTED_TEXT = SORTED_KEYS.join(', ');
	const BALANCED_TEXT = BALANCED_KEYS.join(', ');

	let text = $state(SORTED_TEXT);
	let k = $state(3);
	let step = $state(0);
	let playing = $state(false);

	const parsed = $derived(parseKeys(text));
	const keys = $derived(parsed.error ? [] : parsed.keys);
	const n = $derived(keys.length);
	const s = $derived(Math.min(step, n));

	const snapshots = $derived(bstSteps(keys));
	const bst = $derived(snapshots[s] ?? EMPTY_STEP);
	const tree = $derived(layoutTree(bst.root, bst.path, bst.inserted));

	const tops = $derived(topKSteps(keys, k));
	const topStep = $derived(s === 0 ? null : tops[s - 1]);
	const heapNow = $derived(topStep ? topStep.heap : []);
	const heap = $derived(
		heapGeometry(heapNow, topStep && topStep.action !== 'skip' ? topStep.value : null),
	);
	const kth = $derived(topStep ? topStep.kth : null);
	const topNow = $derived([...heapNow].sort((a, b) => b - a));

	const description = $derived(describeStep());

	function describeStep(): string {
		if (parsed.error) return parsed.error;
		if (n === 0) return 'Введите ключи.';
		if (s === 0) return 'Шаг 0: дерево пусто, куча пуста.';
		const ins = bst.inserted ?? 0;
		const way = bst.path.slice(0, -1);
		const route = way.length === 0 ? 'корень' : way.join(' → ');
		let t = `Дерево: вставлен ключ ${ins}, путь ${route} → ${ins}. Уровней: ${bst.levels}.`;
		const st = topStep;
		if (!st) return t;
		if (st.action === 'fill') {
			t += ` Куча: ${st.value} добавлен, в куче ${st.heap.length} из ${k}.`;
		} else if (st.action === 'replace') {
			t += ` Куча: ${st.value} больше минимума ${st.evicted}, минимум вытеснен. k-й максимум: ${st.kth}.`;
		} else {
			t += ` Куча: ${st.value} не попадает в top-${k}, минимум ${st.kth ?? '—'} остаётся.`;
		}
		return t;
	}

	function setText(next: string): void {
		text = next;
		step = 0;
		playing = false;
	}

	function prev(): void {
		playing = false;
		step = Math.max(0, s - 1);
	}

	function next(): void {
		step = Math.min(n, s + 1);
		if (step >= n) playing = false;
	}

	function reset(): void {
		playing = false;
		step = 0;
		text = SORTED_TEXT;
		k = 3;
	}

	$effect(() => {
		if (!playing) return;
		const id = setInterval(() => {
			if (step >= n) {
				playing = false;
				return;
			}
			step += 1;
		}, 1000);
		return () => clearInterval(id);
	});

	function nodeClass(highlight: boolean, isNew: boolean): string {
		if (isNew) return 'td-node is-new';
		if (highlight) return 'td-node is-path';
		return 'td-node';
	}
</script>

<figure class="td" id="demo-tree-heap" data-demo="tree-heap">
	<div class="td-controls">
		<label class="td-field">
			<span class="td-label">Ключи (по порядку вставки)</span>
			<input
				class="td-input"
				type="text"
				inputmode="numeric"
				value={text}
				oninput={(e) => setText(e.currentTarget.value)}
				aria-invalid={parsed.error !== null}
				aria-describedby="td-error"
			/>
		</label>
		<div class="td-presets" role="group" aria-label="Готовый порядок ключей">
			<button
				type="button"
				class="td-btn"
				aria-pressed={text === SORTED_TEXT}
				onclick={() => setText(SORTED_TEXT)}>По возрастанию</button
			>
			<button
				type="button"
				class="td-btn"
				aria-pressed={text === BALANCED_TEXT}
				onclick={() => setText(BALANCED_TEXT)}>4, 2, 6, 1, 3, 5, 7</button
			>
		</div>
		<label class="td-field td-k">
			<span class="td-label">k для кучи <output class="td-val">{k}</output></span>
			<input
				class="td-range"
				type="range"
				min={K_MIN}
				max={K_MAX}
				step="1"
				value={k}
				oninput={(e) => (k = Number(e.currentTarget.value))}
			/>
		</label>
	</div>
	<p id="td-error" class="td-error" aria-live="polite">{parsed.error ?? ''}</p>

	<div class="td-steps">
		<button type="button" class="td-btn" onclick={prev} disabled={s === 0}>Назад</button>
		<button
			type="button"
			class="td-btn"
			onclick={() => (playing = !playing)}
			disabled={n === 0 || (s >= n && !playing)}
			aria-pressed={playing}>{playing ? 'Пауза' : 'Играть'}</button
		>
		<button type="button" class="td-btn" onclick={next} disabled={s >= n}>Вперёд</button>
		<button type="button" class="td-btn td-reset" onclick={reset}>Сброс</button>
		<label class="td-field td-step">
			<span class="td-label">Шаг <output class="td-val">{s} из {n}</output></span>
			<input
				class="td-range"
				type="range"
				min="0"
				max={n}
				step="1"
				value={s}
				disabled={n === 0}
				oninput={(e) => {
					playing = false;
					step = Number(e.currentTarget.value);
				}}
			/>
		</label>
	</div>

	<div class="td-plots">
		<div class="td-panel">
			<p class="td-panel-t">Дерево поиска</p>
			<svg
				class="td-svg"
				viewBox="0 0 {DRAW_W} {tree.height}"
				style="height: {tree.height}px"
				role="img"
				aria-labelledby="td-tree-title td-tree-desc"
			>
				<title id="td-tree-title">Дерево поиска после {s} вставок</title>
				<desc id="td-tree-desc"
					>{n === 0
						? 'Дерево пусто.'
						: `Уровней: ${bst.levels}. Ключи: ${keys.slice(0, s).join(', ') || 'нет'}.`}</desc
				>
				{#each tree.edges as e, i (i)}
					<line class="td-edge" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
				{/each}
				{#each tree.nodes as nd (nd.id)}
					<g class={nodeClass(nd.highlight, nd.isNew)}>
						<circle cx={nd.x} cy={nd.y} r="14" />
						<text x={nd.x} y={nd.y + 4} text-anchor="middle">{nd.label}</text>
					</g>
				{/each}
			</svg>
			{#if n === 0}
				<p class="td-empty">Дерево пусто.</p>
			{/if}
		</div>

		<div class="td-panel">
			<p class="td-panel-t">Куча: top-{k} по шагам</p>
			<svg
				class="td-svg"
				viewBox="0 0 {DRAW_W} {heap.height}"
				style="height: {heap.height}px"
				role="img"
				aria-labelledby="td-heap-title td-heap-desc"
			>
				<title id="td-heap-title">Куча из наибольших значений</title>
				<desc id="td-heap-desc"
					>{heapNow.length === 0
						? 'Куча пуста.'
						: `Минимум кучи ${heapNow[0]}, в куче ${heapNow.length} значений.`}</desc
				>
				{#each heap.edges as e, i (i)}
					<line class="td-edge" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
				{/each}
				{#each heap.nodes as nd (nd.id)}
					<g class={nodeClass(nd.highlight, nd.isNew)}>
						<circle cx={nd.x} cy={nd.y} r="14" />
						<text x={nd.x} y={nd.y + 4} text-anchor="middle">{nd.label}</text>
					</g>
				{/each}
			</svg>
			<dl class="td-stats">
				<dt>Минимум в куче</dt>
				<dd>{kth ?? '—'}</dd>
				<dt>Top-{k}</dt>
				<dd class="td-top">{topNow.length ? topNow.join(', ') : '—'}</dd>
			</dl>
			{#if topStep && kth === null}
				<p class="td-hint">
					Куча ещё не заполнена: k-й максимум появится, когда в ней будет {k} значений.
				</p>
			{/if}
		</div>
	</div>

	<p class="td-desc" aria-live="polite">{description}</p>

	<p class="td-note">
		<strong>Что заметить:</strong> ключи по возрастанию дают цепочку, а тот же набор в другом порядке
		даёт три уровня. Куча держит только k кандидатов: новое значение попадает в top-k, только если больше
		минимума кучи.
	</p>
</figure>

<style>
	.td {
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
	}
	.td :global(*),
	.td :global(*::before),
	.td :global(*::after) {
		box-sizing: border-box;
	}
	.td dl,
	.td dd,
	.td dt,
	.td p {
		margin: 0;
	}
	.td button {
		font: inherit;
	}

	.td-controls,
	.td-steps {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-3) var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.td-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.td-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.td-input {
		width: 260px;
		max-width: 100%;
		height: 36px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.td-input[aria-invalid='true'] {
		border-color: var(--warn);
	}
	.td-input:focus-visible,
	.td-btn:focus-visible,
	.td-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.td-presets {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.td-btn {
		height: 34px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.td-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.td-btn[aria-pressed='true'] {
		background: var(--topic);
		border-color: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.td-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.td-range:disabled {
		cursor: not-allowed;
	}
	.td-val {
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.td-error {
		min-height: 1.5em;
		margin-top: var(--space-2);
		color: var(--warn);
	}
	.td-steps {
		margin-top: var(--space-2);
	}

	.td-plots {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.td-panel-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
	}
	.td-svg {
		display: block;
		width: 100%;
		overflow: visible;
	}
	.td-edge {
		stroke: var(--text-muted);
		stroke-width: 1.5;
	}
	.td-node circle {
		fill: var(--surface-2);
		stroke: var(--text-muted);
		stroke-width: 1.5;
		transition:
			fill var(--dur) var(--ease),
			stroke var(--dur) var(--ease);
	}
	.td-node text {
		fill: var(--text);
		font-family: var(--font-mono);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		pointer-events: none;
	}
	.td-node.is-path circle {
		stroke: var(--topic);
		fill: var(--topic-soft);
	}
	.td-node.is-new circle {
		stroke: var(--topic);
		stroke-width: 3;
		fill: var(--topic);
	}
	.td-node.is-new text {
		fill: var(--surface);
		font-weight: 600;
	}
	.td-empty,
	.td-hint {
		margin-top: var(--space-2);
		color: var(--text-muted);
	}
	.td-stats {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-3);
	}
	.td-stats dt {
		color: var(--text-muted);
	}
	.td-stats dd {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.td-top {
		overflow-wrap: anywhere;
	}
	.td-desc {
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		background: var(--topic-soft);
		color: var(--text);
	}
	.td-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.td *,
		.td *::before,
		.td *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.td {
			padding: var(--space-4);
		}
		.td-plots {
			grid-template-columns: minmax(0, 1fr);
		}
		.td-input {
			width: 100%;
		}
	}
</style>
