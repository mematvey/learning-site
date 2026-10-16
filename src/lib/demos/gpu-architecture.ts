/**
 * Math of the GPU architecture demo: thread blocks, warps, block distribution over SMs,
 * and the memory ladder (registers, shared memory, L2, global memory).
 * Pure functions only: no DOM, no Svelte.
 *
 * Only structural numbers are exact (warp size, block limit). Latencies are given as orders of
 * magnitude and depend on the GPU model: they are not measured values of one device.
 * The number of SMs is illustrative: real GPUs have a different count, the slider only changes the picture.
 */

/** Threads per warp: the unit the scheduler issues instructions to. */
export const WARP_SIZE = 32;
/** Maximum threads per block on current architectures. */
export const MAX_THREADS_PER_BLOCK = 1024;

export const THREADS_MIN = 1;
export const THREADS_MAX = MAX_THREADS_PER_BLOCK;
export const THREADS_DEFAULT = 100;

export const SMS_MIN = 1;
export const SMS_MAX = 8;
export const SMS_DEFAULT = 4;

export const BLOCKS_MIN = 1;
export const BLOCKS_MAX = 32;
export const BLOCKS_DEFAULT = 10;

/** Nodes of the scheme: units inside an SM and the two memories outside it. */
export type NodeId = 'warp' | 'cores' | 'regs' | 'shared' | 'l2' | 'dram';

export const NODE_IDS: readonly NodeId[] = ['warp', 'cores', 'regs', 'shared', 'l2', 'dram'];

export interface GpuArchitectureDemoState {
	/** Threads in one block, in [THREADS_MIN, THREADS_MAX]. */
	threads: number;
	/** Number of SMs drawn, in [SMS_MIN, SMS_MAX]. */
	sms: number;
	/** Blocks in the launch, in [BLOCKS_MIN, BLOCKS_MAX]. */
	blocks: number;
}

export const CUDA_GUIDE_URL = 'https://docs.nvidia.com/cuda/cuda-c-programming-guide/';
export const BEST_PRACTICES_URL = 'https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/';

export interface NodeInfo {
	id: NodeId;
	title: string;
	/** Where the thread-level work happens: a thread, a block, the SM, the whole chip or the board. */
	scope: string;
	/** Qualitative description of the unit. */
	text: string;
	/** Position on the speed ladder: 1 is the fastest. Units without a memory role use 0. */
	rank: number;
	/** Numbers shown on the card, each with its status (exact or order of magnitude). */
	figures: readonly string[];
	sourceLabel: string;
	sourceUrl: string;
}

export const NODE_INFO: Record<NodeId, NodeInfo> = {
	warp: {
		id: 'warp',
		title: 'Планировщик варпов',
		scope: 'SM',
		text: 'Выбирает готовый варп и выдаёт одну инструкцию сразу всем его активным потокам (SIMT). Пока один варп ждёт память, планировщик переключается на другой: так скрывается задержка.',
		rank: 0,
		figures: [`Варп = ${WARP_SIZE} потоков, все выполняют одну инструкцию (точно)`],
		sourceLabel: 'CUDA C++ Programming Guide, SIMT и warp',
		sourceUrl: CUDA_GUIDE_URL,
	},
	cores: {
		id: 'cores',
		title: 'Ядра (CUDA cores)',
		scope: 'SM',
		text: 'Арифметические блоки SM. Их много: они выполняют инструкции варпов. Число ядер в SM зависит от модели GPU.',
		rank: 0,
		figures: ['Число ядер на SM зависит от модели GPU: в этой схеме не задаётся'],
		sourceLabel: 'CUDA C++ Programming Guide, раздел о архитектуре',
		sourceUrl: CUDA_GUIDE_URL,
	},
	regs: {
		id: 'regs',
		title: 'Регистры',
		scope: 'один поток',
		text: 'Самая быстрая память: каждый поток работает со своими регистрами. Их на SM ограниченное количество, и чем больше регистров использует поток, тем меньше потоков умещается одновременно.',
		rank: 1,
		figures: ['Самый быстрый уровень: доступ почти без дополнительной задержки (качественно)'],
		sourceLabel: 'CUDA C++ Best Practices Guide, раздел о памяти',
		sourceUrl: BEST_PRACTICES_URL,
	},
	shared: {
		id: 'shared',
		title: 'Разделяемая память и L1',
		scope: 'блок потоков',
		text: 'Память на кристалле внутри SM, общая для потоков одного блока. Программист управляет ею явно (__shared__). Доступ заметно медленнее регистров, но намного быстрее глобальной памяти.',
		rank: 2,
		figures: [
			'Задержка: заметно ниже, чем у глобальной памяти, при отсутствии конфликтов (качественно)',
		],
		sourceLabel: 'CUDA C++ Best Practices Guide, раздел о памяти',
		sourceUrl: BEST_PRACTICES_URL,
	},
	l2: {
		id: 'l2',
		title: 'Кэш L2',
		scope: 'весь GPU',
		text: 'Общий кэш на кристалле для всех SM. Он сглаживает обращения к глобальной памяти: повторно прочитанные данные берутся отсюда, а не из DRAM.',
		rank: 3,
		figures: ['Задержка: выше, чем у разделяемой памяти, но ниже, чем у DRAM (качественно)'],
		sourceLabel: 'CUDA C++ Best Practices Guide, раздел о памяти',
		sourceUrl: BEST_PRACTICES_URL,
	},
	dram: {
		id: 'dram',
		title: 'Глобальная память (DRAM)',
		scope: 'вся сетка и хост',
		text: 'Самая большая и самая медленная память: вне кристалла, доступна всем блокам и хосту. Главная цель оптимизации — читать её крупными согласованными порциями и реже.',
		rank: 4,
		figures: ['Задержка: самая высокая в иерархии (качественно, зависит от модели)'],
		sourceLabel: 'CUDA C++ Best Practices Guide, раздел о памяти',
		sourceUrl: BEST_PRACTICES_URL,
	},
};

/** Clamps an integer to [lo, hi]. Non-numbers and NaN give the fallback. */
function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
	return Math.min(hi, Math.max(lo, Math.round(v)));
}

export function snapThreads(v: unknown): number {
	return clampInt(v, THREADS_MIN, THREADS_MAX, THREADS_DEFAULT);
}

export function snapSms(v: unknown): number {
	return clampInt(v, SMS_MIN, SMS_MAX, SMS_DEFAULT);
}

export function snapBlocks(v: unknown): number {
	return clampInt(v, BLOCKS_MIN, BLOCKS_MAX, BLOCKS_DEFAULT);
}

export function isNodeId(v: unknown): v is NodeId {
	return typeof v === 'string' && (NODE_IDS as readonly string[]).includes(v);
}

/** Number of warps needed for a block: the last warp may be partly empty. */
export function warpsPerBlock(threads: number): number {
	return Math.ceil(snapThreads(threads) / WARP_SIZE);
}

export interface LaneStats {
	warps: number;
	/** Thread slots in all warps: warps * WARP_SIZE. */
	slots: number;
	/** Slots occupied by threads of the block. */
	active: number;
	/** Slots of the last warp that no thread uses. */
	idle: number;
}

/** Lane usage of one block: how many warp slots carry no thread. */
export function laneStats(threads: number): LaneStats {
	const t = snapThreads(threads);
	const warps = warpsPerBlock(t);
	const slots = warps * WARP_SIZE;
	return { warps, slots, active: t, idle: slots - t };
}

/**
 * Round-robin distribution of blocks over SMs: block i goes to SM (i mod sms).
 * The real hardware scheduler is not specified by the programming model; this is an illustration.
 */
export function distributeBlocks(blocks: number, sms: number): number[] {
	const b = snapBlocks(blocks);
	const s = snapSms(sms);
	const counts = new Array<number>(s).fill(0);
	for (let i = 0; i < b; i++) counts[i % s] = (counts[i % s] ?? 0) + 1;
	return counts;
}

/** Number of waves: rounds needed when every SM runs one block at a time (illustration). */
export function wavesFor(blocks: number, sms: number): number {
	return Math.ceil(snapBlocks(blocks) / snapSms(sms));
}

/** Text for the state, read by screen readers. */
export function describeLaunch(state: GpuArchitectureDemoState): string {
	const lanes = laneStats(state.threads);
	const counts = distributeBlocks(state.blocks, state.sms);
	const busiest = Math.max(0, ...counts);
	const part =
		lanes.idle > 0
			? `Последний варп заполнен на ${lanes.active - (lanes.warps - 1) * WARP_SIZE} из ${WARP_SIZE}: ${lanes.idle} слотов простаивают.`
			: 'Все варпы заполнены полностью.';
	return `Блок из ${lanes.active} потоков занимает ${lanes.warps} варп(ов). ${part} Блоков на самом загруженном SM: ${busiest}, волн: ${wavesFor(state.blocks, state.sms)}.`;
}
