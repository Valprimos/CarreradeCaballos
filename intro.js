/* Intro de la app: aparece la doble C (las dos herraduras del logo) en el centro, sobre un fondo oscuro. Después las dos
   herraduras viajan hasta el sitio que ocupan en el título «Carrera de Caballos» del menú, mientras el fondo se va
   deshaciendo en un degradado de arriba abajo y deja ver el menú. Sin dependencias.
   Este fichero va el primero del <body> para que la intro cubra la pantalla desde el principio.
   - Se salta tocando la pantalla, con Enter, Espacio o Escape.
   - No sale con ?sinintro, en los enlaces de sala ni cuando se quita en Ajustes. Con «reducir movimiento» es solo un fundido.
   - En un navegador automatizado (las pruebas) tampoco sale, salvo que la dirección lleve ?intro=1.
   - Desde Ajustes, «Ver la intro» la enseña siempre (window.Intro.mostrar()). */
(function () {
  'use strict';
  const INICIO = 1200;      // ms hasta que las herraduras echan a andar (la doble C se queda un momento quieta)
  const VIAJE = 1200;       // ms que tardan en llegar a su sitio en el título
  const DISUELVE = 1400;    // ms que tarda el fondo en deshacerse (empieza a la vez que el viaje)
  const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const reducido = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches;

  let activa = null;
  function crear() {
    if (activa || !document.body) return;
    const rm = reducido(), t0 = performance.now(), raiz = document.documentElement;
    const el = document.createElement('div');
    el.id = 'intro'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="i-fondo"></div><div class="i-halo"></div>'
      + '<img class="hc i-c" src="herradura.svg" alt=""><img class="hc i-c" src="herradura.svg" alt="">'
      + '<div class="i-saltar">Toca para saltar</div>';
    document.body.insertBefore(el, document.body.firstChild);
    raiz.classList.add('intro-activa');
    activa = el;
    const viajeros = [...el.querySelectorAll('.i-c')];

    // La doble C del centro: dos herraduras juntas, como el logo.
    const alto0 = Math.min(innerWidth * .27, innerHeight * .25, 170), ancho0 = alto0 * 71 / 80, sep = ancho0 * .1;
    const origen = viajeros.map((v, i) => {
      const o = { x: innerWidth / 2 + (i ? sep / 2 : -sep / 2 - ancho0), y: innerHeight / 2 - alto0 / 2, w: ancho0, h: alto0 };
      pintar(v, o); return o;
    });
    function pintar(v, r) { v.style.width = r.w + 'px'; v.style.height = r.h + 'px'; v.style.transform = `translate(${r.x}px,${r.y}px)`; }

    let saliendo = false, viajando = false, raf = 0, t1 = 0, tFin = 0;
    const quitar = () => {
      cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(tFin);
      document.removeEventListener('keydown', tecla, true);
      el.remove(); raiz.classList.remove('intro-activa'); activa = null;
    };
    const desvanecer = (ms, retraso) => {                     // fundido de todo el cartel (al saltar, con «reducir movimiento» o si no hay título al que llegar)
      raiz.classList.remove('intro-activa');
      const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, delay: retraso || 0, fill: 'forwards' });
      a.onfinish = quitar;
    };
    const saltar = () => { if (saliendo) return; saliendo = true; el.classList.add('i-saltado'); cancelAnimationFrame(raf); clearTimeout(t1); desvanecer(240); };
    const tecla = ev => { if (['Enter', ' ', 'Escape'].includes(ev.key)) { ev.preventDefault(); ev.stopPropagation(); saltar(); } };
    el.addEventListener('pointerdown', saltar);
    document.addEventListener('keydown', tecla, true);
    setTimeout(quitar, 9000);                                 // por si algo falla: nunca deja la pantalla tapada

    if (rm) { desvanecer(300, 900); return; }                 // sin movimiento: la doble C quieta y un fundido

    // Dónde están las dos «C» del título del menú (se miden en cada fotograma, así llegan exactas aunque la página se recoloque).
    const destinos = () => [...document.querySelectorAll('#vMenu h1 .hc')].slice(0, 2).map(h => h.getBoundingClientRect());
    const arrancar = () => {
      if (saliendo) return;
      const d = destinos();
      el.classList.add('i-va');                               // empieza a deshacerse el fondo
      if (d.length < 2 || d.some(r => r.width < 2)) {         // no hay título a la vista (p. ej. se ve desde Ajustes durante una partida)
        viajeros.forEach(v => v.classList.add('i-sin-destino'));
        tFin = setTimeout(quitar, DISUELVE + 100); return;
      }
      viajando = true;
      const ini = performance.now();
      const paso = ahora => {
        const p = Math.min(1, (ahora - ini) / VIAJE), e = ease(p), dd = destinos();
        viajeros.forEach((v, i) => {
          const o = origen[i], f = dd[i];
          pintar(v, { x: o.x + (f.left - o.x) * e, y: o.y + (f.top - o.y) * e, w: o.w + (f.width - o.w) * e, h: o.h + (f.height - o.h) * e });
        });
        if (p < 1) { raf = requestAnimationFrame(paso); return; }
        document.dispatchEvent(new CustomEvent('intro:aterrizaje', { detail: { viajeros, destinos: dd } }));
        raiz.classList.remove('intro-activa');                // las «C» de verdad aparecen justo debajo de las del viaje
        viajeros.forEach(v => { v.style.visibility = 'hidden'; });
        tFin = setTimeout(quitar, Math.max(60, DISUELVE - VIAJE + 100));
      };
      raf = requestAnimationFrame(paso);
    };
    // Espera a que el menú esté montado (y las letras cargadas) para medir, pero sin pasar de 2,6 s.
    const montado = new Promise(ok => { if (document.readyState !== 'loading') ok(); else document.addEventListener('DOMContentLoaded', ok, { once: true }); })
      .then(() => (document.fonts && document.fonts.ready) || null);
    Promise.race([montado, new Promise(ok => setTimeout(ok, 2600))]).then(() => {
      if (saliendo) return;
      t1 = setTimeout(arrancar, Math.max(0, INICIO - (performance.now() - t0)));
    });
  }

  let ajustes = {};
  try { ajustes = JSON.parse(localStorage.getItem('carrera_ajustes') || '{}') || {}; } catch (e) { /* nada */ }
  const q = new URLSearchParams(location.search);
  const quitada = ajustes.intro === false || q.has('sinintro') || q.has('sala') || (navigator.webdriver && q.get('intro') !== '1');
  window.Intro = { mostrar: crear };
  if (!quitada) crear();
})();
