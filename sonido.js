/* Música y efectos de sonido.
   - Galopes y relinchos: clips reales (audio/galope*.mp3, audio/relincho*.mp3), elegidos al azar y con
     tono y posición estéreo distintos según el carril del caballo. Si no cargan, se usa un galope sintético.
   - Resto de efectos: se generan con Web Audio (no hay archivos).
   - Música: audio/carrera.mp3. Todo respeta los ajustes (música, efectos, volumen) y el botón Sonido. */
(function () {
  'use strict';
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, aj = { musica: true, efectos: true, volumen: .6 }, silencio = false, cargado = false;
  const bufs = { galope: [], relincho: [] };
  const GALOPE_S = 1.05;                                  // lo que dura un galope sonando (s): punto medio entre el rápido de antes y el clip entero (1,65 s)
  const azar = lista => lista[Math.floor(Math.random() * lista.length)];

  function ac() {
    if (ctx && ctx.state === 'closed') ctx = null;
    if (!ctx && AC) { try { ctx = new AC(); } catch (e) { ctx = null; } }
    // En iPhone, al salir de la app o al cortarse el audio, el contexto pasa a 'interrupted' (no solo a 'suspended'):
    // hay que reanudarlo siempre que no esté corriendo, o los efectos (galopes, relinchos, cartas…) se quedan mudos.
    if (ctx && ctx.state !== 'running') { try { const p = ctx.resume(); if (p && p.catch) p.catch(() => { /* nada */ }); } catch (e) { /* nada */ } }
    return ctx;
  }
  // En iPhone/iPad el volumen de un <audio> no se puede cambiar (siempre vale 1): se detecta, no se adivina.
  const esIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const volumenAjustable = !esIOS && (() => { try { const a = new Audio(); a.volume = .5; return a.volume === .5; } catch (e) { return false; } })();

  // Sin barra de volumen en pantalla (iPhone), el nivel guardado no cuenta: un valor viejo (p. ej. 0) dejaría los efectos mudos sin poder arreglarlo.
  const NIVEL_FIJO = .75;
  const vol = () => (silencio || !aj.efectos ? 0 : (volumenAjustable ? aj.volumen : NIVEL_FIJO));

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
  function reproducir(buf, g, pan, rate, t0, corte) {     // clip real, con volumen, posición y velocidad propios; `corte` = segundos del clip que suenan
    const c = ac(), v = vol(); if (!c || !v) return;
    const s = c.createBufferSource(), a = c.createGain(), gv = Math.min(1, g * v), cuando = c.currentTime + (t0 || 0);
    s.buffer = buf; s.playbackRate.value = rate; a.gain.value = gv; s.connect(a);          // sin pasar de 1: los clips ya llegan al máximo
    if (corte) {                                         // recortado: se apaga con un fundido corto justo cuando acaba
      const real = corte / rate;
      a.gain.setValueAtTime(gv, cuando + Math.max(0, real - .1)); a.gain.linearRampToValueAtTime(.0001, cuando + real);
    }
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; a.connect(p); p.connect(c.destination); }
    else a.connect(c.destination);
    if (corte) s.start(cuando, 0, corte); else s.start(cuando);
  }
  function cargar() {                                     // se descargan y decodifican una sola vez, tras el primer toque
    const c = ac(); if (!c || cargado) return; cargado = true;
    ['galope1', 'galope2', 'galope3', 'galope4', 'galope5', 'relincho1', 'relincho2'].forEach(n => {
      fetch('audio/' + n + '.mp3').then(r => r.arrayBuffer())
        .then(b => new Promise((ok, ko) => c.decodeAudioData(b, ok, ko)))
        .then(buf => bufs[n.indexOf('galope') === 0 ? 'galope' : 'relincho'].push(buf))
        .catch(() => { /* sin ese clip */ });
    });
  }

  const Sonido = {
    usar(ajustes) { aj = ajustes; },
    get volumenAjustable() { return volumenAjustable; },
    get silencio() { return silencio; },
    alternarSilencio() { silencio = !silencio; Musica.ajustar(); return silencio; },
    actualizar() { Musica.ajustar(); },
    desbloquear() { ac(); cargar(); Musica.precargar(); },
    clic() { tono(520, 0, .05, 'triangle', .18); },
    carta() { ruido(0, .13, 1200, 6500, .12); },                  // el chasquido de destapar una carta, bien bajito
    /** Un caballo avanza: galope al azar, más a la izquierda o derecha según su carril (i de n).
     *  Devuelve cuántos segundos dura ese galope (suene o no), para que la animación acabe a la vez; null si aún no hay clips. */
    casco(i, n) {
      const pan = n > 1 ? ((i / (n - 1)) * 2 - 1) * .6 : 0;
      if (bufs.galope.length) {
        const buf = azar(bufs.galope), rate = 1.12 + Math.random() * .1;       // algo más rápido que el original (el tono sube poco) y recortado a GALOPE_S
        const corte = Math.min(buf.duration, GALOPE_S * rate);
        reproducir(buf, 1.15, pan, rate, 0, corte);
        if (bufs.relincho.length && Math.random() < .12) reproducir(azar(bufs.relincho), .55, pan, .97 + Math.random() * .06, .3);
        return corte / rate;
      }
      [0, .09, .2, .29].forEach((t, k) => { tono(k % 2 ? 110 : 150, t, .08, 'sine', .55, 55); ruido(t, .04, 900, 400, .25); });
      return null;
    },
    relincho(t0) { if (bufs.relincho.length) reproducir(azar(bufs.relincho), .7, 0, .98 + Math.random() * .05, t0 || 0); },
    retroceso() { tono(320, 0, .3, 'sawtooth', .16, 110); },
    llegada() { tono(880, 0, .45, 'sine', .3); tono(1320, .09, .5, 'sine', .22); },
    ganador() { [[523, 0, .22], [659, .14, .22], [784, .28, .22], [1047, .42, .8]].forEach(n => { tono(n[0], n[1], n[2], 'square', .13); tono(n[0] / 2, n[1], n[2], 'triangle', .2); }); },
    ya() { tono(990, 0, .35, 'square', .16); }
  };

  /* ---- música: un <audio> normal, que se lanza directamente al crear la partida ----
     Suena desde que sale la carrera hasta que llegan todos los caballos o se sale de la partida (parar).
     El botón Sonido solo la silencia: sigue avanzando sin oírse y al volver a activarlo continúa por donde iba.
     Si la app pasa a segundo plano, se pausa; al volver, sigue por donde iba. */
  const el = new Audio('audio/carrera.mp3');
  el.loop = true; el.preload = 'none';
  let pendiente = false, tFade = 0, sonando = false, fuera = false;
  const nivel = () => aj.volumen * .55;
  const quiere = () => sonando && aj.musica && !fuera;
  function poner() {                              // deja el <audio> como toca: sonando o en pausa, con o sin silencio
    clearInterval(tFade);
    if (!quiere()) { el.pause(); return; }
    el.muted = silencio;                          // iPhone ignora el volumen del <audio>, pero sí respeta muted
    el.volume = nivel();
    if (el.paused) {
      const p = el.play(); pendiente = false;
      if (p && p.catch) p.catch(() => { pendiente = true; });   // si el navegador la bloquea, arranca en el siguiente toque
    }
  }
  const Musica = {
    precargar() { if (el.preload !== 'auto') { el.preload = 'auto'; try { el.load(); } catch (e) { /* nada */ } } },
    iniciar() {
      sonando = true;
      if (el.paused && !fuera) el.currentTime = 0;
      poner();
    },
    reintentar() { if (pendiente) poner(); },
    parar(suave) {
      sonando = false; pendiente = false; clearInterval(tFade);
      if (el.paused) return;
      if (!suave || el.muted) { el.pause(); return; }
      let v = el.volume;
      tFade = setInterval(() => { v -= .06; if (v <= 0) { clearInterval(tFade); el.pause(); } else el.volume = v; }, 90);
    },
    ajustar() { poner(); },
    segundoPlano(f) { fuera = f; poner(); }
  };
  const alVolver = () => { if (ctx) ac(); };       // al volver a la app, reactiva los efectos (en iPhone el audio queda interrumpido)
  document.addEventListener('visibilitychange', () => { const oculta = document.visibilityState === 'hidden'; Musica.segundoPlano(oculta); if (!oculta) alVolver(); });
  window.addEventListener('pagehide', () => Musica.segundoPlano(true));
  window.addEventListener('pageshow', () => { Musica.segundoPlano(document.visibilityState === 'hidden'); alVolver(); });
  window.Sonido = Sonido; window.Musica = Musica;
})();
