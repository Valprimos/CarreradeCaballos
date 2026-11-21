const { test, expect } = require('@playwright/test');
const { sembrar, conAjustes, sinRedExterna, abrirPartidaRapida } = require('./ayudas');

test.beforeEach(async ({ page }) => { await sinRedExterna(page); await sembrar(page, conAjustes({ auto: false })); });

test('al avanzar, el caballo galopa de verdad entre casillas y levanta polvo; después no queda nada colgado', async ({ page }) => {
  await abrirPartidaRapida(page);
  await page.click('#deck');
  await page.waitForFunction(() => document.querySelectorAll('.polvo').length > 0, null, { timeout: 8000, polling: 'raf' });
  const d = await page.evaluate(() => {
    const galopando = [...document.querySelectorAll('.horse')].filter(h => h.getAnimations().some(a => a.effect && a.effect.getKeyframes().length > 4));
    const h = galopando[0], c = h && h.parentElement.getBoundingClientRect(), r = h && h.getBoundingClientRect();
    return { galopando: galopando.length, nubes: document.querySelectorAll('.polvo').length, z: h && h.style.zIndex,
             lejos: h ? Math.hypot(r.left + r.width / 2 - (c.left + c.width / 2), r.top + r.height / 2 - (c.top + c.height / 2)) : 0 };
  });
  expect(d.galopando, 'un caballo en plena animación de galope').toBe(1);
  expect(d.nubes).toBeGreaterThan(0);
  expect(d.z, 'va por encima de su polvo').toBe('6');
  expect(d.lejos, 'todavía está en camino hacia su casilla, no se ha teletransportado').toBeGreaterThan(3);
  await page.waitForFunction(() => !document.querySelector('.polvo') && [...document.querySelectorAll('.horse')].every(h => !h.style.zIndex && h.getAnimations().length === 0 || h.classList.contains('win')), null, { timeout: 8000 });
  await expect(page.locator('.horse[data-p="1"]')).toHaveCount(1);
});

test('en una carrera real, todos los avances y los retrocesos se hacen galopando', async ({ page }) => {
  await page.addInitScript(() => {
    window.__mov = [];
    new MutationObserver(ms => ms.forEach(m => {
      if (!m.target.classList || !m.target.classList.contains('horse')) return;
      const h = m.target, ahora = +h.dataset.p, antes = +m.oldValue;
      if (ahora !== antes) window.__mov.push({ antes, ahora, galopa: h.getAnimations().some(a => a.effect && a.effect.getKeyframes().length > 4) });
    })).observe(document, { attributes: true, attributeFilter: ['data-p'], attributeOldValue: true, subtree: true });
  });
  await sembrar(page, conAjustes({ auto: true, velocidad: 'rapida' }));
  await abrirPartidaRapida(page);
  await page.click('#auto');
  await page.waitForFunction(() => window.__mov.some(m => m.ahora < m.antes) && window.__mov.length > 8, null, { timeout: 170000, polling: 500 });
  const mov = await page.evaluate(() => window.__mov);
  expect(mov.filter(m => m.ahora > m.antes).length).toBeGreaterThan(3);
  expect(mov.filter(m => m.ahora < m.antes).length).toBeGreaterThan(0);
  expect(mov.filter(m => !m.galopa), 'ningún movimiento sin animación de galope').toEqual([]);
});

test.describe('con "reducir movimiento" del sistema', () => {
  test.use({ reducedMotion: 'reduce' });
  test('el caballo avanza sin animación ni polvo', async ({ page }) => {
    await abrirPartidaRapida(page);
    await page.click('#deck');
    await expect(page.locator('.horse[data-p="1"]')).toHaveCount(1, { timeout: 8000 });
    await page.waitForTimeout(800);
    expect(await page.locator('.polvo').count()).toBe(0);
  });
});
