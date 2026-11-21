/* Semillas guardadas: la "semilla" de una carrera es lo que hace que salgan las mismas cartas en el mismo orden.
   Aquí se guardan las que el jugador quiere conservar, para repetir una carrera en Partida personalizada.
   Sin dependencias del navegador: recibe el almacenamiento ({ get, set }), así que se prueba con Node (`node --test`). */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Semillas = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const CLAVE = 'carrera_semillas', MAX = 40;
  const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789';

  /** Código corto y legible de una semilla (base 32, 5 letras o cifras): sirve para reconocerla de un vistazo. */
  const codigo = semilla => (semilla >>> 0).toString(32).toUpperCase().padStart(5, '0');

  function nuevoId(azar) {
    let s = 's_';
    for (let i = 0; i < 6; i++) s += ALFABETO[Math.floor(azar() * ALFABETO.length) % ALFABETO.length];
    return s;
  }
  const entero = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

  /** opciones: { pasos: {min, max}, ahora: () => 'fecha ISO', azar: () => número entre 0 y 1 } */
  function crear(almacen, opciones = {}) {
    const lim = opciones.pasos || { min: 2, max: 12 };
    const ahora = opciones.ahora || (() => new Date().toISOString());
    const azar = opciones.azar || Math.random;
    const valida = e => !!e && typeof e === 'object' && /^s_[a-z0-9]{6}$/.test(e.id || '')
      && entero(e.semilla, 0, 4294967295) && entero(e.pasos, lim.min, lim.max)
      && (e.ganador === null || /^[a-z]{1,12}$/.test(e.ganador || '')) && typeof e.fecha === 'string';
    const leer = () => { const v = almacen.get(CLAVE, []); return Array.isArray(v) ? v.filter(valida) : []; };   // de más antigua a más nueva

    return {
      /** De la más reciente a la más antigua. */
      lista: () => leer().reverse(),
      buscar: id => leer().find(e => e.id === id) || null,
      /** Guarda { semilla, pasos, ganador }. Si ya estaba (misma semilla y mismo largo de pista) no la duplica. */
      guardar({ semilla, pasos, ganador = null } = {}) {
        if (!entero(semilla, 0, 4294967295) || !entero(pasos, lim.min, lim.max)) return { ok: false };
        if (ganador !== null && !/^[a-z]{1,12}$/.test(String(ganador))) ganador = null;
        const l = leer(), igual = l.find(e => e.semilla === semilla && e.pasos === pasos);
        if (igual) return { ok: true, repetida: true, entrada: igual };
        let id; do { id = nuevoId(azar); } while (l.some(e => e.id === id));
        const entrada = { id, semilla, pasos, ganador, fecha: ahora() };
        l.push(entrada);
        if (l.length > MAX) l.splice(0, l.length - MAX);          // se van las más antiguas
        almacen.set(CLAVE, l);
        return { ok: true, repetida: false, entrada };
      },
      borrar(id) {
        const l = leer(), n = l.filter(e => e.id !== id);
        if (n.length === l.length) return false;
        almacen.set(CLAVE, n); return true;
      }
    };
  }
  return { CLAVE, MAX, codigo, crear };
});
