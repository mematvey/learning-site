import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	GENERATED_FILES,
	AliasesRegistry,
	ChaptersRegistry,
	GlossaryRegistry,
	LabsRegistry,
	PrereqGraphData,
	TopicsRegistry,
} from '../../src/lib/contracts/registry';
import { RoadmapsRegistry } from '../../src/lib/contracts/roadmap';
import type { CliArgs } from './args';
import { buildRegistries } from './build';
import { checkContent } from './check';
import { type Diagnostic, formatDiagnostic, isError } from './diagnostics';
import { loadContent } from './load';

/**
 * Prints diagnostics to stderr. Returns the process exit code: 1 when there is at least one error,
 * 0 otherwise (warnings are printed but do not fail the check).
 */
function report(diagnostics: Diagnostic[]): number {
	for (const d of diagnostics) console.error(formatDiagnostic(d));
	const errors = diagnostics.filter(isError).length;
	const warnings = diagnostics.length - errors;
	if (warnings > 0) console.error(`content: ${warnings} предупреждений`);
	if (errors > 0) {
		console.error(`content: ${errors} ошибок`);
		return 1;
	}
	return 0;
}

/** `check-content`: validates the content tree and returns an exit code. */
export function runCheck(args: CliArgs): number {
	const loaded = loadContent(args.root);
	const diagnostics = checkContent(loaded);
	const code = report(diagnostics);
	if (code === 0) {
		console.log(
			`content: ок (тем ${loaded.topics.length}, глав ${loaded.chapters.length}, лабов ${loaded.labs.length}, терминов ${loaded.glossary.length})`,
		);
	}
	return code;
}

/**
 * `gen-registry`: checks the content, then writes `src/generated/*.json`.
 * Nothing is written when the check fails.
 */
export function runGenerate(args: CliArgs): number {
	const loaded = loadContent(args.root);
	const diagnostics = checkContent(loaded);
	const code = report(diagnostics);
	if (code !== 0) return code;

	const registries = buildRegistries(loaded);
	// Parsing with the registry schemas guards against a generator bug writing a broken file.
	const outputs: [keyof typeof GENERATED_FILES, unknown, { parse: (v: unknown) => unknown }][] = [
		['topics', registries.topics, TopicsRegistry],
		['chapters', registries.chapters, ChaptersRegistry],
		['labs', registries.labs, LabsRegistry],
		['glossary', registries.glossary, GlossaryRegistry],
		['prereqGraph', registries.prereqGraph, PrereqGraphData],
		['aliases', registries.aliases, AliasesRegistry],
		['roadmaps', registries.roadmaps, RoadmapsRegistry],
	];
	mkdirSync(args.out, { recursive: true });
	for (const [key, value, schema] of outputs) {
		schema.parse(value);
		writeFileSync(join(args.out, GENERATED_FILES[key]), `${JSON.stringify(value, null, '\t')}\n`);
	}
	console.log(`registry: записано ${outputs.length} файлов в ${args.out}`);
	return 0;
}
