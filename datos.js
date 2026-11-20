/* Datos fijos de la interfaz: paños, dorsos y textos de cada modo. Solo datos, sin lógica. */
(function (raiz) {
  'use strict';

  // Paños: color, textura y nombre. Las texturas son degradados CSS (sin imágenes).
  const TEX = {
    fieltro: 'repeating-linear-gradient(45deg,rgba(255,255,255,.022) 0 1px,transparent 1px 4px),repeating-linear-gradient(-45deg,rgba(0,0,0,.06) 0 1px,transparent 1px 4px)',
    liso: 'linear-gradient(rgba(255,255,255,.015),rgba(255,255,255,.015))',
    rombos: 'linear-gradient(45deg,rgba(255,255,255,.05) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.05) 75%) 0 0/34px 34px,linear-gradient(45deg,rgba(255,255,255,.05) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.05) 75%) 17px 17px/34px 34px',
    puntos: 'radial-gradient(rgba(255,255,255,.09) 1.2px,transparent 1.8px) 0 0/18px 18px'
  };
  const PANOS = {
    verde:     { n: 'Verde casino', c: '#177A4B', m: '#0E5A38', o: '#04261a', l: '#3f9a72', t: 'fieltro' },
    burdeos:   { n: 'Burdeos',      c: '#8a2535', m: '#5A1522', o: '#26060d', l: '#b5586a', t: 'fieltro' },
    azul:      { n: 'Azul noche',   c: '#1f6290', m: '#123C57', o: '#06182a', l: '#4a93bd', t: 'fieltro' },
    grafito:   { n: 'Grafito',      c: '#4a545a', m: '#262C30', o: '#0b0e10', l: '#7d8a91', t: 'liso' },
    esmeralda: { n: 'Esmeralda',    c: '#0f8f6a', m: '#0a6a50', o: '#02261d', l: '#3fc9a0', t: 'rombos' },
    violeta:   { n: 'Violeta',      c: '#6a3fb0', m: '#45257a', o: '#150a2e', l: '#9b78e0', t: 'puntos' },
    oro:       { n: 'Negro y oro',  c: '#3a3016', m: '#1b170a', o: '#070604', l: '#d9a93a', t: 'rombos' },
    oceano:    { n: 'Océano',       c: '#12808f', m: '#0c5866', o: '#031c22', l: '#4fc3d6', t: 'puntos' }
  };
  // Dorsos: los dos primeros usan el dibujo original (el granate lo tiñe un filtro); el resto son diseños propios.
  const DORSOS = {
    indigo:     { n: 'Índigo',      src: 'dorso/card_back.webp',       f: 'none' },
    granate:    { n: 'Granate',     src: 'dorso/card_back.webp',       f: 'hue-rotate(125deg) saturate(1.6)' },
    rombos:     { n: 'Rombos',      src: 'dorso/back_rombos.webp',     f: 'none' },
    real:       { n: 'Real',        src: 'dorso/back_real.webp',       f: 'none' },
    noche:      { n: 'Negro y oro', src: 'dorso/back_noche.webp',      f: 'none' },
    herraduras: { n: 'Herraduras',  src: 'dorso/back_herraduras.webp', f: 'none' },
    esmeralda:  { n: 'Esmeralda',   src: 'dorso/back_esmeralda.webp',  f: 'none' },
    violeta:    { n: 'Violeta',     src: 'dorso/back_violeta.webp',    f: 'none' }
  };

  const MODOS = {
    rapida: {
      nombre: 'Partida rápida',
      reglas: 'Corren los cuatro caballos por una pista de 6 pasos. Sin jugadores ni apuestas: elige manual o automático y a correr.'
    },
    uno: {
      nombre: '1 contra 1',
      reglas: 'Dos jugadores, dos palos, dos caballos. Gana el palo que cruce primero la meta.'
    },
    personalizada: {
      nombre: 'Partida personalizada',
      reglas: 'Corren los cuatro caballos y tú decides el largo de la pista. Los jugadores y las apuestas son opcionales: puedes mirar la carrera sin apostar.'
    },
    campeonato: {
      nombre: 'Campeonato',
      reglas: 'Varias carreras seguidas. Cada una se corre entera y reparte puntos por puesto: el primero, tantos como caballos corran. Gana quien más puntos sume.'
    }
  };

  raiz.Datos = { TEX, PANOS, DORSOS, MODOS };
})(window);
