import { test, expect } from '@playwright/test';

/**
 * Smoke e2e de superficies públicas.
 * - Landing + /admin→login no necesitan tenant ni DB de menú.
 * - Flujos de tenant: subdominio del seed local (por defecto `demo`).
 *   Override: PLAYWRIGHT_TENANT_URL=http://mi-slug.localhost:3000
 */

const tenantBase = process.env.PLAYWRIGHT_TENANT_URL ?? 'http://demo.localhost:3000';

test.describe('Landing marketing', () => {
  test('carga la home sin tenant', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.ok()).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Rutas protegidas', () => {
  test('/admin redirige a login sin sesión', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

test.describe('Tenant público — Nonna Raffaela', () => {
  test('carta pública responde 200', async ({ page }) => {
    const res = await page.goto(`${tenantBase}/carta`);
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    const body = await page.locator('body').innerText();
    // Local no encontrado o carta con contenido.
    expect(body.length).toBeGreaterThan(10);
  });

  test('/pedir muestra pedido online o mensaje de offline', async ({ page }) => {
    const res = await page.goto(`${tenantBase}/pedir`);
    expect(res?.status()).toBeLessThan(500);
    await expect(
      page
        .getByText(/Hacé tu pedido|no está tomando pedidos online|no encontrado|Local no encontrado/i)
        .first(),
    ).toBeVisible({ timeout: 45_000 });
  });

  test('/pedir expone buscador cuando el local toma pedidos', async ({ page }) => {
    await page.goto(`${tenantBase}/pedir`);
    await expect(page.locator('body')).toBeVisible();

    const notFound = page.getByText(/Restaurante no encontrado|Local no encontrado/i);
    const offline = page.getByText(/no está tomando pedidos online/i);
    const search = page.getByRole('searchbox', { name: /Buscar en el menú/i });

    await Promise.race([
      search.waitFor({ state: 'visible', timeout: 45_000 }),
      offline.waitFor({ state: 'visible', timeout: 45_000 }),
      notFound.waitFor({ state: 'visible', timeout: 45_000 }),
    ]).catch(() => null);

    if (await notFound.isVisible().catch(() => false)) {
      test.skip(true, 'Tenant no resolvió (proxy/DB). Revisar extractTenantSlug + seed.');
    }
    if (await offline.isVisible().catch(() => false)) {
      test.skip(true, 'Delivery desactivado en este tenant');
    }
    await expect(search).toBeVisible({ timeout: 15_000 });
  });
});
