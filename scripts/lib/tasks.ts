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
import type { CliArgs } from './args';
import { buildRegistries } from './build';
import { checkContent } from './check';
import { type Diagnostic, formatDiagnostic } from './diagnostics';
import { loadContent } from './load';

/** Prints diagnostics to stderr. Returns the process exit code: 0 when there are none, 1 otherwise. */
function report(diagnostics: Diagnostic[]): number {
	for (const d of diagnostics) console.error(formatDiagnostic(d));
	if (diagnostics.length > 0) {
		console.error(`content: ${diagnostics.length} ошибок`);
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
	];
	mkdirSync(args.out, { recursive: true });
	for (const [key, value, schema] of outputs) {
		schema.parse(value);
		writeFileSync(join(args.out, GENERATED_FILES[key]), `${JSON.stringify(value, null, '\t')}\n`);
	}
	console.log(`registry: записано ${outputs.length} файлов в ${args.out}`);
	return 0;
}
