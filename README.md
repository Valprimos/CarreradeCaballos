# Carrera de caballos con baraja española

Juego de cartas para navegador. **Sin dependencias ni compilación**: HTML, CSS y JavaScript
normales más las ilustraciones de la baraja. Se publica tal cual en GitHub Pages.

Es la fusión de dos versiones:

- la web ligera de este repositorio (cartas ilustradas reales, volteo, apuestas con fichas), y
- la app Flutter de [Danielgrs18/CarreraDeCaballos](https://github.com/Danielgrs18/CarreraDeCaballos)
  (reglas completas, modos de juego, campeonato, salas por código, personalización).

## Cómo se juega

- Los caballos (el 11 de cada palo) salen de la baraja y corren.
- Con el resto, ya barajado, se tienden **boca abajo** las cartas de la pista (6 por defecto); lo demás es el mazo.
- Cada carta que sale hace **avanzar un paso** al caballo de su palo.
- En cuanto todos los caballos han dejado atrás un paso, se **levanta su carta** y el caballo de ese palo **retrocede una casilla**.
- Gana el primero en cruzar la meta, un paso más allá de la última carta. La carrera puede seguir para repartir
  los demás puestos, hasta que nadie pueda avanzar (un caballo sin cartas vivas queda parado y sale como «No llegó»).

## Qué trae cada versión

| | Web Valprimos | App Flutter de Daniel | Esta fusión |
|---|---|---|---|
| Cartas | Ilustradas (WebP/SVG) | Dibujadas con código | Ilustradas, con volteo |
| Apuestas con fichas | Sí | No | Sí (el palo ganador paga el triple) |
| Modos | Una carrera | Rápida, 1 contra 1, personalizada, campeonato | Los cuatro |
| Pista | 5, 7 o 10 | 2 a 12 | 2 a 12 |
| Seguir hasta que lleguen todos / clasificación | No | Sí | Sí |
| Campeonato por rondas con puntos | No | Sí | Sí (2 a 10 rondas) |
| Salas por código o enlace, sin servidor | No | Sí | Sí |
| Paño (4) y dorso (4) | No | Sí | Sí |
| Ajustes (vibración, pantalla encendida) | No | Sí | Sí |
| Automático con 3 velocidades | Sí | Sí | Sí |
| Crónica de la carrera | Sí | No | Sí |
| Confirmar antes de salir de una carrera | No | Sí | Sí |
| Funciona sin conexión (PWA) | No | Parcial | Sí |
| Tarjeta al compartir el enlace | No | Sí | Sí |
| Compilación | Ninguna | Flutter + Actions | Ninguna |

## Modos

- **Partida rápida**: los cuatro caballos, pista de 6 pasos, apuestas.
- **1 contra 1**: dos jugadores y dos palos; solo corren esos dos caballos y solo se juega con sus cartas.
- **Partida personalizada**: pista de 2 a 12 pasos y hasta 6 jugadores (los palos pueden repetirse).
- **Campeonato**: de 2 a 10 rondas. Cada ronda se corre entera y el primero se lleva tantos puntos como caballos haya.
  Gana quien más puntos sume; si hay empate arriba se cantan todos.

## Jugar con amigos (sin servidor)

La carrera está determinada por completo por la mesa y una semilla, así que basta con compartir un código para
que varios móviles vean **la misma carrera**, carta por carta y con el mismo ganador.

```
   36359J7D
   ││└─────┴─ semilla (33 millones de carreras por configuración)
   │└─ largo de la pista
   └─ a qué se juega
```

El tercer dígito cambia de sentido: en el 1 contra 1 guarda qué dos palos corren; en el campeonato, cuántas rondas.
Va en base 32 de Crockford (sin I, L, O ni U); al leerlo se perdonan minúsculas, espacios, guiones y la I/L por 1 y la O por 0.
Se comparte como código o como enlace `...?sala=36359J7D`. Cada uno pone su nombre y elige su palo en su propio móvil.
Pedir otra partida crea una **sala nueva** (código nuevo): repetir el mismo daría exactamente el mismo resultado.

Lo que no se comparte es quién se ha unido ni qué palo ha elegido cada uno: para eso haría falta un servidor.

> Los códigos de esta web y los de la app Flutter no son intercambiables: usan generadores de azar distintos.

## Estructura

```
index.html      Páginas (menú, amigos, personalizar, preparar mesa y juego) y diálogos
estilos.css     Tema oscuro de alto contraste; paño y dorso por variables CSS
motor.js        Reglas, campeonato y códigos de sala. Sin DOM: se prueba con Node
app.js          Interfaz y animaciones
sw.js           Modo sin conexión (sube VERSION al cambiar cualquier fichero)
manifest.json   Instalable como app
oros/ copas/ espadas/ bastos/ dorso/   Cartas (WebP para jugar, SVG originales)
test/           Pruebas del motor
```

`motor.js` no sabe nada de la pantalla y `app.js` no decide ninguna regla: solo anima lo que le devuelve
`Carrera.jugarTurno()`.

## Pruebas

```bash
npm test      # o: node --test
```

Cubren las reglas (pasos que se levantan, retrocesos, mazo reciclado, caballos parados), el campeonato y los
códigos de sala (ida y vuelta de todos los modos y de los 12 pares de palos, códigos inválidos, tolerancia al teclearlos).

## Publicación

Sube todo a un repositorio y activa GitHub Pages (Settings > Pages > rama `main`, carpeta `/ (root)`).
`og:url`, `og:image` y `canonical` de `index.html` y el texto de `sw.js`/`manifest.json` llevan el dominio
`valprimos.github.io/CarreradeCaballos`: si cambia, hay que tocarlos ahí (y en `baseUrl()` de `app.js`).

## Créditos

Ilustraciones de las cartas de [Basquetteur](https://commons.wikimedia.org/wiki/User:Basquetteur) (Wikimedia Commons),
en la versión SVG de [spanish-playing-cards-svg](https://github.com/gjenkins20/spanish-playing-cards-svg),
bajo licencia [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

Las imágenes se han adaptado para utilizar únicamente una baraja de 40 cartas (sin ochos ni nueves). Las ilustraciones
no se han modificado: el juego muestra versiones WebP renderizadas desde los SVG originales (incluidos en cada carpeta).
Los dorsos de colores se obtienen con un filtro de color en pantalla.

Reglas, modos, campeonato y salas por código: versión Flutter de [Danielgrs18](https://github.com/Danielgrs18/CarreraDeCaballos).
