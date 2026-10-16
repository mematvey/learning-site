<script lang="ts">
	/**
	 * Urn of N questions, K of them known. «Вытянуть» draws n questions without replacement.
	 * Below: the two-step probability tree for «знает первый и второй».
	 */
	let { N, K, n }: { N: number; K: number; n: number } = $props();

	let picked = $state<number[]>([]);
	let draws = $state(0);
	let bothHits = $state(0);
	let shuffling = $state(false);
	let timer: ReturnType<typeof setInterval> | undefined;

	const known = (i: number): boolean => i < K;

	/** Random subset of n indices from 0..N-1 (partial Fisher–Yates). */
	function sample(): number[] {
		const a = Array.from({ length: N }, (_, i) => i);
		const m = Math.min(Math.max(n, 0), N);
		for (let i = 0; i < m; i++) {
			const j = i + Math.floor(Math.random() * (N - i));
			[a[i], a[j]] = [a[j] as number, a[i] as number];
		}
		return a.slice(0, m);
	}

	const knownPicked = $derived(picked.filter(known).length);
	const allKnown = $derived(picked.length > 0 && knownPicked === picked.length);

	const caption = $derived.by(() => {
		if (shuffling) return 'Вытягиваем…';
		if (picked.length === 0) return 'Нажмите «Вытянуть», чтобы вынуть выборку.';
		return allKnown
			? `Вынуто ${n}: знает все ${n}. Событие произошло.`
			: `Вынуто ${n}: знает ${knownPicked} из ${n}. Событие не произошло.`;
	});

	function draw(): void {
		if (shuffling) return;
		const reduce =
			typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
		const finish = () => {
			picked = sample();
			draws += 1;
			if (picked.length > 0 && picked.every(known)) bothHits += 1;
		};
		if (reduce) {
			finish();
			return;
		}
		shuffling = true;
		let frame = 0;
		clearInterval(timer);
		timer = setInterval(() => {
			frame += 1;
			picked = sample();
			if (frame >= 6) {
				clearInterval(timer);
				shuffling = false;
				finish();
			}
		}, 60);
	}

	$effect(() => () => clearInterval(timer));

	// Two-step tree: the first two questions drawn without replacement.
	const tree = $derived.by(() => {
		const f = (num: number, den: number) => ({ num, den, p: den > 0 ? num / den : 0 });
		const a = f(K, N); // first known
		const b = f(N - K, N); // first unknown
		const kk = f(K - 1, N - 1); // second known after known
		const ku = f(N - K, N - 1); // second unknown after known
		const uk = f(K, N - 1); // second known after unknown
		const uu = f(N - K - 1, N - 1); // second unknown after unknown
		const rows = [
			{ path: 'знает, знает', fr: `${K}/${N} · ${K - 1}/${N - 1}`, p: a.p * kk.p, hit: true },
			{ path: 'знает, не знает', fr: `${K}/${N} · ${N - K}/${N - 1}`, p: a.p * ku.p, hit: false },
			{ path: 'не знает, знает', fr: `${N - K}/${N} · ${K}/${N - 1}`, p: b.p * uk.p, hit: false },
			{
				path: 'не знает, не знает',
				fr: `${N - K}/${N} · ${N - K - 1}/${N - 1}`,
				p: b.p * uu.p,
				hit: false,
			},
		];
		return rows;
	});
</script>

<figure class="urn">
	<div class="grid" role="group" aria-label="Урна: {N} вопросов, {K} известных">
		{#each Array.from({ length: N }, (_, i) => i) as i (i)}
			<span
				class="q"
				class:known={known(i)}
				class:picked={picked.includes(i)}
				title={known(i) ? 'знает' : 'не знает'}
			>
				<span class="sr-only"
					>{known(i) ? 'известный' : 'неизвестный'}{picked.includes(i) ? ', вынут' : ''}</span
				>
				<span aria-hidden="true">{known(i) ? '✓' : '?'}</span>
			</span>
		{/each}
	</div>

	<div class="controls">
		<button type="button" class="btn" onclick={draw} disabled={shuffling}>Вытянуть</button>
		<span class="tally">Вытягиваний: {draws}, все {n} известны: {bothHits}</span>
	</div>

	<p class="caption" aria-live="polite">{caption}</p>

	<table class="tree">
		<caption>Дерево для первых двух вопросов</caption>
		<thead>
			<tr>
				<th scope="col">Исход</th>
				<th scope="col">Дроби</th>
				<th scope="col">Вероятность</th>
			</tr>
		</thead>
		<tbody>
			{#each tree as row (row.path)}
				<tr class:target={row.hit}>
					<th scope="row">{row.path}</th>
					<td>{row.fr}</td>
					<td>{Number(row.p.toFixed(4))}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<figcaption>
		Что заметить: событие «знает оба» — первая строка дерева; ветки складываются в 1.
	</figcaption>
</figure>

<style>
	.urn {
		margin: 0;
		display: grid;
		gap: var(--space-3);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(30px, 1fr));
		gap: var(--space-2);
	}
	.q {
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		border-radius: var(--radius-sm);
		border: 1px dashed var(--border);
		background: var(--surface);
		color: var(--text-muted);
		font-size: 12px;
		transition:
			background-color var(--dur-fast) var(--ease),
			box-shadow var(--dur-fast) var(--ease);
	}
	.q.known {
		border-style: solid;
		background: var(--topic-soft);
		color: var(--topic);
		border-color: var(--topic);
	}
	.q.picked {
		box-shadow: 0 0 0 2px var(--accent);
		font-weight: 700;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-4);
	}
	.btn {
		min-height: 36px;
		padding: 0 var(--space-4);
		border-radius: var(--radius);
		border: 1px solid var(--topic);
		background: var(--topic);
		color: var(--surface);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.btn:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.tally {
		color: var(--text-muted);
	}
	.caption {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--topic);
		background: var(--topic-soft);
		border-radius: var(--radius-sm);
		font-size: var(--fs-base);
	}
	.tree {
		border-collapse: collapse;
		width: 100%;
	}
	caption {
		text-align: left;
		color: var(--text-muted);
		font-size: 12px;
		padding-bottom: var(--space-2);
	}
	th,
	td {
		border: 1px solid var(--border);
		padding: var(--space-2) var(--space-3);
		text-align: left;
		font-family: var(--font-mono);
	}
	th {
		font-family: var(--font-sans);
		font-weight: 600;
		background: var(--surface-2);
	}
	tr.target td,
	tr.target th {
		background: var(--topic-soft);
		font-weight: 700;
	}
	figcaption {
		color: var(--text-muted);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	@media (prefers-reduced-motion: reduce) {
		.q {
			transition: none;
		}
	}
</style>
