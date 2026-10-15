import { resolve } from 'node:path';

export interface CliArgs {
	/** Content root (folder with `content/`, `labs/`, `data/`). */
	root: string;
	/** Output folder for generated registries (gen-registry only). */
	out: string;
}

/** Parses `--root <dir>` and `--out <dir>`. Relative paths resolve against the current directory. */
export function parseArgs(argv: readonly string[], cwd = process.cwd()): CliArgs {
	const value = (flag: string): string | undefined => {
		const i = argv.indexOf(flag);
		if (i === -1) return undefined;
		const next = argv[i + 1];
		if (next === undefined || next.startsWith('--')) throw new Error(`${flag} needs a value`);
		return next;
	};
	const root = resolve(cwd, value('--root') ?? '.');
	const out = resolve(cwd, value('--out') ?? resolve(root, 'src/generated'));
	return { root, out };
}
