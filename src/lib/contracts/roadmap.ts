import { z } from 'zod';
import { ChapterId, LabId } from './ids';

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** One stage of a roadmap: a short theme and the chapters (and labs) that cover it. */
export const RoadmapStep = z.object({
	title: z.string().min(1),
	description: z.string().min(1),
	chapters: z.array(ChapterId).min(1),
	labs: z.array(LabId).optional(),
	/** Optional stages do not block "continue". */
	optional: z.boolean().optional(),
});
export type RoadmapStep = z.infer<typeof RoadmapStep>;

/** `data/roadmaps/<id>.yaml`: an ordered learning route through chapters. */
export const Roadmap = z.object({
	/** Kebab-case, must equal the file name. */
	id: z.string().regex(KEBAB, 'roadmap id must be kebab-case'),
	title: z.string().min(1),
	summary: z.string().min(1),
	/** Who the route is for / what it gives. */
	audience: z.string().min(1),
	goal: z.string().min(1),
	/** Overrides the estimate computed from chapter `minutes.c2`. */
	estimatedMinutes: z.number().int().positive().optional(),
	steps: z.array(RoadmapStep).min(1),
});
export type Roadmap = z.infer<typeof Roadmap>;

/** One roadmap in `roadmaps.json`: the file plus derived fields. */
export const RoadmapEntry = Roadmap.extend({
	/** Time estimate in minutes (explicit or the sum of chapter `minutes.c2`). */
	estimatedMinutes: z.number().int().nonnegative(),
	chapterCount: z.number().int().nonnegative(),
});
export type RoadmapEntry = z.infer<typeof RoadmapEntry>;
export const RoadmapsRegistry = z.array(RoadmapEntry);
export type RoadmapsRegistry = z.infer<typeof RoadmapsRegistry>;
