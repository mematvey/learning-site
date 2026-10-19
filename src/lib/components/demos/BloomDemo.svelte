<script lang="ts">
	import {
		DEFAULT_K,
		DEFAULT_M,
		DEFAULT_N,
		DEFAULT_T,
		K_MAX,
		K_MIN,
		M_MAX,
		M_MIN,
		M_STEP,
		N_ADD,
		N_MAX,
		N_MIN,
		N_STEP,
		SET_A,
		SET_B,
		SPREAD_TRIALS,
		T_MAX,
		T_MIN,
		T_STEP,
		absentKeys,
		binDensity,
		insertedKeys,
		jaccard,
		measureBloom,
		minhashEstimate,
		minhashSignature,
		minhashSpreadMeasured,
		minhashSpreadTheory,
		optimalK,
		probe,
		snapK,
		snapM,
		snapN,
		snapT,
	} from '$lib/demos/hashing-sketches';

	/** Bloom filter and MinHash demo. Props only seed the initial state. */
	let { initial }: { initial?: { m?: number; k?: number; n?: number; t?: number } } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let m = $state(snapM(initial?.m ?? DEFAULT_M));
	/* svelte-ignore state_referenced_locally */
	let k = $state(snapK(initial?.k ?? DEFAULT_K));
	/* svelte-ignore state_referenced_locally */
	let n = $state(snapN(initial?.n ?? DEFAULT_N));
	/* svelte-ignore state_referenced_locally */
	let t = $state(snapT(initial?.t ?? DEFAULT_T));
	/** Which elements the probe button checks: absent ones (false positives) or inserted ones. */
	let probeMode = $state<'absent' | 'inserted'>('absent');
	let probeIndex = $state(0);

	const CELLS = 60;
	const PROBE_COUNT = 50;
	const jExact = jaccard(SET_A, SET_B);
	const bloom = $derived(measureBloom(m, k, n));
	const strip = $derived(binDensity(bloom.bits, CELLS));
	const optK = $derived(optimalK(m, n));
	const probeKeys = $derived(
		probeMode === 'absent' ? absentKeys(PROBE_COUNT, n) : insertedKeys(n).slice(0, PROBE_COUNT),
	);
	const probeKey = $derived(probeKeys[probeIndex % probeKeys.length] ?? 0);
	const probeRes = $derived(probe(bloom.bits, m, k, probeKey));

	const sigA = $derived(minhashSignature(SET_A, t, 0));
	const sigB = $derived(minhashSignature(SET_B, t, 0));
	const estimate = $derived(minhashEstimate(sigA, sigB));
	const spreadTheory = $derived(minhashSpreadTheory(jExact, t));
	const spreadMeasured = $derived(minhashSpreadMeasured(t));
	const agree = $derived(Array.from({ length: t }, (_, i) => sigA[i] === sigB[i]));

	const pct = (x: number) => `${(x * 100).toFixed(2).replace('.', ',')} %`;
	const fmt = (x: number, digits: number) => x.toFixed(digits).replace('.', ',');

	const bloomDesc = $derived(
		`Фильтр на ${m} битов, элементов ${n}, хеш-функций ${k}. Ложных срабатываний по опыту ${pct(bloom.fpMeasured)}, по формуле ${pct(bloom.fpTheory)}. Ложных отрицаний: ${bloom.falseNegatives}.`,
	);
	const minhashDesc = $derived(
		`MinHash с ${t} перестановками: оценка сходства ${fmt(estimate, 2)}, точное значение 1/3.`,
	);

	const verdict = $derived.by(() => {
		if (probeMode === 'inserted') {
			return probeRes.present
				? 'возможно, есть: элемент вставлен, и фильтр его узнаёт'
				: 'ложное отрицание: для вставленного элемента такого быть не должно';
		}
		return probeRes.present
			? 'возможно, есть: все биты горят, но элемента в фильтре нет (ложное срабатывание)'
			: 'точно нет: хотя бы один бит погашен';
	});

	function reset(): void {
		m = DEFAULT_M;
		k = DEFAULT_K;
		n = DEFAULT_N;
		t = DEFAULT_T;
		probeMode = 'absent';
		probeIndex = 0;
	}
</script>

<figure class="bd" id="demo-bloom" data-demo="bloom">
	<section class="bd-part" aria-labelledby="bd-bloom-h">
		<h3 class="bd-h" id="bd-bloom-h">Bloom-фильтр</h3>

		<div class="bd-controls">
			<label class="bd-ctl">
				<span class="bd-label">Биты <span class="bd-sym">m</span></span>
				<input
					class="bd-range"
					type="range"
					min={M_MIN}
					max={M_MAX}
					step={M_STEP}
					value={m}
					oninput={(e) => (m = snapM(Number(e.currentTarget.value)))}
				/>
				<output class="bd-val">{m}</output>
			</label>
			<label class="bd-ctl">
				<span class="bd-label">Хеш-функции <span class="bd-sym">k</span></span>
				<input
					class="bd-range"
					type="range"
					min={K_MIN}
					max={K_MAX}
					step="1"
					value={k}
					oninput={(e) => (k = snapK(Number(e.currentTarget.value)))}
				/>
				<output class="bd-val">{k}</output>
			</label>
			<label class="bd-ctl">
				<span class="bd-label">Элементы <span class="bd-sym">n</span></span>
				<input
					class="bd-range"
					type="range"
					min={N_MIN}
					max={N_MAX}
					step={N_STEP}
					value={n}
					oninput={(e) => (n = snapN(Number(e.currentTarget.value)))}
				/>
				<output class="bd-val">{n}</output>
			</label>
		</div>

		<div class="bd-row">
			<button
				type="button"
				class="bd-btn"
				disabled={n >= N_MAX}
				onclick={() => (n = snapN(n + N_ADD))}
			>
				Добавить {N_ADD} элементов
			</button>
		</div>

		<p class="bd-muted bd-note">
			Битов на элемент m/n = {fmt(m / n, 2)}. Оптимальное k = ln 2 · m/n, округлённое: {optK}.
		</p>

		<svg
			class="bd-strip"
			viewBox="0 0 {CELLS} 1"
			preserveAspectRatio="none"
			role="img"
			aria-labelledby="bd-strip-t bd-strip-d"
		>
			<title id="bd-strip-t">Заполнение битового массива</title>
			<desc id="bd-strip-d">{bloomDesc}</desc>
			{#each strip as d, i (i)}
				<rect class="bd-cell" x={i} y="0" width="1" height="1" style="opacity: {0.08 + 0.92 * d}" />
			{/each}
		</svg>
		<p class="bd-muted bd-small">
			Каждая ячейка полосы усредняет часть массива битов; чем темнее, тем больше единиц.
		</p>

		<dl class="bd-stats">
			<div>
				<dt>Ложные срабатывания, опыт</dt>
				<dd class="bd-num">{pct(bloom.fpMeasured)}</dd>
			</div>
			<div>
				<dt>Формула (1 − e<sup>−kn/m</sup>)<sup>k</sup></dt>
				<dd class="bd-num">{pct(bloom.fpTheory)}</dd>
			</div>
			<div>
				<dt>Ложные отрицания</dt>
				<dd class="bd-num">{bloom.falseNegatives} из {n}</dd>
			</div>
			<div>
				<dt>Заполнено битов, опыт / формула</dt>
				<dd class="bd-num">{pct(bloom.fillMeasured)} / {pct(bloom.fillTheory)}</dd>
			</div>
		</dl>

		<div class="bd-probe">
			<div class="bd-row" role="group" aria-label="Какой элемент проверить">
				<button
					type="button"
					class="bd-btn"
					aria-pressed={probeMode === 'absent'}
					onclick={() => {
						probeMode = 'absent';
						probeIndex = 0;
					}}>Чужой элемент</button
				>
				<button
					type="button"
					class="bd-btn"
					aria-pressed={probeMode === 'inserted'}
					onclick={() => {
						probeMode = 'inserted';
						probeIndex = 0;
					}}>Вставленный элемент</button
				>
				<button
					type="button"
					class="bd-btn"
					onclick={() => (probeIndex = (probeIndex + 1) % PROBE_COUNT)}
				>
					Следующий
				</button>
			</div>
			<p class="bd-small">
				Элемент {probeKey.toString(16)}: биты {probeRes.positions.join(', ')}. Ответ: {verdict}.
			</p>
		</div>
	</section>

	<section class="bd-part" aria-labelledby="bd-mh-h">
		<h3 class="bd-h" id="bd-mh-h">MinHash: сходство множеств</h3>
		<p class="bd-small bd-muted">
			A = &#123;a, b, c, d&#125;, B = &#123;c, d, e, f&#125;. Точное J = 2 / 6 = 1/3.
		</p>

		<div class="bd-controls">
			<label class="bd-ctl">
				<span class="bd-label">Перестановки <span class="bd-sym">t</span></span>
				<input
					class="bd-range"
					type="range"
					min={T_MIN}
					max={T_MAX}
					step={T_STEP}
					value={t}
					oninput={(e) => (t = snapT(Number(e.currentTarget.value)))}
				/>
				<output class="bd-val">{t}</output>
			</label>
		</div>

		<div class="bd-agree" aria-hidden="true">
			{#each agree as same, i (i)}
				<span class="bd-dot" class:is-match={same}></span>
			{/each}
		</div>
		<p class="bd-small bd-muted">Совпавшие минимумы подсвечены. Их доля и есть оценка.</p>

		<dl class="bd-stats">
			<div>
				<dt>Оценка по подписи</dt>
				<dd class="bd-num">{fmt(estimate, 2)}</dd>
			</div>
			<div>
				<dt>Точное J</dt>
				<dd class="bd-num">{fmt(jExact, 2)}</dd>
			</div>
			<div>
				<dt>Разброс: формула √(J(1−J)/t)</dt>
				<dd class="bd-num">{fmt(spreadTheory, 3)}</dd>
			</div>
			<div>
				<dt>Разброс по {SPREAD_TRIALS} запускам</dt>
				<dd class="bd-num">{fmt(spreadMeasured, 3)}</dd>
			</div>
		</dl>
	</section>

	<div class="bd-foot">
		<p class="bd-small" aria-live="polite">{bloomDesc} {minhashDesc}</p>
		<p class="bd-small">
			<strong>Что заметить:</strong> при фиксированных m и n рост k снижает долю ложных срабатываний только
			до оптимума k ≈ ln 2 · m/n, дальше она растёт: массив заполняется единицами. Новые элементы поджигают
			новые биты, поэтому при росте n доля ложных срабатываний растёт. Ложных отрицаний не появляется
			ни при каких настройках.
		</p>
		<button type="button" class="bd-btn" onclick={reset}>Сбросить</button>
	</div>
</figure>

<style>
	.bd {
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
		display: grid;
		gap: var(--space-6);
	}
	.bd :global(*),
	.bd :global(*::before),
	.bd :global(*::after) {
		box-sizing: border-box;
	}
	.bd p,
	.bd dl,
	.bd dd,
	.bd dt,
	.bd h3 {
		margin: 0;
	}
	.bd button {
		font: inherit;
	}
	.bd-h {
		font-size: var(--fs-base);
		font-weight: 600;
		margin-bottom: var(--space-3);
	}
	.bd-part {
		display: grid;
		gap: var(--space-3);
	}
	.bd-muted {
		color: var(--text-muted);
	}
	.bd-small {
		font-size: 13px;
	}
	.bd-sym {
		font-family: var(--font-serif);
		font-size: 16px;
	}
	.bd-controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4) var(--space-8);
	}
	.bd-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.bd-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex: 1 1 260px;
	}
	.bd-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.bd-range {
		flex: 1;
		min-width: 120px;
		accent-color: var(--topic);
	}
	.bd-range:focus-visible,
	.bd-btn:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}
	.bd-val {
		font-family: var(--font-mono);
		min-width: 4ch;
		text-align: right;
	}
	.bd-strip {
		width: 100%;
		height: 28px;
		display: block;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}
	.bd-cell {
		fill: var(--topic);
	}
	.bd-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: var(--space-3);
	}
	.bd-stats > div {
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}
	.bd-stats dt {
		color: var(--text-muted);
		font-size: 12px;
	}
	.bd-num {
		font-family: var(--font-mono);
		font-size: 15px;
		margin-top: 2px;
		overflow-wrap: anywhere;
	}
	.bd-probe {
		display: grid;
		gap: var(--space-2);
		justify-items: start;
	}
	.bd-btn {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		cursor: pointer;
	}
	.bd-btn[aria-pressed='true'] {
		background: var(--topic);
		border-color: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.bd-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.bd-agree {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
	}
	.bd-dot {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		background: var(--border);
	}
	.bd-dot.is-match {
		background: var(--topic);
	}
	.bd-foot {
		display: grid;
		gap: var(--space-3);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
		justify-items: start;
	}
	@media (prefers-reduced-motion: no-preference) {
		.bd-cell {
			transition: opacity var(--dur) var(--ease);
		}
	}
	@media (max-width: 559px) {
		.bd {
			padding: var(--space-4);
		}
	}
</style>
