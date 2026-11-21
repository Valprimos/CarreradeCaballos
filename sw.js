/* Modo sin conexión. La versión se pone sola con `npm run version`: no la toques a mano. */
const VERSION = 'carrera-ccfbcd1f';
const NUCLEO = [
  "./",
  "index.html",
  "estilos.css?v=ccfbcd1f",
  "motor.js?v=ccfbcd1f",
  "util.js?v=ccfbcd1f",
  "datos.js?v=ccfbcd1f",
  "fichas.js?v=ccfbcd1f",
  "app.js?v=ccfbcd1f",
  "manifest.json",
  "favicon-32.png",
  "apple-touch-icon.png",
  "herradura.svg",
  "vendor/supabase.js",
  "config.js",
  "online.js?v=ccfbcd1f",
  "sonido.js?v=ccfbcd1f",
  "confeti.js?v=ccfbcd1f",
  "audio/galope1.mp3",
  "audio/galope2.mp3",
  "audio/galope3.mp3",
  "audio/galope4.mp3",
  "audio/galope5.mp3",
  "audio/relincho1.mp3",
  "audio/relincho2.mp3",
  "logo.svg",
  "social.png",
  "icons/icono-192.png",
  "icons/icono-512.png",
  "bastos/card_clubs_01.webp",
  "bastos/card_clubs_02.webp",
  "bastos/card_clubs_03.webp",
  "bastos/card_clubs_04.webp",
  "bastos/card_clubs_05.webp",
  "bastos/card_clubs_06.webp",
  "bastos/card_clubs_07.webp",
  "bastos/card_clubs_10.webp",
  "bastos/card_clubs_11.webp",
  "bastos/card_clubs_12.webp",
  "copas/card_cups_01.webp",
  "copas/card_cups_02.webp",
  "copas/card_cups_03.webp",
  "copas/card_cups_04.webp",
  "copas/card_cups_05.webp",
  "copas/card_cups_06.webp",
  "copas/card_cups_07.webp",
  "copas/card_cups_10.webp",
  "copas/card_cups_11.webp",
  "copas/card_cups_12.webp",
  "dorso/card_back.webp",
  "dorso/back_esmeralda.webp",
  "dorso/back_herraduras.webp",
  "dorso/back_noche.webp",
  "dorso/back_real.webp",
  "dorso/back_rombos.webp",
  "dorso/back_violeta.webp",
  "espadas/card_swords_01.webp",
  "espadas/card_swords_02.webp",
  "espadas/card_swords_03.webp",
  "espadas/card_swords_04.webp",
  "espadas/card_swords_05.webp",
  "espadas/card_swords_06.webp",
  "espadas/card_swords_07.webp",
  "espadas/card_swords_10.webp",
  "espadas/card_swords_11.webp",
  "espadas/card_swords_12.webp",
  "oros/card_coins_01.webp",
  "oros/card_coins_02.webp",
  "oros/card_coins_03.webp",
  "oros/card_coins_04.webp",
  "oros/card_coins_05.webp",
  "oros/card_coins_06.webp",
  "oros/card_coins_07.webp",
  "oros/card_coins_10.webp",
  "oros/card_coins_11.webp",
  "oros/card_coins_12.webp"
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(NUCLEO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range') || new URL(req.url).origin !== location.origin) return;   // el audio va directo a la red
  const esCodigo = req.mode === 'navigate' || /\.(html|js|css|json)$/.test(new URL(req.url).pathname);
  if (esCodigo) {
    // Primero la red, para que una versión nueva llegue enseguida; la caché es el respaldo sin conexión.
    e.respondWith(
      fetch(req).then(r => { const copia = r.clone(); caches.open(VERSION).then(c => c.put(req, copia)); return r; })
        .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
    );
  } else {
    // Las cartas no cambian: primero la caché.
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); return res;
    })));
  }
});
