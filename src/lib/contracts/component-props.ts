import type { Snippet } from 'svelte';
import type { AttentionDemoState, EntityId } from './context';
import type { BlockId, ChapterId, LabId, TopicId } from './ids';
import type { LabResult } from './lab-result';
import type { LabVisualizer } from './lab';
import type { LevelState } from './levels';
import type { Note } from './notes';
import type { Theme } from './progress';
import type { PrereqGraphData } from './registry';
import type { AnchorResolution, LabRunner, ProgressStore } from './interfaces';

/**
 * Prop contracts of Svelte components (Svelte 5 runes). Each stub in `src/lib/components/**`
 * declares `let props: <Name>Props = $props()`. Callbacks are props named `onXxx`
 * (no custom DOM events). `children` is the default snippet.
 */

/** Color slot of a data series: `1` = `--cat-1`, ... `6` = `--cat-6`. */
export type CatIndex = 1 | 2 | 3 | 4 | 5 | 6;

/* ---------- Content components (used in .svx) ---------- */

/** Additive layer: visible when `c >= props.c` AND `d >= props.d` (missing prop = no condition). */
export interface LevelProps {
	c?: 1 | 2 | 3 | 4;
	d?: 1 | 2 | 3;
	children: Snippet;
}

/**
 * Replaceable block: exactly one `Variant` of a group is shown. Ranges are `"n"` or `"a-b"`.
 * A group is adjacent `Variant`s without text between them, or equal `group` values.
 * Group ranges must cover the whole axis without gaps/overlaps (checked at build).
 */
export interface VariantProps {
	c?: string;
	d?: string;
	group?: string;
	children: Snippet;
}

/** Glossary term with tooltip on hover/focus. Text defaults to the Russian term. */
export interface TermProps {
	id: string;
	children?: Snippet;
}

/** Colored word bound to an entity (Q/K/V...). Hover/focus sets the `hl` context. */
export interface RefProps {
	e: EntityId;
	children: Snippet;
}

/** Link that puts a demo into a state: `demo` is the registered name (`attention`). */
export interface DemoLinkProps {
	demo: string;
	state: Record<string, unknown>;
	children: Snippet;
}

/** Figure frame: number "Рис. N" (from `ChapterContext.figureNumber`), caption, notice, alt. */
export interface FigureProps {
	/** Figure id: anchor for notes (`figureId`). */
	id: BlockId;
	/** Text alternative: what is shown and key values. Mandatory. */
	alt: string;
	caption: string;
	/** "Что заметить" line under the figure. */
	notice?: string;
	/** Wide figure (centered on the page axis). Default true. */
	wide?: boolean;
	children: Snippet;
}

export interface CalloutProps {
	kind: 'warn' | 'note' | 'tip';
	title?: string;
	children: Snippet;
}

/** Collapsible side note (`<details>`), collapsed by default. */
export interface AsideProps {
	title: string;
	open?: boolean;
	children: Snippet;
}

export interface StepCardData {
	title: string;
	/** Plain text, one sentence about what changes. */
	text: string;
	/** TeX for KaTeX (display). */
	formula?: string;
	/** Demo state for this step (passed to the registered demo). */
	state?: Record<string, unknown>;
}

/** Step-by-step cards. The step may drive a demo through the demos context. */
export interface StepCardsProps {
	steps: StepCardData[];
	/** Name of the demo to drive with `StepCardData.state`. */
	demo?: string;
	initial?: number;
	/** Called after the active step changes. */
	onStep?: (index: number, step: StepCardData) => void;
}

/** Question with a show-answer button, no scoring. `interview`: short answer for Classic ML. */
export interface QuizProps {
	id: BlockId;
	q: string;
	kind?: 'self' | 'interview';
	/** Complexity position the answer targets (interview mode label). */
	level?: 1 | 2 | 3 | 4;
	/** Answer. */
	children: Snippet;
}

/** Inline citation by source id from the chapter frontmatter. */
export interface CiteProps {
	id: string;
}

/** Runnable lab. Run state is internal; the host provides `LabRunner` via the lab module. */
export interface CodeLabProps {
	lab: LabId;
	/** `run`: editor + run; `readonly`: show the starter code; `check-solution`: run the solution. */
	mode?: 'run' | 'readonly' | 'check-solution';
	/** Slot for custom visualizers below the result. */
	children?: Snippet;
	onResult?: (result: LabResult) => void;
	/** Progress store for drafts and pass state. Default: the page-wide store once it is open. */
	progress?: ProgressStore;
	/** Runner override. Default: the shared Worker runner from `$lib/labs`. */
	runner?: LabRunner;
}

/** Result panels: Summary, Tests, Diff table, Chart (visualizers bound by the lab). */
export interface LabResultPanelProps {
	result: LabResult;
	visualizers?: LabVisualizer[];
}

/* ---------- Chrome and navigation ---------- */

/** Header button + popover with two sliders; "Применить" appears only when changed. */
export interface LevelPopoverProps {
	applied: LevelState;
	onApply: (state: LevelState) => void;
	open?: boolean;
}

export interface TocItem {
	id: string;
	title: string;
	level: 2 | 3;
}

export interface TocProps {
	items: TocItem[];
	/** Id of the section currently in view. */
	activeId?: string;
}

export interface Crumb {
	label: string;
	href?: string;
}

export interface SiteHeaderProps {
	topic?: TopicId;
	crumbs?: Crumb[];
	theme: Theme;
	onToggleTheme: () => void;
	/** Slot for `LevelPopover` (chapter pages only). */
	levels?: Snippet;
	/** Slot for the search button and dialog (`SearchDialog`). */
	search?: Snippet;
}

export interface ThemeToggleProps {
	/** Resolved theme (not `system`). */
	theme: 'light' | 'dark';
	onToggle: () => void;
}

/** `kbd` with platform notation: `keys="mod+k"` -> `⌘K` / `Ctrl K`. */
export interface KbdHintProps {
	keys: string;
}

export interface ShortcutsHelpProps {
	open: boolean;
	onClose: () => void;
}

/* ---------- Home page ---------- */

export interface TopicCardProps {
	topic: TopicId;
	title: string;
	description: string;
	chapterCount: number;
	/** Up to three chapters shown on the card. */
	chapters: Array<{ id: ChapterId; title: string; href: string }>;
	/** Share of done chapters, 0..1. */
	progress: number;
	active?: boolean;
	mapHref: string;
	onSelect?: (topic: TopicId) => void;
}

export interface TopicTabsProps {
	topics: Array<{ id: TopicId; title: string }>;
	active: TopicId;
	onSelect: (topic: TopicId) => void;
}

export interface ContinueCardProps {
	topic: TopicId;
	topicTitle: string;
	chapterId: ChapterId;
	title: string;
	description: string;
	/** 0..1 */
	progress: number;
	lab?: { id: LabId; state: 'not-started' | 'passed' | 'failed' };
	href: string;
}

export type PrereqNodeState = 'done' | 'current' | 'ahead';

export interface PrereqGraphProps {
	graph: PrereqGraphData;
	/** Highlight this chapter as current and show its neighbourhood. */
	focus?: ChapterId;
	/** Show only this topic. */
	topic?: TopicId;
	/** Chapters the reader has visited/finished. */
	done?: ChapterId[];
	onSelect?: (chapter: ChapterId) => void;
}

/* ---------- Notes ---------- */

export interface MarginNoteProps {
	note: Note;
	/** Anchor resolution status for this note. */
	resolution: AnchorResolution['status'];
	/** Anchor sits in a layer that is hidden at the current levels. */
	layerHidden?: boolean;
	active?: boolean;
	onSelect?: (id: Note['id']) => void;
	/** Asks the host to switch levels so the layer becomes visible. */
	onShowLayer?: (id: Note['id']) => void;
	onDelete?: (id: Note['id']) => void;
}

/** Floating "Заметка" button over a selection. `rect` null = hidden. */
export interface SelectionNoteButtonProps {
	rect: { top: number; left: number } | null;
	onClick: () => void;
}

/* ---------- Charts (D3 scales, Svelte DOM; colors only from tokens) ---------- */

interface ChartBase {
	/** Accessible title and description (also a data table alternative is rendered). */
	title: string;
	desc: string;
	height?: number;
}

export interface LineChartProps extends ChartBase {
	series: Array<{ id: string; label: string; x: number[]; y: number[]; cat?: CatIndex }>;
	xLabel: string;
	yLabel: string;
}

export interface BarChartProps extends ChartBase {
	bars: Array<{ label: string; value: number; cat?: CatIndex }>;
	xLabel?: string;
	yLabel?: string;
	orientation?: 'vertical' | 'horizontal';
}

export interface HeatmapProps extends ChartBase {
	/** Row-major matrix. */
	matrix: number[][];
	rowLabels?: string[];
	colLabels?: string[];
	/** Print values inside cells (for small matrices). */
	showValues?: boolean;
	/** Color domain; default is min/max of the data. */
	domain?: [number, number];
	highlightRow?: number;
}

/** Schematic of matrices (Q, K, V, scores) with highlighting of the participating ones. */
export interface MatrixDiagramProps extends ChartBase {
	matrices: Array<{ id: string; label: string; rows: number; cols: number; entity?: EntityId }>;
	/** Matrix ids drawn highlighted; the others are dimmed. */
	highlight?: string[];
}

/* ---------- Demos ---------- */

/** Attention arcs demo. Registers itself as demo `attention`. */
export interface AttentionDemoProps {
	initial?: Partial<AttentionDemoState>;
}
