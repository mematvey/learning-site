import { parse as parseYaml } from 'yaml';
import { Lab, type LabBundle } from '$lib/contracts';

/*
 * Lab files are read at build time as raw text and loaded lazily per lab.
 * `solution.py` is deliberately not in any glob: the reference solution never ships to the client.
 */
const yamlLoaders = import.meta.glob('/labs/*/lab.yaml', {
	query: '?raw',
	import: 'default',
}) as Record<string, () => Promise<string>>;

const pyLoaders = import.meta.glob(['/labs/*/starter.py', '/labs/*/tests_*.py'], {
	query: '?raw',
	import: 'default',
}) as Record<string, () => Promise<string>>;

/** Loads `lab.yaml` and the starter and test files of one lab, validated against `Lab`. */
export async function loadBundle(labId: string): Promise<LabBundle> {
	const loadYaml = yamlLoaders[`/labs/${labId}/lab.yaml`];
	if (!loadYaml) throw new Error(`Лаб не найден: ${labId}`);
	const parsed = Lab.safeParse(parseYaml(await loadYaml()));
	if (!parsed.success) {
		throw new Error(
			`lab.yaml лаба ${labId}: ${parsed.error.issues[0]?.message ?? 'ошибка формата'}`,
		);
	}
	const lab = parsed.data;

	const read = async (file: string | undefined): Promise<string | undefined> => {
		if (!file) return undefined;
		const load = pyLoaders[`/labs/${labId}/${file}`];
		return load ? load() : undefined;
	};

	const starter = await read(lab.starter ?? 'starter.py');
	if (starter === undefined) throw new Error(`Нет стартового кода у лаба ${labId}`);
	const testsVisible = await read(lab.tests?.visible);
	if (testsVisible === undefined) throw new Error(`Нет видимых тестов у лаба ${labId}`);
	const testsHidden = await read(lab.tests?.hidden);

	return { lab, starter, testsVisible, ...(testsHidden !== undefined ? { testsHidden } : {}) };
}

/** Hex SHA-256 of the starter text, the identity used for `LabDraft.starterHash`. */
export async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
