import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4202',
    headless: true,
    launchOptions: process.env['CHROMIUM_PATH']
      ? { executablePath: process.env['CHROMIUM_PATH'], args: ['--no-sandbox'] }
      : {},
  },
  webServer: {
    command: 'npm start -- --host 127.0.0.1 --port 4202',
    url: 'http://127.0.0.1:4202',
    reuseExistingServer: !process.env['CI'],
    timeout: 60000,
  },
  reporter: 'list',
});
