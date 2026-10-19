<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		DEFAULT_ADDR,
		FRAMES_DEFAULT,
		FRAMES_MAX,
		FRAMES_MIN,
		LOOP_DEFAULT,
		LOOP_MAX,
		LOOP_MIN,
		LOOP_REPEATS,
		type OsMemoryDemoState,
		countStats,
		type AccessResult,
		describeLoop,
		describeStep,
		hex,
		loopAccesses,
		pageUniverse,
		parseAddress,
		residentAt,
		simulate,
		snapFrames,
		snapLoop,
		splitAddress,
		translate,
	} from '$lib/demos/os-memory';

	/** Virtual memory demo: address split, page table, RAM frames and page faults. Registers itself as demo `os-memory`. */
	let { initial }: { initial?: Partial<OsMemoryDemoState> } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	let frames = $state(snapFrames(initial?.frames ?? FRAMES_DEFAULT));
	/* svelte-ignore state_referenced_locally */
	let loopSize = $state(snapLoop(initial?.loopSize ?? LOOP_DEFAULT));
	let addrText = $state(hex(DEFAULT_ADDR));
	/** Sequence of accessed pages (page numbers). */
	let accesses = $state<number[]>([]);
	/** Number of accesses already performed; the rest wait for «Шаг». */
	let pos = $state(0);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const addr = $derived(parseAddress(addrText));
	const addrSplit = $derived(addr === null ? null : splitAddress(addr));
	const steps = $derived(simulate(accesses, frames));
	const shown = $derived(Math.min(pos, accesses.length));
	const current = $derived<AccessResult | null>(shown > 0 ? (steps[shown - 1] ?? null) : null);
	const resident = $derived(residentAt(steps, shown));
	const stats = $derived(countStats(steps.slice(0, shown)));
	const universe = $derived(pageUniverse(addrSplit?.page ?? null, loopSize, accesses));
	const tr = $derived(addr === null ? null : translate(addr, resident));
	const pending = $derived(accesses.length - shown);
	const frameIdx = $derived(Array.from({ length: frames }, (_, i) => i));
	const loopNote = $derived(describeLoop(frames, loopSize));
	const lastNote = $derived(describeStep(current));
	const faultShare = $derived(
		stats.accesses > 0 ? Math.round((100 * stats.faults) / stats.accesses) : 0,
	);

	/** Adds one access and runs everything that is still waiting. */
	function touch(page: number): void {
		accesses = [...accesses, page];
		pos = accesses.length;
	}

	function onAddressSubmit(e: SubmitEvent): void {
		e.preventDefault();
		if (addrSplit) touch(addrSplit.page);
	}

	/** Appends the cyclic pattern without running it: «Шаг» then goes through it one access at a time. */
	function addLoop(): void {
		accesses = [...accesses, ...loopAccesses(loopSize, LOOP_REPEATS)];
	}

	function step(): void {
		if (pos < accesses.length) pos += 1;
	}

	function runAll(): void {
		pos = accesses.length;
	}

	function jumpTo(i: number): void {
		pos = i + 1;
	}

	function reset(): void {
		frames = FRAMES_DEFAULT;
		loopSize = LOOP_DEFAULT;
		addrText = hex(DEFAULT_ADDR);
		accesses = [];
		pos = 0;
	}

	function apply(patch: Partial<OsMemoryDemoState>): void {
		if (typeof patch.frames === 'number') frames = snapFrames(patch.frames);
		if (typeof patch.loopSize === 'number') loopSize = snapLoop(patch.loopSize);
	}

	onMount(() => {
		return demos?.register('os-memory', {
			set: (patch) => apply(patch as Partial<OsMemoryDemoState>),
		});
	});
</script>

<figure class="os" id="demo-os-memory" data-demo="os-memory">
	<div class="os-controls">
		<label class="os-ctl">
			<span class="os-label">Кадров в RAM</span>
			<input
				class="os-range"
				type="range"
				min={FRAMES_MIN}
				max={FRAMES_MAX}
				step="1"
				value={frames}
				oninput={(e) => (frames = snapFrames(Number(e.currentTarget.value)))}
			/>
			<output class="os-val">{frames}</output>
		</label>

		<label class="os-ctl">
			<span class="os-label">Страниц в цикле</span>
			<input
				class="os-range"
				type="range"
				min={LOOP_MIN}
				max={LOOP_MAX}
				step="1"
				value={loopSize}
				oninput={(e) => (loopSize = snapLoop(Number(e.currentTarget.value)))}
			/>
			<output class="os-val">{loopSize}</output>
		</label>
	</div>

	<form class="os-addr" onsubmit={onAddressSubmit}>
		<label class="os-label" for="os-addr-input">Виртуальный адрес</label>
		<input
			id="os-addr-input"
			class="os-input"
			type="text"
			bind:value={addrText}
			autocomplete="off"
			spellcheck="false"
			aria-invalid={addr === null}
			aria-describedby="os-addr-hint"
		/>
		<button type="submit" class="os-btn os-btn-primary" disabled={addr === null}>
			Обратиться
		</button>
	</form>
	<p id="os-addr-hint" class="os-hint" class:os-err={addr === null}>
		{#if addrSplit}
			Номер страницы {hex(addrSplit.page, 5)}, смещение {hex(addrSplit.offset, 3)}.
		{:else}
			Нужны от 1 до 8 шестнадцатеричных цифр: от 0x0 до 0xFFFFFFFF.
		{/if}
	</p>

	{#if addrSplit && tr}
		<div class="os-split">
			<div class="os-bits" aria-hidden="true">
				<span class="os-bit os-bit-page">биты 31–12: страница {hex(tr.page, 5)}</span>
				<span class="os-bit os-bit-off">биты 11–0: смещение {hex(tr.offset, 3)}</span>
			</div>
			<p class="os-chain">
				{#if tr.frame !== null}
					Сейчас: страница {hex(tr.page, 5)} → кадр {tr.frame} → физический адрес
					<strong class="os-mono">{hex(tr.physical ?? 0, 8)}</strong>
				{:else}
					Сейчас страницы {hex(tr.page, 5)} нет в RAM: обращение даст страничное прерывание.
				{/if}
			</p>
		</div>
	{/if}

	<div class="os-main">
		<div class="os-panel">
			<table class="os-table">
				<caption class="os-h">Таблица страниц</caption>
				<thead>
					<tr>
						<th scope="col">Страница</th>
						<th scope="col">Кадр</th>
						<th scope="col"><span class="os-sr">Действие</span></th>
					</tr>
				</thead>
				<tbody>
					{#each universe as p (p)}
						{@const r = resident.find((x) => x.page === p)}
						<tr class:os-row-current={current?.page === p}>
							<th scope="row" class="os-mono">{hex(p, 5)}</th>
							<td class="os-mono" class:os-muted={!r}>{r ? r.frame : 'нет в RAM'}</td>
							<td>
								<button
									type="button"
									class="os-btn os-btn-small"
									onclick={() => touch(p)}
									aria-label="Обратиться к странице {hex(p, 5)}">Обратиться</button
								>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="os-panel">
			<p class="os-h">Оперативная память</p>
			<ol class="os-frames" aria-label="Кадры оперативной памяти">
				{#each frameIdx as i (i)}
					{@const r = resident.find((x) => x.frame === i)}
					<li
						class="os-frame"
						class:is-current={current !== null && current.frame === i}
						class:is-fault={current !== null && current.frame === i && current.fault}
						class:is-hit={current !== null && current.frame === i && !current.fault}
					>
						<span class="os-frame-n">кадр {i}</span>
						<span class="os-mono">{r ? hex(r.page, 5) : 'свободен'}</span>
					</li>
				{/each}
			</ol>
			<div class="os-status" aria-live="polite">
				<p>{lastNote}</p>
			</div>
		</div>
	</div>

	<div class="os-seq" role="group" aria-label="Последовательность обращений">
		{#if accesses.length === 0}
			<p class="os-hint">Обращений пока нет.</p>
		{:else}
			{#each accesses as page, i (i)}
				<button
					type="button"
					class="os-chip"
					class:is-fault={i < shown && steps[i]?.fault === true}
					class:is-hit={i < shown && steps[i]?.fault === false}
					class:is-current={i === shown - 1}
					class:is-pending={i >= shown}
					aria-current={i === shown - 1 ? 'step' : undefined}
					aria-label="Обращение {i + 1}: страница {hex(page, 5)}, {i < shown
						? steps[i]?.fault
							? 'страничное прерывание'
							: 'попадание'
						: 'ещё не выполнено'}"
					onclick={() => jumpTo(i)}
				>
					{hex(page, 5)}
				</button>
			{/each}
		{/if}
	</div>

	<div class="os-actions">
		<button type="button" class="os-btn" onclick={step} disabled={pending === 0}>Шаг</button>
		<button type="button" class="os-btn" onclick={runAll} disabled={pending === 0}>
			Дальше всё
		</button>
		<button type="button" class="os-btn" onclick={addLoop}>
			Добавить цикл ×{LOOP_REPEATS}
		</button>
		<button type="button" class="os-btn" onclick={reset}>Сброс</button>
	</div>

	<dl class="os-stats">
		<dt>Обращений</dt>
		<dd class="os-mono">{stats.accesses}</dd>
		<dt>Страничных прерываний</dt>
		<dd class="os-mono">{stats.faults}</dd>
		<dt>Попаданий</dt>
		<dd class="os-mono">{stats.hits}</dd>
		<dt>Доля прерываний</dt>
		<dd class="os-mono">{faultShare}%</dd>
	</dl>

	<div class="os-notice">
		<p class="os-h">Что заметить</p>
		<p>{loopNote}</p>
		{#if tr}
			<p>
				Смещение {hex(tr.offset, 3)} при переводе не меняется: меняется только номер кадра.
			</p>
		{/if}
	</div>
</figure>

<style>
	.os {
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
	.os :global(*),
	.os :global(*::before),
	.os :global(*::after) {
		box-sizing: border-box;
	}
	.os p,
	.os dl,
	.os dd,
	.os dt,
	.os ol {
		margin: 0;
		padding: 0;
	}
	.os button,
	.os input {
		font: inherit;
	}
	.os-h {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.os-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.os-muted {
		color: var(--text-muted);
	}
	.os-mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.os-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	.os-hint {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 13px;
	}
	.os-err {
		color: var(--fail);
	}

	/* Controls */
	.os-controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.os-ctl {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.os-range {
		width: 150px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.os-val {
		min-width: 2ch;
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.os-addr {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		margin-top: var(--space-4);
	}
	.os-input {
		height: 36px;
		width: 160px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border-control);
		border-radius: var(--radius-sm);
		background: var(--bg);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
	}
	.os-input[aria-invalid='true'] {
		border-color: var(--fail);
	}

	/* Buttons */
	.os-btn {
		height: 34px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border-control);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			opacity var(--dur) var(--ease);
	}
	.os-btn:hover:not(:disabled) {
		background: var(--topic-soft);
	}
	.os-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.os-btn-primary {
		background: var(--topic);
		border-color: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.os-btn-primary:hover:not(:disabled) {
		background: var(--topic);
		opacity: 0.9;
	}
	.os-btn-small {
		height: 28px;
		padding: 0 var(--space-2);
		font-size: 12px;
	}
	.os input:focus-visible,
	.os button:focus-visible,
	.os-range:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Address split and translation */
	.os-split {
		margin-top: var(--space-4);
	}
	.os-bits {
		display: flex;
		gap: 2px;
		font-size: 12px;
	}
	.os-bit {
		display: block;
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
		color: var(--surface);
		font-family: var(--font-mono);
		line-height: 1.3;
	}
	.os-bit-page {
		flex: 20 1 0;
		background: var(--cat-1);
	}
	.os-bit-off {
		flex: 12 1 0;
		background: var(--cat-2);
	}
	.os-chain {
		margin-top: var(--space-2);
		color: var(--text);
	}

	/* Two panels */
	.os-main {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.os-panel {
		min-width: 0;
	}
	.os-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}
	.os-table caption {
		text-align: left;
		caption-side: top;
	}
	.os-table th,
	.os-table td {
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--border);
		text-align: left;
		font-weight: 400;
	}
	.os-table thead th {
		color: var(--text-muted);
		font-size: 12px;
	}
	.os-table tbody th {
		color: var(--text);
	}
	.os-table tr.os-row-current th,
	.os-table tr.os-row-current td {
		background: var(--topic-soft);
	}

	.os-frames {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
		gap: var(--space-2);
		list-style: none;
		padding: 0;
	}
	.os-frame {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg);
		font-size: 12px;
		transition:
			border-color var(--dur) var(--ease),
			background var(--dur) var(--ease);
	}
	.os-frame-n {
		color: var(--text-muted);
	}
	.os-frame.is-current {
		border-color: var(--topic);
		border-width: 2px;
	}
	.os-frame.is-fault {
		background: var(--warn-bg);
	}
	.os-frame.is-hit {
		background: var(--topic-soft);
	}
	.os-status {
		margin-top: var(--space-3);
		min-height: 3em;
		color: var(--text);
		font-size: 13px;
	}

	/* Timeline of accesses */
	.os-seq {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-6);
	}
	.os-chip {
		height: 30px;
		padding: 0 var(--space-2);
		border: 1px solid var(--border-control);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 12px;
		cursor: pointer;
		transition: opacity var(--dur) var(--ease);
	}
	.os-chip.is-fault {
		border-color: var(--warn);
		background: var(--warn-bg);
	}
	.os-chip.is-hit {
		border-color: var(--ok);
	}
	.os-chip.is-pending {
		opacity: 0.45;
	}
	.os-chip.is-current {
		outline: 2px solid var(--topic);
		outline-offset: 1px;
	}

	.os-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-6);
	}

	/* Statistics and notice */
	.os-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.os-stats dt {
		color: var(--text-muted);
	}
	.os-stats dd {
		color: var(--text);
		text-align: right;
	}
	.os-notice {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	.os-notice .os-h {
		color: var(--text);
	}

	@media (prefers-reduced-motion: reduce) {
		.os *,
		.os *::before,
		.os *::after {
			transition: none !important;
		}
	}

	@media (max-width: 720px) {
		.os {
			padding: var(--space-4);
		}
		.os-main {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 559px) {
		.os-range {
			width: 120px;
		}
		.os-input {
			width: 100%;
			flex: 1 1 100%;
		}
		.os-addr .os-label {
			flex: 1 1 100%;
		}
		.os-stats {
			grid-template-columns: minmax(0, 1fr) auto;
		}
	}
</style>
