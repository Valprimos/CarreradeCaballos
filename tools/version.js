#!/usr/bin/env node
/* Mantiene la versión de la caché sin hacerlo a mano.
 *
 * La versión es un hash del contenido de los ficheros que index.html carga con "?v=" (js y css).
 * Se escribe igual en index.html (?v=…) y en sw.js (?v=… de la lista de ficheros y VERSION).
 *
 *   node tools/version.js            pone la versión al día (npm run version)
 *   node tools/version.js --check    no escribe nada; sale con error si está desactualizada
 *
 * Si cambias app.js, estilos.css o cualquier otro fichero versionado, vuelve a ejecutarlo antes de subir.
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const RAIZ = path.join(__dirname, '..');
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');

/** Ficheros locales que index.html pide con ?v= */
function ficherosVersionados(html) {
  return [...html.matchAll(/(?:src|href)="([^"?#]+)\?v=[^"]*"/g)].map(m => m[1]);
}
function hashDe(ficheros) {
  const h = crypto.createHash('sha1');
  [...new Set(ficheros)].sort().forEach(f => { h.update(f + '\0'); h.update(fs.readFileSync(path.join(RAIZ, f))); });
  return h.digest('hex').slice(0, 8);
}
/** Cómo deberían quedar index.html y sw.js. */
function esperado() {
  const html = leer('index.html'), sw = leer('sw.js');
  const v = hashDe(ficherosVersionados(html));
  return {
    v,
    'index.html': html.replace(/\?v=\w+"/g, `?v=${v}"`),
    'sw.js': sw.replace(/\?v=\w+"/g, `?v=${v}"`).replace(/const VERSION = '[^']*';/, `const VERSION = 'carrera-${v}';`)
  };
}
function desactualizados() {
  const e = esperado();
  return ['index.html', 'sw.js'].filter(f => leer(f) !== e[f]);
}

if (require.main === module) {
  if (process.argv.includes('--check')) {
    const mal = desactualizados();
    if (mal.length) { console.error('Versión desactualizada en: ' + mal.join(', ') + '. Ejecuta: npm run version'); process.exit(1); }
    console.log('Versión al día (' + esperado().v + ').');
  } else {
    const e = esperado();
    ['index.html', 'sw.js'].forEach(f => fs.writeFileSync(path.join(RAIZ, f), e[f]));
    console.log('Versión ' + e.v + ' escrita en index.html y sw.js.');
  }
}
module.exports = { ficherosVersionados, hashDe, esperado, desactualizados };
