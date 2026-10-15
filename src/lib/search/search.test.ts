import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce, nextIndex, sanitizeExcerpt, toSearchHit, withBase } from './search';

describe('debounce', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('calls once with the last arguments after the delay', () => {
		const fn = vi.fn<(s: string) => void>();
		const d = debounce(fn, 150);
		d('a');
		vi.advanceTimersByTime(100);
		d('ab');
		vi.advanceTimersByTime(149);
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith('ab');
	});

	it('cancel drops the pending call', () => {
		const fn = vi.fn<(s: string) => void>();
		const d = debounce(fn, 150);
		d('x');
		d.cancel();
		vi.advanceTimersByTime(500);
		expect(fn).not.toHaveBeenCalled();
	});
});

describe('sanitizeExcerpt', () => {
	it('keeps only <mark> and escapes everything else', () => {
		const out = sanitizeExcerpt('a <mark>softmax</mark> <img src=x onerror=alert(1)> & "q"');
		expect(out).toBe(
			'a <mark>softmax</mark> &lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;',
		);
	});
});

describe('withBase', () => {
	it('prefixes the base path once', () => {
		expect(withBase('/dl/attention.html', '/learning-site')).toBe(
			'/learning-site/dl/attention.html',
		);
		expect(withBase('/learning-site/dl/attention.html', '/learning-site')).toBe(
			'/learning-site/dl/attention.html',
		);
	});

	it('leaves URLs alone when base is empty', () => {
		expect(withBase('/dl/attention.html', '')).toBe('/dl/attention.html');
	});
});

describe('toSearchHit', () => {
	it('maps a raw Pagefind record to a render-ready hit', () => {
		const hit = toSearchHit(
			{
				url: '/dl/attention.html',
				excerpt: 'вес <mark>внимания</mark>',
				meta: { title: '  Внимание ' },
				filters: { level: ['Формально'] },
			},
			'/learning-site',
		);
		expect(hit).toEqual({
			url: '/learning-site/dl/attention.html',
			title: 'Внимание',
			excerptHtml: 'вес <mark>внимания</mark>',
			levelLabel: 'Формально',
		});
	});

	it('falls back to the URL when there is no title and no level', () => {
		const hit = toSearchHit({ url: '/cs/x.html', excerpt: '' });
		expect(hit.title).toBe('/cs/x.html');
		expect(hit.levelLabel).toBe('');
	});
});

describe('nextIndex', () => {
	it('wraps around in both directions', () => {
		expect(nextIndex(0, -1, 3)).toBe(2);
		expect(nextIndex(2, 1, 3)).toBe(0);
		expect(nextIndex(-1, 1, 3)).toBe(0);
		expect(nextIndex(-1, -1, 3)).toBe(2);
	});

	it('returns -1 for an empty list', () => {
		expect(nextIndex(0, 1, 0)).toBe(-1);
	});
});
