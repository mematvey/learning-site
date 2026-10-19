<script module lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { FORMATS, formatAt, fsum, kahanSum, naiveSum } from '$lib/demos/floating-point';

	/** One million values of 0.1, shared by all instances. */
	const TENTHS: number[] = new Array<number>(1_000_000).fill(0.1);
	/** Sums are cached per method, format index and count: each one costs up to a million steps. */
	const sumCache = new SvelteMap<string, number>();

	/** Sum of the first n values of 0.1 with the given method; format index 3 (float64) for Kahan and fsum. */
	function cachedSum(method: 'naive' | 'kahan' | 'fsum', fmtIndex: number, n: number): number {
		const key = `${method}:${fmtIndex}:${n}`;
		const hit = sumCache.get(key);
		if (hit !== undefined) return hit;
		const xs = TENTHS.slice(0, n);
		let value: number;
		if (method === 'naive') value = naiveSum(xs, formatAt(fmtIndex));
		else if (method === 'kahan') value = kahanSum(xs);
		else value = fsum(xs);
		sumCache.set(key, value);
		return value;
	}

	/** Russian decimal comma; up to 17 significant digits so the stored value is visible. */
	function fmtNum(v: number): string {
		if (Number.isNaN(v)) return 'nan';
		if (!Number.isFinite(v)) return v > 0 ? 'inf' : '-inf';
		let s = v.toPrecision(17);
		if (s.includes('.') && !s.includes('e')) s = s.replace(/\.?0+$/, '');
		return s.replace('.', ',');
	}

	/** Short form for probabilities and deviations. */
	function fmtExp(v: number): string {
		if (v === 0) return '0';
		return v.toExponential(2).replace('.', ',');
	}

	function fmtDev(d: number): string {
		if (d === 0) return '0';
		return (d > 0 ? '+' : '') + fmtExp(d);
	}
</script>

<script lang="ts">
	import {
		bitsOf,
		decompose,
		machineEpsilon,
		relativeRoundingError,
		roundTo,
		softmaxNaive,
		softmaxStable,
		valueOf,
		bias,
	} from '$lib/demos/floating-point';

	/** Floating-point demo: bits, rounding, summation, softmax. Props only seed the format. */
	let { initial }: { initial?: { format?: string } } = $props();

	const SUM_N = [1_000, 10_000, 100_000, 1_000_000];
	const FLOAT64 = 3;
	const startIndex = FORMATS.findIndex((f) => f.name === initial?.format);
	let fmtIndex = $state(startIndex >= 0 ? startIndex : FLOAT64);
	const fmt = $derived(formatAt(fmtIndex));
	/* svelte-ignore state_referenced_locally */
	let bits = $state<number[]>(bitsOf(0.1, formatAt(fmtIndex)));
	let sumIndex = $state(SUM_N.length - 1);
	let expK = $state(16);
	let shift = $state(1000);

	const value = $derived(valueOf(bits, fmt));
	const d = $derived(decompose(bits, fmt));
	const groups = $derived([
		{ title: 'знак', from: 0, to: 1, color: 'var(--cat-2)' },
		{ title: `порядок, ${fmt.expBits} бит`, from: 1, to: 1 + fmt.expBits, color: 'var(--cat-1)' },
		{
			title: `мантисса, ${fmt.mantBits} бит`,
			from: 1 + fmt.expBits,
			to: bits.length,
			color: 'var(--cat-3)',
		},
	]);
	const explanation = $derived.by(() => {
		if (d.kind === 'nan') return 'Порядок весь из единиц и мантисса ненулевая: это NaN (не число).';
		if (d.kind === 'inf')
			return `Порядок весь из единиц, мантисса нулевая: ${d.sign ? '−' : ''}бесконечность.`;
		if (d.kind === 'zero') return 'Все биты порядка и мантиссы нулевые: ноль.';
		const label = d.kind === 'subnormal' ? 'Денормализованное число' : 'Число';
		return `${label}: (−1)^${d.sign} · ${fmtNum(d.significand)} · 2^${d.exponent}. Порядок ${d.kind === 'subnormal' ? 'фиксирован' : `${d.exponent + bias(fmt)} − смещение ${bias(fmt)} = ${d.exponent}`}.`;
	});

	const rounded = $derived(roundTo(0.1, fmt));
	const roundErr = $derived(relativeRoundingError(0.1, fmt));
	const eps = $derived(machineEpsilon(fmt));

	const n = $derived(SUM_N[sumIndex] ?? 1_000_000);
	const ref = $derived(n / 10);
	const sumRows = $derived([
		{ label: 'Наивно, float64', value: cachedSum('naive', FLOAT64, n) },
		{ label: `Наивно, ${fmt.name}`, value: cachedSum('naive', fmtIndex, n) },
		{ label: 'Кэхэна, float64', value: cachedSum('kahan', FLOAT64, n) },
		{ label: 'math.fsum, float64', value: cachedSum('fsum', FLOAT64, n) },
	]);
	const naive64 = $derived(cachedSum('naive', FLOAT64, n));
	const kahan = $derived(cachedSum('kahan', FLOAT64, n));

	const pair = $derived([shift, shift + 1]);
	const softNaive = $derived(softmaxNaive(pair));
	const softStable = $derived(softmaxStable(pair));

	const sumEqualsThird = 0.1 + 0.2 === 0.3;
	const bigPlus = $derived(10 ** expK + 1);
	const absorbed = $derived(bigPlus === 10 ** expK);

	const ALL_FORMATS = FORMATS.map((f) => f.name);

	function setFormat(i: number): void {
		fmtIndex = i;
		bits = bitsOf(0.1, formatAt(i));
	}

	function toggle(i: number): void {
		const next = bits.slice();
		next[i] = next[i] === 1 ? 0 : 1;
		bits = next;
	}

	function resetAll(): void {
		setFormat(FLOAT64);
		sumIndex = SUM_N.length - 1;
		expK = 16;
		shift = 1000;
	}

	function fmtSoft(v: number): string {
		return Number.isFinite(v) ? v.toFixed(3).replace('.', ',') : fmtNum(v);
	}
</script>

<figure class="fp" data-demo="floating-point">
	<section class="fp-block" aria-labelledby="fp-h-bits">
		<h4 id="fp-h-bits" class="fp-h">1. Биты числа</h4>
		<div class="fp-ctl">
			<label class="fp-label" for="fp-fmt">
				Формат: <output class="fp-val">{fmt.name}</output>
			</label>
			<input
				id="fp-fmt"
				class="fp-range"
				type="range"
				min="0"
				max={FORMATS.length - 1}
				step="1"
				value={fmtIndex}
				aria-valuetext={fmt.name}
				oninput={(e) => setFormat(Number(e.currentTarget.value))}
			/>
			<div class="fp-ticks" aria-hidden="true">
				{#each ALL_FORMATS as name (name)}
					<span>{name}</span>
				{/each}
			</div>
		</div>

		<div class="fp-bits">
			{#each groups as g (g.title)}
				<div class="fp-group" style="--g: {g.color}">
					<span class="fp-glabel">{g.title}</span>
					<div class="fp-grid">
						{#each bits.slice(g.from, g.to) as bit, j (g.from + j)}
							<button
								type="button"
								class="fp-bit"
								aria-pressed={bit === 1}
								aria-label="{g.title}, бит {g.from + j + 1}, значение {bit}"
								onclick={() => toggle(g.from + j)}>{bit}</button
							>
						{/each}
					</div>
				</div>
			{/each}
		</div>
		<p class="fp-hint">Щёлкайте биты: значение пересчитывается сразу.</p>

		<p class="fp-result" aria-live="polite">
			Значение: <strong>{fmtNum(value)}</strong>. {explanation}
		</p>
		<p class="fp-note">
			0,1 в {fmt.name} хранится как {fmtNum(rounded)}. Относительная ошибка δ = {fmtDev(roundErr)},
			граница ε/2 = {fmtExp(eps / 2)}, где ε = 2<sup>−{fmt.mantBits}</sup> = {fmtExp(eps)}.
		</p>
	</section>

	<section class="fp-block" aria-labelledby="fp-h-add">
		<h4 id="fp-h-add" class="fp-h">2. Сложение и степени двойки</h4>
		<p class="fp-line">
			0,1 + 0,2 = <strong>{fmtNum(0.1 + 0.2)}</strong>; 0,1 + 0,2 == 0,3:
			<strong>{sumEqualsThird ? 'да' : 'нет'}</strong>.
		</p>
		<div class="fp-ctl">
			<label class="fp-label" for="fp-k">
				Прибавляем 1 к 10<sup>k</sup>, k = <output class="fp-val">{expK}</output>
			</label>
			<input
				id="fp-k"
				class="fp-range"
				type="range"
				min="1"
				max="22"
				step="1"
				value={expK}
				oninput={(e) => (expK = Number(e.currentTarget.value))}
			/>
		</div>
		<p class="fp-line" aria-live="polite">
			10<sup>{expK}</sup> + 1 = {fmtNum(bigPlus)} в float64:
			{absorbed ? 'единица потеряна (поглощение)' : 'единица сохранилась'}.
		</p>
	</section>

	<section class="fp-block" aria-labelledby="fp-h-sum">
		<h4 id="fp-h-sum" class="fp-h">3. Сумма n слагаемых 0,1</h4>
		<div class="fp-seg" role="group" aria-label="Число слагаемых">
			{#each SUM_N as count, i (count)}
				<button
					type="button"
					class="fp-btn"
					aria-pressed={sumIndex === i}
					onclick={() => (sumIndex = i)}>{count.toLocaleString('ru-RU')}</button
				>
			{/each}
		</div>
		<div class="fp-table-wrap">
			<table class="fp-table">
				<caption>Точный ответ: {fmtNum(ref)}</caption>
				<thead>
					<tr
						><th scope="col">Метод</th><th scope="col">Результат</th><th scope="col">Отклонение</th
						></tr
					>
				</thead>
				<tbody>
					{#each sumRows as r (r.label)}
						<tr>
							<th scope="row">{r.label}</th>
							<td>{fmtNum(r.value)}</td>
							<td>{fmtDev(r.value - ref)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="fp-block" aria-labelledby="fp-h-soft">
		<h4 id="fp-h-soft" class="fp-h">4. Softmax на логитах [z; z + 1]</h4>
		<div class="fp-ctl">
			<label class="fp-label" for="fp-z">
				z = <output class="fp-val">{shift}</output>
			</label>
			<input
				id="fp-z"
				class="fp-range"
				type="range"
				min="0"
				max="1000"
				step="1"
				value={shift}
				oninput={(e) => (shift = Number(e.currentTarget.value))}
			/>
		</div>
		<p class="fp-line" aria-live="polite">
			Без вычитания максимума: exp({shift}) = {fmtNum(Math.exp(shift))}, результат
			<strong>[{softNaive.map(fmtSoft).join('; ')}]</strong>.
		</p>
		<p class="fp-line">
			Со сдвигом на максимум: <strong>[{softStable.map(fmtSoft).join('; ')}]</strong>.
		</p>
	</section>

	<section class="fp-notice" aria-labelledby="fp-h-notice">
		<h4 id="fp-h-notice" class="fp-h">Что заметить</h4>
		<ul class="fp-list">
			<li>
				При n = {n.toLocaleString('ru-RU')} наивная сумма float64 отклоняется от точной на
				{fmtDev(naive64 - ref)}, а сумма Кэхэна дает {fmtNum(kahan)}.
			</li>
			<li>
				В {fmt.name} та же наивная сумма отклоняется на {fmtDev(
					cachedSum('naive', fmtIndex, n) - ref,
				)}: чем меньше бит мантиссы, тем раньше теряется точность.
			</li>
			<li>
				Softmax без сдвига при z = {shift} даёт [{softNaive.map(fmtSoft).join('; ')}]; со сдвигом
				ответ остаётся конечным.
			</li>
		</ul>
	</section>

	<div class="fp-actions">
		<button type="button" class="fp-btn fp-btn-primary" onclick={resetAll}>Сбросить опыты</button>
	</div>
</figure>

<style>
	.fp {
		margin: 0;
		display: grid;
		gap: var(--space-4);
		padding: var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--fs-sm);
		line-height: var(--lh-body);
		min-width: 0;
		box-sizing: border-box;
	}
	.fp-block,
	.fp-notice {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
	}
	.fp-block:first-child {
		border-top: 0;
		padding-top: 0;
	}
	.fp-h {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--fs-base);
		font-weight: 600;
	}
	.fp-ctl {
		display: grid;
		gap: var(--space-1);
		min-width: 0;
	}
	.fp-label {
		color: var(--text-muted);
	}
	.fp-val {
		font-family: var(--font-mono);
		color: var(--text);
		font-weight: 600;
	}
	.fp-range {
		width: 100%;
		accent-color: var(--topic);
		min-height: 24px;
	}
	.fp-ticks {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		color: var(--text-muted);
		font-size: var(--fs-sm);
		text-align: center;
	}
	.fp-bits {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	.fp-group {
		display: grid;
		gap: var(--space-1);
		min-width: 0;
	}
	.fp-glabel {
		color: var(--g);
		font-weight: 600;
	}
	.fp-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(1.75rem, 1fr));
		gap: 4px;
	}
	.fp-bit,
	.fp-btn {
		font: inherit;
		font-family: var(--font-mono);
		min-height: 32px;
		min-width: 28px;
		padding: 0 var(--space-1);
		border: 1px solid var(--border-control);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text);
		cursor: pointer;
		transition:
			background var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease);
	}
	.fp-bit[aria-pressed='true'] {
		background: var(--g);
		border-color: var(--g);
		color: var(--surface);
		font-weight: 600;
	}
	.fp-btn[aria-pressed='true'],
	.fp-btn-primary {
		background: var(--topic);
		border-color: var(--topic);
		color: var(--surface);
	}
	.fp-bit:focus-visible,
	.fp-btn:focus-visible,
	.fp-range:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.fp-hint,
	.fp-note {
		margin: 0;
		color: var(--text-muted);
	}
	.fp-result,
	.fp-line {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.fp-seg {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.fp-table-wrap {
		min-width: 0;
	}
	.fp-table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}
	.fp-table caption {
		text-align: left;
		color: var(--text-muted);
		padding-bottom: var(--space-1);
	}
	.fp-table th,
	.fp-table td {
		padding: var(--space-1);
		border-bottom: 1px solid var(--border);
		text-align: left;
		font-family: var(--font-mono);
		overflow-wrap: anywhere;
	}
	.fp-table thead th {
		font-family: var(--font-sans);
		color: var(--text-muted);
	}
	.fp-list {
		margin: 0;
		padding-left: var(--space-4);
		display: grid;
		gap: var(--space-1);
	}
	.fp-notice {
		background: var(--surface-2);
		border-radius: var(--radius);
		padding: var(--space-3);
		border-top: 0;
	}
	.fp-actions {
		display: flex;
		justify-content: flex-end;
	}
	@media (prefers-reduced-motion: reduce) {
		.fp-bit,
		.fp-btn {
			transition: none;
		}
	}
</style>
