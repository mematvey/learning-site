// Entry point: node scripts/check-content.ts [--root <dir>]
import './lib/register.ts';

const { parseArgs } = await import('./lib/args');
const { runCheck } = await import('./lib/tasks');
process.exitCode = runCheck(parseArgs(process.argv.slice(2)));
