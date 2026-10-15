import type { ChapterId, TopicId } from './ids';
import type { Source } from './chapter';
import type { GlossaryEntry } from './glossary';
import type { LevelState } from './levels';

/**
 * Svelte contexts shared between components. The chapter page calls `setContext(KEY, value)`;
 * components read with `getContext<Type>(KEY)`. Values with reactive fields expose getters
 * (backed by `$state` in the provider), so reading them inside `$derived`/templates is reactive.
 * Keys are plain strings: no Symbol, so duplicated module instances still match.
 */

/** Slider state of the chapter. Provider: chapter page / `LevelPopover` host. */
export const LEVELS_CONTEXT = 'learning-site:levels';
export interface LevelsContext {
	/** Applied state (drives `data-c` / `data-d` on the chapter container). */
	readonly applied: LevelState;
	/** Draft state of the sliders (not applied yet). */
	readonly draft: LevelState;
	setDraft(patch: Partial<LevelState>): void;
	/** Applies the draft: writes progress, URL and attributes. */
	apply(): void;
	/** True when `draft` differs from `applied`. */
	readonly dirty: boolean;
}

/** Entities that carry a color: Q, K, V and further entities of the chapter. */
export const ENTITY_IDS = ['q', 'k', 'v', 'e4', 'e5', 'e6'] as const;
export type EntityId = (typeof ENTITY_IDS)[number];
/** Entity -> data color token: `q -> --cat-1`, `k -> --cat-2`, ... */
export const ENTITY_COLOR_VAR: Record<EntityId, string> = {
	q: '--cat-1',
	k: '--cat-2',
	v: '--cat-3',
	e4: '--cat-4',
	e5: '--cat-5',
	e6: '--cat-6',
};

/**
 * Entity highlight `hl`. `Ref` sets it on hover/focus; the provider mirrors it to
 * `data-hl="<entity>"` on `<body>`; demos and charts dim everything else (CSS `body[data-hl]`).
 */
export const HIGHLIGHT_CONTEXT = 'learning-site:hl';
export interface HighlightContext {
	readonly hl: EntityId | null;
	set(entity: EntityId | null): void;
}

/** Handle a demo registers so text can drive it. */
export interface DemoHandle<S = Record<string, unknown>> {
	/** Merges the patch into the demo state and scrolls the demo into view if asked. */
	set(patch: Partial<S>): void;
}

/** Typed registry of demos by name (`attention`). `DemoLink` calls `set`. */
export const DEMOS_CONTEXT = 'learning-site:demos';
export interface DemosContext {
	/** Registers a demo; returns an unregister function (call in `onDestroy`). */
	register(name: string, handle: DemoHandle): () => void;
	/** Sets demo state and scrolls to it. No-op if the demo is not registered. */
	set(name: string, patch: Record<string, unknown>): void;
}

/** State of `AttentionDemo` (see `docs/mockups/attention-demo.js`). */
export interface AttentionDemoState {
	/** Divide logits by sqrt(d). */
	scaled: boolean;
	/** Index of the query token. */
	query: number;
	/** Key dimension. */
	d: number;
}

/** Data of the current chapter for `Term`, `Cite`, `Figure` numbering. */
export const CHAPTER_CONTEXT = 'learning-site:chapter';
export interface ChapterContext {
	readonly id: ChapterId;
	readonly topic: TopicId;
	readonly sources: readonly Source[];
	/** Glossary entries by id (full registry). */
	readonly glossary: Readonly<Record<string, GlossaryEntry>>;
	/** Returns the next figure number (1-based) for a figure id; stable per id. */
	figureNumber(figureId: string): number;
}
