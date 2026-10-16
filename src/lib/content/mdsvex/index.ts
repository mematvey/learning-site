import { remarkAutoImport } from './auto-import.ts';
import { remarkBlockIds } from './block-ids.ts';
import { remarkMath } from './math.ts';
import { remarkSections } from './sections.ts';

/** Remark plugins for mdsvex, in application order. Wired into vite.config.ts by the orchestrator. */
export const remarkPlugins = [remarkMath, remarkBlockIds, remarkSections, remarkAutoImport];

/** Rehype plugins: none yet (formulas are rendered at the remark stage). */
export const rehypePlugins: never[] = [];

export { checkBlockId, BLOCK_ID_RE } from './block-ids.ts';
export { COMPONENT_IMPORTS } from './auto-import.ts';
export { renderFormula } from './math.ts';
