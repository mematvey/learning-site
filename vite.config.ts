/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { mdsvex } from 'mdsvex';
import { remarkPlugins, rehypePlugins } from './src/lib/content/mdsvex/index.ts';
import { defineConfig } from 'vite';

// SvelteKit 3 reads its configuration from this file (svelte.config.js is no longer used).
// Kit requires the base to be '' or start with '/'.
const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;

export default defineConfig(async () => ({
	// Worktrees under .worktrees/ break rolldown tsconfig lookup during dep optimization.
	optimizeDeps: { rolldownOptions: { tsconfig: false } },
	resolve: { alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) } },
	plugins: [
		tailwindcss(),
		...(await sveltekit({
			extensions: ['.svelte', '.svx'],
			preprocess: [
				mdsvex({
					extensions: ['.svx'],
					// Smart quotes would rewrite attribute quotes in inline component tags.
					smartypants: false,
					// Block ids, build-time KaTeX and auto-imported content components.
					remarkPlugins,
					rehypePlugins,
				}),
			],
			adapter: adapter(),
			// Site is served from a subpath on GitHub Pages in CI (BASE_PATH=/learning-site).
			paths: { base },
		})),
	],
	server: { fs: { allow: ['content', 'labs', 'data', 'src', '.svelte-kit', 'node_modules'] } },
	test: {
		environment: 'jsdom',
		include: ['src/**/*.test.ts', 'content/**/*.test.ts', 'scripts/**/*.test.ts'],
	},
}));
