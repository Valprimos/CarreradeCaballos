/* Música y efectos de sonido. Los efectos se sintetizan con Web Audio (no hay archivos de sonido);
   la música es audio/carrera.mp3. Todo respeta los ajustes (música, efectos, volumen) y el botón Sonido. */
(function () {
  'use strict';
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, aj = { musica: true, efectos: true, volumen: .6 }, silencio = false;

  function ac() {
    if (!ctx && AC) { try { ctx = new AC(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const vol = () => (silencio || !aj.efectos ? 0 : aj.volumen);

  function tono(f, t0, dur, tipo, g, f2) {
    const c = ac(), v = vol(); if (!c || !v) return;
    const o = c.createOscillator(), a = c.createGain(), t = c.currentTime + t0;
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    a.gain.setValueAtTime(.0001, t); a.gain.exponentialRampToValueAtTime(Math.max(.0002, (g || .25) * v), t + .012);
    a.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(a); a.connect(c.destination); o.start(t); o.stop(t + dur + .05);
  }
  function ruido(t0, dur, f1, f2, g) {
    const c = ac(), v = vol(); if (!c || !v) return;
    const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), a = c.createGain(), t = c.currentTime + t0;
    s.buffer = b; f.type = 'bandpass'; f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    a.gain.value = (g || .3) * v; s.connect(f); f.connect(a); a.connect(c.destination); s.start(t);
  }

  const Sonido = {
    usar(ajustes) { aj = ajustes; },
    get silencio() { return silencio; },
    alternarSilencio() { silencio = !silencio; Sonido.actualizar(); return silencio; },
    actualizar() { Musica.ajustar(); },
    desbloquear() { ac(); Musica.desbloquear(); },
    clic() { tono(520, 0, .05, 'triangle', .18); },
    carta() { ruido(0, .13, 1200, 6500, .4); },                                   // carta que se voltea
    casco() { [0, .09, .2, .29].forEach((t, i) => { tono(i % 2 ? 110 : 150, t, .08, 'sine', .55, 55); ruido(t, .04, 900, 400, .25); }); },
    retroceso() { tono(320, 0, .3, 'sawtooth', .16, 110); },                      // el caballo retrocede
    llegada() { tono(880, 0, .45, 'sine', .3); tono(1320, .09, .5, 'sine', .22); },
    ganador() { [[523, 0, .22], [659, .14, .22], [784, .28, .22], [1047, .42, .8]].forEach(n => { tono(n[0], n[1], n[2], 'square', .13); tono(n[0] / 2, n[1], n[2], 'triangle', .2); }); },
    ya() { tono(990, 0, .35, 'square', .16); }                                    // salida
  };

  /* ---- música: pasa por Web Audio para que el volumen funcione también en iPhone ---- */
  const el = new Audio('audio/carrera.mp3');
  el.loop = true; el.preload = 'none';
  let fuente = null, ganancia = null, desbloqueado = false, tFade = 0;
  function cadena() {
    const c = ac(); if (!c) return false;
    if (!fuente) { try { fuente = c.createMediaElementSource(el); ganancia = c.createGain(); fuente.connect(ganancia); ganancia.connect(c.destination); } catch (e) { return false; } }
    return true;
  }
  const objetivo = () => (silencio || !aj.musica ? 0 : aj.volumen * .55);
  const Musica = {
    desbloquear() {                      // el primer toque habilita la reproducción posterior (iOS)
      if (desbloqueado || !cadena()) return; desbloqueado = true;
      ganancia.gain.value = 0;
      const p = el.play(); if (p && p.then) p.then(() => { el.pause(); el.currentTime = 0; }).catch(() => { desbloqueado = false; });
    },
    iniciar() {
      if (!aj.musica || silencio || !cadena()) return;
      clearTimeout(tFade); ganancia.gain.cancelScheduledValues(ctx.currentTime); ganancia.gain.value = objetivo();
      if (el.paused) { el.currentTime = 0; const p = el.play(); if (p && p.catch) p.catch(() => {}); }
    },
    parar(suave) {
      if (!ganancia || el.paused) return;
      clearTimeout(tFade);
      if (suave) { ganancia.gain.cancelScheduledValues(ctx.currentTime); ganancia.gain.setValueAtTime(ganancia.gain.value, ctx.currentTime); ganancia.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.4); tFade = setTimeout(() => el.pause(), 1500); }
      else el.pause();
    },
    ajustar() {
      if (!ganancia) return;
      if (objetivo() === 0) { el.pause(); return; }
      ganancia.gain.cancelScheduledValues(ctx.currentTime); ganancia.gain.value = objetivo();
    }
  };
  window.Sonido = Sonido; window.Musica = Musica;
})();
