/* Carrera de caballos — interfaz.
   Las reglas viven en motor.js; aquí solo se pinta y se anima lo que decide. */
(function () {
  'use strict';

  const M = Motor;
  const { PALOS, IDS, LIMITES, Carrera, Campeonato, paloDe, nombreCarta } = M;

  /* ---------- utilidades ---------- */
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const minus = id => paloDe(id).nombre.toLowerCase();
  const mini = id => `<img class="mini" src="${id}/card_${paloDe(id).archivo}_01.webp" alt="">`;
  const src = c => `${c.palo}/card_${paloDe(c.palo).archivo}_${String(c.valor).padStart(2, '0')}.webp`;
  const BACK = 'dorso/card_back.webp';
  const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches;
  const nuevaSemilla = () => Math.floor(Math.random() * Math.pow(32, 5));
  const PASOS_FIJOS = LIMITES.pasos.defecto;

  const LS = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  };

  /* ---------- ajustes guardados ---------- */
  const PANOS = {
    verde:   { n: 'Verde',   c: '#177A4B', m: '#0E5A38', o: '#04261a', l: '#3f9a72' },
    burdeos: { n: 'Burdeos', c: '#8a2535', m: '#5A1522', o: '#26060d', l: '#b5586a' },
    azul:    { n: 'Azul',    c: '#1f6290', m: '#123C57', o: '#06182a', l: '#4a93bd' },
    grafito: { n: 'Grafito', c: '#4a545a', m: '#262C30', o: '#0b0e10', l: '#7d8a91' }
  };
  // El dorso original es índigo: los demás se obtienen girando el tono.
  const DORSOS = {
    indigo:  { n: 'Índigo',  f: 'none',                                          s: '#264066' },
    granate: { n: 'Granate', f: 'hue-rotate(125deg) saturate(1.6)',              s: '#8A1420' },
    bosque:  { n: 'Bosque',  f: 'hue-rotate(-95deg) saturate(1.3)',               s: '#13603C' },
    ebano:   { n: 'Ébano',   f: 'grayscale(1) brightness(.6) contrast(1.15)',     s: '#272320' }
  };
  const ajustes = Object.assign(
    { pano: 'verde', dorso: 'indigo', vibracion: true, pantalla: true, velocidad: 'normal', auto: false },
    LS.get('carrera_ajustes', {})
  );
  if (!PANOS[ajustes.pano]) ajustes.pano = 'verde';
  if (!DORSOS[ajustes.dorso]) ajustes.dorso = 'indigo';
  const guardarAjustes = () => LS.set('carrera_ajustes', ajustes);

  function aplicarTema() {
    const r = document.documentElement.style, p = PANOS[ajustes.pano];
    r.setProperty('--c', p.c); r.setProperty('--m', p.m); r.setProperty('--o', p.o); r.setProperty('--l', p.l);
    r.setProperty('--dorso', DORSOS[ajustes.dorso].f);
    const meta = $('themeColor'); if (meta) meta.setAttribute('content', p.m);
  }

  /* fichas guardadas en el navegador (misma clave que la versión anterior) */
  const START_CHIPS = 100, PAGO = 3;
  let fichas = LS.get('carrera_fichas', {});
  const getFichas = n => fichas[n] ?? START_CHIPS;

  /* ---------- estado ---------- */
  const SPEEDS = { lenta: 2.2, normal: 1.4, rapida: .8 };
  const S = {
    modo: 'rapida',
    jugadores: [{ nombre: 'Jugador 1', palo: 'oros', apuesta: 10 }, { nombre: 'Jugador 2', palo: 'copas', apuesta: 10 }],
    pasos: LIMITES.pasos.defecto,
    rondas: LIMITES.rondas.defecto,
    sala: null,                 // sala en la que se juega, si la hay
    borrador: { modalidad: 'rapida', pasos: LIMITES.pasos.defecto, rondas: LIMITES.rondas.defecto, palos: ['oros', 'copas'] },
    salaCreada: null,
    // partida en curso
    partida: [], par: ['oros', 'copas'], semillaBase: nuevaSemilla(), ronda: 0, camp: null
  };
  {
    const guardados = LS.get('carrera_jugadores', null);
    if (Array.isArray(guardados) && guardados.length) {
      const ok = guardados.slice(0, LIMITES.jugadores.max)
        .filter(j => j && IDS.includes(j.palo))
        .map((j, i) => ({ nombre: String(j.nombre || '').slice(0, 14) || 'Jugador ' + (i + 1), palo: j.palo, apuesta: [5, 10, 20].includes(j.apuesta) ? j.apuesta : 10 }));
      if (ok.length) S.jugadores = ok;
    }
  }
  const guardarJugadores = () => LS.set('carrera_jugadores', S.jugadores);

  let carrera = null, fase = 'corriendo', busy = false, auto = false, seguir = false, token = 0, ganadorLiquidado = false, espera = false;
  let horseEls = {}, chkEls = [], log = [], hist = [], turnoN = 0;
  let vista = 'menu';

  const MODOS = {
    rapida: {
      nombre: 'Partida rápida',
      reglas: 'Corren los cuatro caballos por una pista de 6 pasos. Sin jugadores ni apuestas: elige manual o automático y a correr.'
    },
    uno: {
      nombre: '1 contra 1',
      reglas: 'Dos jugadores, dos palos, dos caballos. Gana el palo que cruce primero la meta.'
    },
    personalizada: {
      nombre: 'Partida personalizada',
      reglas: 'Corren los cuatro caballos. Tú decides el largo de la pista y los jugadores; los palos pueden repetirse.'
    },
    campeonato: {
      nombre: 'Campeonato',
      reglas: 'Varias carreras seguidas. Cada una se corre entera y reparte puntos por puesto: el primero, tantos como caballos corran. Gana quien más puntos sume.'
    }
  };

  /* ---------- avisos, diálogos, portapapeles ---------- */
  let tAviso = 0;
  function avisar(texto) {
    const a = $('aviso'); a.textContent = texto; a.hidden = false;
    clearTimeout(tAviso); tAviso = setTimeout(() => { a.hidden = true; }, 2600);
  }
  function confirmar(msg, ok = 'Aceptar') {
    return new Promise(res => {
      const d = $('dConf');
      $('confMsg').textContent = msg; $('confOk').textContent = ok; d.returnValue = '';
      const h = () => { d.removeEventListener('close', h); res(d.returnValue === 'si'); };
      d.addEventListener('close', h);
      d.showModal();
    });
  }
  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); return true; }
    catch (e) {
      const t = document.createElement('textarea');
      t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) { /* nada */ }
      t.remove(); return ok;
    }
  }
  const baseUrl = () => (/^https?:$/.test(location.protocol)
    ? location.origin + location.pathname
    : 'https://valprimos.github.io/CarreradeCaballos/');
  const enlaceSala = s => `${baseUrl()}?sala=${M.codigoSala(s)}`;
  const codigoLegible = s => { const c = M.codigoSala(s); return c.slice(0, 4) + ' ' + c.slice(4); };

  async function copiarSala(que) {
    if (!S.sala) return;
    if (que === 'enlace' && navigator.share) {
      try {
        await navigator.share({ title: 'Carrera de caballos', text: `Sala ${M.codigoSala(S.sala)}: la misma carrera en tu móvil.`, url: enlaceSala(S.sala) });
      } catch (e) { /* cancelado */ }
      return;
    }
    const ok = await copiar(que === 'codigo' ? M.codigoSala(S.sala) : enlaceSala(S.sala));
    avisar(ok ? (que === 'codigo' ? 'Código copiado' : 'Enlace copiado') : 'No se ha podido copiar');
  }

  /* ---------- pantalla encendida y vibración ---------- */
  let lock = null;
  async function pedirPantalla() {
    if (!ajustes.pantalla || !('wakeLock' in navigator) || lock) return;
    try { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } catch (e) { lock = null; }
  }
  function soltarPantalla() { try { if (lock) lock.release(); } catch (e) { /* nada */ } lock = null; }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && vista === 'juego') pedirPantalla(); });

  /* ---------- vistas ---------- */
  let avisoRotar = false;
  const mqVertical = typeof matchMedia === 'function' ? matchMedia('(max-width:700px) and (orientation:portrait)') : null;
  const VISTAS = { menu: 'vMenu', amigos: 'vAmigos', pers: 'vPers', config: 'vConfig', juego: 'vJuego' };
  function ir(v) {
    vista = v;
    for (const [k, id] of Object.entries(VISTAS)) $(id).hidden = k !== v;
    $('btnMenu').hidden = v === 'menu';
    $('marca').hidden = v === 'menu';
    document.body.classList.toggle('playing', v === 'juego');
    if (v === 'juego') pedirPantalla(); else soltarPantalla();
    actualizarBarras();
    // Sugerencia puntual (no permanente) para pantallas verticales.
    if (v === 'juego' && mqVertical && mqVertical.matches && !avisoRotar) { avisoRotar = true; avisar('Con el móvil en horizontal la carrera se ve más grande.'); }
    window.scrollTo(0, 0);
  }
  const enMarcha = () => vista === 'juego' && !!carrera && (fase !== 'fin' || (S.camp && !S.camp.terminado));
  async function salirSiSeguro(msg) {
    if (enMarcha() && !(await confirmar(msg, 'Salir'))) return false;
    token++; busy = false; auto = false; fase = 'fin';
    return true;
  }
  function actualizarBarras() {
    const hay = !!S.sala;
    for (const id of ['barraSalaCfg', 'barraSalaJuego']) $(id).hidden = !hay;
    if (hay) document.querySelectorAll('[data-codigo]').forEach(e => { e.textContent = codigoLegible(S.sala); });
  }

  /* ---------- cartas ---------- */
  function fc(c, { w, up = false, cls = '' } = {}) {
    const d = document.createElement('div');
    d.className = `fc ${cls} ${up ? 'up' : ''}`;
    if (w) d.style.setProperty('--w', w + 'px');
    d.setAttribute('role', 'img'); d.setAttribute('aria-label', nombreCarta(c));
    d.innerHTML = `<div class="in"><div class="f"><img class="dorso" src="${BACK}" alt="" decoding="async"></div><div class="f fr"><img src="${src(c)}" alt="${esc(nombreCarta(c))}" decoding="async"></div></div>`;
    return d;
  }
  const cargadas = new Set();
  const preload = u => cargadas.has(u) ? Promise.resolve() : new Promise(r => {
    const i = new Image();
    const hecho = () => { cargadas.add(u); r(); };
    i.src = u;
    (i.decode ? i.decode() : Promise.reject()).then(hecho, hecho);
    setTimeout(r, 4000);
  });
  const calentar = cartas => cartas.forEach(c => { const i = new Image(); i.src = src(c); });

  /* ---------- controles segmentados ---------- */
  function seg(id, opciones, get, set) {
    const el = $(id);
    const pinta = () => {
      el.innerHTML = opciones.map(([v, l]) =>
        `<button type="button" role="radio" aria-checked="${get() === v}" class="${get() === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('');
    };
    el.onclick = e => { const v = e.target.dataset.v; if (v === undefined) return; set(v); pinta(); };
    pinta(); return pinta;
  }
  function rango(idInput, idValor, get, set, deshabilitado) {
    const i = $(idInput), v = $(idValor);
    const pinta = () => { i.value = get(); v.textContent = get(); i.disabled = deshabilitado ? deshabilitado() : false; };
    i.oninput = () => { set(+i.value); v.textContent = i.value; };
    pinta(); return pinta;
  }

  /* ---------- menú ---------- */
  function abanico() {
    const f = $('fan'); f.innerHTML = '';
    PALOS.forEach((p, i) => {
      const el = fc({ palo: p.id, valor: 11 });
      f.appendChild(el); setTimeout(() => el.classList.add('up'), 250 + i * 180);
    });
  }

  /* ---------- personalizar ---------- */
  function pintarPersonalizar() {
    $('opPanos').innerHTML = Object.entries(PANOS).map(([k, p]) =>
      `<button type="button" role="radio" aria-checked="${ajustes.pano === k}" class="opcion ${ajustes.pano === k ? 'on' : ''}" data-pano="${k}"><span class="muestra" style="--bg:${p.m}"></span>${p.n}</button>`).join('');
    $('opDorsos').innerHTML = Object.entries(DORSOS).map(([k, d]) =>
      `<button type="button" role="radio" aria-checked="${ajustes.dorso === k}" class="opcion ${ajustes.dorso === k ? 'on' : ''}" data-dorso="${k}"><span class="muestra" style="--bg:${d.s}"></span>${d.n}</button>`).join('');
    const vp = $('vistaPrevia'); vp.innerHTML = '';
    vp.appendChild(fc({ palo: 'oros', valor: 11 }, { w: 96 }));
    const h = fc({ palo: 'espadas', valor: 11 }, { w: 96, up: true }); vp.appendChild(h);
  }

  /* ---------- crear / unirse a sala ---------- */
  const nombrePalos = ([a, b]) => `${paloDe(a).nombre} contra ${paloDe(b).nombre}`;
  function describirSala(s) {
    const partes = [M.MODALIDADES.find(m => m.id === s.modalidad).nombre];
    if (s.modalidad === 'uno') partes.push(nombrePalos(s.palos));
    if (s.modalidad === 'personalizada' || s.modalidad === 'campeonato') partes.push(`pista de ${s.pasos} pasos`);
    if (s.modalidad === 'campeonato') partes.push(`${s.rondas} rondas`);
    return partes.join(', ') + '.';
  }
  function pintarAmigos() {
    const b = S.borrador;
    const opts = PALOS.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    $('salaPalo1').innerHTML = opts; $('salaPalo2').innerHTML = opts;
    const refrescaFilas = () => {
      $('filaSalaPar').hidden = b.modalidad !== 'uno';
      $('filaSalaPasos').hidden = !(b.modalidad === 'personalizada' || b.modalidad === 'campeonato');
      $('filaSalaRondas').hidden = b.modalidad !== 'campeonato';
      $('salaPalo1').value = b.palos[0]; $('salaPalo2').value = b.palos[1];
    };
    [
      seg('segSalaModo', M.MODALIDADES.map(m => [m.id, m.nombre]), () => b.modalidad, v => { b.modalidad = v; refrescaFilas(); }),
      rango('salaPasos', 'salaPasosV', () => b.pasos, v => { b.pasos = v; }),
      rango('salaRondas', 'salaRondasV', () => b.rondas, v => { b.rondas = v; })
    ];
    const cambiaPar = cual => () => {
      const nuevo = $(cual === 1 ? 'salaPalo1' : 'salaPalo2').value;
      const otro = cual === 1 ? 1 : 0, propio = cual === 1 ? 0 : 1;
      if (b.palos[otro] === nuevo) b.palos[otro] = b.palos[propio];   // intercambia para no repetir
      b.palos[propio] = nuevo; refrescaFilas();
    };
    $('salaPalo1').onchange = cambiaPar(1); $('salaPalo2').onchange = cambiaPar(2);
    refrescaFilas();
    $('salaCreada').hidden = !S.salaCreada;
    if (S.salaCreada) mostrarSalaCreada();
    $('errCodigo').hidden = true;
  }
  function mostrarSalaCreada() {
    $('salaCreada').hidden = false;
    $('salaCodigo').textContent = codigoLegible(S.salaCreada);
    $('salaDescr').textContent = describirSala(S.salaCreada) + ' Pásalo por WhatsApp o dicta el código: todos verán la misma carrera.';
  }
  function crearSala() {
    const b = S.borrador, fija = !(b.modalidad === 'personalizada' || b.modalidad === 'campeonato');
    S.salaCreada = M.nuevaSala({
      modalidad: b.modalidad, pasos: fija ? PASOS_FIJOS : b.pasos, rondas: b.rondas, palos: [...b.palos]
    });
    mostrarSalaCreada();
  }
  function entrarSala(sala) {
    S.sala = sala; S.modo = sala.modalidad; S.pasos = sala.pasos; S.rondas = sala.rondas;
    abrirConfig(null);
  }
  function unirse(texto) {
    const sala = M.leerCodigo(texto);
    const err = $('errCodigo');
    if (!sala) {
      err.textContent = 'Ese código no es válido: tiene que tener 8 caracteres (letras sin I, L, O ni U, y números).';
      err.hidden = false; return false;
    }
    err.hidden = true;
    entrarSala(sala); avisar('Entras en la sala ' + codigoLegible(sala));
    return true;
  }

  /* ---------- preparar la mesa ---------- */
  const palosPermitidos = () => (S.modo === 'uno' && S.sala ? S.sala.palos : IDS);
  const limitesJug = () => (S.modo === 'uno' ? [S.sala ? 1 : 2, 2] : [LIMITES.jugadores.min, LIMITES.jugadores.max]);

  function ajustarJugadores() {
    const [min, max] = limitesJug();
    const permitidos = palosPermitidos();
    S.jugadores = S.jugadores.slice(0, max);
    while (S.jugadores.length < min) {
      const n = S.jugadores.length;
      S.jugadores.push({ nombre: 'Jugador ' + (n + 1), palo: IDS[n % 4], apuesta: 10 });
    }
    S.jugadores.forEach(j => { if (!permitidos.includes(j.palo)) j.palo = permitidos[0]; });
    if (S.modo === 'uno' && S.jugadores.length === 2) {
      const [a, b] = S.jugadores;
      if (a.palo === b.palo) b.palo = permitidos.find(p => p !== a.palo);
    }
  }

  /** modo = null conserva el actual (al entrar en una sala). */
  function abrirConfig(modo) {
    if (modo) { S.modo = modo; S.sala = null; S.pasos = LIMITES.pasos.defecto; }
    ajustarJugadores();
    $('cfgTitulo').textContent = MODOS[S.modo].nombre;
    $('cfgReglas').textContent = MODOS[S.modo].reglas;
    $('cfgJugTitulo').textContent = S.modo === 'campeonato' ? 'Jugadores' : 'Jugadores y apuestas';
    $('filaPasos').hidden = !(S.modo === 'personalizada' || S.modo === 'campeonato');
    $('filaRondas').hidden = S.modo !== 'campeonato';
    $('add').hidden = S.modo === 'uno' && !S.sala;
    // Partida rápida: sin jugadores ni ajustes, solo elegir manual o automático.
    const rap = S.modo === 'rapida';
    ['cfgJugTitulo', 'rows', 'cfgBloque', 'cfgAcciones'].forEach(id => { $(id).hidden = rap; });
    $('rapidaBox').hidden = !rap;
    [
      seg('segMode', [['m', 'Manual'], ['a', 'Automático']], () => (ajustes.auto ? 'a' : 'm'),
        v => { ajustes.auto = v === 'a'; $('rowSpeed').hidden = !ajustes.auto; guardarAjustes(); }),
      seg('segSpeed', [['lenta', 'Lenta'], ['normal', 'Normal'], ['rapida', 'Rápida']], () => ajustes.velocidad,
        v => { ajustes.velocidad = v; guardarAjustes(); }),
      rango('inPasos', 'inPasosV', () => S.pasos, v => { S.pasos = v; }, () => !!S.sala),
      rango('inRondas', 'inRondasV', () => S.rondas, v => { S.rondas = v; }, () => !!S.sala)
    ];
    $('rowSpeed').hidden = !ajustes.auto;
    renderFilas();
    ir('config');
  }

  function renderFilas() {
    const permitidos = palosPermitidos(), conApuesta = S.modo !== 'campeonato', [min, max] = limitesJug();
    $('rows').innerHTML = S.jugadores.map((p, i) => `
      <div class="prow">
        <input data-i="${i}" data-k="nombre" value="${esc(p.nombre)}" maxlength="14" aria-label="Nombre del jugador ${i + 1}">
        <select data-i="${i}" data-k="palo" aria-label="Palo de ${esc(p.nombre)}">${permitidos.map(id => `<option value="${id}" ${id === p.palo ? 'selected' : ''}>${paloDe(id).nombre}</option>`).join('')}</select>
        ${conApuesta ? `<select data-i="${i}" data-k="apuesta" aria-label="Apuesta de ${esc(p.nombre)}">${[5, 10, 20].map(b => `<option value="${b}" ${b === p.apuesta ? 'selected' : ''}>${b} fichas</option>`).join('')}</select>` : ''}
        <button class="x" data-del="${i}" ${S.jugadores.length <= min ? 'disabled' : ''}>Quitar</button>
      </div>`).join('');
    $('add').disabled = S.jugadores.length >= max;
  }

  /* ---------- empezar ---------- */
  function empezar() {
    ajustarJugadores();
    S.partida = S.jugadores.map((p, i) => ({ nombre: (p.nombre || '').trim() || 'Jugador ' + (i + 1), palo: p.palo, apuesta: p.apuesta, delta: undefined }));
    S.par = S.modo === 'uno' ? (S.sala ? [...S.sala.palos] : [S.partida[0].palo, S.partida[1].palo]) : IDS;
    // En la sala el reparto de palos lo fija el código; los jugadores solo eligen entre ellos.
    S.semillaBase = nuevaSemilla();
    S.ronda = 0;
    S.camp = S.modo === 'campeonato' ? new Campeonato({ rondas: S.rondas, jugadores: S.partida }) : null;
    ir('juego');
    nuevaCarrera();
  }

  const pasosEfectivos = () => (S.modo === 'personalizada' || S.modo === 'campeonato' ? (S.sala ? S.sala.pasos : S.pasos) : PASOS_FIJOS);
  const semillaActual = () => ((S.sala ? S.sala.semilla : S.semillaBase) + S.ronda * 7919) >>> 0;

  function nuevaCarrera() {
    token++; busy = false; auto = false; fase = 'corriendo';
    seguir = S.modo === 'campeonato'; ganadorLiquidado = false;
    hist = []; turnoN = 0;
    espera = ajustes.auto;   // en automático, la carrera no arranca hasta pulsar Empezar
    carrera = new Carrera({
      pasos: pasosEfectivos(),
      palos: M.palosEnCarrera(S.modo, S.par),
      rng: M.crearRng(semillaActual())
    });
    S.partida.forEach(p => { p.delta = undefined; });
    log = [S.camp ? `Ronda ${S.ronda + 1} de ${S.camp.rondas}: los caballos están en la salida.` : 'Los caballos están en la salida.'];
    $('cartel').hidden = true;
    $('last').innerHTML = '<div class="slot">Aún no ha salido ninguna carta</div>';
    $('tituloLista').textContent = S.camp ? `Marcador, ronda ${S.ronda + 1} de ${S.camp.rondas}` : 'Apuestas';
    $('tituloLista').hidden = $('bets').hidden = S.modo === 'rapida';
    construirPista(); pintarLista(); pintarLog(); sync();
    preload(src(carrera.mazo[carrera.mazo.length - 1])); calentar(carrera.mazo);
  }

  /* ---------- pista ---------- */
  function construirPista() {
    const T = $('track'), meta = carrera.meta, palos = carrera.palos;
    T.style.gridTemplateColumns = `40px repeat(${meta + 1},minmax(0,1fr))`;
    T.style.setProperty('--n', meta + 1); T.style.setProperty('--lanes', palos.length);
    let h = '<div></div>';
    for (let c = 0; c <= meta; c++) h += `<div class="th">${c === 0 ? 'Salida' : c === meta ? 'Meta' : ''}</div>`;
    palos.forEach((id, i) => {
      const p = paloDe(id), b = i % 2 ? '' : ' l1';
      h += `<div class="lane-label${b}" title="${p.nombre}">${mini(p.id)}</div>`;
      for (let c = 0; c <= meta; c++) h += `<div class="cell${b}${c === 0 ? ' start' : ''}${c === meta ? ' meta' : ''}" data-l="${id}" data-c="${c}"></div>`;
    });
    h += '<div class="lane-label small"></div>';
    for (let c = 0; c <= meta; c++) h += `<div class="cell chk" data-k="${c}"></div>`;
    T.innerHTML = h;
    horseEls = {};
    palos.forEach((id, i) => {
      const el = fc({ palo: id, valor: 11 }, { cls: 'horse' }); el.dataset.p = 0; horseEls[id] = el;
      T.querySelector(`.cell[data-l="${id}"][data-c="0"]`).appendChild(el);
      setTimeout(() => el.classList.add('up'), 200 + i * 170);
    });
    chkEls = carrera.cartasPista.map((c, i) => {
      const el = fc(c); T.querySelector(`.cell[data-k="${i + 1}"]`).appendChild(el); return el;
    });
  }
  function moverCaballos(pos) {
    for (const id of carrera.palos) {
      const h = horseEls[id], antes = +h.dataset.p, ahora = pos[id];
      if (antes === ahora) continue;
      $('track').querySelector(`.cell[data-l="${id}"][data-c="${ahora}"]`).appendChild(h);
      h.dataset.p = ahora; h.classList.remove('hop', 'retreat'); void h.offsetWidth; h.classList.add(ahora > antes ? 'hop' : 'retreat');
    }
  }
  function ponerPuesto(id, texto, extra = '') {
    const celda = horseEls[id].parentElement;
    celda.querySelectorAll('.puesto').forEach(e => e.remove());
    const b = document.createElement('span');
    b.className = 'puesto ' + extra; b.textContent = texto; celda.appendChild(b);
  }

  /* ---------- lista de apuestas / marcador y crónica ---------- */
  function pintarLista() {
    $('bets').innerHTML = S.partida.map(p => {
      const pal = paloDe(p.palo);
      if (S.camp) {
        const total = S.camp.puntosDe(p), ult = S.camp.ultimaRonda[p.palo];
        const extra = fase === 'fin' && ult !== undefined ? `<span class="delta pos">+${ult}</span>` : '';
        return `<li>${mini(pal.id)}<span>${esc(p.nombre)} con ${pal.nombre.toLowerCase()}</span><span class="chips">${total} puntos${extra}</span></li>`;
      }
      const d = p.delta !== undefined ? `<span class="delta ${p.delta > 0 ? 'pos' : 'neg'}">${p.delta > 0 ? '+' : ''}${p.delta}</span>` : '';
      return `<li>${mini(pal.id)}<span>${esc(p.nombre)} apuesta ${p.apuesta} a ${pal.nombre.toLowerCase()}</span><span class="chips">${getFichas(p.nombre)} fichas${d}</span></li>`;
    }).join('');
  }
  const decir = t => { log.unshift(t); if (log.length > 6) log.pop(); };
  const pintarLog = () => { $('log').innerHTML = log.map(t => `<li>${esc(t)}</li>`).join(''); };

  function sync() {
    const n = carrera ? carrera.mazo.length : 0, corriendo = fase === 'corriendo';
    $('deck').disabled = !carrera || !corriendo || busy || auto || espera;
    $('deckCount').textContent = fase === 'fin' ? 'Fin de carrera'
      : fase === 'ganador' ? 'Hay ganador'
      : espera ? 'Pulsa Empezar' : auto ? `${n} cartas` : `Toca el mazo (${n})`;
    $('auto').setAttribute('aria-pressed', auto);
    $('auto').textContent = espera ? 'Empezar' : auto ? 'Pausar' : 'Automático';
    $('auto').classList.toggle('rojo', espera);
    $('auto').classList.toggle('ghost', !espera);
    $('auto').disabled = !corriendo;
    $('spd').hidden = !auto; $('spd').value = ajustes.velocidad;
  }
  function setAuto(v) { auto = v; sync(); if (v && !busy && fase === 'corriendo') sacar(); }

  /* ---------- un turno ---------- */
  async function sacar() {
    if (busy || fase !== 'corriendo' || !carrera || carrera.agotada) return;
    busy = true; const mi = token;
    const f = auto ? SPEEDS[ajustes.velocidad] : .9, w = ms => sleep(ms * f);
    if (!RM) document.documentElement.style.setProperty('--flip', (.75 * f) + 's');

    const r = carrera.jugarTurno();
    registrarTurno(r);
    if (r.mazoReciclado) decir('Se acaba el mazo: se baraja el descarte.');
    sync();
    const el = fc(r.carta, { cls: 'deal' });
    $('last').replaceChildren(el);
    await preload(src(r.carta)); if (mi !== token) return;
    el.classList.add('up');
    await w(1000); if (mi !== token) return;

    const nom = nombreCarta(r.carta);
    let abreCartel = false;
    if (r.avanza) {
      moverCaballos(r.posTrasAvance);
      decir(`Sale el ${nom}: avanza el caballo de ${minus(r.carta.palo)}.`);
    } else {
      decir(`Sale el ${nom}: su caballo ya ha llegado y no pasa nada.`);
    }
    if (r.llegada) {
      const puesto = carrera.clasificacion.indexOf(r.llegada) + 1;
      ponerPuesto(r.llegada, puesto + 'º', puesto === 1 ? 'p1' : '');
      decir(`El caballo de ${minus(r.llegada)} cruza la meta en ${puesto}.º lugar.`);
      if (r.ganador) {
        horseEls[r.llegada].classList.add('win');
        liquidarFichas(r.ganador);
        abreCartel = !seguir;
      }
    }
    pintarLista(); pintarLog();
    await w(550); if (mi !== token) return;

    for (const rev of r.revelaciones) {
      chkEls[rev.paso - 1].classList.add('up');
      await w(1050); if (mi !== token) return;
      if (rev.retrocede) {
        moverCaballos(rev.posDespues);
        decir(`Control ${rev.paso}: se voltea el ${nombreCarta(rev.carta)} y el caballo de ${minus(rev.carta.palo)} retrocede.`);
      } else {
        decir(`Control ${rev.paso}: se voltea el ${nombreCarta(rev.carta)}; su caballo ya llegó y no retrocede.`);
      }
      pintarLog();
      await w(550); if (mi !== token) return;
    }

    busy = false;
    if (r.agotada) { terminar(); return; }
    if (abreCartel) { cartelGanador(); return; }
    sync();
    if (carrera.mazo.length) preload(src(carrera.mazo[carrera.mazo.length - 1]));
    if (auto) setTimeout(() => { if (mi === token) sacar(); }, 800 * f);
  }

  /* historial resumido: una línea por carta, lo más reciente arriba */
  function registrarTurno(r) {
    turnoN++;
    const subs = [];
    if (r.mazoReciclado) subs.push('Se baraja el descarte.');
    if (r.llegada) subs.push(`El caballo de ${minus(r.llegada)} llega en ${carrera.clasificacion.indexOf(r.llegada) + 1}.º lugar.`);
    r.revelaciones.forEach(rev => subs.push(`Control ${rev.paso} (${nombreCarta(rev.carta)}): ${rev.retrocede ? minus(rev.retrocede) + ' retrocede' : 'sin efecto'}.`));
    hist.push({ n: turnoN, palo: r.carta.palo, main: `${nombreCarta(r.carta)}: ${r.avanza ? minus(r.avanza) + ' avanza' : 'sin efecto'}`, subs, llega: !!r.llegada });
  }
  function abrirHistorial() {
    $('histSala').hidden = !S.sala;
    if (S.sala) $('histSala').textContent = 'Sala ' + codigoLegible(S.sala);
    $('histLista').innerHTML = hist.length
      ? hist.slice().reverse().map(e => `<li class="${e.llega ? 'llega' : ''}"><span class="n">${e.n}</span>${mini(e.palo)}<div>${esc(e.main)}${e.subs.map(t => `<span class="sub">${esc(t)}</span>`).join('')}</div></li>`).join('')
      : '<li>Aún no ha salido ninguna carta.</li>';
    $('dHist').showModal();
  }

  function liquidarFichas(ganador) {
    if (S.camp || S.modo === 'rapida' || ganadorLiquidado) return;
    ganadorLiquidado = true;
    S.partida.forEach(p => {
      p.delta = p.palo === ganador ? p.apuesta * PAGO : -p.apuesta;
      fichas[p.nombre] = getFichas(p.nombre) + p.delta;
    });
    LS.set('carrera_fichas', fichas);
  }

  /* ---------- carteles ---------- */
  const quienes = palo => (S.modo === 'rapida' ? [] : S.partida.filter(p => p.palo === palo).map(p => p.nombre));
  function cartelGanador() {
    fase = 'ganador'; auto = false; sync();
    const g = carrera.ganador, cobran = quienes(g);
    $('cartel').innerHTML = `
      <h2>Gana el caballo de ${minus(g)}</h2>
      <p>${S.modo === 'rapida' ? '' : cobran.length ? (S.modo === 'campeonato' ? 'Va con ' : 'Cobra: ') + esc(cobran.join(', ')) + '.' : 'Nadie había apostado por él.'}</p>
      <div class="acciones-fila">
        <button id="cSeguir">Seguir hasta que lleguen todos</button>
        <button id="cRevancha" class="ghost">Revancha</button>
        <button id="cFin" class="ghost">Finalizar</button>
      </div>`;
    $('cartel').hidden = false;
    pintarLista(); $('cartel').scrollIntoView({ block: 'nearest', behavior: RM ? 'auto' : 'smooth' });
  }

  function listaClasificacion() {
    const filas = carrera.clasificacion.map((p, i) => {
      const pts = S.camp ? `<span class="pts">+${S.camp.ultimaRonda[p]} pts</span>` : '';
      const q = quienes(p);
      return `<li><span class="n">${i + 1}.º</span>${mini(paloDe(p).id)}${paloDe(p).nombre}${q.length ? `<span class="quien">${esc(q.join(', '))}</span>` : ''}${pts}</li>`;
    });
    carrera.descolgados.forEach(p => {
      const q = quienes(p);
      filas.push(`<li><span class="n">—</span>${mini(paloDe(p).id)}${paloDe(p).nombre}${q.length ? `<span class="quien">${esc(q.join(', '))}</span>` : ''}<span class="pts">No llegó</span></li>`);
    });
    return `<ol class="clasif">${filas.join('')}</ol>`;
  }

  function terminar() {
    fase = 'fin'; auto = false; busy = false; sync();
    carrera.descolgados.forEach(id => { horseEls[id].classList.add('colgado'); ponerPuesto(id, 'Parado'); });
    const sinGanador = !carrera.ganador;
    if (S.camp) S.camp.anotar(carrera);
    let html;
    if (S.camp) {
      const c = S.camp, ultima = c.terminado;
      const marcador = `<ol class="clasif">${c.clasificacion.map((j, i) => `<li><span class="n">${i + 1}.º</span>${mini(paloDe(j.palo).id)}${esc(j.nombre)}<span class="quien">${paloDe(j.palo).nombre}</span><span class="pts">${c.puntosDe(j)} pts</span></li>`).join('')}</ol>`;
      html = `<h2>${ultima ? 'Campeonato terminado' : `Fin de la ronda ${c.rondasCorridas.length} de ${c.rondas}`}</h2>`
        + (ultima ? `<p><b>${c.campeones.length > 1 ? 'Campeones' : 'Campeón'}: ${esc(c.campeones.map(j => j.nombre).join(', '))}</b></p>` : '')
        + `<h3>Llegada de esta ronda</h3>${sinGanador ? '<p>Ningún caballo pudo llegar a la meta.</p>' : ''}${listaClasificacion()}<h3 style="margin-top:12px">Marcador</h3>${marcador}`
        + `<div class="acciones-fila">${ultima
            ? '<button id="cNuevoCamp">Nuevo campeonato</button>'
            : `<button id="cSiguiente">Siguiente ronda (${c.rondasCorridas.length + 1} de ${c.rondas})</button>`}
           <button id="cFin" class="ghost">Finalizar</button></div>`;
    } else {
      html = `<h2>${sinGanador ? 'Carrera sin ganador' : 'Clasificación'}</h2>${sinGanador ? '<p>Ningún caballo pudo llegar a la meta.</p>' : ''}${listaClasificacion()}
        <div class="acciones-fila"><button id="cRevancha">Revancha</button><button id="cFin" class="ghost">Finalizar</button></div>`;
    }
    $('cartel').innerHTML = html; $('cartel').hidden = false;
    pintarLista(); $('cartel').scrollIntoView({ block: 'nearest', behavior: RM ? 'auto' : 'smooth' });
  }

  function seguirCarrera() {
    $('cartel').hidden = true; seguir = true; fase = 'corriendo'; sync();
    if (ajustes.auto) setAuto(true);
  }
  function revancha() {
    if (S.camp) { S.camp = new Campeonato({ rondas: S.rondas, jugadores: S.partida }); S.ronda = 0; }
    if (S.sala) {
      S.sala = Object.assign({}, S.sala, { semilla: nuevaSemilla() });
      actualizarBarras();
      avisar('Sala nueva: ' + codigoLegible(S.sala) + '. Hay que volver a pasar el código.');
    } else {
      S.semillaBase = nuevaSemilla();
    }
    nuevaCarrera();
  }
  function siguienteRonda() { S.ronda++; nuevaCarrera(); }

  /* ---------- eventos ---------- */
  document.querySelectorAll('.modo[data-modo]').forEach(b => { b.onclick = () => abrirConfig(b.dataset.modo); });
  $('btnAmigos').onclick = () => { pintarAmigos(); ir('amigos'); };
  $('btnPers').onclick = () => { pintarPersonalizar(); ir('pers'); };
  $('btnPersVolver').onclick = () => ir('menu');
  $('btnMenu').onclick = async () => {
    if (!(await salirSiSeguro('Si sales ahora, se pierde la carrera en marcha.'))) return;
    S.sala = null;
    ir('menu');
  };
  $('btnCrearSala').onclick = crearSala;
  $('btnIrMesa').onclick = () => { if (S.salaCreada) entrarSala(S.salaCreada); };
  $('btnCopiarCodigo').onclick = async () => { if (!S.salaCreada) return; avisar((await copiar(M.codigoSala(S.salaCreada))) ? 'Código copiado' : 'No se ha podido copiar'); };
  $('btnCopiarEnlace').onclick = async () => {
    if (!S.salaCreada) return;
    if (navigator.share) { try { await navigator.share({ title: 'Carrera de caballos', text: 'Sala ' + M.codigoSala(S.salaCreada), url: enlaceSala(S.salaCreada) }); } catch (e) { /* cancelado */ } return; }
    avisar((await copiar(enlaceSala(S.salaCreada))) ? 'Enlace copiado' : 'No se ha podido copiar');
  };
  document.querySelectorAll('[data-copiar]').forEach(b => { b.onclick = () => copiarSala(b.dataset.copiar); });
  if (navigator.share) { $('btnCopiarEnlace').textContent = 'Compartir enlace'; document.querySelectorAll('[data-copiar="enlace"]').forEach(b => { b.textContent = 'Compartir enlace'; }); }
  $('btnUnirme').onclick = () => unirse($('inCodigo').value);
  $('inCodigo').onkeydown = e => { if (e.key === 'Enter') unirse($('inCodigo').value); };

  $('opPanos').onclick = e => { const b = e.target.closest('[data-pano]'); if (!b) return; ajustes.pano = b.dataset.pano; guardarAjustes(); aplicarTema(); pintarPersonalizar(); };
  $('opDorsos').onclick = e => { const b = e.target.closest('[data-dorso]'); if (!b) return; ajustes.dorso = b.dataset.dorso; guardarAjustes(); aplicarTema(); pintarPersonalizar(); };

  $('rows').addEventListener('input', e => {
    const t = e.target; if (t.dataset.k === 'nombre') { S.jugadores[+t.dataset.i].nombre = t.value; guardarJugadores(); }
  });
  $('rows').addEventListener('change', e => {
    const t = e.target, k = t.dataset.k, i = +t.dataset.i;
    if (!k || k === 'nombre') return;
    if (k === 'apuesta') S.jugadores[i].apuesta = +t.value;
    else {
      const antes = S.jugadores[i].palo; S.jugadores[i].palo = t.value;
      if (S.modo === 'uno' && S.jugadores.length === 2) { const otro = S.jugadores[1 - i]; if (otro.palo === t.value) otro.palo = antes; renderFilas(); }
    }
    guardarJugadores();
  });
  $('rows').addEventListener('click', e => {
    const d = e.target.dataset.del;
    if (d !== undefined && S.jugadores.length > limitesJug()[0]) { S.jugadores.splice(+d, 1); guardarJugadores(); renderFilas(); }
  });
  $('add').onclick = () => {
    if (S.jugadores.length < limitesJug()[1]) {
      S.jugadores.push({ nombre: 'Jugador ' + (S.jugadores.length + 1), palo: IDS[S.jugadores.length % 4], apuesta: 10 });
      guardarJugadores(); renderFilas();
    }
  };
  $('start').onclick = empezar;
  $('rapManual').onclick = () => { ajustes.auto = false; guardarAjustes(); empezar(); };
  $('rapAuto').onclick = () => { ajustes.auto = true; guardarAjustes(); empezar(); };

  $('deck').onclick = () => {
    if (auto) return;
    if (ajustes.vibracion && navigator.vibrate) navigator.vibrate(25);
    sacar();
  };
  $('btnHist').onclick = abrirHistorial;
  $('auto').onclick = () => { if (espera) { espera = false; setAuto(true); } else setAuto(!auto); };
  $('spd').onchange = e => { ajustes.velocidad = e.target.value; guardarAjustes(); };
  $('salir').onclick = async () => {
    if (!(await salirSiSeguro('Si sales ahora, se pierde la carrera en marcha.'))) return;
    abrirConfig(null);
  };
  $('cartel').addEventListener('click', e => {
    const id = e.target.id;
    if (id === 'cSeguir') seguirCarrera();
    else if (id === 'cRevancha' || id === 'cNuevoCamp') revancha();
    else if (id === 'cSiguiente') siguienteRonda();
    else if (id === 'cFin') { token++; S.sala = null; ir('menu'); }
  });

  /* ajustes y créditos */
  $('btnAjustes').onclick = () => {
    $('ajVibra').checked = ajustes.vibracion; $('ajPantalla').checked = ajustes.pantalla;
    $('dAjustes').showModal();
  };
  $('ajVibra').onchange = e => { ajustes.vibracion = e.target.checked; guardarAjustes(); };
  $('ajPantalla').onchange = e => {
    ajustes.pantalla = e.target.checked; guardarAjustes();
    if (!ajustes.pantalla) soltarPantalla(); else if (vista === 'juego') pedirPantalla();
  };
  $('ajFichas').onclick = async () => {
    if (await confirmar('Todos los jugadores vuelven a 100 fichas.', 'Reiniciar')) {
      fichas = {}; LS.set('carrera_fichas', fichas); pintarLista(); avisar('Fichas reiniciadas');
    }
  };
  $('credBtn').onclick = () => $('cred').showModal();

  /* ---------- arranque ---------- */
  aplicarTema();
  abanico();
  ir('menu');
  const enlace = new URLSearchParams(location.search).get('sala');
  if (enlace) {
    const sala = M.leerCodigo(enlace);
    if (sala) { entrarSala(sala); avisar('Entras en la sala ' + codigoLegible(sala)); }
    else avisar('El código del enlace no es válido.');
  }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo sin conexión */ });
  }

  // Solo para las pruebas automáticas.
  if (typeof window !== 'undefined') window.__carrera = { S, ajustes, estado: () => ({ fase, busy, auto, vista, carrera }) };
})();
