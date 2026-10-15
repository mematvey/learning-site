import { z } from 'zod';
import { LabId } from './ids';

/** Version of the `LabResult` format. Importers reject other versions with a clear error. */
export const LAB_RESULT_SCHEMA_VERSION = 1;

export const LabStatus = z.enum(['pass', 'fail', 'error', 'timeout']);
export type LabStatus = z.infer<typeof LabStatus>;

export const TestStatus = z.enum(['pass', 'fail', 'error', 'skipped']);
export type TestStatus = z.infer<typeof TestStatus>;

/** One mismatching position of an array diff. */
export const DiffCell = z.object({
	/** Multi-dimensional index. */
	index: z.array(z.number().int().nonnegative()),
	expected: z.number(),
	actual: z.number(),
});
export type DiffCell = z.infer<typeof DiffCell>;

/** Difference between expected and actual values. */
export const TestDiff = z.object({
	kind: z.enum(['scalar', 'array', 'text']),
	/** Human-readable one-liner, e.g. `max deviation 2.7`. */
	summary: z.string(),
	/** Arrays: maximum absolute deviation. */
	max_abs: z.number().optional(),
	/** Arrays: mismatching positions (capped by the producer, up to 50). */
	cells: z.array(DiffCell).max(50).optional(),
});
export type TestDiff = z.infer<typeof TestDiff>;

export const TestResult = z.object({
	name: z.string().min(1),
	status: TestStatus,
	/** Hidden test: `expected`, `actual`, `diff`, `message` must be omitted. */
	hidden: z.boolean(),
	message: z.string().optional(),
	expected: z.json().optional(),
	actual: z.json().optional(),
	diff: TestDiff.optional(),
	location: z.object({ file: z.string(), line: z.number().int().positive() }).optional(),
});
export type TestResult = z.infer<typeof TestResult>;

/** Time series, e.g. a learning curve. `x` and `y` have equal length. */
export const Series = z
	.object({ x: z.array(z.number()), y: z.array(z.number()), label: z.string().optional() })
	.refine((s) => s.x.length === s.y.length, 'x and y must have equal length');
export type Series = z.infer<typeof Series>;

/** Dense array in flat row-major order. `data.length` equals the product of `shape`. */
export const ArrayData = z
	.object({
		shape: z.array(z.number().int().positive()).min(1),
		dtype: z.string().min(1),
		data: z.array(z.number()),
	})
	.refine(
		(a) => a.data.length === a.shape.reduce((p, n) => p * n, 1),
		'data length must match shape',
	);
export type ArrayData = z.infer<typeof ArrayData>;

export const LabError = z.object({
	type: z.string(),
	message: z.string(),
	line: z.number().int().positive().optional(),
});
export type LabError = z.infer<typeof LabError>;

/**
 * Result of one lab run (browser Worker or imported external run).
 * Python and external notebooks produce this exact JSON; keys are snake_case.
 */
export const LabResult = z
	.object({
		schema_version: z.literal(LAB_RESULT_SCHEMA_VERSION),
		lab_id: LabId,
		status: LabStatus,
		tests: z.array(TestResult),
		metrics: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
		series: z.record(z.string(), Series).optional(),
		arrays: z.record(z.string(), ArrayData).optional(),
		duration_ms: z.number().nonnegative(),
		stdout: z.string().optional(),
		stderr: z.string().optional(),
		/** Required when `status` is `error` or `timeout` and the failure is outside the tests. */
		error: LabError.optional(),
		/** `local`: ran in the browser Worker; `external`: imported from Colab/Kaggle. */
		source: z.enum(['local', 'external']),
		/** External runs: hardware and versions. */
		env: z.object({ device: z.string().optional(), notes: z.string().optional() }).optional(),
	})
	.superRefine((r, ctx) => {
		if ((r.status === 'error' || r.status === 'timeout') && !r.error) {
			ctx.addIssue({
				code: 'custom',
				path: ['error'],
				message: `status "${r.status}" requires \`error\``,
			});
		}
		if (r.status === 'pass' && r.tests.some((t) => t.status === 'fail' || t.status === 'error')) {
			ctx.addIssue({
				code: 'custom',
				path: ['status'],
				message: 'status "pass" with failing tests',
			});
		}
	});
export type LabResult = z.infer<typeof LabResult>;

/** Compact result kept in progress: no arrays, series, stdout. */
export const LabResultSummary = z.object({
	schema_version: z.literal(LAB_RESULT_SCHEMA_VERSION),
	lab_id: LabId,
	status: LabStatus,
	tests: z.array(TestResult.pick({ name: true, status: true, hidden: true })),
	metrics: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
	duration_ms: z.number().nonnegative(),
	source: z.enum(['local', 'external']),
});
export type LabResultSummary = z.infer<typeof LabResultSummary>;

/** Builds a summary from a full result. */
export function summarizeResult(r: LabResult): LabResultSummary {
	return {
		schema_version: r.schema_version,
		lab_id: r.lab_id,
		status: r.status,
		tests: r.tests.map(({ name, status, hidden }) => ({ name, status, hidden })),
		...(r.metrics ? { metrics: r.metrics } : {}),
		duration_ms: r.duration_ms,
		source: r.source,
	};
}
