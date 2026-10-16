import { RoadmapsRegistry, type RoadmapEntry } from '$lib/contracts/roadmap';

const generated = import.meta.glob('/src/generated/roadmaps.json', {
	eager: true,
	import: 'default',
}) as Record<string, unknown>;

let cached: RoadmapEntry[] | undefined;

/** Roadmaps from `src/generated/roadmaps.json`, sorted by id. */
export function getRoadmaps(): RoadmapEntry[] {
	if (!cached) {
		const raw = generated['/src/generated/roadmaps.json'];
		if (raw === undefined) {
			throw new Error(
				'src/generated/roadmaps.json отсутствует: запустите node scripts/gen-registry.ts',
			);
		}
		cached = RoadmapsRegistry.parse(raw);
	}
	return cached;
}

export function getRoadmap(id: string): RoadmapEntry | undefined {
	return getRoadmaps().find((r) => r.id === id);
}
