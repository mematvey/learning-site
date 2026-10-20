<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { DEMOS_CONTEXT, type DemosContext } from '$lib/contracts/context';
	import {
		TOOLS,
		type InjectionDemoInit,
		type Permissions,
		type ToolName,
		describeState,
		documentLines,
		normalizeState,
		runTurn,
	} from '$lib/demos/security-privacy';

	/**
	 * Prompt injection demo: untrusted text in the context and a tool-rights switch.
	 * The model proposals are fixed; only the code-side rights check decides what runs.
	 * Registers itself as demo `injection`.
	 */
	let { initial }: { initial?: InjectionDemoInit } = $props();

	// The props only seed the initial state: the demo owns it afterwards.
	/* svelte-ignore state_referenced_locally */
	const seed = normalizeState(initial);
	let withInjection = $state(seed.withInjection);
	let permissions = $state<Permissions>({ ...seed.permissions });

	const demos = getContext<DemosContext | undefined>(DEMOS_CONTEXT);

	const current = $derived({ withInjection, permissions: { ...permissions } });
	const lines = $derived(documentLines(withInjection));
	const decisions = $derived(runTurn(current));
	const description = $derived(describeState(current));

	function setPermission(name: ToolName, value: boolean): void {
		permissions = { ...permissions, [name]: value };
	}

	function reset(): void {
		withInjection = seed.withInjection;
		permissions = { ...seed.permissions };
	}

	function apply(patch: InjectionDemoInit): void {
		const next = normalizeState({
			withInjection: patch.withInjection ?? withInjection,
			permissions: { ...permissions, ...(patch.permissions ?? {}) },
		});
		withInjection = next.withInjection;
		permissions = next.permissions;
	}

	onMount(() => {
		return demos?.register('injection', {
			set: (patch) => apply(patch as InjectionDemoInit),
		});
	});
</script>

<figure class="inj" id="demo-injection" data-demo="injection">
	<div class="inj-controls">
		<div class="inj-group" role="group" aria-label="Содержимое документа">
			<button
				type="button"
				class="inj-seg"
				aria-pressed={withInjection}
				onclick={() => (withInjection = true)}>С инструкцией</button
			>
			<button
				type="button"
				class="inj-seg"
				aria-pressed={!withInjection}
				onclick={() => (withInjection = false)}>Без инструкции</button
			>
		</div>
		<button type="button" class="inj-reset" onclick={reset}>Сброс</button>
	</div>

	<div class="inj-grid">
		<section class="inj-panel" aria-labelledby="inj-doc-title">
			<h4 class="inj-title" id="inj-doc-title">Недоверенный документ</h4>
			<p class="inj-hint">
				Текст попадает в контекст модели целиком, вместе с запросом пользователя.
			</p>
			<ul class="inj-doc">
				{#each lines as line, i (i)}
					<li class="inj-line" class:is-injected={line.injected}>
						{#if line.injected}<span class="inj-tag">скрытая инструкция</span>{/if}
						{line.text}
					</li>
				{/each}
			</ul>
		</section>

		<section class="inj-panel" aria-labelledby="inj-tools-title">
			<h4 class="inj-title" id="inj-tools-title">Права инструментов</h4>
			<p class="inj-hint">Права проверяет код, а не текст промпта.</p>
			<ul class="inj-tools">
				{#each TOOLS as tool (tool.name)}
					<li class="inj-tool">
						<label class="inj-switch">
							<input
								type="checkbox"
								role="switch"
								checked={permissions[tool.name]}
								onchange={(e) => setPermission(tool.name, e.currentTarget.checked)}
							/>
							<span class="inj-tool-name">{tool.title}</span>
						</label>
						<span class="inj-kind" class:is-write={tool.kind === 'write'}>
							{tool.kind === 'write' ? 'запись' : 'чтение'}
						</span>
						<code class="inj-code">{tool.name}</code>
					</li>
				{/each}
			</ul>
		</section>
	</div>

	<section class="inj-result" aria-labelledby="inj-result-title">
		<h4 class="inj-title" id="inj-result-title">Решение системы</h4>
		<ul class="inj-calls">
			{#each decisions as d, i (i)}
				<li class="inj-call">
					<div class="inj-call-head">
						<code class="inj-code">{d.call.name}({d.call.args})</code>
						<span class="inj-badge" class:is-ok={d.executed} class:is-no={!d.executed}>
							{d.executed ? 'выполнен' : 'отклонён'}
						</span>
					</div>
					<p class="inj-call-reason">{d.reason}</p>
				</li>
			{/each}
		</ul>
	</section>

	<p class="inj-live" aria-live="polite">{description}</p>
</figure>

<style>
	.inj {
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
	.inj :global(*),
	.inj :global(*::before),
	.inj :global(*::after) {
		box-sizing: border-box;
	}
	.inj ul,
	.inj p,
	.inj h4 {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.inj button {
		font: inherit;
	}

	/* Controls */
	.inj-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3) var(--space-4);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.inj-group {
		display: inline-flex;
		max-width: 100%;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.inj-seg {
		min-height: 32px;
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
	.inj-seg[aria-pressed='true'] {
		background: var(--topic);
		color: var(--surface);
		font-weight: 600;
	}
	.inj-reset {
		min-height: 32px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.inj-seg:focus-visible,
	.inj-reset:focus-visible,
	.inj-switch input:focus-visible {
		outline: 2px solid var(--topic);
		outline-offset: 2px;
	}

	/* Panels */
	.inj-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
		gap: var(--space-6);
		margin-top: var(--space-6);
	}
	.inj-panel {
		min-width: 0;
	}
	.inj-title {
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.inj-hint {
		margin-top: var(--space-1);
		color: var(--text-muted);
		font-size: 13px;
	}

	/* Document */
	.inj-doc {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.inj-line {
		padding: var(--space-2) var(--space-3);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		overflow-wrap: anywhere;
	}
	.inj-line.is-injected {
		border: 1px dashed var(--cat-2);
		background: var(--surface-2);
	}
	.inj-tag {
		display: inline-block;
		margin-right: var(--space-2);
		padding: 0 var(--space-2);
		border-radius: var(--radius-sm);
		background: var(--cat-2);
		color: var(--surface);
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
	}

	/* Tools */
	.inj-tools {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.inj-tool {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-1) var(--space-3);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg);
	}
	.inj-switch {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		cursor: pointer;
	}
	.inj-switch input {
		accent-color: var(--topic);
		width: 16px;
		height: 16px;
		flex: none;
		cursor: pointer;
	}
	.inj-tool-name {
		color: var(--text);
	}
	.inj-kind {
		color: var(--text-muted);
		font-size: 12px;
		white-space: nowrap;
	}
	.inj-kind.is-write {
		color: var(--warn);
		font-weight: 600;
	}
	.inj-tool .inj-code {
		grid-column: 1 / -1;
	}
	.inj-code {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-muted);
		overflow-wrap: anywhere;
	}

	/* Result */
	.inj-result {
		margin-top: var(--space-6);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
	.inj-calls {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.inj-call {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg);
	}
	.inj-call-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.inj-call-reason {
		margin-top: var(--space-1);
		color: var(--text-muted);
		font-size: 13px;
	}
	.inj-badge {
		padding: 2px var(--space-2);
		border-radius: var(--radius-sm);
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
	}
	.inj-badge.is-ok {
		color: var(--ok);
		border: 1px solid var(--ok);
	}
	.inj-badge.is-no {
		color: var(--fail);
		border: 1px solid var(--fail);
	}

	.inj-live {
		margin-top: var(--space-4);
		color: var(--text-muted);
	}
	@media (max-width: 720px) {
		.inj {
			padding: var(--space-4);
		}
		.inj-grid {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-6);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.inj *,
		.inj *::before,
		.inj *::after {
			transition: none !important;
		}
	}
</style>
