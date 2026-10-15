import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
	testDir: 'e2e',
	use: { baseURL: `http://localhost:${port}` },
	webServer: {
		command: 'npm run build && npm run preview',
		url: `http://localhost:${port}`,
		reuseExistingServer: !process.env.CI,
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
