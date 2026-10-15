import { z } from 'zod';
import { ChapterId, LabId } from './ids';

export const LabRuntime = z.enum(['pyodide', 'js', 'simulator', 'external-notebook']);
export type LabRuntime = z.infer<typeof LabRuntime>;

/** Visualizer binding: which registered visualizer draws which `LabResult` field. */
export const LabVisualizer = z.object({
	/** Registered visualizer type: `curve`, `heatmap`, `table`, `diff`, or a custom one. */
	type: z.string().regex(/^[a-z][a-z0-9-]*$/),
	/** Path into `LabResult`, e.g. `arrays.weights`, `series.loss`, `metrics`. */
	source: z.string().regex(/^(arrays|series|metrics|tests)(\.[A-Za-z0-9_-]+)?$/),
	options: z.record(z.string(), z.json()).optional(),
});
export type LabVisualizer = z.infer<typeof LabVisualizer>;

export const LabExternal = z.object({
	colab: z.boolean().optional(),
	kaggle: z.boolean().optional(),
	gpu: z.boolean().optional(),
});
export type LabExternal = z.infer<typeof LabExternal>;

/** Whitelisted Pyodide packages are checked by the linter; the schema only checks the format. */
const PackageName = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/i);

/**
 * `labs/<lab-id>/lab.yaml`. Paths are relative to the lab folder.
 * Required by runtime:
 * - `pyodide`, `js`: `starter`, `solution`, `tests.visible`
 * - `simulator`: `simulator` (component key)
 * - `external-notebook`: `starter`, `solution`, `tests.visible`, `external`
 */
export const Lab = z
	.object({
		id: LabId,
		title: z.string().min(1),
		chapter: ChapterId,
		runtime: LabRuntime,
		starter: z.string().min(1).optional(),
		/** Reference solution. Never shipped to the client bundle. */
		solution: z.string().min(1).optional(),
		tests: z
			.object({
				visible: z.string().min(1).optional(),
				/** Executed but only name and status are reported. */
				hidden: z.string().min(1).optional(),
			})
			.optional(),
		/** Simulator component key (runtime `simulator` only). */
		simulator: z
			.string()
			.regex(/^[a-z][a-z0-9-]*$/)
			.optional(),
		visualizers: z.array(LabVisualizer).optional(),
		/** Seconds; default 10. */
		timeout: z.number().positive().max(120).default(10),
		packages: z.array(PackageName).optional(),
		external: LabExternal.optional(),
	})
	.superRefine((lab, ctx) => {
		const need = (ok: boolean, path: string[], message: string) => {
			if (!ok) ctx.addIssue({ code: 'custom', path, message });
		};
		if (lab.runtime === 'simulator') {
			need(!!lab.simulator, ['simulator'], 'runtime "simulator" requires `simulator`');
			return;
		}
		need(!!lab.starter, ['starter'], `runtime "${lab.runtime}" requires \`starter\``);
		need(!!lab.solution, ['solution'], `runtime "${lab.runtime}" requires \`solution\``);
		need(!!lab.tests?.visible, ['tests', 'visible'], 'requires `tests.visible`');
		if (lab.runtime === 'external-notebook') {
			need(!!lab.external, ['external'], 'runtime "external-notebook" requires `external`');
		}
	});
export type Lab = z.infer<typeof Lab>;
/** Input form of `lab.yaml` (before defaults). */
export type LabInput = z.input<typeof Lab>;

/** Default timeout in seconds. */
export const DEFAULT_LAB_TIMEOUT_S = 10;
