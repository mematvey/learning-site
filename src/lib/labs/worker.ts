/**
 * Pyodide Web Worker. Protocol: `WorkerRequest` / `WorkerResponse` (src/lib/contracts/interfaces.ts).
 * The page never runs learner code; this Worker does, and the runner can terminate it at any time.
 */
import { loadPyodide, version } from 'pyodide';
import { WorkerRequest, type WorkerResponse } from '$lib/contracts/interfaces';
import type { LabResult } from '$lib/contracts/lab-result';
import harnessSource from './harness.py?raw';

interface WorkerScope {
	postMessage(message: WorkerResponse): void;
	onmessage: ((event: MessageEvent<unknown>) => void) | null;
}

type RunLab = (labId: string, code: string, visible: string, hidden: string) => string;

const scope = self as unknown as WorkerScope;

/** Set once the runtime is ready; `run` waits on it. */
let ready: Promise<RunLab> | null = null;
let activeRequest: string | undefined;
let stdoutBuffer = '';

/** Globals that would let learner code reach the network. Removed after packages are loaded. */
const NETWORK_GLOBALS = ['fetch', 'XMLHttpRequest', 'WebSocket'];

async function init(packages: string[]): Promise<RunLab> {
	const api = await loadPyodide({
		indexURL: `https://cdn.jsdelivr.net/pyodide/v${version}/full/`,
	});
	api.setStdout({
		batched: (chunk: string) => {
			if (activeRequest === undefined) return;
			stdoutBuffer += `${chunk}\n`;
			scope.postMessage({ type: 'stdout', requestId: activeRequest, chunk });
		},
	});
	if (packages.length > 0) {
		await api.loadPackage(packages);
	}
	api.runPython(harnessSource);
	const runLab = api.globals.get('run_lab') as RunLab;
	// Best effort: once packages are in, learner code gets no JS network APIs.
	for (const key of NETWORK_GLOBALS) {
		Reflect.deleteProperty(globalThis, key);
	}
	return runLab;
}

async function run(
	requestId: string,
	labId: string,
	code: string,
	testsVisible: string,
	testsHidden: string | undefined,
): Promise<void> {
	try {
		if (!ready) throw new Error('runtime was not initialised');
		const runLab = await ready;
		activeRequest = requestId;
		stdoutBuffer = '';
		scope.postMessage({ type: 'stage', requestId, stage: 'running-code' });
		const parsed: unknown = JSON.parse(runLab(labId, code, testsVisible, testsHidden ?? ''));
		const withStdout =
			stdoutBuffer.length > 0 && typeof parsed === 'object' && parsed !== null
				? { ...parsed, stdout: stdoutBuffer }
				: parsed;
		scope.postMessage({ type: 'result', requestId, result: withStdout as LabResult });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		scope.postMessage({ type: 'fatal', requestId, message });
	} finally {
		activeRequest = undefined;
	}
}

scope.onmessage = (event: MessageEvent<unknown>) => {
	const parsed = WorkerRequest.safeParse(event.data);
	if (!parsed.success) {
		scope.postMessage({ type: 'fatal', message: 'invalid request to the lab worker' });
		return;
	}
	const msg = parsed.data;
	if (msg.type === 'init') {
		if (msg.runtime !== 'pyodide') {
			scope.postMessage({ type: 'fatal', message: `runtime "${msg.runtime}" is not supported` });
			return;
		}
		if (!ready) {
			ready = init(msg.packages);
			// A failed init is reported by the pending run (fatal with its requestId).
			ready.catch(() => undefined);
		}
		return;
	}
	void run(msg.requestId, msg.labId, msg.code, msg.testsVisible, msg.testsHidden);
};
