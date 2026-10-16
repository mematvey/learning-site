<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorState, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
	import {
		Decoration,
		type DecorationSet,
		EditorView,
		ViewPlugin,
		type ViewUpdate,
		keymap,
	} from '@codemirror/view';
	import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language';
	import { python } from '@codemirror/lang-python';
	import { basicSetup } from 'codemirror';
	// Transitive dependency of @codemirror/language: it does not re-export the tag set.
	import { tags as t } from '@lezer/highlight';

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

	// Site palette: only tokens from the theme file, no red for strings. Both themes read the same vars.
	const siteHighlight = HighlightStyle.define([
		{
			tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword],
			color: 'var(--cat-5)',
		},
		{ tag: [t.operatorKeyword, t.modifier, t.self, t.null], color: 'var(--cat-5)' },
		{ tag: [t.string, t.character, t.attributeValue], color: 'var(--cat-3)' },
		{ tag: [t.number, t.integer, t.float, t.bool, t.atom, t.unit], color: 'var(--cat-2)' },
		{
			tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
			color: 'var(--text-muted)',
			fontStyle: 'italic',
		},
		{
			tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.variableName)],
			color: 'var(--cat-1)',
		},
		{ tag: [t.className, t.typeName, t.namespace, t.macroName], color: 'var(--cat-6)' },
		{ tag: [t.meta, t.annotation], color: 'var(--cat-4)' },
		{ tag: [t.operator, t.punctuation, t.bracket, t.separator], color: 'var(--text-muted)' },
	]);

	// Python docstrings are plain strings in the grammar: a string that is the first statement of
	// a module, function or class body is marked as documentation (muted, not string-coloured).
	const docstringMark = Decoration.mark({ class: 'cm-docstring' });
	const docstrings = ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			constructor(view: EditorView) {
				this.decorations = this.build(view);
			}
			update(update: ViewUpdate) {
				if (
					update.docChanged ||
					update.viewportChanged ||
					syntaxTree(update.startState) !== syntaxTree(update.state)
				) {
					this.decorations = this.build(update.view);
				}
			}
			build(view: EditorView): DecorationSet {
				const builder = new RangeSetBuilder<Decoration>();
				const tree = syntaxTree(view.state);
				for (const { from, to } of view.visibleRanges) {
					tree.iterate({
						from,
						to,
						enter(node) {
							if (node.name !== 'String') return;
							const stmt = node.node.parent;
							if (stmt?.name !== 'ExpressionStatement') return;
							const owner = stmt.parent?.name;
							if (owner !== 'Script' && owner !== 'Body') return;
							const prev = stmt.prevSibling;
							if (prev !== null && prev.name !== ':') return;
							builder.add(node.from, node.to, docstringMark);
						},
					});
				}
				return builder.finish();
			}
		},
		{ decorations: (v) => v.decorations },
	);

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
		// The syntax token inside the mark carries its own colour: override it for docstrings.
		'.cm-docstring, .cm-docstring *': {
			color: 'var(--text-muted) !important',
			fontStyle: 'italic',
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
					syntaxHighlighting(siteHighlight),
					docstrings,
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
		/* Fixed inline size: a long line cannot widen the lab frame. */
		box-sizing: border-box;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		contain: inline-size;
		background: var(--surface);
	}
	.cm-host :global(.cm-editor) {
		background: transparent;
		max-width: 100%;
	}
	.cm-host :global(.cm-scroller) {
		overflow-x: auto;
		overflow-y: hidden;
		font-family: var(--font-mono);
		line-height: 22px;
	}
	.cm-host :global(.cm-gutters) {
		font-family: var(--font-mono);
	}
</style>
