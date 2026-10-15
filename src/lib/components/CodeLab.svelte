<script lang="ts">
	import type { CodeLabProps } from '$lib/contracts/component-props';
	import {
		LabDraft,
		summarizeResult,
		type LabBundle,
		type LabId,
		type LabResult,
		type LabRunner,
		type ProgressStore,
	} from '$lib/contracts';
	import { progressState } from '$lib/shell.svelte';
	import KbdHint from './KbdHint.svelte';
	import LabResultPanel from './LabResultPanel.svelte';
	import CodeEditor from './lab/CodeEditor.svelte';
	import { loadBundle, sha256Hex } from './lab/bundle';
	import { readLocalDraft, removeLocalDraft, writeLocalDraft } from './lab/draft';
	import { errorLine, formatSeconds, isDraftStale } from './lab/format';

	/** Runtime-only additions: the lab runner and the progress store (drafts, pass state). */
	interface Props extends CodeLabProps {
		/** Defaults to the Worker runner from `$lib/labs`. */
		runner?: LabRunner;
		/** Drafts go here when given; otherwise localStorage (in try/catch). */
		progress?: ProgressStore;
	}

	let {
		lab: labId,
		mode = 'run',
		onResult,
		runner,
		progress: progressProp,
		children,
	}: Props = $props();

	// Without an explicit store, the page-wide progress store is used once it is open.
	const progress = $derived(progressProp ?? progressState.store ?? undefined);

	const runnerModules = import.meta.glob('/src/lib/labs/index.ts') as Record<
		string,
		() => Promise<{ labRunner: LabRunner }>
	>;
	let resolvedRunner: LabRunner | undefined;

	async function getRunner(): Promise<LabRunner> {
		if (runner) return runner;
		if (!resolvedRunner) {
			const load = runnerModules['/src/lib/labs/index.ts'];
			if (!load) throw new Error('Раннер лабов не подключён');
			resolvedRunner = (await load()).labRunner;
		}
		return resolvedRunner;
	}

	const uid = $props.id();

	let bundle = $state<LabBundle | null>(null);
	let loadError = $state<string | null>(null);
	let starterHash = $state('');
	let draftHash = $state<string | undefined>(undefined);
	let code = $state('');
	let note = $state('');
	let status = $state<'idle' | 'running' | 'done' | 'error'>('idle');
	let result = $state<LabResult | null>(null);
	let runError = $state<string | null>(null);
	let elapsed = $state(0);
	let confirmReset = $state(false);

	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	let loadToken = 0;

	const stale = $derived(bundle !== null && isDraftStale(draftHash, starterHash));
	const canRun = $derived(mode === 'run' && bundle !== null && status !== 'running');
	const errLine = $derived(result ? errorLine(result.tests) : null);

	async function readDraft(id: LabId) {
		if (progress) {
			try {
				return (await progress.getLab(id))?.draft;
			} catch {
				return undefined;
			}
		}
		return readLocalDraft(id);
	}

	async function load(id: LabId) {
		const token = ++loadToken;
		bundle = null;
		loadError = null;
		result = null;
		status = 'idle';
		try {
			const b = await loadBundle(id);
			const hash = await sha256Hex(b.starter);
			const draft = await readDraft(id);
			if (token !== loadToken) return;
			bundle = b;
			starterHash = hash;
			draftHash = draft?.starterHash;
			code = draft?.code ?? b.starter;
		} catch (e) {
			if (token === loadToken) loadError = e instanceof Error ? e.message : String(e);
		}
	}

	$effect(() => {
		// Reload when the progress store opens: the saved draft lives there.
		void progress;
		void load(labId);
	});

	// Elapsed time while a run is in progress.
	$effect(() => {
		if (status !== 'running') return;
		const t0 = performance.now();
		elapsed = 0;
		const timer = setInterval(() => {
			elapsed = (performance.now() - t0) / 1000;
		}, 100);
		return () => clearInterval(timer);
	});

	$effect(() => () => {
		if (saveTimer) clearTimeout(saveTimer);
	});

	async function persistDraft(draft: LabDraft | undefined) {
		if (!bundle) return;
		const { id, chapter } = bundle.lab;
		if (progress) {
			await progress.update({
				labs: [{ labId: id, chapter, draft }],
			});
		} else if (draft) {
			writeLocalDraft(id, draft);
		} else {
			removeLocalDraft(id);
		}
	}

	async function saveDraft() {
		if (!bundle) return;
		const draft: LabDraft = { code, savedAt: new Date().toISOString(), starterHash };
		try {
			await persistDraft(draft);
			draftHash = starterHash;
			note = `Черновик сохранён · ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
		} catch {
			note = 'Черновик не сохранён: хранилище только для чтения';
		}
	}

	function onEdit(value: string) {
		code = value;
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => void saveDraft(), 500);
	}

	async function run() {
		if (!canRun || !bundle) return;
		status = 'running';
		runError = null;
		try {
			const r = await (await getRunner()).run(bundle, code);
			result = r;
			status = 'done';
			onResult?.(r);
			if (r.status === 'pass' && progress) {
				await progress.update({
					labs: [
						{
							labId: bundle.lab.id,
							chapter: bundle.lab.chapter,
							passed: true,
							passedAt: new Date().toISOString(),
							lastResult: summarizeResult(r),
						},
					],
				});
			}
		} catch (e) {
			status = 'error';
			runError = `Не удалось запустить код: ${e instanceof Error ? e.message : String(e)}`;
		}
	}

	async function reset() {
		if (!bundle) return;
		confirmReset = false;
		if (saveTimer) clearTimeout(saveTimer);
		code = bundle.starter;
		draftHash = undefined;
		result = null;
		status = 'idle';
		try {
			await persistDraft(undefined);
		} catch {
			/* read-only store: the page still shows the starter code */
		}
		note = 'Стартовый код восстановлен';
	}

	function onEscape() {
		if (confirmReset) confirmReset = false;
	}

	const runtimeLabel: Record<string, string> = {
		pyodide: 'Python · Pyodide',
		js: 'JavaScript',
		simulator: 'Симулятор',
		'external-notebook': 'Внешний блокнот',
	};
</script>

<section class="lab" aria-labelledby="{uid}-title">
	<header class="head">
		<div class="title">
			<h3 id="{uid}-title">
				{bundle?.lab.title ?? (loadError ? 'Лаб недоступен' : 'Загрузка лаба…')}
			</h3>
			{#if bundle}<span class="badge">{runtimeLabel[bundle.lab.runtime] ?? bundle.lab.runtime}</span
				>{/if}
		</div>
		{#if mode === 'run'}
			<div class="actions">
				<button
					type="button"
					class="btn"
					disabled={!bundle}
					title="Сбросить к стартовому коду: Ctrl+Shift+Backspace"
					onclick={() => (confirmReset = !confirmReset)}>Сбросить</button
				>
				<button type="button" class="btn btn-primary" disabled={!canRun} onclick={run}>
					▶ Запустить <KbdHint keys="mod+enter" />
				</button>
			</div>
		{/if}
	</header>

	<div class="file-bar">
		<span>{bundle?.lab.starter ?? 'starter.py'}</span>
		<span class="hint">
			<KbdHint keys="mod+enter" /> запуск · <KbdHint keys="mod+s" /> черновик · <kbd>Esc</kbd> выход
		</span>
	</div>

	{#if loadError}
		<p class="error" role="alert">{loadError}</p>
	{:else if bundle}
		<div class="editor">
			<CodeEditor
				value={code}
				readonly={mode !== 'run'}
				errorLine={errLine}
				label="Код лаба"
				onChange={onEdit}
				onRun={run}
				onSave={saveDraft}
				onReset={() => (confirmReset = true)}
				{onEscape}
			/>
		</div>
	{/if}

	<footer class="foot">
		<span class="saved">{note || (bundle ? 'Черновик не сохранён' : '')}</span>
		{#if stale}
			<span class="warn"
				>Стартовый код лаба изменился после черновика. Проверьте код или сбросьте.</span
			>
		{/if}
		{#if status === 'running'}
			<span class="status">Выполняется… {formatSeconds(elapsed * 1000)}</span>
		{:else if status === 'done' && result}
			<span class="status" class:ok={result.status === 'pass'}>
				{result.status === 'pass' ? 'Все тесты зелёные' : 'Тесты не прошли'}
			</span>
		{:else if status === 'error' && runError}
			<span class="status fail">{runError}</span>
		{/if}
		{#if confirmReset}
			<span class="ask">
				<span>Сбросить код к стартовому?</span>
				<button type="button" class="btn btn-mini btn-danger" onclick={reset}>Сбросить</button>
				<button type="button" class="btn btn-mini" onclick={() => (confirmReset = false)}
					>Отмена</button
				>
			</span>
		{/if}
	</footer>

	{#if mode === 'check-solution'}
		<p class="note">Эталонное решение не передаётся в браузер; проверка выполняется при сборке.</p>
	{/if}

	<div class="out" aria-live="polite">
		{#if status === 'running'}
			<div class="running"><span class="spin"></span>Выполняется…</div>
		{:else if result}
			<LabResultPanel {result} visualizers={bundle?.lab.visualizers} />
		{/if}
	</div>

	{@render children?.()}
</section>

<style>
	.lab {
		display: block;
		width: 100%;
		margin: 32px 0;
		font: 400 16px/1.5 var(--font-sans);
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		overflow: hidden;
	}
	.lab h3 {
		margin: 0;
		padding: 0;
		font: 600 17px/1.3 var(--font-serif);
		color: var(--text);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 16px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
	}
	.title {
		display: flex;
		align-items: center;
		flex: 1 1 auto;
		gap: 12px;
		min-width: 0;
	}
	.badge {
		flex: none;
		font: 500 12px/1 var(--font-sans);
		padding: 6px 9px;
		border-radius: 999px;
		color: var(--topic);
		background: var(--topic-soft);
		white-space: nowrap;
	}
	.actions {
		display: flex;
		gap: 8px;
		align-items: center;
		margin-left: auto;
		flex: none;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font: 500 14px/1 var(--font-sans);
		padding: 9px 13px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		cursor: pointer;
		white-space: nowrap;
		transition:
			background var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease);
	}
	.btn:hover {
		background: var(--surface-2);
	}
	.btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.btn:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	.btn-primary {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--surface);
		font-weight: 600;
	}
	.btn-primary:hover {
		background: var(--accent);
		filter: brightness(1.07);
	}
	.btn-mini {
		padding: 5px 9px;
		font-size: 12.5px;
	}
	.btn-danger {
		color: var(--fail);
		border-color: var(--fail);
	}
	.file-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		padding: 7px 16px;
		background: var(--surface-2);
		border-bottom: 1px solid var(--border);
		font: 12px/1.4 var(--font-mono);
		color: var(--text-muted);
	}
	.hint {
		font: 12px/1.4 var(--font-sans);
		white-space: nowrap;
	}
	.editor {
		border-bottom: 1px solid var(--border);
		overflow-x: auto;
	}
	kbd {
		font: 11px var(--font-mono);
		padding: 1px 5px;
		border: 1px solid var(--border);
		border-bottom-width: 2px;
		border-radius: 4px;
		background: var(--surface);
		color: var(--text-muted);
	}
	.foot {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 8px 12px;
		padding: 8px 16px;
		font-size: 13px;
		line-height: 1.4;
		color: var(--text-muted);
	}
	.saved::before {
		content: '';
		display: inline-block;
		width: 6px;
		height: 6px;
		margin-right: 7px;
		vertical-align: middle;
		border-radius: 50%;
		background: var(--ok);
	}
	.saved:empty {
		display: none;
	}
	.warn {
		color: var(--warn);
	}
	.status {
		font-weight: 600;
	}
	.status.ok {
		color: var(--ok);
	}
	.status.fail {
		color: var(--fail);
	}
	.ask {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-left: auto;
		color: var(--text);
	}
	.error,
	.note {
		margin: 0;
		padding: 12px 16px;
		font-size: 14px;
		color: var(--text-muted);
	}
	.error {
		color: var(--fail);
	}
	.out {
		padding: 16px;
		border-top: 1px solid var(--border);
		background: var(--bg);
	}
	.out:empty {
		display: none;
	}
	.running {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 0;
		color: var(--text-muted);
	}
	.spin {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2px solid var(--border);
		border-top-color: var(--accent);
		animation: lab-spin 0.8s linear infinite;
	}
	@keyframes lab-spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (max-width: 640px) {
		.title {
			flex-basis: 100%;
		}
		.actions {
			margin-left: 0;
			width: 100%;
			justify-content: flex-end;
		}
	}
	@media (max-width: 560px) {
		.hint {
			display: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spin {
			animation: none;
		}
	}
</style>
