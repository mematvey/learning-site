import { remarkAutoImport } from './auto-import';
import { remarkBlockIds } from './block-ids';
import { remarkMath } from './math';
import { remarkSections } from './sections';

/** Remark plugins for mdsvex, in application order. Wired into vite.config.ts by the orchestrator. */
export const remarkPlugins = [remarkMath, remarkBlockIds, remarkSections, remarkAutoImport];

/** Rehype plugins: none yet (formulas are rendered at the remark stage). */
export const rehypePlugins: never[] = [];

export { checkBlockId, BLOCK_ID_RE } from './block-ids';
export { COMPONENT_IMPORTS } from './auto-import';
export { renderFormula } from './math';
