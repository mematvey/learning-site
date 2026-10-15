import { register } from 'node:module';

// Import this module first in every script run by `node scripts/<name>.ts`.
register('./resolve-hook.mjs', import.meta.url);
