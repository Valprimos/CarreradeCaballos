'use strict';
/* Comprueba la caché sin conexión: versión al día, lista de ficheros coherente y completa. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { desactualizados, ficherosVersionados } = require('../tools/version.js');

const RAIZ = path.join(__dirname, '..');
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const sw = leer('sw.js'), html = leer('index.html');
const nucleo = [...sw.slice(sw.indexOf('const NUCLEO'), sw.indexOf('];', sw.indexOf('const NUCLEO'))).matchAll(/"([^"]+)"/g)].map(m => m[1]);
const sinVersion = f => f.split('?')[0];

test('la versión de index.html y sw.js está al día (si falla: npm run version)', () => {
  assert.deepEqual(desactualizados(), []);
});

test('todos los ficheros de la lista sin conexión existen', () => {
  const faltan = nucleo.map(sinVersion).filter(f => f !== './' && !fs.existsSync(path.join(RAIZ, f)));
  assert.deepEqual(faltan, []);
});

test('cada js/css que index.html carga con ?v= está en la lista, con la misma URL exacta', () => {
  const pedidos = [...html.matchAll(/(?:src|href)="([^"]+\?v=\w+)"/g)].map(m => m[1]);
  assert.ok(pedidos.length >= 8);
  assert.deepEqual(pedidos.filter(u => !nucleo.includes(u)), []);
  assert.equal(ficherosVersionados(html).length, pedidos.length);
});

test('VERSION lleva el mismo hash que los ?v=', () => {
  const v = /const VERSION = 'carrera-(\w+)';/.exec(sw)[1];
  assert.deepEqual([...new Set([...html.matchAll(/\?v=(\w+)"/g)].map(m => m[1]))], [v]);
});

test('los 40 naipes, el dorso y los 6 dorsos de colores se guardan para jugar sin conexión', () => {
  const naipes = nucleo.filter(f => /^(oros|copas|espadas|bastos)\/card_\w+_\d\d\.webp$/.test(f));
  assert.equal(naipes.length, 40);
  assert.ok(nucleo.includes('dorso/card_back.webp'));
  const colores = fs.readdirSync(path.join(RAIZ, 'dorso')).filter(f => /^back_\w+\.webp$/.test(f));
  assert.equal(colores.length, 6);
  colores.forEach(f => assert.ok(nucleo.includes('dorso/' + f), f + ' falta en la lista sin conexión'));
});

test('todos los dorsos y paños que ofrece Ajustes tienen su fichero en la lista', () => {
  const w = {}; new Function('window', leer('datos.js'))(w);
  Object.values(w.Datos.DORSOS).forEach(d => assert.ok(nucleo.includes(d.src), d.src));
});
