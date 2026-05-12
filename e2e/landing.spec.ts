import { test, expect } from '@playwright/test';

test('landing page se carga correctamente', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Healthy Space Club/i);
});

test('botones de landing son visibles', async ({ page }) => {
  await page.goto('/');
  const hasComenzar = await page
    .locator('text=/comenzar/i')
    .first()
    .isVisible({ timeout: 5000 })
    .catch(() => false);
  const hasIniciar = await page
    .locator('text=/iniciar sesión/i')
    .first()
    .isVisible({ timeout: 5000 })
    .catch(() => false);
  expect(hasComenzar || hasIniciar).toBe(true);
});
