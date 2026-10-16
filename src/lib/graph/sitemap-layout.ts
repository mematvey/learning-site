import type { PrereqGraphData } from '$lib/contracts/registry';

/** Pure layout of the site map: topic clusters of chapter nodes, edges between chapters. */

export const NODE_W = 164;
export const NODE_H = 46;
const COL_GAP = 44;
const ROW_GAP = 10;
const CLUSTER_PAD = 12;
const CLUSTER_HEAD = 30;
const CLUSTER_GAP = 24;
const MARGIN = 8;
const TITLE_CHARS = 19;
const TITLE_LINES = 2;

export interface SitemapTopicInput {
	id: string;
	title: string;
	/** Chapter ids in reading order. */
	chapterIds: string[];
}

export interface SitemapNode {
	id: string;
	topic: string;
	title: string;
	lines: string[];
	x: number;
	y: number;
	w: number;
	h: number;
	layer: number;
}

export interface SitemapCluster {
	topic: string;
	title: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

export type SitemapEdgeKind = 'prereq' | 'uses';

export interface SitemapEdge {
	from: string;
	to: string;
	/** `prereq`: declared prerequisite; `uses`: `to` requires a concept introduced by `from`. */
	kind: SitemapEdgeKind;
	/** The edge connects chapters of different topics. */
	cross: boolean;
	d: string;
}

export interface SitemapLayout {
	clusters: SitemapCluster[];
	nodes: SitemapNode[];
	edges: SitemapEdge[];
	width: number;
	height: number;
}

export interface SitemapOptions {
	/** Soft limit for the width of one row of clusters. */
	maxRowWidth?: number;
}

/** Greedy word wrap by character count; text beyond `maxLines` is cut with an ellipsis. */
export function wrapTitle(text: string, maxChars = TITLE_CHARS, maxLines = TITLE_LINES): string[] {
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
	if (lines.length <= maxLines) return lines.length ? lines : [''];
	const kept = lines.slice(0, maxLines);
	const last = kept[maxLines - 1] ?? '';
	kept[maxLines - 1] = last.slice(0, maxChars - 1).trimEnd() + '…';
	return kept;
}

/**
 * Chapter-to-chapter edges: declared `prereq` edges plus `uses` edges derived from
 * chapter -> concept (`introduces`) and concept -> chapter (`requires`) pairs.
 * Duplicates, self-loops and edges to unknown chapters are dropped.
 */
export function chapterEdges(
	graph: PrereqGraphData,
	chapterIds: ReadonlySet<string>,
): { from: string; to: string; kind: SitemapEdgeKind }[] {
	const seen = new Set<string>();
	const out: { from: string; to: string; kind: SitemapEdgeKind }[] = [];
	const add = (from: string, to: string, kind: SitemapEdgeKind) => {
		if (from === to || !chapterIds.has(from) || !chapterIds.has(to)) return;
		const key = `${from}\n${to}`;
		if (seen.has(key)) return;
		seen.add(key);
		out.push({ from, to, kind });
	};
	for (const e of graph.edges) if (e.kind === 'prereq') add(e.from, e.to, 'prereq');
	const owner = new Map<string, string>();
	for (const e of graph.edges) if (e.kind === 'introduces') owner.set(e.to, e.from);
	for (const e of graph.edges) {
		if (e.kind !== 'requires') continue;
		const from = owner.get(e.from);
		if (from) add(from, e.to, 'uses');
	}
	return out;
}

/** Ancestors and descendants of `id` along `edges` (without `id` itself). */
export function chain(
	edges: readonly { from: string; to: string }[],
	id: string,
): { ancestors: Set<string>; descendants: Set<string> } {
	const walk = (forward: boolean) => {
		const next = new Map<string, string[]>();
		for (const e of edges) {
			const [a, b] = forward ? [e.from, e.to] : [e.to, e.from];
			const list = next.get(a);
			if (list) list.push(b);
			else next.set(a, [b]);
		}
		const seen = new Set<string>();
		const stack = [id];
		while (stack.length) {
			for (const n of next.get(stack.pop() as string) ?? []) {
				if (n === id || seen.has(n)) continue;
				seen.add(n);
				stack.push(n);
			}
		}
		return seen;
	};
	return { ancestors: walk(false), descendants: walk(true) };
}

function edgePath(a: SitemapNode, b: SitemapNode): string {
	if (b.x >= a.x + a.w + 8) {
		const x1 = a.x + a.w;
		const y1 = a.y + a.h / 2;
		const x2 = b.x;
		const y2 = b.y + b.h / 2;
		const c = (x2 - x1) / 2;
		return `M${x1} ${y1} C${x1 + c} ${y1} ${x2 - c} ${y2} ${x2} ${y2}`;
	}
	if (a.x >= b.x + b.w + 8) {
		const x1 = a.x;
		const y1 = a.y + a.h / 2;
		const x2 = b.x + b.w;
		const y2 = b.y + b.h / 2;
		const c = (x1 - x2) / 2;
		return `M${x1} ${y1} C${x1 - c} ${y1} ${x2 + c} ${y2} ${x2} ${y2}`;
	}
	// Overlapping columns: connect vertically.
	const down = b.y >= a.y;
	const x1 = a.x + a.w / 2;
	const y1 = down ? a.y + a.h : a.y;
	const x2 = b.x + b.w / 2;
	const y2 = down ? b.y : b.y + b.h;
	const c = Math.max(24, Math.abs(y2 - y1) / 2);
	const s = down ? 1 : -1;
	return `M${x1} ${y1} C${x1} ${y1 + s * c} ${x2} ${y2 - s * c} ${x2} ${y2}`;
}

/**
 * Lays topics out as clusters. Inside a cluster a chapter sits one column right of its deepest
 * in-topic prerequisite. Clusters are packed left to right and wrap into rows at `maxRowWidth`.
 */
export function layoutSitemap(
	graph: PrereqGraphData,
	topics: readonly SitemapTopicInput[],
	opts: SitemapOptions = {},
): SitemapLayout {
	const maxRow = opts.maxRowWidth ?? 1000;
	const titles = new Map(graph.nodes.map((n) => [n.id, n.title]));
	const topicOf = new Map<string, string>();
	for (const t of topics) for (const id of t.chapterIds) topicOf.set(id, t.id);
	const ids = new Set(topicOf.keys());
	const allEdges = chapterEdges(graph, ids);

	type Local = { cluster: SitemapCluster; nodes: SitemapNode[] };
	const locals: Local[] = [];

	for (const t of topics) {
		if (t.chapterIds.length === 0) continue;
		const inTopic = allEdges.filter(
			(e) => e.kind === 'prereq' && topicOf.get(e.from) === t.id && topicOf.get(e.to) === t.id,
		);
		const layer = new Map(t.chapterIds.map((id) => [id, 0]));
		// Longest path; the pass cap protects against a cycle in broken data.
		for (let pass = 0, changed = true; changed && pass <= t.chapterIds.length; pass++) {
			changed = false;
			for (const e of inTopic) {
				const next = (layer.get(e.from) ?? 0) + 1;
				if (next > (layer.get(e.to) ?? 0)) {
					layer.set(e.to, next);
					changed = true;
				}
			}
		}
		const reading = new Map(t.chapterIds.map((id, i) => [id, i]));
		const maxLayer = Math.max(0, ...layer.values());
		const rowOf = new Map<string, number>();
		const columns: string[][] = [];
		for (let l = 0; l <= maxLayer; l++) {
			const col = t.chapterIds.filter((id) => layer.get(id) === l);
			const score = (id: string) => {
				const ps = inTopic.filter((e) => e.to === id).map((e) => rowOf.get(e.from) ?? 0);
				return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : (reading.get(id) ?? 0);
			};
			col.sort((a, b) => score(a) - score(b) || (reading.get(a) ?? 0) - (reading.get(b) ?? 0));
			col.forEach((id, i) => rowOf.set(id, i));
			columns.push(col);
		}
		const rows = Math.max(1, ...columns.map((c) => c.length));
		const w = CLUSTER_PAD * 2 + columns.length * NODE_W + (columns.length - 1) * COL_GAP;
		const h = CLUSTER_HEAD + CLUSTER_PAD + rows * NODE_H + (rows - 1) * ROW_GAP;
		const nodes: SitemapNode[] = [];
		columns.forEach((col, l) => {
			// Center shorter columns vertically in the cluster.
			const colH = col.length * NODE_H + (col.length - 1) * ROW_GAP;
			const free = rows * NODE_H + (rows - 1) * ROW_GAP - colH;
			col.forEach((id, i) => {
				const title = titles.get(id) ?? id;
				nodes.push({
					id,
					topic: t.id,
					title,
					lines: wrapTitle(title),
					x: CLUSTER_PAD + l * (NODE_W + COL_GAP),
					y: CLUSTER_HEAD + free / 2 + i * (NODE_H + ROW_GAP),
					w: NODE_W,
					h: NODE_H,
					layer: l,
				});
			});
		});
		locals.push({ cluster: { topic: t.id, title: t.title, x: 0, y: 0, w, h }, nodes });
	}

	// Pack clusters into rows.
	let x = MARGIN;
	let y = MARGIN;
	let rowH = 0;
	let width = 0;
	const nodes: SitemapNode[] = [];
	const clusters: SitemapCluster[] = [];
	for (const { cluster, nodes: ns } of locals) {
		if (x > MARGIN && x + cluster.w > maxRow) {
			x = MARGIN;
			y += rowH + CLUSTER_GAP;
			rowH = 0;
		}
		cluster.x = x;
		cluster.y = y;
		for (const n of ns) {
			n.x += x;
			n.y += y;
			nodes.push(n);
		}
		clusters.push(cluster);
		x += cluster.w + CLUSTER_GAP;
		rowH = Math.max(rowH, cluster.h);
		width = Math.max(width, cluster.x + cluster.w);
	}

	const byId = new Map(nodes.map((n) => [n.id, n]));
	const edges: SitemapEdge[] = [];
	for (const e of allEdges) {
		const a = byId.get(e.from);
		const b = byId.get(e.to);
		if (!a || !b) continue;
		edges.push({ ...e, cross: a.topic !== b.topic, d: edgePath(a, b) });
	}

	return { clusters, nodes, edges, width: width + MARGIN, height: y + rowH + MARGIN };
}
