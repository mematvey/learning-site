import type { ZodType } from 'zod';
import { PROGRESS_SCHEMA_VERSION, type Migration } from '$lib/contracts';

function versionOf(record: unknown): number {
	const v =
		typeof record === 'object' && record !== null
			? (record as { schemaVersion?: unknown }).schemaVersion
			: undefined;
	if (typeof v !== 'number' || !Number.isInteger(v)) {
		throw new Error('record has no integer schemaVersion');
	}
	return v;
}

/**
 * Applies migrations `from -> from + 1` until the record reaches `target`.
 * Throws for records from a newer schema and for gaps in the migration chain.
 */
export function migrateRecord(
	record: unknown,
	migrations: readonly Migration[] = [],
	target: number = PROGRESS_SCHEMA_VERSION,
): unknown {
	let current = record;
	let version = versionOf(current);
	while (version !== target) {
		if (version > target) {
			throw new Error(`record schemaVersion ${version} is newer than ${target}`);
		}
		const step = migrations.find((m) => m.from === version && m.to === version + 1);
		if (!step) throw new Error(`no migration from schemaVersion ${version}`);
		current = step.migrate(current);
		const next = versionOf(current);
		if (next !== version + 1) {
			throw new Error(`migration ${version} -> ${version + 1} produced schemaVersion ${next}`);
		}
		version = next;
	}
	return current;
}

/** Migrates a stored or imported record to the current version and validates it with `schema`. */
export function decodeRecord<T>(
	raw: unknown,
	schema: ZodType<T>,
	migrations: readonly Migration[] = [],
): T {
	return schema.parse(migrateRecord(raw, migrations));
}
