// Entry point: node scripts/gen-registry.ts [--root <dir>] [--out <dir>]
import './lib/register.ts';

const { parseArgs } = await import('./lib/args');
const { runGenerate } = await import('./lib/tasks');
process.exitCode = runGenerate(parseArgs(process.argv.slice(2)));
