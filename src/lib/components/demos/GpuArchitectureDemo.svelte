<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		BEST_PRACTICES_URL,
		BLOCKS_DEFAULT,
		BLOCKS_MAX,
		BLOCKS_MIN,
		NODE_INFO,
		SMS_DEFAULT,
		SMS_MAX,
		SMS_MIN,
		THREADS_DEFAULT,
		THREADS_MAX,
		THREADS_MIN,
		WARP_SIZE,
		describeLaunch,
		distributeBlocks,
		isNodeId,
		laneStats,
		snapBlocks,
		snapSms,
		snapThreads,
		wavesFor,
		type GpuArchitectureDemoState,
		type NodeId,
	} from '$lib/demos/gpu-architecture';

	/** GPU architecture demo: thread blocks, warps, SMs and the memory ladder. Registers as demo `gpu-architecture`. */
	let { initial }: { initial?: Partial<GpuArchitectureDemoState> } = $props();

	/* Starting values: the reset button returns to them. */
	/* svelte-ignore state_referenced_locally */
	const start = {
		threads: snapThreads(initial?.threads ?? THREADS_DEFAULT),
		sms: snapSms(initial?.sms ?? SMS_DEFAULT),
		blocks: snapBlocks(initial?.blocks ?? BLOCKS_DEFAULT),
	};

	/* The props only seed the initial state: the demo owns it afterwards. */
	let threads = $state(start.threads);
	let sms = $state(start.sms);
	let blocks = $state(start.blocks);
	/** Node chosen by click or keyboard; its card shows the numbers and the source. */
	let node = $state<NodeId | null>(null);

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const lanes = $derived(laneStats(threads));
	const counts = $derived(distributeBlocks(blocks, sms));
	const busiest = $derived(Math.max(0, ...counts));
	const waves = $derived(wavesFor(blocks, sms));
	const smIdx = $derived(Array.from({ length: sms }, (_, i) => i));
	/** One entry per block on each SM, for the block squares. */
	const blockSlots = $derived(counts.map((n) => Array.from({ length: n }, (_, b) => b)));
	/** Warp rows of the block: each cell is one thread slot; slots past the block size are idle. */
	const rows = $derived(
		Array.from({ length: lanes.warps }, (_, w) =>
			Array.from({ length: WARP_SIZE }, (_, l) => {
				const t = w * WARP_SIZE + l;
				return { t, active: t < lanes.active };
			}),
		),
	);
	const info = $derived(node ? NODE_INFO[node] : null);
	const note = $derived(describeLaunch({ threads, sms, blocks }));

	function apply(patch: Partial<GpuArchitectureDemoState> & { node?: unknown }): void {
		if (typeof patch.threads === 'number') threads = snapThreads(patch.threads);
		if (typeof patch.sms === 'number') sms = snapSms(patch.sms);
		if (typeof patch.blocks === 'number') blocks = snapBlocks(patch.blocks);
		if (isNodeId(patch.node)) node = patch.node;
	}

	function reset(): void {
		threads = start.threads;
		sms = start.sms;
		blocks = start.blocks;
		node = null;
	}

	onMount(() =>
		demos?.register('gpu-architecture', {
			set: (patch) => apply(patch as Partial<GpuArchitectureDemoState> & { node?: unknown }),
		}),
	);
</script>

<figure class="gp" id="demo-gpu-architecture" data-demo="gpu-architecture">
	<div class="gp-controls">
		<label class="gp-ctl">
			<span class="gp-label">Потоков в блоке</span>
			<input
				class="gp-range"
				type="range"
				min={THREADS_MIN}
				max={THREADS_MAX}
				step="1"
				value={threads}
				oninput={(e) => (threads = snapThreads(Number(e.currentTarget.value)))}
			/>
			<output class="gp-val">{threads}</output>
		</label>

		<label class="gp-ctl">
			<span class="gp-label">SM на схеме</span>
			<input
				class="gp-range"
				type="range"
				min={SMS_MIN}
				max={SMS_MAX}
				step="1"
				value={sms}
				oninput={(e) => (sms = snapSms(Number(e.currentTarget.value)))}
			/>
			<output class="gp-val">{sms}</output>
		</label>

		<label class="gp-ctl">
			<span class="gp-label">Блоков в запуске</span>
			<input
				class="gp-range"
				type="range"
				min={BLOCKS_MIN}
				max={BLOCKS_MAX}
				step="1"
				value={blocks}
				oninput={(e) => (blocks = snapBlocks(Number(e.currentTarget.value)))}
			/>
			<output class="gp-val">{blocks}</output>
		</label>

		<button type="button" class="gp-reset" onclick={reset}>Сбросить</button>
	</div>

	<div class="gp-grid">
		<section class="gp-scheme" aria-label="Схема GPU">
			<p class="gp-t">Схема GPU</p>
			<div class="gp-chip">
				<p class="gp-sub">
					Мультипроцессоры SM (показано {sms}). Блоки распределены по SM по кругу.
				</p>
				<div class="gp-sms">
					{#each smIdx as i (i)}
						<div class="gp-sm" class:gp-sm-open={i === 0}>
							<p class="gp-sm-t">
								SM {i + 1} <span class="gp-muted">блоков: {counts[i] ?? 0}</span>
							</p>
							<div class="gp-blocks" aria-hidden="true">
								{#each blockSlots[i] ?? [] as b (b)}
									<span class="gp-block"></span>
								{/each}
							</div>
							{#if i === 0}
								<div class="gp-units">
									<button
										type="button"
										class="gp-node"
										aria-pressed={node === 'warp'}
										onclick={() => (node = 'warp')}>Планировщик варпов</button
									>
									<button
										type="button"
										class="gp-node"
										aria-pressed={node === 'cores'}
										onclick={() => (node = 'cores')}>Ядра</button
									>
									<button
										type="button"
										class="gp-node gp-mem"
										aria-pressed={node === 'regs'}
										onclick={() => (node = 'regs')}>Регистры</button
									>
									<button
										type="button"
										class="gp-node gp-mem"
										aria-pressed={node === 'shared'}
										onclick={() => (node = 'shared')}>Разделяемая память и L1</button
									>
								</div>
							{/if}
						</div>
					{/each}
				</div>
				<button
					type="button"
					class="gp-bar gp-l2"
					aria-pressed={node === 'l2'}
					onclick={() => (node = 'l2')}>Кэш L2: общий для всех SM</button
				>
				<button
					type="button"
					class="gp-bar gp-dram"
					aria-pressed={node === 'dram'}
					onclick={() => (node = 'dram')}>Глобальная память (DRAM): вне кристалла</button
				>
				<p class="gp-ladder" aria-hidden="true">
					от быстрых к медленным: регистры → разделяемая память → L2 → DRAM
				</p>
			</div>
		</section>

		<section class="gp-info" aria-live="polite" aria-label="Описание выбранного узла">
			{#if info}
				<p class="gp-t">{info.title}</p>
				<p class="gp-muted gp-scope">Область: {info.scope}</p>
				<p class="gp-text">{info.text}</p>
				<ul class="gp-figs">
					{#each info.figures as f (f)}
						<li>{f}</li>
					{/each}
				</ul>
				<p class="gp-src">
					Источник:
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external documentation URL, not a site route -->
					<a href={info.sourceUrl} target="_blank" rel="noopener noreferrer">{info.sourceLabel}</a>
				</p>
			{:else}
				<p class="gp-t">Нажмите на узел схемы</p>
				<p class="gp-text">
					Узлы: планировщик, ядра, регистры, разделяемая память внутри SM, кэш L2 и глобальная
					память. Для каждого показано, что он делает, и порядок величины задержки с ссылкой на
					документацию.
				</p>
			{/if}
		</section>
	</div>

	<section class="gp-warps" aria-label="Варпы блока">
		<p class="gp-t">
			Блок из {lanes.active} потоков: {lanes.warps}
			{lanes.warps === 1 ? 'варп' : 'варпа'} по {WARP_SIZE}
		</p>
		<div class="gp-cells" role="img" aria-label={note}>
			{#each rows as row, w (w)}
				{#each row as cell (cell.t)}
					<span class="gp-cell" class:gp-cell-on={cell.active} title="поток {cell.t}"></span>
				{/each}
			{/each}
		</div>
		<p class="gp-legend">
			<span class="gp-key gp-key-on"></span> поток блока
			<span class="gp-key"></span> простаивающий слот последнего варпа
		</p>
	</section>

	<dl class="gp-stats">
		<dt>Варпов в блоке</dt>
		<dd>{lanes.warps}</dd>
		<dt>Простаивающих слотов</dt>
		<dd>{lanes.idle}</dd>
		<dt>Блоков на самом загруженном SM</dt>
		<dd>{busiest}</dd>
		<dt>Волн при {sms} SM</dt>
		<dd>{waves}</dd>
	</dl>

	<p class="gp-note" aria-live="polite">{note}</p>

	<div class="gp-notice">
		<p class="gp-h2">Что заметить</p>
		<ul>
			<li>
				Потоки исполняются группами по {WARP_SIZE}: например, блок из {THREADS_DEFAULT} потоков занимает
				4 варпа, и в последнем 28 слотов пусты.
			</li>
			<li>
				Блоки не выполняются «по одному»: несколько блоков живут на одном SM, а блоков больше, чем
				SM, — они идут волнами.
			</li>
			<li>
				Чем дальше память от SM, тем она больше и медленнее. Поэтому данные стараются держать в
				регистрах и разделяемой памяти.
			</li>
			<li>
				Точные задержки зависят от модели GPU: здесь даны только порядки величин. См.
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external documentation URL, not a site route -->
				<a href={BEST_PRACTICES_URL} target="_blank" rel="noopener noreferrer"
					>CUDA C++ Best Practices Guide</a
				>.
			</li>
		</ul>
	</div>
</figure>

<style>
	.gp {
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
	.gp :global(*),
	.gp :global(*::before),
	.gp :global(*::after) {
		box-sizing: border-box;
	}
	.gp dl,
	.gp dd,
	.gp dt,
	.gp p,
	.gp ul {
		margin: 0;
	}
	.gp ul {
		padding-left: var(--space-4);
	}
	.gp button {
		font: inherit;
	}
	.gp a {
		color: var(--topic);
		text-decoration: underline dotted;
	}
	.gp-muted {
		color: var(--text-muted);
	}

	/* Controls */
	.gp-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.gp-ctl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.gp-label {
		color: var(--text-muted);
		white-space: nowrap;
	}
	.gp-range {
		width: 140px;
		accent-color: var(--topic);
		cursor: pointer;
	}
	.gp-val {
		min-width: 4ch;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.gp-reset {
		height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: none;
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.gp-range:focus-visible,
	.gp-reset:focus-visible,
	.gp-node:focus-visible,
	.gp-bar:focus-visible,
	.gp a:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Layout */
	.gp-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.gp-t {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.gp-sub {
		margin-bottom: var(--space-3);
		color: var(--text-muted);
		font-size: 13px;
	}

	/* Scheme */
	.gp-chip {
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg);
	}
	.gp-sms {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: var(--space-2);
	}
	.gp-sm {
		padding: var(--space-2);
		border: 1px dashed var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		min-width: 0;
	}
	.gp-sm-open {
		border: 1px solid var(--topic);
		grid-column: 1 / -1;
	}
	.gp-sm-t {
		font-size: 13px;
		font-weight: 600;
	}
	.gp-sm-t span {
		font-weight: 400;
		font-size: 12px;
	}
	.gp-blocks {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
		min-height: 12px;
		margin: var(--space-1) 0;
	}
	.gp-block {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		background: var(--topic-soft);
		border: 1px solid var(--topic);
	}
	.gp-units {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	.gp-node,
	.gp-bar {
		min-height: 36px;
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text);
		font-size: 13px;
		text-align: center;
		cursor: pointer;
		transition: border-color var(--dur) var(--ease);
	}
	.gp-mem {
		background: var(--topic-soft);
	}
	.gp-node[aria-pressed='true'],
	.gp-bar[aria-pressed='true'] {
		border: 2px solid var(--topic);
		font-weight: 600;
	}
	.gp-bar {
		display: block;
		width: 100%;
		margin-top: var(--space-2);
	}
	.gp-dram {
		background: var(--surface);
	}
	.gp-ladder {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
		text-align: center;
	}

	/* Info card */
	.gp-info {
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		min-width: 0;
	}
	.gp-scope {
		font-size: 13px;
	}
	.gp-text {
		margin-top: var(--space-2);
	}
	.gp-figs {
		margin-top: var(--space-2);
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.gp-src {
		margin-top: var(--space-3);
		font-size: 13px;
	}

	/* Warps */
	.gp-warps {
		margin-top: var(--space-6);
	}
	.gp-cells {
		display: grid;
		grid-template-columns: repeat(32, minmax(0, 1fr));
		gap: 2px;
		max-width: 100%;
	}
	.gp-cell {
		display: block;
		aspect-ratio: 1;
		border-radius: 2px;
		border: 1px dashed var(--border);
		background: var(--bg);
	}
	.gp-cell-on {
		border: 0;
		background: var(--topic);
	}
	.gp-legend {
		margin-top: var(--space-2);
		color: var(--text-muted);
		font-size: 12px;
	}
	.gp-key {
		display: inline-block;
		width: 10px;
		height: 10px;
		margin: 0 4px 0 var(--space-2);
		border-radius: 2px;
		border: 1px dashed var(--border);
		vertical-align: -1px;
	}
	.gp-key-on {
		border: 0;
		background: var(--topic);
	}

	/* Statistics */
	.gp-stats {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-size: 13px;
	}
	.gp-stats dt {
		color: var(--text-muted);
	}
	.gp-stats dd {
		color: var(--text);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.gp-note {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}

	/* What to notice */
	.gp-notice {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--topic-soft);
		border-radius: var(--radius);
		color: var(--text);
	}
	.gp-h2 {
		margin-bottom: var(--space-2);
		font-family: var(--font-serif);
		font-weight: 600;
	}
	.gp-notice li + li {
		margin-top: var(--space-2);
	}

	@media (max-width: 720px) {
		.gp {
			padding: var(--space-4);
		}
		.gp-grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.gp-stats {
			grid-template-columns: minmax(0, 1fr) auto;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.gp-node,
		.gp-bar {
			transition: none;
		}
	}
</style>
