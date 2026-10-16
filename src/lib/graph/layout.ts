import type { PrereqGraphData } from '$lib/contracts/registry';
import type { TopicId } from '$lib/contracts/ids';

/** Pure layered layout of the chapter prerequisite graph. No DOM, no reactivity. */

export const NODE_W = 180;
export const COL_GAP = 64;
export const ROW_GAP = 16;
export const PAD = 16;
const TITLE_CHARS = 20;
const TITLE_LINES = 3;
export const LINE_H = 18;
const NODE_PAD_Y = 8;

export interface LayoutNode {
	id: string;
	topic: TopicId;
	title: string;
	lines: string[];
	x: number;
	y: number;
	w: number;
	h: number;
	layer: number;
}

export interface LayoutEdge {
	from: string;
	to: string;
	/** SVG path data, from the right side of `from` to the left side of `to`. */
	d: string;
}

export interface GraphLayout {
	nodes: LayoutNode[];
	edges: LayoutEdge[];
	width: number;
	height: number;
}

export interface LayoutOptions {
	/** Keep only chapters of this topic. */
	topic?: TopicId;
	/** With `depth`: keep only the chapters within `depth` steps of this chapter (both ways). */
	focus?: string;
	depth?: number;
}

export type ReadStatus = 'new' | 'progress' | 'done';

/**
 * Greedy word wrap by character count. Words longer than a line are split; text beyond
 * `maxLines` is cut with an ellipsis. Character counts stand in for measured text width.
 */
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
	const lines: string[] = [];
	let cur = '';
	for (const word of text.trim().split(/\s+/).filter(Boolean)) {
		if (cur && cur.length + 1 + word.length <= maxChars) {
			cur += ' ' + word;
			continue;
		}
		if (cur) lines.push(cur);
		let rest = word;
		while (rest.length > maxChars) {
			lines.push(rest.slice(0, maxChars));
			rest = rest.slice(maxChars);
		}
		cur = rest;
	}
	if (cur) lines.push(cur);
	if (lines.length <= maxLines) return lines;
	const kept = lines.slice(0, maxLines);
	const last = kept[maxLines - 1] ?? '';
	kept[maxLines - 1] = last.slice(0, maxChars - 1).trimEnd() + '…';
	return kept;
}

type Adjacency = Map<string, string[]>;

function push(map: Adjacency, key: string, value: string) {
	const list = map.get(key);
	if (list) list.push(value);
	else map.set(key, [value]);
}

function adjacency(edges: Array<{ from: string; to: string }>): { out: Adjacency; inc: Adjacency } {
	const out: Adjacency = new Map();
	const inc: Adjacency = new Map();
	for (const e of edges) {
		push(out, e.from, e.to);
		push(inc, e.to, e.from);
	}
	return { out, inc };
}

function reach(start: string, adj: Adjacency, maxDepth: number): Set<string> {
	const seen = new Set<string>();
	let frontier = [start];
	for (let d = 0; d < maxDepth && frontier.length; d++) {
		const next: string[] = [];
		for (const id of frontier) {
			for (const n of adj.get(id) ?? []) {
				if (!seen.has(n) && n !== start) {
					seen.add(n);
					next.push(n);
				}
			}
		}
		frontier = next;
	}
	return seen;
}

/** All prerequisites (ancestors) and dependents (descendants) of `id` within `depth` steps. */
export function relatives(
	edges: Array<{ from: string; to: string }>,
	id: string,
	depth = Infinity,
): { ancestors: Set<string>; descendants: Set<string> } {
	const { out, inc } = adjacency(edges);
	return { ancestors: reach(id, inc, depth), descendants: reach(id, out, depth) };
}

/** Reading status from the progress sets; done wins over in-progress. */
export function statusOf(
	id: string,
	done: ReadonlySet<string>,
	visited: ReadonlySet<string>,
): ReadStatus {
	if (done.has(id)) return 'done';
	if (visited.has(id)) return 'progress';
	return 'new';
}

/**
 * Layers chapters by prerequisite depth (a chapter sits one column right of its deepest
 * prerequisite), orders each column by barycenter to cut crossings, and centres columns
 * vertically. Throws on a cycle (check-content rejects cycles; this guards broken data).
 */
export function layoutGraph(graph: PrereqGraphData, opts: LayoutOptions = {}): GraphLayout {
	const all = graph.nodes.filter((n) => n.kind === 'chapter');
	const allEdges = graph.edges.filter((e) => e.kind === 'prereq');
	let keep = new Set(all.filter((n) => !opts.topic || n.topic === opts.topic).map((n) => n.id));
	if (opts.focus && opts.depth !== undefined) {
		const rel = relatives(allEdges, opts.focus, opts.depth);
		keep = new Set([opts.focus, ...rel.ancestors, ...rel.descendants]);
	}
	const chapters = all.filter((n) => keep.has(n.id));
	const ids = new Set(chapters.map((n) => n.id));
	const edges = allEdges.filter((e) => ids.has(e.from) && ids.has(e.to));

	const layer = new Map<string, number>(chapters.map((n) => [n.id, 0]));
	let changed = true;
	for (let pass = 0; changed; pass++) {
		if (pass > chapters.length) throw new Error('prereq graph has a cycle');
		changed = false;
		for (const e of edges) {
			const next = (layer.get(e.from) ?? 0) + 1;
			if (next > (layer.get(e.to) ?? 0)) {
				layer.set(e.to, next);
				changed = true;
			}
		}
	}
	const maxLayer = Math.max(0, ...layer.values());
	const { out, inc } = adjacency(edges);

	const cols: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
	for (const n of chapters) cols[layer.get(n.id) ?? 0]?.push(n.id);
	const rank = new Map<string, number>();
	const reindex = () => cols.forEach((c) => c.forEach((id, i) => rank.set(id, i)));
	reindex();
	const sweep = (l: number, adj: Adjacency) => {
		const col = cols[l];
		if (!col) return;
		const key = (id: string) => {
			const ns = adj.get(id) ?? [];
			if (!ns.length) return rank.get(id) ?? 0;
			return ns.reduce((s, n) => s + (rank.get(n) ?? 0), 0) / ns.length;
		};
		const base = new Map(col.map((id, i) => [id, i]));
		col.sort((a, b) => key(a) - key(b) || (base.get(a) ?? 0) - (base.get(b) ?? 0));
		reindex();
	};
	for (let it = 0; it < 3; it++) {
		for (let l = 1; l <= maxLayer; l++) sweep(l, inc);
		for (let l = maxLayer - 1; l >= 0; l--) sweep(l, out);
	}

	const titleLines = new Map(
		chapters.map((n) => [n.id, wrapText(n.title, TITLE_CHARS, TITLE_LINES)]),
	);
	const maxTitleLines = Math.max(1, ...Array.from(titleLines.values(), (l) => l.length));
	const nodeH = NODE_PAD_Y * 2 + maxTitleLines * LINE_H;
	const colH = (c: string[]) => (c.length ? c.length * nodeH + (c.length - 1) * ROW_GAP : 0);
	const tallest = Math.max(0, ...cols.map(colH));

	const byId = new Map<string, LayoutNode>();
	const byChapter = new Map(chapters.map((n) => [n.id, n]));
	cols.forEach((col, l) => {
		const top = PAD + (tallest - colH(col)) / 2;
		col.forEach((id, i) => {
			const n = byChapter.get(id);
			if (!n) return;
			byId.set(id, {
				id,
				topic: n.topic,
				title: n.title,
				lines: titleLines.get(id) ?? [''],
				x: PAD + l * (NODE_W + COL_GAP),
				y: top + i * (nodeH + ROW_GAP),
				w: NODE_W,
				h: nodeH,
				layer: l,
			});
		});
	});

	const nodes = chapters.map((n) => byId.get(n.id)).filter((n): n is LayoutNode => !!n);
	const layoutEdges: LayoutEdge[] = [];
	for (const e of edges) {
		const a = byId.get(e.from);
		const b = byId.get(e.to);
		if (!a || !b) continue;
		const x1 = a.x + a.w;
		const y1 = a.y + a.h / 2;
		const x2 = b.x;
		const y2 = b.y + b.h / 2;
		const c = Math.max(24, (x2 - x1) / 2);
		layoutEdges.push({
			from: e.from,
			to: e.to,
			d: `M${x1} ${y1} C${x1 + c} ${y1} ${x2 - c} ${y2} ${x2} ${y2}`,
		});
	}

	return {
		nodes,
		edges: layoutEdges,
		width: PAD * 2 + (maxLayer + 1) * NODE_W + maxLayer * COL_GAP,
		height: nodes.length ? PAD * 2 + tallest : PAD * 2,
	};
}

export type Direction = 'left' | 'right' | 'up' | 'down';

/**
 * Next node for arrow-key navigation. Left/right follow prerequisite/dependent edges
 * (closest row first); up/down move within the column. Returns `undefined` at a dead end.
 */
export function neighbor(layout: GraphLayout, id: string, dir: Direction): string | undefined {
	const cur = layout.nodes.find((n) => n.id === id);
	if (!cur) return undefined;
	const byId = new Map(layout.nodes.map((n) => [n.id, n]));
	const dist = (n: LayoutNode) => Math.abs(n.y - cur.y);
	if (dir === 'left' || dir === 'right') {
		const ids = layout.edges
			.filter((e) => (dir === 'left' ? e.to === id : e.from === id))
			.map((e) => (dir === 'left' ? e.from : e.to));
		const cand = ids.map((i) => byId.get(i)).filter((n): n is LayoutNode => !!n);
		cand.sort((a, b) => dist(a) - dist(b));
		return cand[0]?.id;
	}
	const col = layout.nodes.filter((n) => n.layer === cur.layer).sort((a, b) => a.y - b.y);
	const i = col.findIndex((n) => n.id === id);
	return col[dir === 'up' ? i - 1 : i + 1]?.id;
}

export interface Viewport {
	scale: number;
	x: number;
	y: number;
}

export const MIN_SCALE = 0.4;
export const MAX_SCALE = 2;

export function clampScale(s: number): number {
	return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/** Scale that fits the layout into `avail` px width, never above 1 and never below `floor`. */
export function fitScale(layoutWidth: number, avail: number, floor = 0.6): number {
	if (!avail || !layoutWidth) return 1;
	return clampScale(Math.max(floor, Math.min(1, avail / layoutWidth)));
}

/** Zoom around the point (`px`, `py`) of the viewport, keeping that point fixed. */
export function zoomAt(v: Viewport, factor: number, px: number, py: number): Viewport {
	const scale = clampScale(v.scale * factor);
	const k = scale / v.scale;
	return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
}

/** Pans the minimum distance that brings the rectangle inside a `w` x `h` viewport. */
export function revealRect(
	v: Viewport,
	rect: { x: number; y: number; w: number; h: number },
	w: number,
	h: number,
	margin = 12,
): Viewport {
	const shift = (pos: number, size: number, view: number, off: number) => {
		const lo = pos * v.scale + off;
		const hi = (pos + size) * v.scale + off;
		if (lo < margin) return off + (margin - lo);
		if (hi > view - margin) return off - Math.min(hi - (view - margin), lo - margin);
		return off;
	};
	return { ...v, x: shift(rect.x, rect.w, w, v.x), y: shift(rect.y, rect.h, h, v.y) };
}
