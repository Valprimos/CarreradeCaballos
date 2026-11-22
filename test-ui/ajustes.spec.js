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

test.describe('Mi partida rápida (Ajustes)', () => {
  const fijarPista = (page, n) => page.$eval('#ajPasosRapida', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, n);
  const cartasDePista = page => page.locator('#track .cell.chk .fc').count();

  test('la pista que eliges en Ajustes es con la que arranca Partida rápida, también al reabrir la web', async ({ page }) => {
    await page.goto('/');
    await page.click('#btnAjustes');
    await expect(page.locator('#ajPasosRapidaV')).toHaveText('6');
    await fijarPista(page, 9);
    await expect(page.locator('#ajPasosRapidaV')).toHaveText('9');
    await page.locator('#dAjustes form.cierra button').click();
    await page.click('.modo[data-modo="rapida"]');
    await expect(page.locator('#cfgReglas')).toContainText('pista de 9 pasos');
    await page.click('#start'); await page.waitForSelector('#deck', { state: 'visible' });
    expect(await cartasDePista(page)).toBe(9);
    await page.reload();
    await page.click('.modo[data-modo="rapida"]');
    await page.click('#start'); await page.waitForSelector('#deck', { state: 'visible' });
    expect(await cartasDePista(page)).toBe(9);
  });

  test('por defecto son 6 cartas, como siempre', async ({ page }) => {
    await page.goto('/');
    await page.click('.modo[data-modo="rapida"]');
    await page.click('#start'); await page.waitForSelector('#deck', { state: 'visible' });
    expect(await cartasDePista(page)).toBe(6);
  });

  test('no afecta a Partida personalizada ni a campeonato: siguen con 6', async ({ page }) => {
    await sembrar(page, { carrera_ajustes: { ...conAjustes().carrera_ajustes, pasosRapida: 10 } });
    await page.goto('/');
    for (const modo of ['personalizada', 'campeonato']) {
      await page.click(`.modo[data-modo="${modo}"]`);
      await expect(page.locator('#inPasos'), modo).toHaveValue('6');
      await page.evaluate(() => document.getElementById('btnMenu').click());
    }
  });

  test('la pista que se había elegido en la versión anterior pasa a la partida rápida', async ({ page }) => {
    await sembrar(page, { carrera_ajustes: { ...conAjustes().carrera_ajustes, pasosPers: 8 } });
    await page.goto('/');
    await page.click('#btnAjustes');
    await expect(page.locator('#ajPasosRapidaV')).toHaveText('8');
    expect(await page.evaluate(() => 'pasosPers' in JSON.parse(localStorage.getItem('carrera_ajustes') || '{}'))).toBe(false);
  });

  test('un valor guardado estropeado no rompe la pista', async ({ page }) => {
    for (const [malo, esperado] of [[99, '12'], [1, '2'], ['x', '6'], [null, '6']]) {
      const p = await page.context().newPage();
      await sembrar(p, { carrera_ajustes: { ...conAjustes().carrera_ajustes, pasosRapida: malo } });
      await p.goto('/');
      await p.click('#btnAjustes');
      await expect(p.locator('#ajPasosRapidaV'), String(malo)).toHaveText(esperado);
      await p.close();
    }
  });
});
