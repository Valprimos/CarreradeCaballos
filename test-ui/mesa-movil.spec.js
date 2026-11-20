const { test, expect } = require('@playwright/test');
const { IPHONE_UA, sembrar, conAjustes, sinRedExterna, abrirPartidaRapida } = require('./ayudas');

for (const [nombre, w, h] of [['iPhone SE', 375, 600], ['iPhone 14', 390, 797], ['iPhone grande', 430, 860]]) {
  test.describe(nombre, () => {
    test.use({ userAgent: IPHONE_UA, viewport: { width: w, height: h }, isMobile: true, hasTouch: true });

    test('en vertical el panel de abajo (mazo y botones) no se corta', async ({ page }) => {
      await sinRedExterna(page); await sembrar(page, conAjustes({ auto: false }));
      await abrirPartidaRapida(page);
      if (await page.evaluate(() => !document.getElementById('giro').hidden)) await page.click('#giroOk');
      const m = await page.evaluate(() => {
        const t = document.querySelector('#vJuego .table-row'), r = s => document.querySelector(s).getBoundingClientRect();
        return { cortado: t.scrollHeight > t.clientHeight + 1, vh: innerHeight, deckBottom: r('#deck').bottom, salirBottom: r('#salir').bottom, deckW: r('#deck').width };
      });
      expect(m.cortado).toBe(false);
      expect(m.salirBottom).toBeLessThanOrEqual(m.vh);
      expect(m.deckBottom).toBeLessThanOrEqual(m.vh);
      expect(m.deckW, 'el mazo ya no sale a 112 px').toBeLessThan(80);
    });

    test('pulsar dos veces seguidas no hace zoom (touch-action: manipulation)', async ({ page }) => {
      await sinRedExterna(page); await sembrar(page, conAjustes({ auto: false }));
      await abrirPartidaRapida(page);
      const ta = await page.evaluate(() => ['body', '#deck', '#auto', '#salir'].map(s => getComputedStyle(document.querySelector(s)).touchAction));
      expect(ta).toEqual(['manipulation', 'manipulation', 'manipulation', 'manipulation']);
    });
  });
}
