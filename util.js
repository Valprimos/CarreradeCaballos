/* Utilidades sin estado que usa la interfaz: acceso al DOM por id, escape de HTML,
   pausa, semilla nueva y el guardado en el navegador (localStorage, sin romper si no existe). */
(function (raiz) {
  'use strict';
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nuevaSemilla = () => Math.floor(Math.random() * Math.pow(32, 5));
  const LS = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  };
  raiz.Util = { $, sleep, esc, nuevaSemilla, LS };
})(window);
