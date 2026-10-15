import {
	WorkerRequest,
	WorkerResponse,
	type LabBundle,
	type LabRunner,
	type RunOptions,
} from '$lib/contracts/interfaces';
import type { LabResult } from '$lib/contracts/lab-result';
import { makeLabResult } from './result';

export interface LabRunnerOptions {
	/** Creates the Worker. Tests inject a mock; the default is the Pyodide worker. */
	createWorker?: () => Worker;
	/** Time allowed for Python and packages to load before the run starts, in ms. */
	loadTimeoutMs?: number;
}

/** Loaded into every Pyodide session; labs may add their own packages. */
const BASE_PACKAGES = ['numpy'];
const DEFAULT_LOAD_TIMEOUT_MS = 120_000;

function defaultCreateWorker(): Worker {
	return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
}

interface Session {
	worker: Worker;
	packages: Set<string>;
}

/**
 * Lab runner on a Web Worker with Pyodide. One run at a time: concurrent calls are queued.
 * A run that exceeds `lab.timeout` (or the load phase) terminates the Worker and resolves
 * with status `timeout`; the next run starts a fresh Worker.
 */
export function createLabRunner(options: LabRunnerOptions = {}): LabRunner {
	const createWorker = options.createWorker ?? defaultCreateWorker;
	const loadTimeoutMs = options.loadTimeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS;

	let session: Session | null = null;
	let queue: Promise<unknown> = Promise.resolve();
	let cancelInFlight: (() => void) | null = null;
	let seq = 0;

	function killSession(): void {
		if (session) {
			session.worker.terminate();
			session = null;
		}
	}

	function ensureSession(packages: string[]): Session {
		const needed = new Set([...BASE_PACKAGES, ...packages]);
		if (session && [...needed].every((p) => session?.packages.has(p))) return session;
		const merged = new Set([...(session?.packages ?? []), ...needed]);
		killSession();
		const worker = createWorker();
		const created: Session = { worker, packages: merged };
		session = created;
		const init: WorkerRequest = { type: 'init', runtime: 'pyodide', packages: [...merged] };
		worker.postMessage(init);
		return created;
	}

	function execute(bundle: LabBundle, code: string, opts?: RunOptions): Promise<LabResult> {
		const labId = bundle.lab.id;
		if (bundle.lab.runtime !== 'pyodide') {
			return Promise.resolve(
				makeLabResult({
					labId,
					status: 'error',
					error: {
						type: 'UnsupportedRuntime',
						message: `Среда "${bundle.lab.runtime}" пока не поддерживается`,
					},
					durationMs: 0,
				}),
			);
		}

		const requestId = `run-${++seq}`;
		const timeoutMs = opts?.timeoutMs ?? bundle.lab.timeout * 1000;
		const current = ensureSession(bundle.lab.packages ?? []);
		const worker = current.worker;
		const started = Date.now();
		const elapsed = () => Date.now() - started;

		return new Promise<LabResult>((resolve, reject) => {
			let phase: 'load' | 'run' = 'load';
			let timer: ReturnType<typeof setTimeout> | undefined;
			let settled = false;

			const detach = () => {
				settled = true;
				clearTimeout(timer);
				worker.removeEventListener('message', onMessage);
				worker.removeEventListener('error', onError);
				cancelInFlight = null;
			};
			const finish = (result: LabResult) => {
				if (settled) return;
				detach();
				resolve(result);
			};
			const fail = (type: string, message: string) => {
				if (settled) return;
				killSession();
				finish(
					makeLabResult({
						labId,
						status: 'error',
						error: { type, message },
						durationMs: elapsed(),
					}),
				);
			};
			const timeOut = (message: string) => {
				if (settled) return;
				killSession();
				finish(
					makeLabResult({
						labId,
						status: 'timeout',
						error: { type: 'TimeoutError', message },
						durationMs: elapsed(),
					}),
				);
			};
			const infrastructureFailure = (message: string) => {
				if (settled) return;
				killSession();
				detach();
				reject(new Error(message));
			};

			const onMessage = (event: MessageEvent<unknown>) => {
				const parsed = WorkerResponse.safeParse(event.data);
				if (!parsed.success) {
					// A malformed reply to this request must not leave the run pending forever.
					const raw = event.data as { requestId?: unknown } | null;
					if (raw && raw.requestId === requestId) {
						fail('HarnessError', 'Раннер вернул сообщение неверного формата');
					}
					return;
				}
				const msg = parsed.data;
				switch (msg.type) {
					case 'ready':
					case 'stdout':
						return;
					case 'stage':
						if (msg.requestId === requestId && msg.stage === 'running-code' && phase === 'load') {
							phase = 'run';
							clearTimeout(timer);
							timer = setTimeout(
								() => timeOut(`Код выполнялся дольше ${timeoutMs / 1000} с`),
								timeoutMs,
							);
						}
						return;
					case 'result':
						// The schema already checked the payload as a LabResult.
						if (msg.requestId === requestId) finish(msg.result);
						return;
					case 'fatal':
						if (msg.requestId === undefined) {
							infrastructureFailure(`Не удалось запустить Python: ${msg.message}`);
						} else if (msg.requestId === requestId) {
							fail('HarnessError', msg.message);
						}
						return;
				}
			};
			const onError = (event: Event) => {
				const message =
					'message' in event && typeof event.message === 'string' ? event.message : 'unknown error';
				infrastructureFailure(`Ошибка Worker: ${message}`);
			};

			cancelInFlight = () => {
				killSession();
				finish(
					makeLabResult({
						labId,
						status: 'error',
						error: { type: 'Terminated', message: 'Запуск остановлен' },
						durationMs: elapsed(),
					}),
				);
			};

			worker.addEventListener('message', onMessage);
			worker.addEventListener('error', onError);
			timer = setTimeout(
				() => timeOut(`Загрузка Python заняла больше ${loadTimeoutMs / 1000} с`),
				loadTimeoutMs,
			);

			const request: WorkerRequest = {
				type: 'run',
				requestId,
				labId,
				code,
				testsVisible: bundle.testsVisible,
				...(bundle.testsHidden !== undefined ? { testsHidden: bundle.testsHidden } : {}),
				timeoutMs,
			};
			worker.postMessage(request);
		});
	}

	return {
		run(bundle, code, opts) {
			const job = queue.then(() => execute(bundle, code, opts));
			queue = job.catch(() => undefined);
			return job;
		},
		terminate() {
			cancelInFlight?.();
			killSession();
		},
	};
}
