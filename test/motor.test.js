'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../motor.js');

test('la baraja de la carrera no lleva caballos y suma 36 cartas con 4 palos', () => {
  const c = new M.Carrera({ pasos: 6, rng: M.crearRng(1) });
  const todas = [...c.cartasPista, ...c.mazo];
  assert.equal(todas.length, 36);
  assert.ok(todas.every(x => x.valor !== 11));
  assert.equal(c.cartasPista.length, 6);
  assert.equal(c.meta, 7);
});

test('1 contra 1 usa solo las cartas de los dos palos', () => {
  const c = new M.Carrera({ pasos: 6, palos: ['espadas', 'bastos'], rng: M.crearRng(2) });
  const todas = [...c.cartasPista, ...c.mazo];
  assert.equal(todas.length, 18);
  assert.ok(todas.every(x => x.palo === 'espadas' || x.palo === 'bastos'));
});

test('validaciones del constructor', () => {
  assert.throws(() => new M.Carrera({ palos: ['oros'] }), RangeError);
  assert.throws(() => new M.Carrera({ palos: ['oros', 'oros'] }), RangeError);
  assert.throws(() => new M.Carrera({ pasos: 0 }), RangeError);
});

test('la misma semilla da exactamente la misma carrera', () => {
  const corre = semilla => {
    const c = new M.Carrera({ pasos: 6, rng: M.crearRng(semilla) });
    const cartas = [];
    while (!c.agotada) cartas.push(M.nombreCarta(c.jugarTurno().carta));
    return { cartas, clasif: c.clasificacion };
  };
  assert.deepEqual(corre(12345), corre(12345));
  assert.notDeepEqual(corre(12345).cartas, corre(54321).cartas);
});

test('toda carrera termina con ganador y las posiciones nunca se salen de rango', () => {
  for (let semilla = 1; semilla <= 300; semilla++) {
    const pasos = 2 + (semilla % 8); // 2..9: siempre hay ganador posible
    const c = new M.Carrera({ pasos, rng: M.crearRng(semilla) });
    let turnos = 0;
    while (!c.agotada) {
      c.jugarTurno();
      for (const p of c.palos) assert.ok(c.pos[p] >= 0 && c.pos[p] <= c.meta);
      assert.ok(++turnos < 5000, 'la carrera no debería ser infinita');
    }
    assert.ok(c.ganador, `sin ganador con semilla ${semilla}`);
    assert.equal(c.clasificacion.length + c.descolgados.length, 4);
    assert.equal(new Set(c.clasificacion).size, c.clasificacion.length);
  }
});

test('las cartas de paso solo se levantan cuando todos las han dejado atrás', () => {
  const c = new M.Carrera({ pasos: 6, rng: M.crearRng(77) });
  while (!c.agotada) {
    let esperado = c.pasosLevantados;
    const r = c.jugarTurno();
    for (const rev of r.revelaciones) {
      assert.equal(rev.paso, ++esperado);
    }
    assert.equal(c.pasosLevantados, esperado);
  }
});

test('a quien ya llegó no se le hace retroceder ni avanzar más', () => {
  const c = new M.Carrera({ pasos: 3, rng: M.crearRng(9) });
  while (!c.agotada) c.jugarTurno();
  for (const p of c.clasificacion) assert.equal(c.pos[p], c.meta);
});

test('el mazo se recicla con los descartes cuando se acaba', () => {
  let reciclado = false;
  for (let s = 1; s < 200 && !reciclado; s++) {
    const c = new M.Carrera({ pasos: 9, rng: M.crearRng(s) });
    while (!c.agotada) { if (c.jugarTurno().mazoReciclado) reciclado = true; }
  }
  assert.ok(reciclado, 'alguna carrera larga debería reciclar el mazo');
});

test('jugarTurno en una carrera agotada lanza error', () => {
  const c = new M.Carrera({ pasos: 2, rng: M.crearRng(3) });
  while (!c.agotada) c.jugarTurno();
  assert.throws(() => c.jugarTurno());
});

test('un caballo sin cartas vivas queda descolgado y la carrera se agota sin él', () => {
  const c = new M.Carrera({ pasos: 4, rng: M.crearRng(5) });
  // Quitamos del mazo y los descartes todas las cartas de oros (como si las 9
  // estuvieran en la pista): ese caballo ya no puede moverse.
  c.mazo = c.mazo.filter(x => x.palo !== 'oros');
  c.descartes = c.descartes.filter(x => x.palo !== 'oros');
  assert.deepEqual(c.descolgados, ['oros']);
  assert.ok(!c.enCarrera.includes('oros'));
  while (!c.agotada) c.jugarTurno();
  assert.equal(c.pos.oros, 0);
  assert.ok(!c.clasificacion.includes('oros'));
});

/* ---- campeonato ---- */

test('el campeonato reparte tantos puntos como caballos y suma por rondas', () => {
  const jugadores = [{ nombre: 'Ana', palo: 'oros' }, { nombre: 'Luis', palo: 'copas' }, { nombre: 'Eva', palo: 'oros' }];
  const camp = new M.Campeonato({ rondas: 2, jugadores });
  const falsa = clasif => ({ palos: M.IDS, clasificacion: clasif });
  assert.deepEqual(M.Campeonato.repartir(falsa(['copas', 'oros', 'bastos'])),
    { oros: 3, copas: 4, espadas: 0, bastos: 2 });
  camp.anotar(falsa(['copas', 'oros', 'bastos', 'espadas']));
  assert.equal(camp.terminado, false);
  assert.equal(camp.rondaActual, 2);
  camp.anotar(falsa(['oros', 'copas']));
  assert.equal(camp.terminado, true);
  assert.equal(camp.puntosPorPalo.oros, 3 + 4);
  assert.equal(camp.puntosPorPalo.copas, 4 + 3);
  // Ana y Eva comparten palo (oros) y por tanto puntos; Luis (copas) empata también.
  assert.equal(camp.campeones.length, 3);
  assert.throws(() => camp.anotar(falsa(['oros'])));
});

test('campeones: gana quien más suma y la clasificación está ordenada', () => {
  const jugadores = [{ nombre: 'A', palo: 'bastos' }, { nombre: 'B', palo: 'espadas' }];
  const camp = new M.Campeonato({ rondas: 2, jugadores });
  const f = clasif => ({ palos: M.IDS, clasificacion: clasif });
  camp.anotar(f(['espadas', 'bastos']));
  camp.anotar(f(['espadas']));
  assert.deepEqual(camp.campeones.map(j => j.nombre), ['B']);
  assert.deepEqual(camp.clasificacion.map(j => j.nombre), ['B', 'A']);
});

/* ---- salas ---- */

test('códigos de sala: ida y vuelta para todos los modos', () => {
  for (const mod of ['rapida', 'personalizada']) {
    const s = { modalidad: mod, pasos: 8, rondas: 3, palos: ['oros', 'copas'], semilla: 31415926 };
    const t = M.leerCodigo(M.codigoSala(s));
    assert.deepEqual(t, s);
  }
  const camp = { modalidad: 'campeonato', pasos: 5, rondas: 7, palos: ['oros', 'copas'], semilla: 99 };
  assert.deepEqual(M.leerCodigo(M.codigoSala(camp)), camp);
});

test('1 contra 1: los 12 pares ordenados de palos viajan bien en el código', () => {
  let n = 0;
  for (const a of M.IDS) for (const b of M.IDS) {
    if (a === b) continue;
    const s = { modalidad: 'uno', pasos: 6, rondas: 3, palos: [a, b], semilla: 7 };
    assert.deepEqual(M.leerCodigo(M.codigoSala(s)).palos, [a, b]);
    n++;
  }
  assert.equal(n, 12);
});

test('los códigos miden 8 caracteres y el alfabeto no tiene I, L, O ni U', () => {
  for (let i = 0; i < 100; i++) {
    const s = M.nuevaSala({ modalidad: 'campeonato', rondas: 4, rng: M.crearRng(i) });
    const c = M.codigoSala(s);
    assert.equal(c.length, 8);
    assert.match(c, /^[0-9A-HJKMNP-TV-Z]{8}$/);
  }
});

test('se perdona minúsculas, espacios, guiones y I/L/O al leer un código', () => {
  const s = { modalidad: 'rapida', pasos: 6, rondas: 3, palos: ['oros', 'copas'], semilla: 1 * 32 + 0 };
  const c = M.codigoSala(s);
  assert.deepEqual(M.leerCodigo(c.toLowerCase().replace(/(....)(....)/, '$1 - $2')), s);
  const confuso = c.replace(/1/g, 'l').replace(/0/g, 'o');
  assert.deepEqual(M.leerCodigo(confuso), s);
});

test('códigos inválidos devuelven null', () => {
  assert.equal(M.leerCodigo(''), null);
  assert.equal(M.leerCodigo('1234'), null);
  assert.equal(M.leerCodigo('6359J7D'), null);          // 7 caracteres
  assert.equal(M.leerCodigo('636359J7D'), null);        // 9 caracteres
  assert.equal(M.leerCodigo('93000000'), null);         // modo 9 inexistente
  assert.equal(M.leerCodigo('01000000'), null);         // pista de 1
  assert.equal(M.leerCodigo('0W000000'), null);         // pista de 30
  assert.equal(M.leerCodigo('06100000'), null);         // extras en modo sin extras
  assert.equal(M.leerCodigo('1 6 Z 00000'.replace(/ /g, '')), null); // par de palos 31 inexistente
  assert.equal(M.leerCodigo('36 1 00000'.replace(/ /g, '')), null);  // campeonato con 1 ronda
  assert.equal(M.leerCodigo(null), null);
});

test('mismo código = misma partida; cada ronda del campeonato, otra distinta', () => {
  const sala = M.leerCodigo(M.codigoSala({ modalidad: 'campeonato', pasos: 6, rondas: 3, palos: ['oros', 'copas'], semilla: 123456 }));
  const orden = ronda => {
    const c = new M.Carrera({ pasos: sala.pasos, rng: M.crearRng(M.semillaDeRonda(sala, ronda)) });
    return c.cartasPista.map(M.nombreCarta).join(',');
  };
  assert.equal(orden(0), orden(0));
  assert.notEqual(orden(0), orden(1));
});
