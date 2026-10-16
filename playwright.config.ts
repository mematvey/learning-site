import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const host = '127.0.0.1';

export default defineConfig({
	testDir: 'e2e',
	use: { baseURL: `http://${host}:${port}` },
	webServer: {
		// Serve the static build (with the Pagefind index) exactly as GitHub Pages would.
		command: `npm run build && uv run python -m http.server ${port} --bind ${host} --directory build`,
		url: `http://${host}:${port}`,
		reuseExistingServer: !process.env.CI,
		timeout: 300_000,
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
