const { test, expect } = require('@playwright/test');
const { IPHONE_UA, sembrar, conAjustes, sinRedExterna } = require('./ayudas');

// Efectos con sonido de verdad: se espían el contexto de audio y el <audio> de la música.
const ESPIAS = () => {
  window.__fuentes = []; window.__resumes = 0; window.__ctx = null; window.__musica = { paused: true };
  const _start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function () { window.__fuentes.push(this.buffer ? this.buffer.duration : 0); return _start.apply(this, arguments); };
  const _C = window.AudioContext;
  window.AudioContext = function (...a) {
    const c = new _C(...a); window.__ctx = c;
    const r = c.resume.bind(c); c.resume = () => { window.__resumes++; return r(); };
    return c;
  };
  window.AudioContext.prototype = _C.prototype;
  const P = HTMLMediaElement.prototype;
  Object.defineProperty(P, 'paused', { get() { return this.__p !== false; } });
  P.play = function () { this.__p = false; return Promise.resolve(); };
  P.pause = function () { this.__p = true; };
};
const clipsReales = page => page.evaluate(() => window.__fuentes.filter(d => d > 0.25).length);

test.beforeEach(async ({ page }) => {
  await sinRedExterna(page);
  await sembrar(page, conAjustes({ auto: false, velocidad: 'normal', musica: true, efectos: true, volumen: 0.6 }));
  await page.addInitScript(ESPIAS);
  await page.goto('/');
  await page.click('.modo[data-modo="rapida"]');
  await page.click('#start');
  await page.waitForSelector('#deck', { state: 'visible' });
  if (await page.evaluate(() => !document.getElementById('giro').hidden)) await page.click('#giroOk');
});

test('al destapar cartas suenan los galopes reales de los caballos', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => window.__ctx && window.__ctx.state), { timeout: 10000 }).toBe('running');
  await page.waitForTimeout(2500);                                   // dan tiempo a bajar y decodificar los clips
  for (let i = 0; i < 4; i++) { await page.click('#deck'); await page.waitForTimeout(2300); }
  expect(await clipsReales(page)).toBeGreaterThanOrEqual(3);
});

test.describe('en iPhone', () => {
  test.use({ userAgent: IPHONE_UA, viewport: { width: 390, height: 797 }, isMobile: true, hasTouch: true });

  test('si el audio queda interrumpido (salir de la app y volver), el siguiente toque lo reactiva', async ({ page }) => {
    await expect.poll(() => page.evaluate(() => window.__ctx && window.__ctx.state), { timeout: 10000 }).toBe('running');
    // iOS deja el contexto en "interrupted" al volver de otra app
    await page.evaluate(() => { Object.defineProperty(window.__ctx, 'state', { get: () => 'interrupted', configurable: true }); window.__resumes = 0; });
    await page.tap('#deck');
    expect(await page.evaluate(() => window.__resumes), 'debe llamar a resume()').toBeGreaterThan(0);
  });

  test('al volver a la app se reactiva solo, sin esperar a un toque', async ({ page }) => {
    await expect.poll(() => page.evaluate(() => window.__ctx && window.__ctx.state), { timeout: 10000 }).toBe('running');
    await page.evaluate(() => { Object.defineProperty(window.__ctx, 'state', { get: () => 'interrupted', configurable: true }); window.__resumes = 0; });
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(await page.evaluate(() => window.__resumes)).toBeGreaterThan(0);
  });
});

test('la música se pausa al salir de la app y sigue al volver', async ({ page }) => {
  await page.waitForTimeout(500);
  const visibilidad = v => page.evaluate(vis => { Object.defineProperty(document, 'visibilityState', { value: vis, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }, v);
  const sonando = () => page.evaluate(() => window.__reproduciendo === true);
  // registra el play/pause del <audio> de la música (no está en el DOM)
  await page.evaluate(() => {
    window.__reproduciendo = false;
    const P = HTMLMediaElement.prototype, play = P.play, pause = P.pause;
    P.play = function () { window.__reproduciendo = true; return play.apply(this, arguments); };
    P.pause = function () { window.__reproduciendo = false; return pause.apply(this, arguments); };
  });
  await visibilidad('hidden'); await page.waitForTimeout(100);
  expect(await sonando()).toBe(false);
  await visibilidad('visible'); await page.waitForTimeout(100);
  expect(await sonando(), 'vuelve a sonar al volver a una carrera en marcha').toBe(true);
});
