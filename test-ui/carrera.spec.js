const { test, expect } = require('@playwright/test');
const { sembrar, conAjustes, sinRedExterna, observarTextos, textosDesde, correrHastaGanador, esperarClasificacion } = require('./ayudas');

test.beforeEach(async ({ page }) => {
  await sinRedExterna(page);
  await sembrar(page, conAjustes());
  await observarTextos(page);
});

test('partida rápida: gana un caballo, se continúa con los que quedan y sale la clasificación con medallas', async ({ page }) => {
  const errores = []; page.on('pageerror', e => errores.push(String(e)));
  await correrHastaGanador(page);
  await expect(page.locator('#cartel h2')).toContainText('Gana el caballo de');
  await expect(page.locator('#cartel button')).toHaveText(['Continuar con los que quedan', 'Continuar con todas las cartas', 'Revancha', 'Finalizar']);

  const desde = await page.evaluate(() => window.__textos.length);
  await page.click('#cSeguir');
  await esperarClasificacion(page);
  const textos = await textosDesde(page, desde);
  expect(textos.filter(t => t.includes('avanza el caballo')).length, 'sigue habiendo turnos').toBeGreaterThan(0);
  expect(textos.filter(t => t.includes('ya ha llegado')), 'ninguna carta de un caballo que ya llegó').toHaveLength(0);

  await expect(page.locator('.clasif li.m1')).toHaveCount(1);
  await expect(page.locator('.clasif li.m2')).toHaveCount(1);
  await expect(page.locator('.clasif li.m3')).toHaveCount(1);
  expect(errores).toEqual([]);
});

test('partida rápida: "Continuar con todas las cartas" también termina la carrera', async ({ page }) => {
  const errores = []; page.on('pageerror', e => errores.push(String(e)));
  await correrHastaGanador(page);
  await page.click('#cSeguirTodas');
  await esperarClasificacion(page);
  await expect(page.locator('.clasif li')).toHaveCount(4);
  expect(errores).toEqual([]);
});
