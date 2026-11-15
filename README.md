# Lunar Landing Site Navigator

Herramienta web para evaluar un sitio y una fecha de aterrizaje en el polo sur lunar, y un pequeño juego 3D para recorrer esos sitios. Proyecto para el NASA Space Apps Challenge 2026 (reto "CLPS Lunar Mission Browser").

Responde a la pregunta de planificación —¿qué sitio y qué fecha dan mejor luz y mejor visibilidad de la Tierra?— con la posición del Sol y de la Tierra respecto al **horizonte real del terreno**, y deja explorar el lugar en 3D con un rover.

## Qué incluye

- **Interfaz tipo reproductor:** la escena 3D ocupa toda la pantalla; arriba, el nombre, el idioma, cuatro botones de la vista y un menú; abajo, un reproductor del tiempo simulado. El planificador (métricas, gráfica, umbrales y comparación) es un cajón oculto que se abre desde el menú.
- **Planificador:** elevación del Sol y de la Tierra, tiempo hasta el ocaso solar y terrestre (con la fecha cuando falta un mes o más), % de luz, racha de luz continua más larga, noche más larga, mayor hueco sin Tierra, y un semáforo de viabilidad con umbrales editables. Gráfica de elevación con cursor arrastrable y modo **Comparar** (dos escenarios lado a lado).
- **Ventana de Análisis:** mejores ventanas de aterrizaje de 2026 a 2030, calendario de luz, gráfico polar del cielo y comparación de los cinco sitios con exportación a CSV.
- **Escena 3D:** terreno LOLA real de 5 m con sombras reales, un rover NASA que se conduce hasta el módulo de aterrizaje del sitio, señales con datos del lugar, una Tierra con imagen NASA que gira con la hora, polvo con gravedad lunar y, en cuatro sitios, un mapa de tonos de imágenes LROC.
- **Cinco sitios con datos reales:** Connecting Ridge (Site 01), Shackleton Rim (Site 04), Nobile Rim 1 (Site 06), Haworth y Malapert Massif (Site 23).
- **Español e inglés**, todo estático y sin servidor, y funciona sin conexión (la página no hace peticiones a terceros; una prueba lo vigila).

## Estado del proyecto

Hitos del [diseño](docs/superpowers/specs/2026-11-14-lunar-navigator-design.md):

| Hito | Contenido | Estado |
|---|---|---|
| M0 | Pipeline de datos (horizonte, efemérides, terreno) con validación contra JPL Horizons | Hecho |
| M1 | Panel con datos reales, línea de tiempo y comparación | Hecho |
| M2 | Escena 3D con terreno, Sol, Tierra, rover y cartel | Hecho |
| M3 | Cinco regiones con horizonte lejano | Hecho |
| M4 | Animación, sonido, textos, accesibilidad, README con fuentes y límites | Hecho |
| Extras | Ventana de Análisis, señales y datos por sitio, módulo y rocas, Tierra NASA, polvo, mapa de tonos LROC | Hecho |

Pendiente o por decidir: ver [Ideas y pendiente](#ideas-y-pendiente).

## Cómo funciona

```
data-pipeline/ (Python, se ejecuta una vez)       web/public/sites/<id>/                 web/ (JS, calcula en el navegador)
  DEM LOLA + Skyfield/SPICE            ->           ephemeris.bin · horizon.json    ->     métricas, panel, escena 3D
  DEM LOLA (recorte de 5 km)           ->           terrain.bin · info.json · start.json (npm run plan-starts)
  mosaico LROC NAC (vistas previas)    ->           albedo.bin (cuatro sitios)
```

- **No hay servidor.** Al arrancar se descargan solo las efemérides y el horizonte de los cinco sitios (~0,7 MB cada uno) y el terreno del primero. El terreno de cada sitio (`terrain.bin`, 2 MB, más `albedo.bin`, 1 MB, si lo tiene, y `start.json`, unos 200 bytes) se pide la primera vez que se elige.
- **Activos locales:** las fuentes (Barlow, Barlow Condensed e IBM Plex Mono, licencia OFL), los modelos 3D (`web/public/models/`), el decodificador Draco (`web/public/draco/`) y la imagen de la Tierra (`web/public/textures/`) van incluidos, así que no hay peticiones a terceros.
- **Qué se calcula dónde:** Python precalcula posiciones (Skyfield) y horizonte (a partir del DEM); el navegador calcula visibilidad, cuentas atrás, porcentajes, mejores ventanas y veredictos. No se usa ninguna librería de efemérides en el navegador.

## Interfaz

- **Barra superior:** a la izquierda el nombre de la aplicación y, a su derecha, el selector de idioma (ES/EN) y el **selector de sitio** (el sitio del escenario A, el que se ve en 3D). A la derecha, de derecha a izquierda: **Activar sonido**, **Aclarar sombras**, **Imagen LROC** y **Vista libre** (o **Seguir al robot**), y en la esquina el **menú desplegable**. En pantallas estrechas los botones muestran solo su icono (siguen teniendo nombre para lectores de pantalla) y, en móvil, la barra pasa a dos filas: nombre, idioma y menú arriba; sitio y botones debajo.
- **Menú:** **Planificador** (abre o cierra el cajón de la derecha), **Análisis** (abre la ventana de Análisis) y **Comparar** (activa o quita el escenario B; al activarlo se abre el planificador). Se maneja con el teclado: flechas, Inicio/Fin, Esc para cerrarlo.
- **Barra inferior, como un reproductor de vídeo:**
  - **Saltos:** −1 día, −1 hora, +1 hora y +1 día, parando en los extremos de los datos.
  - **Reproducir:** un triángulo que se convierte en el signo de pausa. Si se pulsa al final de los datos, vuelve a empezar desde el principio.
  - **Línea de tiempo:** un control deslizante sobre **todo el tiempo calculado** (de 2026 a 2030, una muestra por hora), con marcas de cada año y el momento actual en UTC. Arrastrarla o usar las flechas del teclado mueve el escenario A; en modo Comparar el B se mueve igual, manteniendo la diferencia entre sus fechas. Si la animación está en marcha, sigue desde el nuevo punto.
  - **Velocidad:** un botón con la velocidad actual que abre un menú: 1 h/s, 6 h/s, 1 d/s, 7 d/s o 30 d/s.
- **Planificador (cajón de la derecha):** oculto al abrir la página. Contiene el escenario (sitio, fecha y hora en UTC, ventana de análisis de 1 día, 7 días o 1 día lunar), el veredicto, las cuentas atrás, las métricas, la gráfica de elevación con cursor arrastrable (ratón o flechas) y, en modo Comparar, una tarjeta de diferencias respecto a A. Se cierra con su botón, con Esc (con el foco dentro) o desde el menú; cerrado, no recibe foco ni lo lee un lector de pantalla. Con Comparar se ensancha.
- **Veredicto:** *Viable*, *Dudoso* o *No viable* según tres umbrales editables: elevación solar mínima (0° por defecto), oscuridad máxima (120 h) y hueco máximo sin Tierra (48 h). Cada estado conserva su etiqueta de texto.
- **Cuentas atrás:** ocaso o salida del Sol y de la Tierra. Cuando faltan 30 días o más, bajo la duración aparece la fecha («≈ 7 may 2029 (UTC)»).
- **Elegir el sitio:** con el selector de la barra superior (escenario A); el escenario B, en modo Comparar, tiene el suyo en el planificador. Los dos selectores de A están sincronizados.

## Escena 3D

La escena muestra el sitio seleccionado en el escenario A a pantalla completa; la barra superior y la inferior flotan encima y los avisos de la escena (Sol y Tierra, ayuda de controles, cartel del sitio) se colocan fuera de ellas. El Sol y la Tierra se colocan según la fecha del panel y la animación los mueve. El rover parte a ~400 m del módulo de aterrizaje y el objetivo es llegar hasta él: a menos de 25 m se abre el cartel del lugar.

- **Controles:** W/↑ avanzar, S/↓ retroceder, A/D o ←/→ girar, Shift turbo. Las teclas se ignoran mientras escribes en un campo del panel. En **vista libre** se arrastra para girar y la rueda acerca.
- **Terreno:** la malla es la altura LOLA real de un recorte de 5 km de lado (1001 × 1001 muestras de 5 m), dibujada por bloques de 320 m con nivel de detalle según la distancia a la cámara (vértices cada 5, 10, 20 o 40 m; ver [Rendimiento](#rendimiento)). El grano fino es un regolito **procedural** que se repite cada 32 m (con cráteres pequeños, usado también como mapa de relieve para que la luz rasante lo marque), con un moteado suave y un tono algo más claro en las pendientes fuertes. Más allá del recorte hay una silueta oscura del horizonte lejano.
- **Imagen LROC:** cuatro sitios (Connecting Ridge, Shackleton, Haworth y Malapert) tienen un mapa de tonos del mosaico LROC NAC del polo sur (NASA/GSFC/Arizona State University), alineado con la malla (`albedo.bin`, un byte por celda): moteado y manchas claras y oscuras de cráteres pequeños y eyecta. El botón **Imagen LROC** lo apaga para comparar. Nobile Rim 1 queda fuera (el mosaico termina en 85,5° S y solo cubre el 11 % de su terreno). Detalles y límites: [Imagen LROC](#imagen-lroc-cómo-se-hace-y-límites).
- **Módulo y rocas:** en el centro de cada sitio está el módulo lunar Apolo de NASA (NASA 3D Resources): un modelo histórico usado solo como referencia visual de «un módulo de aterrizaje», **no** el vehículo de CLPS ni de Artemis. Mientras carga, o si no carga, se ve un módulo procedural con las patas ajustadas al terreno. Unas 2.100 rocas repartidas por el mapa (más densas junto al módulo y al punto de salida) evitan las pendientes fuertes; son malla instanciada y **solo visuales** (el rover pasa por encima).
- **Señales:** tres etiquetas por sitio —la zona de aterrizaje, el punto más alto y el punto más bajo del mapa— con altitud y distancia al robot en vivo; salen de la altura real del terreno. Un panel arriba a la izquierda dice dónde están el Sol y la Tierra (acimut, elevación, horizonte en esa dirección y si quedan sobre o bajo el horizonte).
- **Cartel del sitio:** texto del lugar, por qué importa, datos calculados con las efemérides de 2026–2030 (% de luz solar, luz continua más larga, noche más larga, % de Tierra visible, mayor hueco sin Tierra) y enlaces a las fuentes.
- **Sol:** disco con sombras reales y un halo suave que el relieve tapa cuando el Sol queda bajo el horizonte.
- **Tierra:** imagen *Blue Marble: Next Generation* de NASA Earth Observatory (enero de 2004, reducida a 2048 × 1024; el océano profundo se recoloreó a azul porque el mapa original lo deja casi negro) con nubes procedurales en una capa aparte. Gira con la hora UTC y con la fase media de la Luna para que mire al observador el meridiano que le toca (precisión de unos pocos grados de longitud; el eje se deja vertical), y la luz del Sol le da la fase. Mientras carga la imagen, o si falla, se ve una Tierra procedural.
- **Rover:** NASA/JPL-Caltech, *Mars 2020 Perseverance Rover* (GLB local); es un modelo visual de rover de seis ruedas, no un vehículo lunar. El GLB va comprimido con Draco y el decodificador se sirve en local. Si no carga, se ve un rover sencillo.
- **Polvo:** el rover lanza granos desde las ruedas traseras que siguen parábolas con la gravedad lunar (1,62 m/s²) y **sin rozamiento del aire**: suben lento y alto, no forman nubes y vuelven a caer donde salieron. Cada grano aterriza, descansa 0,6 s y desaparece.
- **Sonido (opcional):** apagado por defecto. El botón "Activar sonido" crea el audio solo cuando lo pulsas (los navegadores no permiten sonar antes) y suena en tres momentos: una llamada de radio al abrirse el cartel (tono de entrada Quindar de 2525 Hz, un soplo de estática y tono de salida de 2475 Hz, como en las comunicaciones del Apolo), un clic breve al usar un botón o selector de la barra, y un motivo corto cuando cambia el veredicto del escenario A (tres notas ascendentes en *Viable*, dos iguales en *Dudoso*, dos descendentes en *No viable*; no suena mientras corre la animación). Todos se sintetizan con Web Audio: no hay archivos de audio ni licencias que atribuir. No hay sonido ambiente ni de motor a propósito: en la Luna no hay atmósfera y el sonido no viaja. Si el navegador no soporta Web Audio, el botón queda apagado.
- **Límite de pendiente por sitio:** cada sitio usa el más bajo de 15°, 20°… 45° con el que la meta sigue siendo alcanzable desde ~400 m: 15° en Connecting Ridge, Haworth y Malapert, 20° en Nobile Rim 1 y 35° en el borde de Shackleton (una pared de cráter). El robot no entra en terreno más empinado (se detiene y avisa; distingue "pendiente de más de N°" de "límite del terreno cartografiado") y la ayuda de la escena muestra el límite.
- **Accesibilidad:** el cartel cerrado no se expone a lectores de pantalla ni al foco, las etiquetas del mapa tienen una lista equivalente para lectores de pantalla, el lienzo 3D tiene etiqueta, `<html lang>` sigue al idioma de la interfaz y las teclas con Ctrl/Alt/Meta no se capturan.
- Sin WebGL, el panel sigue funcionando y la escena muestra un aviso.

## Ventana de Análisis

El botón **Análisis** abre una ventana ampliada (se cierra con Esc) con su propio sitio, fecha de inicio y duración de estancia (3 días, 6,5 días —la estancia planificada de Artemis III— o 14 días):

- **Mejores ventanas de aterrizaje:** las 5 fechas de inicio con más Sol (a igualdad, más Tierra) en todo el rango 2026–2030, sin solaparse, con su veredicto. «Ver en la escena» lleva el escenario A a esa fecha.
- **Calendario de luz de 30 días:** un día por fila y una hora UTC por columna, para el Sol y para la Tierra.
- **Cielo visto desde el sitio:** recorrido del Sol y la Tierra durante 30 días contra la silueta del horizonte del terreno; los puntos tenues están tapados por el relieve.
- **Comparación de los 5 sitios** con la misma fecha y ventana, y descarga en CSV.

## Imagen LROC: cómo se hace y límites

```bash
python data-pipeline/scripts/make_albedo.py --list       # qué teselas necesita cada sitio, sin descargar nada
python data-pipeline/scripts/make_albedo.py --download   # baja esas vistas previas PNG a data-pipeline/cache/lroc y genera albedo.bin
```

Se ejecuta después de `build_site.py`, porque necesita el `terrain.bin` y el `info.json` del sitio. Necesita Pillow (incluido en `requirements.txt`).

- **Fuente:** mosaico LROC NAC del polo sur sin controlar a 1 m/px (Wagner et al. 2015), 40 teselas polares entre 85,5° S y el polo. Las teselas completas pesan 2–3 GB cada una, así que se usan sus **vistas previas PNG** (unos 0,3–1 MB cada una, **unos 32 m por píxel**); en total se descargan 6 PNG, unos 3,6 MB. La geometría de las teselas (nombre, extensión) está en `data-pipeline/lunarnav/lroc.py` y se comprobó contra las cabeceras de los GeoTIFF originales.
- **No es una fotografía del suelo a 5 m:** a 32 m por píxel solo aporta variación de tono a gran escala. La malla del terreno sigue siendo LOLA a 5 m.
- **Las sombras de la imagen no se usan:** el mosaico se tomó en el solsticio de 2010 con el Sol casi en el horizonte, por lo que casi todo es sombra y el resto lleva la luz de ese día. La app ilumina el terreno por su cuenta en cualquier fecha, así que `relative_tone` solo conserva el contraste local de las zonas iluminadas (cada píxel dividido por el brillo medio de sus 100 m de alrededor) y marca la sombra como «sin información». Por eso el mapa cubre entre el 17 % y el 49 % del terreno según el sitio.
- **Alineación:** las imágenes se proyectaron sobre el DEM GLD100, no sobre el LOLA de 5 m. Se comprobó correlacionándolas con el relieve sombreado del propio terreno: correlación de 0,76 a 0,93 sin desplazar y mejor desplazamiento de 20 a 40 m, del orden de un píxel de la vista previa. Es una comprobación de coherencia, no una validación contra una fuente externa.
- **Exageración:** la variación real de tono es de unos ±20 % a 30 m; con el Sol tan bajo apenas se vería, así que se muestra multiplicada por 1,7 (`ALBEDO_STRENGTH` en `terrainMesh.js`). El botón compara con el terreno sin ella.

## Rendimiento

El 3D dibuja el terreno de 5 m completo, los modelos NASA, rocas, polvo y un mapa de sombras de 4096 px. Para que vaya fluido sin una GPU potente se hizo esto (cifras medidas en un solo equipo, en la escena de Connecting Ridge con el rover parado, antes y después):

| | Antes | Después |
|---|---|---|
| Triángulos del terreno | 2.000.000 | ~180.000 |
| Triángulos por render (con el paso de sombras) | 7,3 millones | 0,28 millones |
| Llamadas de dibujo por render | 938 | 83 |
| Coste de un render con el paso de sombras (mediana, GPU sincronizada)* | ~15 ms | ~2 ms |
| Construir un sitio al elegirlo | 1,7–2,4 s | 0,55 s el primero, ~0,1 s los siguientes |

\* Medición con mucho ruido (la GPU del equipo de pruebas variaba entre 8 y 20 ms): vale como orden de magnitud, no como cifra exacta. Las filas de triángulos y llamadas de dibujo son recuentos exactos; el tiempo de construcción es una medida.

- **Terreno por bloques con nivel de detalle** (`terrainLod.js`): 256 bloques de 64 × 64 celdas. Cada uno se dibuja con vértices cada 5 m (a menos de 260 m de la cámara), 10 m (hasta 640 m), 20 m (hasta 1,5 km) o 40 m. La geometría fina se construye la primera vez que hace falta (como mucho 6 bloques por fotograma) y se conserva; las grietas entre niveles se tapan con un «faldón» vertical, y las normales salen de las alturas, así que el sombreado es continuo entre niveles. Lo que queda fuera de la vista no se dibuja.
- **Modelos NASA fusionados** (`mergeModel.js`): el rover (252 mallas) y el módulo (157) se fusionan por material al cargar, con los mismos triángulos: 46 y 12 llamadas de dibujo en vez de 409.
- **Sombras solo cuando cambian:** el mapa de sombras se vuelve a dibujar cuando se mueve el Sol, el rover o el nivel de detalle, no en cada fotograma. Solo las rocas grandes (≥ 1 m) proyectan sombra.
- **Fotogramas inactivos:** si no cambió nada visible (cámara, rover, fecha, polvo), no se vuelve a dibujar.
- **Resolución adaptable** (`quality.js`): si los fotogramas tardan más de ~24 ms durante un rato, baja la resolución de render (hasta la mitad por lado) y la sube de nuevo, con espera creciente si vuelve a ir lento. No cambia nada más. En una pantalla que no sea lenta se queda a resolución completa.
- **Salida del rover precalculada:** la búsqueda de ruta que decide dónde empieza el rover y el límite de pendiente (de 0,5 a 2 s) se calcula una vez con `npm --prefix web run plan-starts` y se guarda en `start.json`, con una huella del terreno; si el archivo falta o no corresponde al terreno, la app lo calcula como antes.
- **Profundidad normal:** se quitó el buffer de profundidad logarítmico (el rango de 0,5 m a 150 km cabe en el normal) y se pueden usar las optimizaciones de profundidad de la GPU.
- Una prueba comprueba que cada `start.json` sigue siendo el resultado de la búsqueda sobre su terreno.

Para medir en desarrollo, la consola del navegador ofrece `__navigator.info()` (llamadas y triángulos), `__navigator.lod()` (bloques por nivel), `__navigator.timeRender()` (coste de un render sin el límite de 60 fps) y `__navigator.forceScale(1)` (fija la resolución).

## Uso

```bash
npm --prefix web install
npm --prefix web run dev      # http://localhost:5173
npm --prefix web test         # pruebas (Vitest): métricas, panel, ventana de Análisis, escena y datos
npm --prefix web run build    # versión estática en web/dist
npm --prefix web run plan-starts   # recalcula web/public/sites/*/start.json (hay que repetirlo si cambia un terrain.bin)
```

Pipeline de datos (necesita Python 3.11):

```bash
py -3.11 -m venv data-pipeline/.venv
data-pipeline/.venv/Scripts/python -m pip install -r data-pipeline/requirements.txt
data-pipeline/.venv/Scripts/python -m pytest data-pipeline/tests
# con el DEM del sitio descargado en data-pipeline/cache/ (ver config/sites.json):
data-pipeline/.venv/Scripts/python data-pipeline/scripts/build_site.py site01-connecting-ridge --dem data-pipeline/cache/Site01_final_adj_5mpp_surf.tif --radius-m 8000
# Opcional para sumar el horizonte distante de un DEM regional de menor resolución:
data-pipeline/.venv/Scripts/python data-pipeline/scripts/build_site.py site01-connecting-ridge --dem data-pipeline/cache/Site01_final_adj_5mpp_surf.tif --far-dem data-pipeline/cache/LDEM_80S_80MPP_ADJ.TIF
```

Los kernels SPICE (`de421.bsp`, `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf`, `pck00008.tpc`) se descargan a `data-pipeline/cache/` con Skyfield. La carpeta `cache/` no se versiona. Los textos de cada sitio (cartel, fuentes) viven en `data-pipeline/config/sites.json` y se copian al `info.json` de cada sitio; si se edita uno, hay que mantener el otro igual.

## Créditos de modelos, imágenes y datos

| Qué | Origen | Detalle |
|---|---|---|
| Topografía (terreno y horizonte) | NASA LRO/LOLA, [PGDA](https://pgda.gsfc.nasa.gov/products/78) | Barker et al. (2021) |
| Horizonte lejano | [DEM LOLA regional de 80 m/píxel, 80–90° S (PGDA)](https://pgda.gsfc.nasa.gov/products/90) | Se combina con cada DEM local de 5 m |
| Efemérides | [Skyfield](https://rhodesmill.org/skyfield/planetary.html) con kernels SPICE de NAIF/JPL | Validadas contra [JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html) |
| Imagen del suelo | LROC NAC, mosaico del polo sur | NASA/GSFC/Arizona State University; `data-pipeline/lunarnav/lroc.py` |
| Rover | NASA 3D Resources, *Mars 2020 Perseverance Rover* | NASA/JPL-Caltech; `web/public/models/README.md` |
| Módulo de aterrizaje | NASA 3D Resources, *Apollo Lunar Module* | `web/public/models/README.md` |
| Tierra | NASA Earth Observatory, *Blue Marble: Next Generation* | Recoloreado el océano; `web/public/textures/README.md` |
| Fuentes tipográficas | Barlow, Barlow Condensed, IBM Plex Mono | Licencia OFL (paquetes `@fontsource`) |

NASA no respalda este proyecto. Los modelos y las imágenes de NASA se usan según las [guías de uso de medios de NASA](https://www.nasa.gov/nasa-brand-center/images-and-media/).

Citar para la topografía: Barker, M. K. et al. (2021), *Improved LOLA Elevation Maps for South Pole Landing Sites: Error Estimates and Their Impact on Illumination Conditions*, Planetary and Space Science 203, 105119, [doi:10.1016/j.pss.2020.105119](https://doi.org/10.1016/j.pss.2020.105119). Las efemérides están validadas en `data-pipeline/VALIDATION.md` (elevación y acimut, dos semanas de 2026 y 2030, en el sitio real y en (0, 0)).

## Límites conocidos (léelos antes de usar los números)

- **El punto de observación es el centro del DEM de cada región, no una posición de aterrizaje concreta.** Las coordenadas salen de la extensión del GeoTIFF (ver `coordinates_source` en `data-pipeline/config/sites.json`). Un punto concreto del borde puede ver la Tierra o el Sol muy distinto: en Shackleton, por ejemplo, la próxima salida de la Tierra puede estar a más de dos años por la pared del cráter al sur.
- **El horizonte combina el DEM local de 5 m con el DEM regional de 80 m.** El regional empieza a contribuir al 75 % del radio local por defecto, con solapamiento para evitar huecos. Solo cuenta el terreno contenido en los DEM disponibles.
- **Alrededor del 90 % de los píxeles de 5 m están interpolados**; el error típico es 0,30–0,50 m en altura y 1,5–2,5° en pendiente (Barker et al. 2021).
- **La validación con Horizons cubre las efemérides (Sol y Tierra), no el horizonte del terreno.** La orientación de la cuadrícula del DEM (norte verdadero frente a norte de la cuadrícula) está comprobada con un raster sintético, no contra una fuente externa.
- El Sol se considera visible cuando su **borde superior** supera el horizonte; la Tierra se considera por su **centro**.
- El semáforo compara la elevación del Sol con el horizonte *geométrico* (0° por defecto), así que un Sol visible sobre terreno bajo puede marcarse "por debajo del mínimo".
- Datos de 2026-01-01 a 2030-12-31, paso de 1 hora. Fuera de ese rango la fecha se ajusta al límite y se avisa.
- **Escena 3D:** las sombras cubren todo el recorte (5 km de lado, 2,5 km de radio); más allá hay una silueta oscura sin iluminar calculada con el horizonte del observador en el centro del sitio, así que desde otro punto es solo aproximada. El rover no tiene físicas (sigue la altura del mapa) y las rocas y el polvo son solo visuales. La escena muestra solo el escenario A.
- **Horizonte del robot frente al del panel:** las métricas del panel son para el centro del sitio; desde otro punto del terreno el Sol puede quedar tapado aunque el panel diga que es visible.
- **Modelos y texturas:** el rover es el de Marte y el módulo es el histórico de Apolo; son referencias visuales, no los vehículos de CLPS o Artemis. El grano del suelo y las nubes son procedurales, y los continentes de la Tierra de respaldo, dibujados a mano.
- **La Tierra:** su giro usa la fase media de la Luna y deja el eje vertical; no es una vista astronómica exacta de qué cara mira a la Luna.
- **Límite de pendiente:** se precalcula (`start.json`, ver más abajo) con una búsqueda de ruta que exige 2° menos que el límite del robot y comprueba la pendiente cada 2,5 m a lo largo de cada tramo; si ni 45° sirve, la escena lo avisa y muestra el cartel desde el punto central. Que exista ruta no garantiza que sea fácil, y el DEM está interpolado en un ~90 %.
- **Textos de los sitios:** las cifras de cada cartel (tamaños de cráteres, iluminación, edades) vienen de páginas de NASA/USGS/LROC y de artículos citados en el propio cartel; algunas (el 90 % de luz de la cresta, el 56 % anual de un punto estudiado) son de puntos y métodos distintos y no son comparables entre sí. El estado de Artemis III cambia: los textos hablan de «las nueve regiones revisadas en 2024» y conviene volver a comprobarlo en NASA antes de presentarlo.
- **Rendimiento:** con renderizado por software (sin GPU) puede ir a pocos fotogramas por segundo; la resolución adaptable baja la calidad antes de que se note, y el movimiento del rover se ralentiza en vez de saltar. Las cifras de arriba son de un solo equipo.
- **Pérdida del contexto WebGL:** si el navegador pierde el contexto gráfico (poca memoria de GPU, muchas pestañas), la escena se vuelve a dibujar sola cuando se restaura.
- **Pruebas del pipeline:** necesitan los paquetes de `requirements.txt` (entre ellos Skyfield); sin ellos, algunos archivos de `data-pipeline/tests/` no se pueden ejecutar.

## Ideas y pendiente

- Aplicar el mosaico LROC NAC a 1 m/px (teselas de 2–3 GB; haría falta además quitar las sombras de 2010) o usar un producto con iluminación uniforme; hoy solo se usan sus vistas previas de ~32 m.
- Un modelo de rover lunar: NASA 3D Resources no ofrece un LRV en GLB, y el rover actual es el de Marte.
- Inclinar el eje de la Tierra y usar la fase real de la Luna de las efemérides.
- Coordenadas de aterrizaje concretas en vez del centro del DEM, y más regiones.
- Partir el JavaScript en bloques (hoy es un solo paquete de unos 730 kB) y precargar los terrenos de los sitios que faltan.
