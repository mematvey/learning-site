import { createLabRunner } from './runner';
import type { LabRunner } from '$lib/contracts/interfaces';

export { createLabRunner, type LabRunnerOptions } from './runner';
export { makeLabResult } from './result';

/** Shared runner for the page. Creating it does not start a Worker; the first run does. */
export const labRunner: LabRunner = createLabRunner();
