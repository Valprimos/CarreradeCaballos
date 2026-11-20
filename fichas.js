/* Fichas de los jugadores.
   Se guardan por id interno y no por nombre: dos jugadores con el mismo nombre no comparten fichas
   y cambiar un nombre no las pierde. Sin dependencias del navegador: recibe el almacenamiento
   ({ get, set }), así que se prueba con Node (`node --test`). */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Fichas = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const INICIO = 100, CLAVE = 'carrera_fichas';
  const ID_OK = /^p_[a-z0-9]{8}$/;
  const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789';

  function nuevoId(azar = Math.random) {
    let s = 'p_';
    for (let i = 0; i < 8; i++) s += ALFABETO[Math.floor(azar() * ALFABETO.length) % ALFABETO.length];
    return s;
  }
  const tieneId = p => !!p && ID_OK.test(p.id || '');
  /** Con id, el id; sin él (un jugador que llega de otro móvil en una sala) sigue siendo el nombre, como antes. */
  const clave = p => (tieneId(p) ? p.id : p && p.nombre);

  /** Da id a quien no lo tiene y repara los repetidos dentro de una misma lista. Devuelve true si cambió algo.
   *  - Una persona que está con el mismo nombre en varias listas (rápida, personalizada…) conserva un solo id,
   *    como antes compartía fichas por nombre.
   *  - Dos jugadores con el mismo nombre en la misma lista reciben ids distintos.
   *  - Quien ya tenía fichas guardadas por nombre las conserva (se copian a su id). */
  function asignarIds(listas, fichas, azar) {
    let cambio = false;
    const porNombre = new Map();
    listas.forEach(lista => {
      const usados = new Set();
      lista.forEach(p => {
        if (tieneId(p) && !usados.has(p.id)) {
          usados.add(p.id);
          if (!porNombre.has(p.nombre)) porNombre.set(p.nombre, p.id);
          return;
        }
        let id = porNombre.get(p.nombre);
        if (!id || usados.has(id)) {
          do { id = nuevoId(azar); } while (usados.has(id));
          if (!porNombre.has(p.nombre)) porNombre.set(p.nombre, id);
        }
        p.id = id; usados.add(id); cambio = true;
        if (fichas[id] === undefined && fichas[p.nombre] !== undefined) fichas[id] = fichas[p.nombre];
      });
    });
    return cambio;
  }

  function crear(almacen) {
    let datos = almacen.get(CLAVE, {});
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) datos = {};
    const guardar = () => almacen.set(CLAVE, datos);
    return {
      de: p => datos[clave(p)] ?? INICIO,
      cambiar(p, delta) { const k = clave(p); datos[k] = (datos[k] ?? INICIO) + delta; },
      guardar,
      reiniciar() { datos = {}; guardar(); },
      prepararJugadores(listas, azar) { const c = asignarIds(listas, datos, azar); if (c) guardar(); return c; },
      get datos() { return datos; }
    };
  }

  return { INICIO, CLAVE, nuevoId, tieneId, clave, asignarIds, crear };
});
