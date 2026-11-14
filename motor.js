/*
 * Motor de la carrera de caballos con baraja española.
 *
 * No toca el DOM: solo reglas, así que se puede probar con Node
 * (`node --test`) y la interfaz (app.js) se limita a animar lo que
 * este fichero decide.
 *
 * Reglas (portadas de la versión Flutter de Danielgrs18):
 *  - Los caballos (el 11 de cada palo) salen de la baraja y corren.
 *  - Con el resto, ya barajado, se tienden `pasos` cartas boca abajo
 *    (la pista); lo que queda es el mazo.
 *  - Cada carta que se destapa avanza al caballo de su palo.
 *  - Cuando todos los caballos han dejado atrás un paso, su carta se
 *    levanta y el caballo de ese palo retrocede una casilla.
 *  - Gana quien cruza la meta (un paso más allá de la última carta).
 *  - La carrera puede seguir para repartir los demás puestos.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Motor = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PALOS = [
    { id: 'oros',    nombre: 'Oros',    archivo: 'coins',  color: '#f2c230' },
    { id: 'copas',   nombre: 'Copas',   archivo: 'cups',   color: '#ff6a5c' },
    { id: 'espadas', nombre: 'Espadas', archivo: 'swords', color: '#5aa2ff' },
    { id: 'bastos',  nombre: 'Bastos',  archivo: 'clubs',  color: '#5fd068' }
  ];
  const IDS = PALOS.map(p => p.id);
  const VALORES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
  const NOMBRE_VALOR = { 1: 'As', 10: 'Sota', 11: 'Caballo', 12: 'Rey' };

  const LIMITES = {
    pasos: { min: 2, max: 12, defecto: 6 },
    rondas: { min: 2, max: 10, defecto: 3 },
    jugadores: { min: 1, max: 6 }
  };

  const MODALIDADES = [
    { id: 'rapida',        nombre: 'Partida rápida' },
    { id: 'uno',           nombre: '1 contra 1' },
    { id: 'personalizada', nombre: 'Partida personalizada' },
    { id: 'campeonato',    nombre: 'Campeonato' }
  ];

  const paloDe = id => PALOS.find(p => p.id === id);
  const nombreCarta = c =>
    `${NOMBRE_VALOR[c.valor] || c.valor} de ${paloDe(c.palo).nombre.toLowerCase()}`;

  /* ---------- Aleatoriedad con semilla (mulberry32) ---------- */

  function crearRng(semilla) {
    let a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function barajar(lista, rng) {
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    return lista;
  }

  /* ---------- La carrera ---------- */

  class Carrera {
    /**
     * @param {object} o
     * @param {number} o.pasos  cartas de la pista (2..12)
     * @param {string[]} o.palos palos que corren (2 o más, sin repetir)
     * @param {function} o.rng  generador en [0,1)
     */
    constructor({ pasos = LIMITES.pasos.defecto, palos = IDS, rng = Math.random } = {}) {
      if (!(pasos >= 1 && pasos <= 20)) throw new RangeError('La pista debe tener entre 1 y 20 pasos');
      if (palos.length < 2) throw new RangeError('Hacen falta al menos 2 caballos');
      if (new Set(palos).size !== palos.length) throw new RangeError('Los palos no pueden repetirse');

      this.pasos = pasos;
      this.palos = [...palos];
      this.rng = rng;
      this.pos = Object.fromEntries(this.palos.map(p => [p, 0]));

      const baraja = [];
      for (const palo of this.palos) {
        for (const valor of VALORES) if (valor !== 11) baraja.push({ palo, valor });
      }
      barajar(baraja, rng);
      this.cartasPista = baraja.splice(0, pasos);
      this.mazo = baraja;
      this.descartes = [];
      this.pasosLevantados = 0;
      this.clasificacion = [];
    }

    get meta() { return this.pasos + 1; }
    get ultimaCarta() { return this.descartes.length ? this.descartes[this.descartes.length - 1] : null; }
    get ganador() { return this.clasificacion.length ? this.clasificacion[0] : null; }
    haLlegado(palo) { return this.pos[palo] >= this.meta; }

    /** Un caballo solo avanza si le queda alguna carta suya en el mazo o los descartes. */
    puedeAvanzar(palo) {
      return this.mazo.some(c => c.palo === palo) || this.descartes.some(c => c.palo === palo);
    }
    get enCarrera() { return this.palos.filter(p => !this.haLlegado(p) && this.puedeAvanzar(p)); }
    get descolgados() { return this.palos.filter(p => !this.haLlegado(p) && !this.puedeAvanzar(p)); }
    get agotada() { return this.enCarrera.length === 0; }
    get pasoComunSuperado() { return Math.min(...this.palos.map(p => this.pos[p])); }

    /** Destapa la siguiente carta y aplica sus efectos. */
    jugarTurno() {
      if (this.agotada) throw new Error('La carrera ya no da más de sí');

      let mazoReciclado = false;
      if (this.mazo.length === 0) {
        this.mazo = barajar([...this.descartes], this.rng);
        this.descartes = [];
        mazoReciclado = true;
      }
      const carta = this.mazo.pop();
      this.descartes.push(carta);

      let avanza = null, llegada = null;
      if (!this.haLlegado(carta.palo)) {
        avanza = carta.palo;
        this.pos[carta.palo]++;
        if (this.haLlegado(carta.palo)) {
          this.clasificacion.push(carta.palo);
          llegada = carta.palo;
        }
      }
      const posTrasAvance = { ...this.pos };
      const revelaciones = this._levantarPasos();

      return {
        carta, avanza, llegada, mazoReciclado, posTrasAvance, revelaciones,
        ganador: this.clasificacion.length === 1 ? llegada : null,
        agotada: this.agotada
      };
    }

    _levantarPasos() {
      const reveladas = [];
      while (this.pasosLevantados < this.pasos &&
             this.pasoComunSuperado >= this.pasosLevantados + 1) {
        const carta = this.cartasPista[this.pasosLevantados];
        this.pasosLevantados++;
        let retrocede = null;
        // A quien ya cruzó la meta no se le hace retroceder: su puesto está dado.
        if (!this.haLlegado(carta.palo)) {
          this.pos[carta.palo] = Math.max(0, this.pos[carta.palo] - 1);
          retrocede = carta.palo;
        }
        reveladas.push({ paso: this.pasosLevantados, carta, retrocede, posDespues: { ...this.pos } });
      }
      return reveladas;
    }
  }

  /* ---------- Campeonato ---------- */

  class Campeonato {
    /** @param {{rondas:number, jugadores:{nombre:string,palo:string}[]}} o */
    constructor({ rondas, jugadores }) {
      if (rondas < 1) throw new RangeError('Un campeonato necesita al menos una ronda');
      this.rondas = rondas;
      this.jugadores = jugadores;
      this.rondasCorridas = [];
    }

    get terminado() { return this.rondasCorridas.length >= this.rondas; }
    get rondaActual() { return this.terminado ? this.rondas : this.rondasCorridas.length + 1; }

    /** El primero se lleva tantos puntos como caballos haya; quien no llega no puntúa. */
    static repartir(carrera) {
      const total = carrera.palos.length;
      const puntos = Object.fromEntries(carrera.palos.map(p => [p, 0]));
      carrera.clasificacion.forEach((palo, i) => { puntos[palo] = total - i; });
      return puntos;
    }

    anotar(carrera) {
      if (this.terminado) throw new Error('El campeonato ya ha acabado');
      this.rondasCorridas.push(Campeonato.repartir(carrera));
    }

    get ultimaRonda() { return this.rondasCorridas.length ? this.rondasCorridas[this.rondasCorridas.length - 1] : {}; }

    get puntosPorPalo() {
      const total = {};
      for (const ronda of this.rondasCorridas) {
        for (const [palo, pts] of Object.entries(ronda)) total[palo] = (total[palo] || 0) + pts;
      }
      return total;
    }

    puntosDe(j) { return this.puntosPorPalo[j.palo] || 0; }

    /** Jugadores de más a menos puntos (estable: empatados mantienen su orden). */
    get clasificacion() {
      return this.jugadores
        .map((j, i) => ({ j, i, p: this.puntosDe(j) }))
        .sort((a, b) => b.p - a.p || a.i - b.i)
        .map(x => x.j);
    }

    get campeones() {
      if (!this.jugadores.length) return [];
      const mejor = Math.max(...this.jugadores.map(j => this.puntosDe(j)));
      return this.jugadores.filter(j => this.puntosDe(j) === mejor);
    }
  }

  /* ---------- Salas por código (sin servidor) ----------
   *
   * El código es la mesa + la semilla: dos dispositivos con el mismo código
   * sacan las cartas en el mismo orden y llegan al mismo ganador.
   *
   *    36359J7D
   *    ││└─────┴─ semilla (33 millones de carreras por configuración)
   *    │└─ largo de la pista
   *    └─ a qué se juega
   *
   * El tercer dígito cambia de sentido: en el 1 contra 1 guarda qué dos
   * palos corren; en el campeonato, cuántas rondas; en el resto es 0.
   * Base 32 de Crockford (sin I, L, O ni U). El orden de MODALIDADES y de
   * PALOS NO se toca: cambiaría el sentido de los códigos ya apuntados.
   */
  const DIGITOS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const LARGO_SEMILLA = 5;
  const LIMITE_SEMILLA = Math.pow(32, LARGO_SEMILLA);
  const LARGO_CODIGO = 3 + LARGO_SEMILLA;

  const aBase32 = (valor, largo) => {
    let s = '';
    for (let i = 0; i < largo; i++) { s = DIGITOS[valor % 32] + s; valor = Math.floor(valor / 32); }
    return s;
  };
  const deBase32 = texto => {
    let v = 0;
    for (const c of texto) {
      const i = DIGITOS.indexOf(c);
      if (i < 0) return null;
      v = v * 32 + i;
    }
    return v;
  };

  const indiceDelPar = ([a, b]) => {
    const ia = IDS.indexOf(a), ib = IDS.indexOf(b);
    return ia * 3 + (ib > ia ? ib - 1 : ib);
  };
  const parDelIndice = i => {
    if (i < 0 || i >= 12) return null;
    const a = Math.floor(i / 3), resto = i % 3;
    const b = resto >= a ? resto + 1 : resto;
    return [IDS[a], IDS[b]];
  };

  function nuevaSala({ modalidad = 'rapida', pasos = LIMITES.pasos.defecto,
                       rondas = LIMITES.rondas.defecto, palos = ['oros', 'copas'],
                       rng = Math.random, slot = null } = {}) {
    const s = { modalidad, pasos, rondas, palos, semilla: Math.floor(rng() * LIMITE_SEMILLA) };
    if (slot != null) s.slot = slot;
    return s;
  }

  function codigoSala(s) {
    const extra = s.modalidad === 'uno' ? indiceDelPar(s.palos)
                : s.modalidad === 'campeonato' ? s.rondas : 0;
    return aBase32(MODALIDADES.findIndex(m => m.id === s.modalidad), 1) +
           aBase32(s.pasos, 1) + aBase32(extra, 1) + aBase32(s.semilla, LARGO_SEMILLA) +
           (s.slot != null ? aBase32(s.slot, 2) : '');
  }

  /** Lee un código tecleado o pegado; null si no es válido. */
  function leerCodigo(texto) {
    const limpio = String(texto || '').toUpperCase()
      .replace(/[^0-9A-Z]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
    if (limpio.length !== LARGO_CODIGO && limpio.length !== LARGO_CODIGO + 2) return null;

    const im = deBase32(limpio[0]), pasos = deBase32(limpio[1]),
          extra = deBase32(limpio[2]), semilla = deBase32(limpio.slice(3, LARGO_CODIGO)),
          slot = limpio.length > LARGO_CODIGO ? deBase32(limpio.slice(LARGO_CODIGO)) : null;
    if (limpio.length > LARGO_CODIGO && slot === null) return null;
    if ([im, pasos, extra, semilla].includes(null)) return null;
    if (im >= MODALIDADES.length) return null;
    if (pasos < LIMITES.pasos.min || pasos > LIMITES.pasos.max) return null;

    const modalidad = MODALIDADES[im].id;
    let rondas = LIMITES.rondas.defecto, palos = ['oros', 'copas'];
    if (modalidad === 'uno') {
      palos = parDelIndice(extra);
      if (!palos) return null;
    } else if (modalidad === 'campeonato') {
      if (extra < LIMITES.rondas.min || extra > LIMITES.rondas.max) return null;
      rondas = extra;
    } else if (extra !== 0) return null;

    const sala = { modalidad, pasos, rondas, palos, semilla };
    if (slot !== null) sala.slot = slot;
    return sala;
  }

  /** Semilla de la ronda indicada (desde 0): distintas entre sí, iguales para todos. */
  const semillaDeRonda = (sala, ronda = 0) => (sala.semilla + ronda * 7919) >>> 0;

  /** Palos que corren de verdad en una modalidad. */
  const palosEnCarrera = (modalidad, par) => (modalidad === 'uno' ? par : IDS);

  /* ---------- Salas en vivo: todos los móviles siguen el mismo reloj ----------
   * El código lleva 2 dígitos más con la hora de salida (en tramos de 2 minutos).
   * La carrera es determinista, así que cada móvil sabe a qué hora exacta sale
   * cada carta y todos la ven a la vez, sin servidor. */
  const EPOCA = Date.UTC(2026, 0, 1), TRAMO = 120000, N_TRAMOS = 1024;
  const slotDe = ms => Math.floor((ms - EPOCA) / TRAMO) % N_TRAMOS;
  const inicioDeSlot = (slot, ahora) => {
    const ciclo = N_TRAMOS * TRAMO, base = EPOCA + slot * TRAMO;
    return base + Math.round((ahora - base) / ciclo) * ciclo;
  };
  /** Momento de salida de cada carta (ms desde el inicio) y duración total. F = factor de ritmo. */
  function planCarrera(sala, ronda, F = 1.4) {
    const c = new Carrera({ pasos: sala.pasos, palos: palosEnCarrera(sala.modalidad, sala.palos), rng: crearRng(semillaDeRonda(sala, ronda)) });
    const inicios = []; let acc = 0;
    while (!c.agotada) { const r = c.jugarTurno(); inicios.push(acc); acc += (2350 + 1600 * r.revelaciones.length) * F; }
    return { inicios, total: acc };
  }
  /** La siguiente carrera sale en el próximo minuto en punto, 25 s después de acabar. */
  const siguienteInicio = fin => Math.ceil((fin + 25000) / 60000) * 60000;

  return {
    PALOS, IDS, VALORES, LIMITES, MODALIDADES, NOMBRE_VALOR,
    paloDe, nombreCarta, crearRng, barajar,
    Carrera, Campeonato,
    nuevaSala, codigoSala, leerCodigo, semillaDeRonda, palosEnCarrera,
    slotDe, inicioDeSlot, planCarrera, siguienteInicio
  };
});
