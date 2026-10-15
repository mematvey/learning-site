/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { mdsvex } from 'mdsvex';
import { defineConfig } from 'vite';

// SvelteKit 3 reads its configuration from this file (svelte.config.js is no longer used).
// Kit requires the base to be '' or start with '/'.
const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;

export default defineConfig(async () => ({
	resolve: { alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) } },
	plugins: [
		tailwindcss(),
		...(await sveltekit({
			extensions: ['.svelte', '.svx'],
			preprocess: [
				mdsvex({
					extensions: ['.svx'],
					// Custom remark plugins (block ids, notes anchors) go here later.
					remarkPlugins: [],
					// Custom rehype plugins (KaTeX at build time, level components) go here later.
					rehypePlugins: [],
				}),
			],
			adapter: adapter(),
			// Site is served from a subpath on GitHub Pages in CI (BASE_PATH=/learning-site).
			paths: { base },
		})),
	],
	test: {
		environment: 'jsdom',
		include: ['src/**/*.test.ts'],
	},
}));
