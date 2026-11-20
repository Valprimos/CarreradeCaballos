const { test, expect } = require('@playwright/test');
const { IPHONE_UA, sembrar, conAjustes, sinRedExterna, abrirPartidaRapida } = require('./ayudas');

test.beforeEach(async ({ page }) => { await sinRedExterna(page); });

test.describe('menú de Ajustes en un móvil', () => {
  test.use({ viewport: { width: 390, height: 700 } });

  test('la cruz sigue a la vista aunque se baje del todo, y cierra el menú', async ({ page }) => {
    await page.goto('/');
    await page.click('#btnAjustes');
    const cruz = page.locator('#dAjustes form.cierra button');
    await expect(cruz).toBeVisible();
    await page.evaluate(() => { document.getElementById('dAjustes').scrollTop = 99999; });
    const caja = await page.evaluate(() => {
      const d = document.getElementById('dAjustes'), x = d.querySelector('form.cierra button').getBoundingClientRect(), r = d.getBoundingClientRect();
      return { arriba: x.top >= r.top, abajo: x.bottom <= r.bottom, bajado: d.scrollTop > 200 };
    });
    expect(caja).toEqual({ arriba: true, abajo: true, bajado: true });
    await cruz.click();
    await expect(page.locator('#dAjustes')).not.toHaveAttribute('open', '');
  });

  test('el aviso de girar sale en la primera partida y después como mucho cada 5 minutos', async ({ page }) => {
    await sembrar(page, conAjustes());
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/');
    const empezar = async () => {
      await page.click('.modo[data-modo="rapida"]'); await page.click('#start');
      await page.waitForSelector('#deck', { state: 'visible' });
      const sale = await page.evaluate(() => !document.getElementById('giro').hidden);
      if (sale) await page.click('#giroOk');
      return sale;
    };
    const salir = async () => {
      await page.click('#salir');
      await page.locator('#dConf button', { hasText: 'Salir' }).first().click();
      await page.evaluate(() => document.getElementById('btnMenu').click());
    };
    expect(await empezar(), 'primera partida de la sesión').toBe(true); await salir();
    expect(await empezar(), 'un minuto después').toBe(false); await salir();
    await page.evaluate(() => { const o = Date.now.bind(Date); Date.now = () => o() + 6 * 60 * 1000; });
    expect(await empezar(), 'seis minutos después').toBe(true);
  });
});

test('el volumen se ve donde funciona', async ({ page }) => {
  await page.goto('/');
  await page.click('#btnAjustes');
  await expect(page.locator('#ajVol')).toBeVisible();
});

test.describe('en iPhone', () => {
  test.use({ userAgent: IPHONE_UA, viewport: { width: 390, height: 797 } });

  test('no sale el volumen (no funciona con la música)', async ({ page }) => {
    await page.goto('/');
    await page.click('#btnAjustes');
    await expect(page.locator('#ajVol')).toBeHidden();
    await expect(page.locator('#ajEfectos')).toBeVisible();
  });
});
