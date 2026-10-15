import { LabDraft, type LabId } from '$lib/contracts';

/*
 * Fallback draft storage for pages without a ProgressStore. Everything is wrapped in try/catch:
 * private mode and blocked storage must not break the lab.
 */
const key = (labId: LabId) => `learning-site:lab-draft:${labId}`;

export function readLocalDraft(labId: LabId): LabDraft | undefined {
	try {
		const raw = window.localStorage.getItem(key(labId));
		if (raw === null) return undefined;
		const parsed = LabDraft.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : undefined;
	} catch {
		return undefined;
	}
}

export function writeLocalDraft(labId: LabId, draft: LabDraft): void {
	try {
		window.localStorage.setItem(key(labId), JSON.stringify(draft));
	} catch {
		/* storage unavailable: the draft lives only in the page */
	}
}

export function removeLocalDraft(labId: LabId): void {
	try {
		window.localStorage.removeItem(key(labId));
	} catch {
		/* ignored, see above */
	}
}
