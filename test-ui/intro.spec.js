const { test, expect } = require('@playwright/test');
const { sembrar, conAjustes, sinRedExterna, abrirPartidaRapida } = require('./ayudas');

// Las pruebas del resto de la web no ven la intro (en un navegador automatizado se salta sola); aquí se pide con ?intro=1.
// Todo se mide DENTRO de la página (cuándo aparece, cuándo se salta, dónde aterrizan y cuándo se quita), para que no dependa de lo cargado que esté el equipo.
test.beforeEach(async ({ page }) => {
  await sinRedExterna(page);
  await page.addInitScript(() => {
    window.__intro = {};
    const caja = r => [r.left, r.top, r.width, r.height];
    document.addEventListener('intro:aterrizaje', ev => {                         // las dos herraduras acaban de llegar: ¿dónde están las «C» del título?
      const { viajeros, destinos } = ev.detail;
      window.__intro.error = Math.max(...viajeros.flatMap((v, i) => caja(v.getBoundingClientRect()).map((x, k) => Math.abs(x - caja(destinos[i])[k]))));
    });
    new MutationObserver(() => {
      const e = document.getElementById('intro'), r = window.__intro;
      if (e && r.ini === undefined) {
        const ini = performance.now();                                                // primero la hora: lo de después fuerza un cálculo de diseño que, con el equipo cargado, tarda
        const encima = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
        const rs = [...e.querySelectorAll('.i-c')].map(c => c.getBoundingClientRect()), ov = e.getBoundingClientRect();
        const centro = [(Math.min(...rs.map(x => x.left)) + Math.max(...rs.map(x => x.right))) / 2 - (ov.left + ov.width / 2), (Math.min(...rs.map(x => x.top)) + Math.max(...rs.map(x => x.bottom))) / 2 - (ov.top + ov.height / 2)];   // dónde está la doble C respecto al centro del cartel
        Object.assign(r, { ini, centro, viajeros: e.querySelectorAll('.i-c').length, fondo: e.querySelectorAll('.i-fondo').length, tapaLaApp: !!encima && !!encima.closest('#intro'),
          fundido: e.getAnimations().map(a => [a.effect.getTiming().delay, a.effect.getTiming().duration]) });
      }
      if (e && e.classList.contains('i-saltado') && r.saltada === undefined) r.saltada = performance.now();
      if (!e && r.ini !== undefined && r.fin === undefined) {
        r.fin = performance.now();
        r.claseQuitada = !document.documentElement.classList.contains('intro-activa');
        r.cVisibles = [...document.querySelectorAll('#vMenu h1 .hc')].map(h => getComputedStyle(h).visibility);
      }
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  });
});

const abrir = async (page, url = '/?intro=1') => { await page.goto(url, { waitUntil: 'commit' }); await page.waitForSelector('#intro', { state: 'attached', timeout: 20000 }); };
const esperarFin = page => expect.poll(() => page.evaluate(() => window.__intro.fin !== undefined), { timeout: 20000, intervals: [200] }).toBe(true);
const leer = page => page.evaluate(() => window.__intro);
/** La intro se queda en la doble C hasta que se la salta: no hay viaje ni fin por su cuenta (así no depende de lo que tarde el equipo). */
const congelar = page => page.addInitScript(() => {
  const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => (ms >= 1000 ? 0 : st.call(window, f, ms, ...a));
  Object.defineProperty(document, 'fonts', { value: { ready: new Promise(() => {}) }, configurable: true });
});

for (const [nombre, viewport] of [['escritorio', { width: 1100, height: 680 }], ['iPhone en vertical', { width: 390, height: 797 }], ['iPhone en horizontal', { width: 844, height: 390 }]]) {
  test.describe(nombre, () => {
    test.use({ viewport });
    test('la doble C viaja hasta su sitio en el título, y el fondo se deshace dejando el menú', async ({ page }) => {
      const errores = []; page.on('pageerror', e => errores.push(String(e)));
      await abrir(page);
      await esperarFin(page);
      const s = await leer(page);
      expect(s.viajeros, 'las dos herraduras').toBe(2);
      expect(s.fondo).toBe(1);
      expect(s.tapaLaApp, 'lo de debajo no recibe toques mientras dura').toBe(true);
      expect(s.saltada, 'nadie la ha saltado').toBeUndefined();
      expect(Math.abs(s.centro[0]), 'la doble C sale centrada (horizontal)').toBeLessThan(2);
      expect(Math.abs(s.centro[1]), 'la doble C sale centrada (vertical)').toBeLessThan(2);
      expect(s.error, 'aterrizan encima de las «C» del título (diferencia en píxeles)').toBeLessThan(1.5);
      expect(s.claseQuitada).toBe(true);
      expect(s.cVisibles, 'las «C» del título quedan a la vista al acabar').toEqual(['visible', 'visible']);
      expect(s.fin - s.ini, 'dura unos 2,7 s desde que aparece').toBeGreaterThan(2300);
      expect(s.fin - s.ini).toBeLessThan(8000);
      expect(errores).toEqual([]);
      await page.click('.modo[data-modo="rapida"]');
      await expect(page.locator('#vConfig')).toBeVisible();
    });
  });
}

test.describe('el iPhone da mal el tamaño de la ventana al abrir la app en horizontal', () => {
  test.use({ viewport: { width: 844, height: 390 } });
  test('la doble C sale igualmente centrada y llega a su sitio (no depende de innerWidth/innerHeight)', async ({ page }) => {
    // Lo que pasaba: durante un rato la ventana decía medir 390×844 (en vertical) y la doble C salía abajo a la izquierda, cortada.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'innerWidth', { get: () => 390, configurable: true });
      Object.defineProperty(window, 'innerHeight', { get: () => 844, configurable: true });
    });
    await abrir(page);
    await esperarFin(page);
    const s = await leer(page);
    expect(Math.abs(s.centro[0])).toBeLessThan(2);
    expect(Math.abs(s.centro[1])).toBeLessThan(2);
    expect(s.error, 'y llega exacta al título').toBeLessThan(1.5);
  });
});

test.describe('en la app instalada (iPhone en vertical, con barra de estado)', () => {
  test.use({ viewport: { width: 390, height: 797 } });
  test('la doble C sube medio hueco de la barra de estado para verse centrada en la pantalla', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
      Object.defineProperty(screen, 'height', { value: 844, configurable: true });             // pantalla 844, ventana 797: la barra de estado mide 47
    });
    await abrir(page);
    await esperarFin(page);
    const s = await leer(page);
    expect(Math.abs(s.centro[0])).toBeLessThan(2);
    expect(s.centro[1], 'sube la mitad de 47 px').toBeGreaterThan(-26);
    expect(s.centro[1]).toBeLessThan(-21);
    expect(s.error, 'y aun así llega exacta al título').toBeLessThan(1.5);
  });
});

test('se salta tocando la pantalla, y el toque no se cuela a la app', async ({ page }) => {
  await congelar(page);
  await abrir(page);
  await page.mouse.click(100, 100);
  await esperarFin(page);
  const s = await leer(page);
  expect(s.saltada, 'se marcó como saltada').toBeGreaterThan(0);
  expect(s.error, 'no hubo viaje').toBeUndefined();
  expect(s.cVisibles, 'las «C» del título quedan a la vista').toEqual(['visible', 'visible']);
  await expect(page.locator('#vConfig')).toBeHidden();
  await page.click('.modo[data-modo="rapida"]');
  await expect(page.locator('#vConfig')).toBeVisible();
});

test('se salta con Escape, Enter o Espacio', async ({ page }) => {
  await congelar(page);
  for (const tecla of ['Escape', 'Enter', ' ']) {
    await abrir(page);
    await page.keyboard.press(tecla);
    await esperarFin(page);
    expect((await leer(page)).saltada, tecla).toBeGreaterThan(0);
  }
});

test('por defecto no sale en un navegador automatizado, ni con ?sinintro, ni en un enlace de sala', async ({ page }) => {
  for (const url of ['/', '/?intro=1&sinintro=1', '/?intro=1&sala=ABCDE']) {
    await page.goto(url);
    await page.waitForTimeout(400);
    expect(await page.locator('#intro').count(), url).toBe(0);
    expect((await leer(page)).ini, url).toBeUndefined();
  }
});

test('si se quita en Ajustes, no sale; y «Ver la intro» la enseña igualmente', async ({ page }) => {
  await sembrar(page, { carrera_ajustes: { ...conAjustes().carrera_ajustes, intro: false } });
  await page.goto('/?intro=1');
  await page.waitForTimeout(400);
  expect(await page.locator('#intro').count()).toBe(0);
  await page.click('#btnAjustes');
  await expect(page.locator('#ajIntro')).not.toBeChecked();
  await page.click('#ajVerIntro');
  await expect(page.locator('#intro')).toBeAttached({ timeout: 5000 });
  await expect(page.locator('#dAjustes')).not.toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('#intro')).toHaveCount(0, { timeout: 5000 });
});

test('la casilla de Ajustes guarda si la intro sale al abrir', async ({ page }) => {
  await page.goto('/');
  await page.click('#btnAjustes');
  await expect(page.locator('#ajIntro')).toBeChecked();                            // por defecto, sí
  await page.uncheck('#ajIntro');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('carrera_ajustes')).intro)).toBe(false);
  await page.check('#ajIntro');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('carrera_ajustes')).intro)).toBe(true);
});

test('«Ver la intro» durante una partida (sin título a la vista) no falla: el fondo se deshace y las herraduras se desvanecen', async ({ page }) => {
  const errores = []; page.on('pageerror', e => errores.push(String(e)));
  await sembrar(page, conAjustes({ auto: false }));
  await abrirPartidaRapida(page);
  await page.click('#btnAjustes');
  await page.click('#ajVerIntro');
  await expect(page.locator('#intro')).toBeAttached({ timeout: 5000 });
  await expect(page.locator('#intro .i-c.i-sin-destino').first()).toBeAttached({ timeout: 8000 });
  await expect(page.locator('#intro')).toHaveCount(0, { timeout: 8000 });
  expect(errores).toEqual([]);
  await expect(page.locator('#deck')).toBeVisible();                              // la partida sigue ahí
});

test.describe('con "reducir movimiento" del sistema', () => {
  test.use({ reducedMotion: 'reduce' });
  test('es un fundido corto con la doble C quieta, sin viaje', async ({ page }) => {
    await abrir(page);
    await esperarFin(page);
    const s = await leer(page);
    expect(s.fundido, 'un único fundido de 0,3 s tras 0,9 s, sin viaje').toEqual([[900, 300]]);
    expect(s.error, 'sin viaje').toBeUndefined();
    expect(s.cVisibles).toEqual(['visible', 'visible']);
  });
});
