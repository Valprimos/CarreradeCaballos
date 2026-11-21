// Ayudas comunes de las pruebas de interfaz.
const AJUSTES_RAPIDOS = {
  pano: 'verde', dorso: 'indigo', vibracion: false, pantalla: false, velocidad: 'rapida',
  auto: true, musica: false, efectos: false, volumen: 0, soloQuedan: true
};
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

/** Deja el almacenamiento del navegador como se pide, UNA vez por pestaña (sobrevive a recargar la página). */
async function sembrar(page, claves = {}) {
  await page.addInitScript(valores => {
    if (sessionStorage.getItem('__sembrado')) return;
    sessionStorage.setItem('__sembrado', '1');
    for (const [k, v] of Object.entries(valores)) localStorage.setItem(k, JSON.stringify(v));
  }, claves);
}
/** Ajustes por defecto de las pruebas: carrera rápida, en automático, sin sonido ni música. */
const conAjustes = (extra = {}) => ({ carrera_ajustes: { ...AJUSTES_RAPIDOS, ...extra } });

/** Sin red hacia fuera: las salas online no deben intentar conectar durante las pruebas. */
async function sinRedExterna(page) {
  await page.route(url => new URL(url).hostname !== 'localhost', r => r.abort());
}
/** Apunta todo lo que se va añadiendo a la página (el historial de la carrera, avisos…). */
async function observarTextos(page) {
  await page.addInitScript(() => {
    window.__textos = [];
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => window.__textos.push((n.textContent || '').trim()))))
      .observe(document, { childList: true, subtree: true });
  });
}
const textosDesde = (page, desde) => page.evaluate(d => window.__textos.slice(d), desde);

async function abrirPartidaRapida(page) {
  await page.goto('/');
  await page.click('.modo[data-modo="rapida"]');
  await page.click('#start');
  await page.waitForSelector('#deck', { state: 'visible' });
}
/** Arranca en automático y espera al cartel de "Gana el caballo de …". */
async function correrHastaGanador(page) {
  await abrirPartidaRapida(page);
  await page.click('#auto');
  await page.waitForSelector('#cartel:not([hidden])', { timeout: 150000 });
}
const esperarClasificacion = page => page.waitForFunction(() => {
  const c = document.querySelector('#cartel'), h = c && c.querySelector('h2');
  return !c.hidden && h && /Clasificaci|sin ganador/.test(h.textContent);
}, null, { timeout: 170000 });

// Espía el contexto de audio (fuentes lanzadas, resume) y el play/pause del <audio> de la música.
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
module.exports = { ESPIAS,  AJUSTES_RAPIDOS, IPHONE_UA, sembrar, conAjustes, sinRedExterna, observarTextos, textosDesde, abrirPartidaRapida, correrHastaGanador, esperarClasificacion };
