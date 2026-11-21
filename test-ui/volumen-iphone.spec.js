const { test, expect } = require('@playwright/test');
const { IPHONE_UA, sembrar, conAjustes, sinRedExterna, ESPIAS } = require('./ayudas');

const clipsReales = page => page.evaluate(() => window.__fuentes.filter(d => d > 0.25).length);
async function jugar(page, ajustes) {
  await sinRedExterna(page);
  await sembrar(page, conAjustes({ auto: false, velocidad: 'normal', musica: true, efectos: true, ...ajustes }));
  await page.addInitScript(ESPIAS);
  await page.goto('/');
  await page.click('.modo[data-modo="rapida"]'); await page.click('#start');
  await page.waitForSelector('#deck', { state: 'visible' });
  if (await page.evaluate(() => !document.getElementById('giro').hidden)) await page.click('#giroOk');
  await expect.poll(() => page.evaluate(() => window.__ctx && window.__ctx.state), { timeout: 10000 }).toBe('running');
  await page.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { await page.click('#deck'); await page.waitForTimeout(2300); }
}

test.describe('en iPhone (sin barra de volumen), con un volumen viejo guardado a 0', () => {
  test.use({ userAgent: IPHONE_UA, viewport: { width: 390, height: 797 }, isMobile: true, hasTouch: true });
  test('los galopes suenan igual', async ({ page }) => {
    await jugar(page, { volumen: 0 });
    expect(await clipsReales(page)).toBeGreaterThanOrEqual(2);
  });
});

test.describe('donde sí hay barra de volumen', () => {
  test('con el volumen a 0 no suena nada (se respeta la barra)', async ({ page }) => {
    await jugar(page, { volumen: 0 });
    expect(await clipsReales(page)).toBe(0);
  });
});

test.describe('botón "Probar sonido" de Ajustes', () => {
  test.use({ userAgent: IPHONE_UA, viewport: { width: 390, height: 797 }, isMobile: true, hasTouch: true });

  test('suena y explica qué mirar; avisa si los efectos están apagados', async ({ page }) => {
    await sinRedExterna(page);
    await sembrar(page, conAjustes({ auto: false, volumen: 0, efectos: true }));
    await page.addInitScript(ESPIAS);
    await page.goto('/');
    await page.click('#btnAjustes');
    await page.tap('#ajProbar');
    await expect(page.locator('#ajProbarMsg')).toContainText('interruptor lateral');
    await expect.poll(() => page.evaluate(() => window.__fuentes.length), { timeout: 5000 }).toBeGreaterThan(0);
    await page.uncheck('#ajEfectos');
    await page.tap('#ajProbar');
    await expect(page.locator('#ajProbarMsg')).toContainText('desactivados');
  });
});
