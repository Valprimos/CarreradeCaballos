const { test, expect } = require('@playwright/test');
const { sembrar, conAjustes, sinRedExterna } = require('./ayudas');

test('crear una sala y unirse con su código desde otro móvil', async ({ browser }) => {
  // móvil 1: crea la sala
  const c1 = await browser.newContext(), p1 = await c1.newPage();
  await sinRedExterna(p1); await sembrar(p1, conAjustes());
  await p1.goto('/');
  await p1.click('#btnAmigos');
  await p1.click('#btnCrearSala');
  await expect(p1.locator('#salaCodigo')).not.toBeEmpty();
  const codigo = (await p1.locator('#salaCodigo').innerText()).trim();
  expect(codigo.replace(/[^A-Za-z0-9]/g, '').length).toBeGreaterThanOrEqual(8);

  // móvil 2: se une con ese código
  const c2 = await browser.newContext(), p2 = await c2.newPage();
  await sinRedExterna(p2); await sembrar(p2, conAjustes());
  await p2.goto('/');
  await p2.click('#btnAmigos');
  await p2.fill('#inCodigo', codigo);
  await p2.click('#btnUnirme');
  await expect(p2.locator('#errCodigo')).toBeHidden();
  await expect(p2.locator('#aviso')).toContainText('Entras en la sala');
  await expect(p2.locator('#vConfig')).toBeVisible();
  await c1.close(); await c2.close();
});

test('un código mal escrito da un aviso y no entra', async ({ page }) => {
  await sinRedExterna(page); await sembrar(page, conAjustes());
  await page.goto('/');
  await page.click('#btnAmigos');
  await page.fill('#inCodigo', 'ZZZ');
  await page.click('#btnUnirme');
  await expect(page.locator('#errCodigo')).toBeVisible();
  await expect(page.locator('#errCodigo')).toContainText('no es válido');
  await expect(page.locator('#vConfig')).toBeHidden();
});
