/* Confeti de celebración. Sin dependencias: un canvas que se crea al lanzar y se quita solo al acabar.
   Dos cañones, uno en cada esquina de abajo, disparan hacia el centro. No hace nada si el sistema
   pide reducir el movimiento.
   Uso: Confeti.lanzar(['#f2c230'], { cantidad: 160 }); */
(function () {
  'use strict';
  const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches;
  const ORO = ['#f0c453', '#fff6cf', '#ffffff'];
  const GRAVEDAD = 1100, ROCE_X = 1.5, ROCE_Y = 1.2;

  let canvas = null, ctx = null, ps = [], raf = 0, ultimo = 0, w = 0, h = 0, dpr = 1;

  const azar = (a, b) => a + Math.random() * (b - a);

  function ajustar() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function abrir() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1000';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    ajustar();
    window.addEventListener('resize', ajustar);
  }

  function cerrar() {
    cancelAnimationFrame(raf); raf = 0; ultimo = 0;
    window.removeEventListener('resize', ajustar);
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = ctx = null;
  }

  function fotograma(t) {
    const dt = Math.min(0.05, ultimo ? (t - ultimo) / 1000 : 0.016);
    ultimo = t;
    ctx.clearRect(0, 0, w, h);
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.t += dt;
      if (p.t < 0) continue;                           // aún no ha salido del cañón
      if (p.t >= p.vida || p.y > h + 40) { ps.splice(i, 1); continue; }
      p.vy += GRAVEDAD * dt;
      p.vx -= p.vx * ROCE_X * dt;
      p.vy -= p.vy * ROCE_Y * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (p.vida - p.t) / 0.7);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.t * p.aleteo));          // el giro en 3D del papelito
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto);
      ctx.restore();
    }
    if (ps.length) raf = requestAnimationFrame(fotograma); else cerrar();
  }

  function lanzar(colores, opciones) {
    if (RM || typeof document === 'undefined' || !document.body) return;
    const o = Object.assign({ cantidad: 140, vida: 3.4 }, opciones);
    const paleta = (colores && colores.length ? colores : []).concat(ORO);
    abrir();
    const base = Math.min(w, h);
    const fuerza = Math.max(650, Math.min(1500, base * 1.7));
    for (let i = 0; i < o.cantidad; i++) {
      const izq = i % 2 === 0;
      const ang = -azar(52, 84) * Math.PI / 180;                      // hacia arriba, algo abierto
      const v = azar(0.55, 1) * fuerza;
      ps.push({
        x: izq ? w * 0.04 : w * 0.96, y: h * 0.92,
        vx: Math.cos(ang) * v * (izq ? 1 : -1), vy: Math.sin(ang) * v,
        rot: azar(0, 6.28), vr: azar(-9, 9), aleteo: azar(6, 14),
        ancho: azar(6, 11), alto: azar(9, 16),
        color: paleta[(Math.random() * paleta.length) | 0],
        t: -azar(0, 0.25), vida: o.vida + azar(-0.4, 0.5)       // t negativo: salen escalonados
      });
    }
    if (!raf) raf = requestAnimationFrame(fotograma);
  }

  window.Confeti = { lanzar };
})();
