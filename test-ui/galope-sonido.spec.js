const { test, expect } = require('@playwright/test');
const { sembrar, conAjustes, sinRedExterna, abrirPartidaRapida, ESPIAS } = require('./ayudas');

test.beforeEach(async ({ page }) => {
  await sinRedExterna(page);
  await sembrar(page, conAjustes({ auto: false, velocidad: 'normal', musica: false, efectos: true, volumen: 0.6 }));
  await page.addInitScript(ESPIAS);
  await abrirPartidaRapida(page);
  await expect.poll(() => page.evaluate(() => window.__ctx && window.__ctx.state), { timeout: 10000 }).toBe('running');
  await page.waitForFunction(() => window.__decodificados >= 7, null, { timeout: 30000 });      // los 7 clips (5 galopes y 2 relinchos) ya están listos, aunque el equipo vaya cargado
});

test('el galope dura exactamente lo que dura el sonido del caballo, y la carta siguiente espera a que acabe', async ({ page }) => {
  const t0 = Date.now();
  await page.click('#deck');
  await page.waitForFunction(() => [...document.querySelectorAll('.horse')].some(h => h.getAnimations().some(a => a.effect && a.effect.getKeyframes().length > 4)), null, { polling: 'raf', timeout: 8000 });
  const d = await page.evaluate(() => {
    const a = [...document.querySelectorAll('.horse')].flatMap(h => h.getAnimations()).find(x => x.effect && x.effect.getKeyframes().length > 4);
    const clip = window.__clips.filter(c => c.dur > 1.5).pop();                  // el galope que acaba de sonar (los clips duran 1,65 s)
    return { animacion: a.effect.getTiming().duration, sonido: clip.dur / clip.rate * 1000 };
  });
  expect(d.sonido, 'el galope real dura más de 1,5 s').toBeGreaterThan(1500);
  expect(Math.abs(d.animacion - d.sonido), 'la animación y el sonido miden lo mismo').toBeLessThan(5);
  // el mazo no se puede volver a tocar hasta que acaba el galope: tarda el giro de la carta (~0,9 s) más lo que dura el sonido
  await expect(page.locator('#deck')).toBeDisabled();
  await expect(page.locator('#deck')).toBeEnabled({ timeout: 10000 });
  const total = Date.now() - t0;
  expect(total).toBeGreaterThan(900 + d.sonido);
  expect(total).toBeLessThan(900 + d.sonido + 2500);
});

test('destapar una carta suena mucho más bajo que el galope del caballo', async ({ page }) => {
  await page.evaluate(() => { window.__ganancias.length = 0; });
  await page.click('#deck');
  await page.waitForFunction(() => window.__clips.some(c => c.dur > 1.5), null, { timeout: 8000 });
  const g = await page.evaluate(() => window.__ganancias);
  const carta = g.filter(x => x > 0.04 && x < 0.1), galope = g.filter(x => x > 0.6 && x < 0.75);
  expect(carta, 'chasquido de la carta: 0,12 × volumen').toContain(0.072);
  expect(galope, 'galope: 1,15 × volumen').toContain(0.69);
  expect(Math.max(...galope) / Math.max(...carta)).toBeGreaterThan(8);
});
