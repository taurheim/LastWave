import { defineConfig, devices } from '@playwright/test';

const viewports = {
  mobile: { width: 375, height: 812 },
  'mobile-landscape': { width: 812, height: 375 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [
    ...Object.entries(viewports).map(([name, viewport]) => ({
      name: `visual-${name}`,
      use: { ...devices['Desktop Chrome'], viewport },
      testMatch: 'visual-regression.spec.ts',
    })),
    {
      name: 'wave-snapshots',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
      testMatch: 'wave-snapshot.spec.ts',
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['visual-regression.spec.ts', 'wave-snapshot.spec.ts'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
  },
});
