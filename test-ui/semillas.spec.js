const { test, expect } = require('@playwright/test');
const M = require('../motor.js');
const { sembrar, conAjustes, sinRedExterna, observarTextos } = require('./ayudas');

const SEMILLA = 12345, PASOS = 4;
const guardadas = [
  { id: 's_abcdef', semilla: SEMILLA, pasos: PASOS, ganador: 'oros', fecha: '2026-11-01T10:00:00.000Z' },
  { id: 's_ghijkl', semilla: 777, pasos: 8, ganador: null, fecha: '2026-11-02T10:00:00.000Z' }
];
/** Las primeras cartas que debe sacar el juego con esa semilla y ese largo de pista (calculado con el motor). */
function esperadas(semilla, pasos, n) {
  const c = new M.Carrera({ pasos, palos: M.IDS, rng: M.crearRng(semilla) }), r = [];
  for (let i = 0; i < n; i++) { const t = c.jugarTurno(); r.push(`${t.carta.palo}/${t.carta.valor}`); }
  return r;
}
/** Apunta cada carta que sale en "Última carta" (palo/valor), sin repetir la misma seguida. */
async function apuntarCartas(page) {
  await page.addInitScript(() => {
    window.__cartas = [];
    new MutationObserver(() => {
      const l = document.getElementById('last'); if (!l) return;
      const s = [...l.querySelectorAll('img')].map(i => i.getAttribute('src') || '').find(x => /card_/.test(x) && !/card_back|back_/.test(x));
      const m = s && /([a-z]+)\/card_[a-z]+_(\d+)\.webp/.exec(s); if (!m) return;
      const k = `${m[1]}/${+m[2]}`;
      if (window.__cartas[window.__cartas.length - 1] !== k) window.__cartas.push(k);
    }).observe(document, { childList: true, subtree: true });
  });
}
const cartas = page => page.evaluate(() => window.__cartas.slice());
const abrirPersonalizada = async page => { await page.goto('/'); await page.click('.modo[data-modo="personalizada"]'); };

test.beforeEach(async ({ page }) => { await sinRedExterna(page); });

test.describe('elegir una semilla guardada en Partida personalizada', () => {
  test.beforeEach(async ({ page }) => { await sembrar(page, { ...conAjustes({ auto: false }), carrera_semillas: guardadas }); await apuntarCartas(page); });

  test('sale en la lista, fija el largo de la pista y la carrera es exactamente la de esa semilla', async ({ page }) => {
    await abrirPersonalizada(page);
    await expect(page.locator('#filaSemilla')).toBeVisible();
    await expect(page.locator('#selSemilla option')).toHaveCount(3);
    await expect(page.locator('#selSemilla option').nth(1)).toContainText('pista 8');            // la más reciente primero
    await expect(page.locator('#selSemilla option').nth(2)).toContainText('ganó Oros');
    await page.selectOption('#selSemilla', 's_abcdef');
    await expect(page.locator('#inPasos')).toHaveValue(String(PASOS));
    await expect(page.locator('#inPasos')).toBeDisabled();
    await expect(page.locator('#notaSemilla')).toContainText('las fichas no cambian');
    await page.click('#start');
    await page.waitForSelector('#deck', { state: 'visible' });
    await expect(page.locator('#tituloLista')).toContainText('las fichas no cambian');
    for (let i = 0; i < 5; i++) { await page.click('#deck'); await page.waitForTimeout(2300); }
    expect((await cartas(page)).slice(0, 5)).toEqual(esperadas(SEMILLA, PASOS, 5));
  });

  test('"Aleatoria" deja la pista libre otra vez', async ({ page }) => {
    await abrirPersonalizada(page);
    await page.selectOption('#selSemilla', 's_abcdef');
    await page.selectOption('#selSemilla', '');
    await expect(page.locator('#inPasos')).toBeEnabled();
    await expect(page.locator('#btnBorrarSemilla')).toBeHidden();
  });

  test('se puede borrar una semilla guardada', async ({ page }) => {
    await abrirPersonalizada(page);
    await page.selectOption('#selSemilla', 's_ghijkl');
    await page.click('#btnBorrarSemilla');
    await page.locator('#dConf button', { hasText: 'Borrar' }).click();
    await expect(page.locator('#selSemilla option')).toHaveCount(2);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('carrera_semillas')).map(e => e.id))).toEqual(['s_abcdef']);
  });

  test('solo se ofrece en Partida personalizada', async ({ page }) => {
    await page.goto('/');
    for (const modo of ['rapida', 'campeonato']) {
      await page.click(`.modo[data-modo="${modo}"]`);
      await expect(page.locator('#filaSemilla')).toBeHidden();
      await page.evaluate(() => document.getElementById('btnMenu').click());
    }
  });
});

test('sin semillas guardadas lo explica', async ({ page }) => {
  await sembrar(page, conAjustes({ auto: false }));
  await abrirPersonalizada(page);
  await expect(page.locator('#selSemilla option')).toHaveCount(1);
  await expect(page.locator('#notaSemilla')).toContainText('Guardar semilla');
});

test('guardar la semilla al acabar y repetir la misma carrera: mismas cartas y las fichas no cambian', async ({ page }) => {
  await sembrar(page, conAjustes({ auto: true, velocidad: 'rapida' }));
  await apuntarCartas(page); await observarTextos(page);
  await abrirPersonalizada(page);
  await page.$eval('#inPasos', el => { el.value = 2; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('#start');
  await page.waitForSelector('#auto', { state: 'visible' }); await page.click('#auto');
  await page.waitForSelector('#cartel:not([hidden])', { timeout: 150000 });
  const primera = await cartas(page);
  const fichas1 = await page.locator('#bets .chips').allInnerTexts();

  await page.click('#cGuardar');
  await expect(page.locator('#aviso')).toContainText('guardada');
  await expect(page.locator('#cGuardar')).toBeDisabled();
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('carrera_semillas')));
  expect(guardado).toHaveLength(1);
  expect(guardado[0].pasos).toBe(2);
  expect(guardado[0].ganador).toMatch(/^[a-z]+$/);

  await page.evaluate(() => window.__cartas.push('|'));
  await page.click('#cRepetir');
  await expect(page.locator('#cartel')).toBeHidden();
  await expect(page.locator('#tituloLista')).toContainText('misma carrera');
  await page.waitForSelector('#auto', { state: 'visible' }); await page.click('#auto');
  await page.waitForSelector('#cartel:not([hidden])', { timeout: 150000 });          // la repetición acaba en el mismo ganador
  const todas = await cartas(page), segunda = todas.slice(todas.indexOf('|') + 1);
  expect(segunda.length).toBeGreaterThan(2);
  expect(segunda, 'misma carrera, carta por carta').toEqual(primera);
  expect(await page.locator('#bets .chips').allInnerTexts(), 'repetir no regala ni quita fichas').toEqual(fichas1);
});
