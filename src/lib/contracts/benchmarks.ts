import { z } from 'zod';
import { IsoDate } from './ids';
import { Series } from './lab-result';

export const BENCHMARK_SCHEMA_VERSION = 1;

/** `data/benchmarks/<id>.json`: precomputed measurements shown with `charts`. */
export const Benchmark = z
	.object({
		schema_version: z.literal(BENCHMARK_SCHEMA_VERSION),
		id: z.string().regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/),
		title: z.string().min(1),
		/** Required: numbers about hardware are meaningless without it. */
		hardware: z.object({
			gpu: z.string().min(1),
			cpu: z.string().optional(),
			driver: z.string().optional(),
			cuda: z.string().optional(),
			memory: z.string().optional(),
		}),
		/** Versions, e.g. `{ torch: "2.5.1", triton: "3.1" }`. */
		software: z.record(z.string(), z.string()),
		/** How it was measured: warmups, repeats, statistic. */
		method: z.string().min(1),
		date: IsoDate,
		series: z.record(z.string(), Series).optional(),
		table: z
			.object({
				columns: z.array(z.string()).min(1),
				rows: z.array(z.array(z.union([z.number(), z.string()]))),
			})
			.optional(),
		source: z.object({
			url: z.url().optional(),
			/** Command that reproduces the measurement. */
			command: z.string().min(1),
			repo_commit: z.string().min(1),
		}),
	})
	.refine((b) => b.series !== undefined || b.table !== undefined, 'need `series` or `table`');
export type Benchmark = z.infer<typeof Benchmark>;
