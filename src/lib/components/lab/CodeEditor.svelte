<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorState, StateEffect, StateField } from '@codemirror/state';
	import { Decoration, type DecorationSet, EditorView, keymap } from '@codemirror/view';
	import { python } from '@codemirror/lang-python';
	import { basicSetup } from 'codemirror';

	interface Props {
		value: string;
		readonly: boolean;
		/** Line to mark as failing (from the first failed test location). */
		errorLine: number | null;
		label: string;
		onChange: (value: string) => void;
		onRun: () => void;
		onSave: () => void;
		onReset: () => void;
		onEscape: () => void;
	}

	let { value, readonly, errorLine, label, onChange, onRun, onSave, onReset, onEscape }: Props =
		$props();

	let host: HTMLDivElement | undefined = $state();
	let view: EditorView | undefined;
	let applyingExternal = false;

	const setErrorLine = StateEffect.define<number | null>();
	const lineMark = Decoration.line({ class: 'cm-lab-err' });

	const errorField = StateField.define<DecorationSet>({
		create: () => Decoration.none,
		update(deco, tr) {
			let next = deco.map(tr.changes);
			for (const effect of tr.effects) {
				if (effect.is(setErrorLine)) {
					const n = effect.value;
					next =
						n === null
							? Decoration.none
							: Decoration.set([
									lineMark.range(
										tr.state.doc.line(Math.min(Math.max(n, 1), tr.state.doc.lines)).from,
									),
								]);
				}
			}
			return next;
		},
		provide: (field) => EditorView.decorations.from(field),
	});

	const labKeys = keymap.of([
		{
			key: 'Mod-Enter',
			preventDefault: true,
			run: () => {
				onRun();
				return true;
			},
		},
		{
			key: 'Mod-s',
			preventDefault: true,
			run: () => {
				onSave();
				return true;
			},
		},
		{
			key: 'Mod-Shift-Backspace',
			preventDefault: true,
			run: () => {
				onReset();
				return true;
			},
		},
		{
			key: 'Escape',
			run: (v) => {
				onEscape();
				v.contentDOM.blur();
				return true;
			},
		},
	]);

	const theme = EditorView.theme({
		'&': { color: 'var(--text)', backgroundColor: 'transparent', fontSize: '13px' },
		'&.cm-focused': { outline: '2px solid var(--accent)', outlineOffset: '-2px' },
		'.cm-content': {
			fontFamily: 'var(--font-mono)',
			padding: '12px 16px',
			caretColor: 'var(--text)',
		},
		'.cm-gutters': {
			backgroundColor: 'var(--surface)',
			color: 'var(--text-muted)',
			border: 'none',
			borderRight: '1px solid var(--border)',
		},
		'.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'transparent' },
		'.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
			backgroundColor: 'color-mix(in srgb, var(--accent) 25%, transparent) !important',
		},
		'.cm-lab-err': {
			backgroundColor: 'color-mix(in srgb, var(--fail) 10%, transparent)',
			boxShadow: 'inset 3px 0 0 var(--fail)',
		},
	});

	onMount(() => {
		if (!host) return;
		view = new EditorView({
			parent: host,
			state: EditorState.create({
				doc: value,
				extensions: [
					labKeys,
					basicSetup,
					python(),
					errorField,
					theme,
					EditorState.readOnly.of(readonly),
					EditorView.editable.of(!readonly),
					EditorView.contentAttributes.of({ 'aria-label': label }),
					EditorView.updateListener.of((u) => {
						if (u.docChanged && !applyingExternal) onChange(u.state.doc.toString());
					}),
				],
			}),
		});
		return () => view?.destroy();
	});

	// Replace the document when the parent changes it (reset, restored draft).
	$effect(() => {
		const next = value;
		if (!view || view.state.doc.toString() === next) return;
		applyingExternal = true;
		view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
		applyingExternal = false;
	});

	$effect(() => {
		const line = errorLine;
		view?.dispatch({ effects: setErrorLine.of(line) });
	});
</script>

<div class="cm-host" bind:this={host}></div>

<style>
	.cm-host {
		min-width: 0;
		background: var(--surface);
	}
	.cm-host :global(.cm-editor) {
		background: transparent;
	}
	.cm-host :global(.cm-scroller) {
		font-family: var(--font-mono);
		line-height: 22px;
	}
	.cm-host :global(.cm-gutters) {
		font-family: var(--font-mono);
	}
</style>
