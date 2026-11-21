'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Semillas = require('../semillas.js');
const M = require('../motor.js');

function almacen(inicial = {}) {
  const d = new Map(Object.entries(inicial).map(([k, v]) => [k, JSON.stringify(v)]));
  return { get: (k, def) => (d.has(k) ? JSON.parse(d.get(k)) : def), set: (k, v) => d.set(k, JSON.stringify(v)), crudo: k => d.get(k) };
}
const reloj = () => { let n = 0; return () => new Date(Date.UTC(2026, 10, 1, 0, 0, n++)).toISOString(); };
const azarFijo = () => { let x = 11; return () => (x = (x * 16807) % 2147483647) / 2147483647; };
const crear = alm => Semillas.crear(alm, { ahora: reloj(), azar: azarFijo(), pasos: { min: M.LIMITES.pasos.min, max: M.LIMITES.pasos.max } });

test('codigo: 5 caracteres, estable y sin ambigüedad', () => {
  assert.equal(Semillas.codigo(0), '00000');
  assert.equal(Semillas.codigo(32 ** 5 - 1), 'VVVVV');
  assert.equal(Semillas.codigo(12345), '00C1P');
  assert.match(Semillas.codigo(1234567), /^[0-9A-V]{5}$/);
});

test('guardar y listar: la más reciente primero, y persiste', () => {
  const alm = almacen(), s = crear(alm);
  const a = s.guardar({ semilla: 111, pasos: 6, ganador: 'oros' }), b = s.guardar({ semilla: 222, pasos: 4, ganador: null });
  assert.ok(a.ok && b.ok && !a.repetida);
  assert.deepEqual(s.lista().map(e => e.semilla), [222, 111]);
  assert.equal(s.lista()[1].ganador, 'oros');
  assert.equal(s.lista()[0].ganador, null);
  assert.deepEqual(crear(alm).lista().map(e => e.semilla), [222, 111], 'sigue ahí al volver a abrir');
});

test('no duplica la misma semilla con el mismo largo de pista, pero sí si cambia el largo', () => {
  const s = crear(almacen());
  const a = s.guardar({ semilla: 5, pasos: 6 }), b = s.guardar({ semilla: 5, pasos: 6 }), c = s.guardar({ semilla: 5, pasos: 8 });
  assert.equal(b.repetida, true);
  assert.equal(b.entrada.id, a.entrada.id);
  assert.equal(c.repetida, false);
  assert.equal(s.lista().length, 2);
});

test('rechaza datos inválidos', () => {
  const s = crear(almacen());
  for (const mala of [{ semilla: -1, pasos: 6 }, { semilla: 1.5, pasos: 6 }, { semilla: NaN, pasos: 6 }, { semilla: 4294967296, pasos: 6 },
                      { semilla: 1, pasos: 1 }, { semilla: 1, pasos: 99 }, { semilla: '7', pasos: 6 }, { semilla: 1 }, undefined]) {
    assert.equal(s.guardar(mala).ok, false, JSON.stringify(mala));
  }
  assert.equal(s.lista().length, 0);
  assert.equal(s.guardar({ semilla: 1, pasos: 6, ganador: '<script>' }).entrada.ganador, null, 'un ganador raro se descarta');
});

test('buscar y borrar', () => {
  const s = crear(almacen());
  const { entrada } = s.guardar({ semilla: 9, pasos: 3 });
  assert.equal(s.buscar(entrada.id).semilla, 9);
  assert.equal(s.buscar('s_nadaaa'), null);
  assert.equal(s.borrar('s_nadaaa'), false);
  assert.equal(s.borrar(entrada.id), true);
  assert.equal(s.lista().length, 0);
});

test(`como mucho ${Semillas.MAX} guardadas: se van las más antiguas`, () => {
  const s = crear(almacen());
  for (let i = 0; i < Semillas.MAX + 5; i++) s.guardar({ semilla: i, pasos: 6 });
  const l = s.lista();
  assert.equal(l.length, Semillas.MAX);
  assert.equal(l[0].semilla, Semillas.MAX + 4);
  assert.equal(l[l.length - 1].semilla, 5);
});

test('un almacén estropeado o con entradas raras no rompe nada', () => {
  for (const malo of [null, {}, 'x', 5, [null, 7, { id: 'x' }, { id: 's_aaaaaa', semilla: -3, pasos: 6, ganador: null, fecha: 'f' }]]) {
    const s = crear(almacen({ carrera_semillas: malo }));
    assert.deepEqual(s.lista(), []);
    assert.equal(s.guardar({ semilla: 1, pasos: 6 }).ok, true);
  }
});

test('la misma semilla y el mismo largo de pista dan SIEMPRE la misma carrera, y otra semilla da otra', () => {
  const cartas = (semilla, pasos) => {
    const c = new M.Carrera({ pasos, palos: M.IDS, rng: M.crearRng(semilla) }), seq = [];
    while (!c.agotada) { const r = c.jugarTurno(); seq.push(r.carta.palo + r.carta.valor, r.avanza || '-', ...r.revelaciones.map(v => v.retrocede || 'x')); }
    return seq.join(',');
  };
  assert.equal(cartas(12345, 6), cartas(12345, 6));
  assert.notEqual(cartas(12345, 6), cartas(54321, 6));
  assert.notEqual(cartas(12345, 6), cartas(12345, 7), 'el largo de pista cambia la carrera: por eso se guarda con la semilla');
});
