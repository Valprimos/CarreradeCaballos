'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Fichas = require('../fichas.js');

/** Almacén en memoria con la misma forma que LS ({ get, set }); guarda copias como haría localStorage. */
function almacen(inicial = {}) {
  const d = new Map(Object.entries(inicial).map(([k, v]) => [k, JSON.stringify(v)]));
  return { get: (k, def) => (d.has(k) ? JSON.parse(d.get(k)) : def), set: (k, v) => d.set(k, JSON.stringify(v)), crudo: k => d.get(k) };
}
/** Azar repetible para que los ids de los tests no cambien. */
const azarFijo = () => { let x = 7; return () => (x = (x * 16807) % 2147483647) / 2147483647; };

test('nuevoId: formato p_ + 8 caracteres, y distintos entre sí', () => {
  const az = azarFijo(), ids = new Set();
  for (let i = 0; i < 500; i++) { const id = Fichas.nuevoId(az); assert.match(id, /^p_[a-z0-9]{8}$/); ids.add(id); }
  assert.equal(ids.size, 500);
  assert.match(Fichas.nuevoId(() => 0), /^p_a{8}$/);          // un azar degenerado no se cuelga
});

test('sin historial, todos empiezan con 100 fichas; cambiar y guardar persiste', () => {
  const alm = almacen(), f = Fichas.crear(alm), ana = { id: 'p_aaaaaaaa', nombre: 'Ana' };
  assert.equal(f.de(ana), 100);
  f.cambiar(ana, 30); f.cambiar(ana, -10); f.guardar();
  assert.equal(f.de(ana), 120);
  assert.equal(Fichas.crear(alm).de(ana), 120);
});

test('dos jugadores con el mismo nombre NO comparten fichas', () => {
  const f = Fichas.crear(almacen());
  const lista = [{ nombre: 'Ana' }, { nombre: 'Ana' }];
  f.prepararJugadores([lista], azarFijo());
  assert.notEqual(lista[0].id, lista[1].id);
  f.cambiar(lista[0], +30);
  assert.equal(f.de(lista[0]), 130);
  assert.equal(f.de(lista[1]), 100);
});

test('cambiar el nombre no pierde las fichas (van por id)', () => {
  const f = Fichas.crear(almacen());
  const lista = [{ nombre: 'Ana' }];
  f.prepararJugadores([lista], azarFijo());
  f.cambiar(lista[0], 50);
  lista[0].nombre = 'Beatriz';
  assert.equal(f.de(lista[0]), 150);
});

test('migración: lo guardado por nombre pasa a cada jugador sin perder fichas', () => {
  const alm = almacen({ carrera_fichas: { Ana: 250, Luis: 40 } });
  const f = Fichas.crear(alm);
  const otros = [{ nombre: 'Ana' }, { nombre: 'Luis' }], pers = [{ nombre: 'Ana' }, { nombre: 'Ana' }];
  assert.equal(f.prepararJugadores([otros, pers], azarFijo()), true);
  assert.equal(f.de(otros[0]), 250);
  assert.equal(f.de(otros[1]), 40);
  assert.equal(otros[0].id, pers[0].id, 'la misma persona en dos listas conserva un solo id (como antes compartía fichas por nombre)');
  assert.notEqual(pers[0].id, pers[1].id, 'pero dos con el mismo nombre en la misma lista se separan');
  assert.equal(f.de(pers[1]), 250, 'el segundo parte de lo que ya tenía ese nombre');
  f.cambiar(pers[1], -100);
  assert.equal(f.de(pers[0]), 250);
  // las claves viejas por nombre se conservan (siguen sirviendo para jugadores de otras salas)
  assert.equal(f.datos.Ana, 250);
  // y queda guardado
  assert.ok(JSON.parse(alm.crudo('carrera_fichas'))[otros[0].id] === 250);
});

test('prepararJugadores es idempotente: una segunda vez no cambia ids ni fichas', () => {
  const f = Fichas.crear(almacen({ carrera_fichas: { Ana: 90 } }));
  const lista = [{ nombre: 'Ana' }, { nombre: 'Ana' }];
  f.prepararJugadores([lista], azarFijo());
  const antes = JSON.stringify([lista, f.datos]);
  assert.equal(f.prepararJugadores([lista], azarFijo()), false);
  assert.equal(JSON.stringify([lista, f.datos]), antes);
});

test('ids repetidos o inválidos dentro de una lista se reparan', () => {
  const f = Fichas.crear(almacen());
  const lista = [{ id: 'p_zzzzzzzz', nombre: 'A' }, { id: 'p_zzzzzzzz', nombre: 'B' }, { id: 'malo', nombre: 'C' }];
  f.prepararJugadores([lista], azarFijo());
  assert.equal(new Set(lista.map(p => p.id)).size, 3);
  lista.forEach(p => assert.ok(Fichas.tieneId(p)));
  assert.equal(lista[0].id, 'p_zzzzzzzz', 'el primero conserva su id');
});

test('un jugador sin id (llega de otro móvil en una sala) sigue contando por nombre', () => {
  const f = Fichas.crear(almacen({ carrera_fichas: { Marta: 180 } }));
  const remoto = { nombre: 'Marta' };
  assert.equal(f.de(remoto), 180);
  f.cambiar(remoto, 20);
  assert.equal(f.datos.Marta, 200);
});

test('reiniciar vuelve todo a 100 y lo guarda', () => {
  const alm = almacen({ carrera_fichas: { p_aaaaaaaa: 500 } }), f = Fichas.crear(alm);
  f.reiniciar();
  assert.equal(f.de({ id: 'p_aaaaaaaa', nombre: 'X' }), 100);
  assert.deepEqual(JSON.parse(alm.crudo('carrera_fichas')), {});
});

test('un almacén estropeado no rompe nada', () => {
  for (const malo of [null, [], 'texto', 7]) {
    const f = Fichas.crear(almacen({ carrera_fichas: malo }));
    assert.equal(f.de({ nombre: 'Ana' }), 100);
  }
});
