# Moon Insight 153 — Investigación de tecnologías

> NASA Space Apps Challenge 2026 · Reto "CLPS Lunar Mission Browser"
> Objetivo: una plataforma web que ayuda a elegir un sitio y una fecha de aterrizaje en el polo sur lunar, y un juego 3D en el que el jugador conduce un rover por cada sitio. Muestra las posiciones del Sol y la Tierra respecto al horizonte real del terreno.

> **Nota de revisión (2026-11-15).** Este documento es la investigación original del equipo. Se revisó para que coincida con el proyecto actual: lo que se evaluó pero **no** se adoptó (Astronomy Engine, WebGPURenderer, el mosaico 87–90° S, la validación cruzada con QuickMap) está marcado como tal. El estado completo y vigente está en el [README](README.md).

## El problema

El problema consiste en seleccionar un sitio de aterrizaje en el polo sur de la Luna, ya que la oscuridad prolongada y la pérdida de visión con la Tierra suponen un desafío crítico.

## La solución

Nuestra solución es una plataforma web interactiva diseñada para evaluar, simular y comparar la viabilidad de sitios de aterrizaje lunares: dado un sitio y una fecha, calcula en el navegador la luz solar y la visibilidad de la Tierra contra el horizonte real del terreno, y deja explorar el lugar en 3D.

El proyecto se justifica en la necesidad de una herramienta computacional interactiva que facilite la evaluación de la viabilidad operativa (iluminación, oscuridad máxima y continuidad de comunicaciones) para ingenieros y planificadores de misiones, y que sirva también a un público general.

## Datos de terreno

* Se usan los modelos de elevación LOLA de alta resolución para los sitios del polo sur (5 m/píxel, un DEM por sitio) del Planetary Data System / PGDA ([producto 78](https://pgda.gsfc.nasa.gov/products/78)). Permiten evaluar micro-relieves, pendientes de crestas y obstáculos locales que podrían comprometer la estabilidad de un rover. Solo Connecting Ridge y Shackleton Rim están dentro de 87–90° S; Haworth, Malapert y Nobile Rim 1 quedan fuera. Por eso se usa el recorte de 5 m de cada sitio y no el mosaico de 87–90° S, que se evaluó pero no cubre esos tres.
* Para el horizonte lejano se combina cada DEM local con el DEM LOLA regional de 80 m/píxel de 80–90° S ([producto 90](https://pgda.gsfc.nasa.gov/products/90)).
* **LROC QuickMap** se consultó como sistema cartográfico de referencia, pero no se hizo una validación cruzada sistemática de las sombras con él. Las imágenes LROC se usan de otra forma: el mosaico NAC del polo sur aporta un mapa de tonos al suelo de cuatro sitios (ver el README).

## Posición del Sol y de la Tierra

La viabilidad temporal de un sitio depende de las posiciones relativas entre la Luna, la Tierra y el Sol. Para no depender de aproximaciones empíricas, las posiciones se calculan con estándares científicos y se validan:

* **Skyfield (Python)** con los kernels SPICE de NAIF/JPL (`de421.bsp`, `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf`, `pck00008.tpc`): marcos de referencia planetarios, libración real y elevación/acimut del Sol y de la Tierra desde el punto del sitio. Se calcula **una vez**, offline, cada hora de 2026 a 2030, y se guarda como `ephemeris.bin`.
* **Validación contra JPL Horizons:** diferencias por debajo de 0,0005° (ver `data-pipeline/VALIDATION.md`).
* **Astronomy Engine (npm):** se evaluó como alternativa para calcular en el navegador, pero **no se usa**: no da directamente la posición vista desde la superficie lunar. El navegador no calcula efemérides; calcula visibilidad, cuentas atrás, porcentajes y mejores ventanas con código propio sobre los datos precalculados.

## Modelos, imágenes y texturas

Se usan activos oficiales de la NASA, siempre con su atribución (ver `web/public/models/README.md`, `web/public/textures/README.md` y la tabla de créditos del README):

* **Rover:** *Mars 2020 Perseverance Rover* (NASA 3D Resources, GLB), como referencia visual de rover de seis ruedas.
* **Módulo de aterrizaje:** *Apollo Lunar Module* (NASA 3D Resources, GLB), como referencia visual de «un módulo de aterrizaje».
* **Tierra:** *Blue Marble: Next Generation* (NASA Earth Observatory), con el océano recoloreado y nubes procedurales.
* **Suelo:** mosaico LROC NAC del polo sur (vistas previas), en cuatro sitios.

`images.nasa.gov` se consultó como fuente de imágenes, pero no se usa ninguna de ese archivo. No encontramos un modelo del Lunar Roving Vehicle en GLB en el espejo de GitHub de NASA 3D Resources.

## Motor gráfico

El 3D usa **Three.js** (con Vite) y su `WebGLRenderer`: terreno LOLA con sombras en tiempo real, estrellas, la Tierra y el rover. El **WebGPURenderer** se estudió (ver los enlaces de abajo), pero no se adoptó: WebGL fue suficiente para este terreno. Las gráficas del panel usan **uPlot**.

---

## Fuentes

Usadas en el proyecto:

* [High-Resolution LOLA Topography for Lunar South Pole Sites (PGDA)](https://pgda.gsfc.nasa.gov/products/78)
* [Regional LOLA DEM 80 m/pix, 80–90° S (PGDA)](https://pgda.gsfc.nasa.gov/products/90)
* [Skyfield – Planetary reference frames](https://rhodesmill.org/skyfield/planetary.html)
* [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html)
* [NASA 3D Resources (GitHub)](https://github.com/nasa/NASA-3D-Resources)
* [Blue Marble: Next Generation (NASA Earth Observatory)](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/)
* [Mosaico LROC NAC del polo sur](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_POLE_SOUTH)
* [NASA announces 9 possible Artemis 3 landing regions (Space.com)](https://www.space.com/space-exploration/artemis/nasa-announces-9-possible-moon-landing-sites-for-artemis-3-lunar-mission)

Consultadas y no adoptadas:

* [South Pole LOLA DEM Mosaic (PGDA)](https://pgda.gsfc.nasa.gov/products/81)
* [5 m/pix LOLA DEM Mosaic 87–90° S](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/)
* [Astronomy Engine (npm)](https://npmjs.com/package/astronomy-engine)
* [Three.js WebGPURenderer manual](https://threejs.org/manual/en/webgpurenderer)
* [What's New in Three.js (2026)](https://www.utsubo.com/blog/threejs-2026-what-changed)
* [NASA Images](https://images.nasa.gov/)
* [LROC QuickMap](https://quickmap.lroc.im-ldi.com/)
