import { z } from 'zod';
import { ChapterId, TermId } from './ids';
import { CLevel, DLevel } from './levels';

/** One term in `data/glossary/*.yaml`. Used by `<Term id>`. One term, one entry. */
export const GlossaryEntry = z.object({
	id: TermId,
	/** Russian term (as written in text). */
	term: z.string().min(1),
	/** English term, shown at first mention. */
	term_en: z.string().min(1).optional(),
	/** Short definition for the tooltip (plain text, up to ~240 chars). */
	definition: z.string().min(1).max(400),
	/** Chapter where the term is defined, for the "learn more" link. */
	chapter: ChapterId.optional(),
	/** Block id (`#def-...`) inside `chapter`. */
	block: z.string().optional(),
	/**
	 * Lowest slider position at which the term is defined (default: always, c=1,d=1).
	 * Used by the linter: a mention must not be visible where the definition is not.
	 */
	layer: z.object({ c: CLevel, d: DLevel }).optional(),
	/** Symbol, if the term is a notation (e.g. `d_k`). */
	symbol: z.string().optional(),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntry>;

/** A glossary file is a list of entries. */
export const GlossaryFile = z.array(GlossaryEntry);
export type GlossaryFile = z.infer<typeof GlossaryFile>;
