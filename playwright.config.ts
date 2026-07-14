import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke e2e públicos (sin login / sin cobros reales de MP).
 * Arrancá el dev server en :3000 o setéá PLAYWRIGHT_BASE_URL.
 * Tenant: PLAYWRIGHT_TENANT_URL (default http://demo.localhost:3000).
 * Kit de demo y checklist comercial: docs/VENTA-PILOTO.md
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  // En local, si no hay server, lo levantamos. En CI hay que pasar baseURL
  // de un preview o arrancar next en el workflow.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'bun run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
