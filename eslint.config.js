import js from '@eslint/js';
import globals from 'globals';
import svelte from 'eslint-plugin-svelte';
import ts from 'typescript-eslint';

export default ts.config(
	{
		ignores: [
			'build',
			'.svelte-kit',
			'.worktrees',
			'docs/mockups/**',
			'node_modules',
			'playwright-report',
			'test-results',
			'user-data',
		],
	},
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: { parser: ts.parser },
		},
	},
);
