import { test, expect } from '@playwright/test';

/**
 * Smoke e2e de superficies públicas y de cobro (sin login).
 *
 * - Landing, legal, auth: dominio principal (baseURL).
 * - Tenant: PLAYWRIGHT_TENANT_URL o http://demo.localhost:3000
 *
 * No ejecutan cobros reales de Mercado Pago (eso es staging manual).
 */

const tenantBase = process.env.PLAYWRIGHT_TENANT_URL ?? 'http://demo.localhost:3000';

test.describe('Landing marketing', () => {
  test('carga la home', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.ok()).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('muestra precios de referencia (no trial inventado)', async ({ page }) => {
    await page.goto('/');
    // Ancla o sección de precios
    const precios = page.locator('#precios');
    if (await precios.count()) {
      await precios.scrollIntoViewIfNeeded();
      await expect(precios.getByText(/referencia|Crear mi local|Consultar/i).first()).toBeVisible({
        timeout: 15_000,
      });
    } else {
      // Fallback: el copy de 14 días no debe aparecer
      await expect(page.getByText(/14 días/i)).toHaveCount(0);
    }
  });

  test('footer enlaza términos y privacidad', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Términos/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Privacidad/i }).first()).toBeVisible();
  });
});

test.describe('Legal', () => {
  test('/terminos responde', async ({ page }) => {
    const res = await page.goto('/terminos');
    expect(res?.status()).toBeLessThan(500);
    await expect(page.getByRole('heading', { name: /Términos/i })).toBeVisible();
  });

  test('/privacidad responde', async ({ page }) => {
    const res = await page.goto('/privacidad');
    expect(res?.status()).toBeLessThan(500);
    await expect(page.getByRole('heading', { name: /privacidad/i })).toBeVisible();
  });
});

test.describe('Auth', () => {
  test('/admin redirige a login sin sesión', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('/login muestra form y link de recuperación', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Ingresar/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Olvidaste tu contraseña/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ingresar/i })).toBeVisible();
  });

  test('/forgot-password carga', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: /Recuperar contraseña/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Enviar link/i })).toBeVisible();
  });

  test('/register carga el wizard', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText(/Creá tu cuenta|acomer/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('/cambiar-password sin sesión redirige a login', async ({ page }) => {
    await page.goto('/cambiar-password');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

test.describe('Tenant público — flujos de operación/plata', () => {
  test('carta pública responde sin 5xx', async ({ page }) => {
    const res = await page.goto(`${tenantBase}/carta`);
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(10);
  });

  test('/pedir: offline, menú o no encontrado', async ({ page }) => {
    const res = await page.goto(`${tenantBase}/pedir`);
    expect(res?.status()).toBeLessThan(500);

    const notFound = page.getByText(/Local no encontrado|Restaurante no encontrado/i);
    const offline = page.getByText(/no.*tomando pedidos online|no está tomando pedidos/i);
    const menuHint = page.getByText(/Hacé tu pedido|Buscar|Finalizar pedido|menú/i);

    await Promise.race([
      notFound.waitFor({ state: 'visible', timeout: 45_000 }),
      offline.waitFor({ state: 'visible', timeout: 45_000 }),
      menuHint.waitFor({ state: 'visible', timeout: 45_000 }),
    ]).catch(() => null);

    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(20);
  });

  test('/pedir expone buscador cuando el local toma pedidos', async ({ page }) => {
    await page.goto(`${tenantBase}/pedir`);

    const notFound = page.getByText(/Local no encontrado|Restaurante no encontrado/i);
    const offline = page.getByText(/no.*tomando pedidos online|no está tomando pedidos/i);
    const search = page.getByRole('searchbox', { name: /Buscar en el menú/i });

    await Promise.race([
      search.waitFor({ state: 'visible', timeout: 45_000 }),
      offline.waitFor({ state: 'visible', timeout: 45_000 }),
      notFound.waitFor({ state: 'visible', timeout: 45_000 }),
    ]).catch(() => null);

    if (await notFound.isVisible().catch(() => false)) {
      test.skip(true, 'Tenant no resolvió (proxy/DB). Revisar seed + PLAYWRIGHT_TENANT_URL.');
    }
    if (await offline.isVisible().catch(() => false)) {
      test.skip(true, 'Delivery desactivado en este tenant');
    }
    await expect(search).toBeVisible({ timeout: 15_000 });
  });

  test('/reservar: form, offline o no encontrado', async ({ page }) => {
    const res = await page.goto(`${tenantBase}/reservar`);
    expect(res?.status()).toBeLessThan(500);

    const notFound = page.getByText(/Local no encontrado/i);
    const offline = page.getByText(/Reservas online no disponibles|no estamos tomando reservas/i);
    const form = page.getByRole('heading', { name: /Reservá tu mesa|Reservar/i });

    await Promise.race([
      form.waitFor({ state: 'visible', timeout: 45_000 }),
      offline.waitFor({ state: 'visible', timeout: 45_000 }),
      notFound.waitFor({ state: 'visible', timeout: 45_000 }),
    ]).catch(() => null);

    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(20);
  });

  test('mesa con token inválido no devuelve 5xx', async ({ page }) => {
    // UUID inventado: debe mostrar error amigable, no crash del server.
    const res = await page.goto(
      `${tenantBase}/mesa/00000000-0000-0000-0000-000000000000`,
    );
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(10);
  });
});
