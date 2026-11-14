# Lunar Landing Site Navigator — Investigación de tecnologías

> NASA Space Apps Challenge 2026 · Reto "CLPS Lunar Mission Browser"
> Objetivo: juego 3D interactivo donde el jugador es un robot que viaja entre sitios de aterrizaje del polo sur lunar. Cada sitio tiene un cartel que explica por qué es importante. El juego muestra las posiciones del Sol y la Tierra respecto al horizonte.

---

## Resumen

Usar **Python para precalcular los datos** (dónde están el Sol y la Tierra y la línea del horizonte de cada sitio) y un **juego web en Three.js** que solo lea esos archivos.

- No necesita servidor: todo es estático y se publica gratis en GitHub Pages o Netlify.
- Encaja con el stack del equipo (Python + HTML/CSS/JS).

---

## 1. Motor 3D (donde vive el robot)

| Opción | A favor | En contra | Veredicto |
|---|---|---|---|
| **Three.js** (+ Vite) | Es JavaScript puro y combina con HTML/CSS. Es el ecosistema más grande, tiene sombras en tiempo real y ya soporta WebGPU. | Las físicas y la interfaz las armamos nosotros. | ✅ **Recomendado** |
| Babylon.js | Es más "motor de juego": trae físicas (Havok), interfaz dentro del 3D e inspector. | La comunidad es más chica y hay menos ejemplos de terreno con datos reales. | Buena alternativa |
| React Three Fiber | Es Three.js con componentes de React. | Solo conviene si alguien del equipo ya domina React. | Opcional |
| Godot 4 (exportado a web) | Tiene editor visual y es fácil de usar para juegos. | Conectarlo con los datos de Python y con la interfaz web es más complicado, y el archivo exportado pesa más. | Solo si ya lo conocen |
| Unity WebGL | Es potente. | Es pesado, tarda en cargar en el navegador y es demasiado para un hackatón. | ❌ |

### Complementos para Three.js

- **Mover al robot sobre el terreno:**
  - Lo más simple es leer la altura del mapa en la posición del robot.
  - Si queremos choques y pendientes reales, podemos usar **Rapier** (`@dimforge/rapier3d-compat`), que tiene un tipo de terreno hecho para mapas de altura.
- **Modelo del robot:**
  - En [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources) hay modelos gratuitos de naves y rovers.
  - Hay que pasarlo por **Blender** y exportarlo como `.glb`.
  - Un robot sencillo hecho por nosotros también funciona.
- **Cartel explicativo:**
  - Ponerlo como texto HTML encima del 3D, con `CSS2DRenderer` o un panel normal con CSS. Así es más fácil de leer y de traducir.
  - Si queremos que el letrero esté "dentro" del mundo, usar **troika-three-text**.
- **Gráficas** (cómo cambia la altura del Sol y cuándo se ve la Tierra a lo largo del mes): **uPlot** o **Chart.js**.
- **Panel de controles** mientras desarrollamos: **lil-gui**.
- **Herramienta de build:** **Vite**.

---

## 2. Datos del terreno (lo que hace que se vea real)

- **Modelos de elevación LOLA del polo sur a 5 m por píxel**, del grupo PGDA de la NASA:
  - Son archivos GeoTIFF de las zonas de aterrizaje: [PGDA producto 78](https://pgda.gsfc.nasa.gov/products/78).
  - También hay un mosaico completo de 87°S a 90°S: [mosaico 87°S](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/) · [PGDA producto 81](https://pgda.gsfc.nasa.gov/products/81).
- **Cómo procesarlos en Python:**
  - Usar `rasterio` (o GDAL) y `numpy`.
  - Recortar una zona de unos 2 a 5 km alrededor de cada sitio.
  - Guardarla como PNG de 16 bits o como archivo binario.
  - En Three.js eso se convierte en un plano con relieve.
- **Para ver el horizonte lejano** (picos a decenas de km), sumar un anillo de baja resolución con el mosaico a 20–60 m por píxel.

---

## 3. Posición del Sol y de la Tierra

| Herramienta | Uso |
|---|---|
| **Skyfield (Python)** ✅ | Da la posición vista desde un punto de la superficie lunar, con la orientación real de la Luna (incluida su libración). Usa los archivos `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf` y `pck00008.tpc` ([documentación](https://rhodesmill.org/skyfield/planetary.html)). Da directamente la **elevación y el azimut del Sol y de la Tierra** para cualquier lat/lon y fecha. |
| SpiceyPy (SPICE de la NASA) | Es más precisa y es el estándar profesional, pero cuesta más configurarla. |
| JPL Horizons | Sirve para comprobar nuestros resultados contra una fuente oficial. |
| astronomy-engine (JS) | Existe por si quisiéramos calcular en el navegador ([npm](https://npmjs.com/package/astronomy-engine)), pero no trae de forma directa la posición vista desde la superficie lunar. Mejor precalcular en Python. |

---

## 4. El truco clave: la línea del horizonte de cada sitio

En el polo sur, el Sol y la Tierra se mueven **rozando el horizonte**, así que lo que de verdad importa es el relieve.

Para cada sitio:

1. Desde el punto de aterrizaje, revisar las **360 direcciones** (una por grado) y calcular el ángulo más alto del terreno en cada una.
   - Hay que incluir la curvatura de la Luna.
   - Como no hay atmósfera, no hace falta corregir por refracción.
   - Con `numba` o `numpy` sale en segundos.
2. El Sol se ve si su elevación es mayor que la del horizonte en su dirección. Lo mismo vale para la Tierra.
3. Con eso calculamos las métricas del reto:
   - Elevación del Sol.
   - % de horas con luz.
   - **Tiempo que falta para que se ponga el Sol o la Tierra.**
   - Ventanas de comunicación.

Guardar por cada sitio un JSON con: el perfil del horizonte, la serie de horas (Sol y Tierra) para el periodo elegido y el texto del cartel.

### Efecto visual

- La luz direccional se orienta según el Sol calculado, así que las **sombras reales del terreno aparecen solas**. Ese es el efecto "wow" para el jurado.
- La Tierra puede ser una esfera con textura colocada en su posición real del cielo.
- Cielo negro con estrellas, sin atmósfera.

---

## 5. Sitios para el selector

- **Artemis III**: las 9 regiones candidatas al sur, entre ellas Malapert Massif, Mons Mouton, Haworth, Nobile Rim y de Gerlache Rim 2 ([Space.com](https://www.space.com/space-exploration/artemis/nasa-announces-9-possible-moon-landing-sites-for-artemis-3-lunar-mission)).
- **CLPS reales**: IM-1 Odysseus (cerca de Malapert A) e IM-2 Athena (Mons Mouton).
- **Otros países**: Chandrayaan-3 (India, ~69°S).
- **Apolo 11 y 17** como contraste: cerca del ecuador el Sol sube alto y la Tierra queda casi fija sobre el horizonte. Eso explica muy bien al público por qué el polo es tan distinto.
- **Coordenadas personalizadas**: el usuario escribe lat/lon (opcional, requiere cálculo bajo demanda o una cuadrícula precalculada).

> Pendiente: verificar las coordenadas exactas de cada sitio en fuentes oficiales antes de precalcular.

---

## 6. Arquitectura propuesta

```
/data-pipeline (Python): rasterio + numpy/numba + Skyfield
   └─> genera /public/sites/<sitio>/
         ├─ terreno.bin        (mapa de altura recortado)
         ├─ horizonte.json     (360 ángulos del horizonte)
         ├─ efemerides.json    (Sol y Tierra: elevación/azimut por hora)
         └─ info.json          (nombre, coordenadas, texto del cartel)

/game (Vite + Three.js)
   ├─ escena: terreno, robot (.glb), Sol (luz + sombras), Tierra, estrellas
   ├─ HUD (HTML/CSS): fecha, línea de tiempo, cuenta regresiva al ocaso
   │                  o a que se oculte la Tierra
   ├─ cartel: info.json del sitio actual
   └─ comparador: dos sitios o dos fechas lado a lado (gráficas uPlot)

Despliegue: GitHub Pages / Netlify (todo estático)
```

### Dependencias

**Python**
```
rasterio  numpy  numba  skyfield
```

**JavaScript**
```
three  vite  @dimforge/rapier3d-compat (opcional)  troika-three-text (opcional)  uplot  lil-gui
```

---

## 7. Orden para un producto mínimo en hackatón

- [ ] 1. Hacer el pipeline en Python para **un sitio** (terreno + horizonte + efemérides de un mes).
- [ ] 2. Montar la escena en Three.js con el terreno y la luz solar movida por una línea de tiempo.
- [ ] 3. Agregar el robot con movimiento sobre el terreno y la cámara en tercera persona.
- [ ] 4. Añadir el selector de sitios y los carteles; luego escalar a 5–8 sitios.
- [ ] 5. Sumar el HUD de métricas y el comparador.
- [ ] 6. Pulir: animación del día lunar, sonido y pista de "esta zona tendrá luz X días".

---

## Fuentes

- [High-Resolution LOLA Topography for Lunar South Pole Sites (PGDA)](https://pgda.gsfc.nasa.gov/products/78)
- [South Pole LOLA DEM Mosaic (PGDA)](https://pgda.gsfc.nasa.gov/products/81)
- [5 m/pix LOLA DEM Mosaic 87–90°S](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/)
- [Skyfield – Planetary reference frames](https://rhodesmill.org/skyfield/planetary.html)
- [Astronomy Engine (npm)](https://npmjs.com/package/astronomy-engine)
- [Three.js WebGPURenderer manual](https://threejs.org/manual/en/webgpurenderer)
- [What's New in Three.js (2026)](https://www.utsubo.com/blog/threejs-2026-what-changed)
- [NASA 3D Resources (GitHub)](https://github.com/nasa/NASA-3D-Resources)
- [NASA announces 9 possible Artemis 3 landing regions (Space.com)](https://www.space.com/space-exploration/artemis/nasa-announces-9-possible-moon-landing-sites-for-artemis-3-lunar-mission)
