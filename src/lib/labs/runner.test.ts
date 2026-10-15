import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Lab, type LabBundle, type LabRunner } from '$lib/contracts';
import { createLabRunner } from './runner';

type Listener = (event: unknown) => void;
type Sent = { type: string; requestId?: string; packages?: string[]; code?: string };

/** Minimal Worker double. `onSend` decides how the "Worker" answers each request. */
class MockWorker {
	sent: Sent[] = [];
	terminated = false;
	private listeners = new Map<string, Set<Listener>>();
	onSend: ((msg: Sent, worker: MockWorker) => void) | null = null;

	postMessage(msg: Sent): void {
		this.sent.push(msg);
		queueMicrotask(() => this.onSend?.(msg, this));
	}
	addEventListener(type: string, fn: Listener): void {
		const set = this.listeners.get(type) ?? new Set<Listener>();
		set.add(fn);
		this.listeners.set(type, set);
	}
	removeEventListener(type: string, fn: Listener): void {
		this.listeners.get(type)?.delete(fn);
	}
	terminate(): void {
		this.terminated = true;
	}
	emit(data: unknown): void {
		for (const fn of this.listeners.get('message') ?? []) fn({ data });
	}
}

const LAB_ID = 'dl-attention-numpy';

function makeBundle(overrides: Record<string, unknown> = {}): LabBundle {
	const lab = Lab.parse({
		id: LAB_ID,
		title: 'Attention',
		chapter: 'dl/attention',
		runtime: 'pyodide',
		starter: 'starter.py',
		solution: 'solution.py',
		tests: { visible: 'tests_visible.py' },
		timeout: 1,
		...overrides,
	});
	return { lab, starter: '', testsVisible: 'def test_a(): pass' };
}

function passResult(requestId: string) {
	return {
		type: 'result',
		requestId,
		result: {
			schema_version: 1,
			lab_id: LAB_ID,
			status: 'pass',
			tests: [{ name: 'test_a', status: 'pass', hidden: false }],
			duration_ms: 3,
			source: 'local',
		},
	};
}

/** Worker that runs every request successfully and immediately. */
function answeringWorker(w: MockWorker): void {
	w.onSend = (msg, self) => {
		if (msg.type !== 'run' || msg.requestId === undefined) return;
		self.emit({ type: 'stage', requestId: msg.requestId, stage: 'running-code' });
		self.emit(passResult(msg.requestId));
	};
}

/** Worker that starts running the code but never answers. */
function hangingWorker(w: MockWorker): void {
	w.onSend = (msg, self) => {
		if (msg.type === 'run' && msg.requestId) {
			self.emit({ type: 'stage', requestId: msg.requestId, stage: 'running-code' });
		}
	};
}

describe('createLabRunner', () => {
	let workers: MockWorker[];
	/** Configures each Worker as it is created; receives the worker's index. */
	let setup: (w: MockWorker, index: number) => void;
	let runner: LabRunner;

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
		workers = [];
		setup = (w) => answeringWorker(w);
		const createWorker = (): Worker => {
			const w = new MockWorker();
			setup(w, workers.length);
			workers.push(w);
			return w as unknown as Worker;
		};
		runner = createLabRunner({ createWorker, loadTimeoutMs: 5000 });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('initialises Pyodide with numpy and returns the worker result', async () => {
		const result = await runner.run(makeBundle(), 'def attention(): pass');
		expect(result.status).toBe('pass');
		expect(result.lab_id).toBe(LAB_ID);
		expect(workers[0]?.sent[0]).toEqual({ type: 'init', runtime: 'pyodide', packages: ['numpy'] });
		expect(workers[0]?.sent[1]).toMatchObject({
			type: 'run',
			labId: LAB_ID,
			code: 'def attention(): pass',
		});
	});

	it('reuses the same Worker for the next run with the same packages', async () => {
		await runner.run(makeBundle(), 'x = 1');
		await runner.run(makeBundle(), 'x = 2');
		expect(workers).toHaveLength(1);
		expect(workers[0]?.sent.filter((m) => m.type === 'run')).toHaveLength(2);
	});

	it('terminates the Worker on timeout and starts a fresh one next time', async () => {
		setup = (w, index) => (index === 0 ? hangingWorker(w) : answeringWorker(w));
		const p = runner.run(makeBundle({ timeout: 1 }), 'while True: pass');
		await vi.advanceTimersByTimeAsync(1000);
		const result = await p;
		expect(result.status).toBe('timeout');
		expect(result.error?.type).toBe('TimeoutError');
		expect(result.tests).toEqual([]);
		expect(workers[0]?.terminated).toBe(true);

		await expect(runner.run(makeBundle(), 'x = 1')).resolves.toMatchObject({ status: 'pass' });
		expect(workers).toHaveLength(2);
	});

	it('times out while Python is still loading', async () => {
		setup = () => {};
		const p = runner.run(makeBundle(), 'x = 1');
		await vi.advanceTimersByTimeAsync(5000);
		const result = await p;
		expect(result.status).toBe('timeout');
		expect(result.error?.message).toContain('Загрузка');
		expect(workers[0]?.terminated).toBe(true);
	});

	it('turns a run-level fatal message into an error result', async () => {
		setup = (w) => {
			w.onSend = (msg, self) => {
				if (msg.type === 'run' && msg.requestId) {
					self.emit({ type: 'fatal', requestId: msg.requestId, message: 'boom' });
				}
			};
		};
		const result = await runner.run(makeBundle(), 'x = 1');
		expect(result.status).toBe('error');
		expect(result.error).toEqual({ type: 'HarnessError', message: 'boom' });
		expect(workers[0]?.terminated).toBe(true);
	});

	it('rejects on an infrastructure fatal without requestId', async () => {
		setup = (w) => {
			w.onSend = (msg, self) => {
				if (msg.type === 'init') self.emit({ type: 'fatal', message: 'CDN unreachable' });
			};
		};
		await expect(runner.run(makeBundle(), 'x = 1')).rejects.toThrow('CDN unreachable');
	});

	it('replaces an invalid result with an error result', async () => {
		setup = (w) => {
			w.onSend = (msg, self) => {
				if (msg.type === 'run' && msg.requestId) {
					self.emit({ type: 'result', requestId: msg.requestId, result: { status: 'pass' } });
				}
			};
		};
		const result = await runner.run(makeBundle(), 'x = 1');
		expect(result.status).toBe('error');
		expect(result.error?.type).toBe('HarnessError');
	});

	it('ignores messages for other requests', async () => {
		setup = (w) => {
			w.onSend = (msg, self) => {
				if (msg.type === 'run' && msg.requestId) {
					self.emit(passResult('someone-else'));
					self.emit(passResult(msg.requestId));
				}
			};
		};
		const result = await runner.run(makeBundle(), 'x = 1');
		expect(result.status).toBe('pass');
	});

	it('does not start Python for a runtime it does not support', async () => {
		const result = await runner.run(
			makeBundle({ runtime: 'js', starter: 's', solution: 's' }),
			'x',
		);
		expect(result.status).toBe('error');
		expect(result.error?.type).toBe('UnsupportedRuntime');
		expect(workers).toHaveLength(0);
	});

	it('resolves an in-flight run as terminated when terminate() is called', async () => {
		setup = hangingWorker;
		const p = runner.run(makeBundle({ timeout: 60 }), 'while True: pass');
		await vi.advanceTimersByTimeAsync(10);
		runner.terminate();
		const result = await p;
		expect(result.status).toBe('error');
		expect(result.error?.type).toBe('Terminated');
		expect(workers[0]?.terminated).toBe(true);
	});

	it('runs queued calls one after another', async () => {
		const order: string[] = [];
		setup = (w) => {
			w.onSend = (msg, self) => {
				if (msg.type !== 'run' || !msg.requestId) return;
				order.push(msg.code ?? '');
				self.emit({ type: 'stage', requestId: msg.requestId, stage: 'running-code' });
				setTimeout(() => self.emit(passResult(msg.requestId as string)), 10);
			};
		};
		const a = runner.run(makeBundle(), 'a = 1');
		const b = runner.run(makeBundle(), 'b = 2');
		await vi.advanceTimersByTimeAsync(100);
		await expect(a).resolves.toMatchObject({ status: 'pass' });
		await expect(b).resolves.toMatchObject({ status: 'pass' });
		expect(order).toEqual(['a = 1', 'b = 2']);
	});
});
