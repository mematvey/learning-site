import {
	LAB_RESULT_SCHEMA_VERSION,
	type LabError,
	type LabResult,
} from '$lib/contracts/lab-result';
import type { LabId } from '$lib/contracts/ids';

/** Builds a `LabResult` for failures that happen outside the learner's tests. */
export function makeLabResult(args: {
	labId: LabId;
	status: 'error' | 'timeout';
	error: LabError;
	durationMs: number;
}): LabResult {
	return {
		schema_version: LAB_RESULT_SCHEMA_VERSION,
		lab_id: args.labId,
		status: args.status,
		tests: [],
		duration_ms: Math.max(0, args.durationMs),
		source: 'local',
		error: args.error,
	};
}
