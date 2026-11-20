const { test, expect } = require('@playwright/test');
const { sembrar, conAjustes, sinRedExterna } = require('./ayudas');

const viejo = {   // como lo dejaba la versión anterior: sin ids y con las fichas por nombre
  ...conAjustes({ auto: false }),
  carrera_fichas: { Ana: 150 },
  carrera_jugadores_pers: [{ nombre: 'Ana', palo: 'oros', apuesta: 10 }, { nombre: 'Ana', palo: 'copas', apuesta: 10 }]
};

test.beforeEach(async ({ page }) => { await sinRedExterna(page); await sembrar(page, viejo); });

test('al abrir, a cada jugador antiguo se le da un id y conserva sus fichas; dos "Ana" quedan separadas', async ({ page }) => {
  await page.goto('/');
  const g = await page.evaluate(() => ({
    lista: JSON.parse(localStorage.getItem('carrera_jugadores_pers')),
    fichas: JSON.parse(localStorage.getItem('carrera_fichas'))
  }));
  const [a, b] = g.lista;
  expect(a.id).toMatch(/^p_[a-z0-9]{8}$/); expect(b.id).toMatch(/^p_[a-z0-9]{8}$/);
  expect(a.id).not.toBe(b.id);
  expect(g.fichas[a.id]).toBe(150); expect(g.fichas[b.id]).toBe(150);

  await page.click('.modo[data-modo="personalizada"]');
  await page.click('#start');
  await page.waitForSelector('#deck', { state: 'visible' });
  await expect(page.locator('#bets li .chips')).toHaveText(['150 fichas', '150 fichas']);
});

test('cambiar el nombre de un jugador no le quita las fichas', async ({ page }) => {
  await page.goto('/');
  const idAntes = await page.evaluate(() => JSON.parse(localStorage.getItem('carrera_jugadores_pers'))[0].id);
  await page.click('.modo[data-modo="personalizada"]');
  await page.fill('input[data-i="0"][data-k="nombre"]', 'Beatriz');
  await page.click('#start');
  await page.waitForSelector('#deck', { state: 'visible' });
  await expect(page.locator('#bets li').first()).toContainText('Beatriz apuesta 10 a oros');
  await expect(page.locator('#bets li .chips').first()).toHaveText('150 fichas');
  const idDespues = await page.evaluate(() => JSON.parse(localStorage.getItem('carrera_jugadores_pers'))[0].id);
  expect(idDespues).toBe(idAntes);
});

test('un jugador nuevo que se añade empieza con 100 fichas y tiene su propio id', async ({ page }) => {
  await page.goto('/');
  await page.click('.modo[data-modo="personalizada"]');
  await page.click('#add');
  const lista = await page.evaluate(() => JSON.parse(localStorage.getItem('carrera_jugadores_pers')));
  expect(new Set(lista.map(p => p.id)).size).toBe(3);
  await page.click('#start');
  await page.waitForSelector('#deck', { state: 'visible' });
  await expect(page.locator('#bets li .chips').nth(2)).toHaveText('100 fichas');
});
