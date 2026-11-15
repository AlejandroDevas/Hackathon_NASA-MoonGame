# Lunar Landing Site Navigator

Herramienta web para evaluar rápido un sitio y una fecha de aterrizaje en el polo sur lunar: posición del Sol y de la Tierra respecto al **horizonte real del terreno**, tiempo hasta el ocaso solar y terrestre, % de luz, la racha de luz continua más larga, ventanas de visibilidad de la Tierra y un semáforo de viabilidad con umbrales editables. Permite comparar dos escenarios (sitio + fecha) lado a lado y animar el paso del tiempo.

Proyecto para el NASA Space Apps Challenge 2026 (reto "CLPS Lunar Mission Browser"). Incluye M0 (pipeline de datos), M1 (panel), M2 (escena 3D con el robot) y el alcance mínimo de M3: cinco regiones con datos y horizonte lejano — Connecting Ridge (Site 01), Shackleton Rim (Site 04), Nobile Rim 1 (Site 06), Haworth y Malapert Massif (Site 23).

## Cómo funciona

```
data-pipeline/ (Python, se ejecuta una vez)  ->  web/public/sites/<id>/  ->  web/ (JS, calcula todo en el navegador)
  DEM LOLA + Skyfield/SPICE                        ephemeris.bin · horizon.json · info.json
```

No hay servidor: todo es estático. Al arrancar se descargan solo las efemérides y el horizonte de los cinco sitios (~0,7 MB cada uno); el terreno de 2 MB de cada sitio se pide la primera vez que se elige. Las fuentes (Barlow, Barlow Condensed e IBM Plex Mono, licencia OFL) van incluidas en la aplicación, así que la página no hace peticiones a terceros y funciona sin conexión; una prueba lo vigila.

## Escena 3D

Encima del panel hay una vista 3D del sitio seleccionado en el escenario A: el terreno real del recorte LOLA (5 km, malla a 5 m por vértice), un Sol con sombras y una Tierra puestos según la fecha del panel (la animación del panel los mueve), estrellas y la silueta del horizonte lejano. El rover NASA Perseverance (modelo GLB local, escala de escena ajustada) parte a ~400 m del punto del sitio y el objetivo es llegar hasta él: a menos de 25 m se abre el cartel con la explicación del lugar.

- **Controles:** W/↑ avanzar, S/↓ retroceder, A/D o ←/→ girar, Shift turbo. Las teclas se ignoran mientras escribes en un campo del panel.
- **Sonido (opcional):** apagado por defecto. El botón "Activar sonido" del panel crea el audio solo cuando lo pulsas (los navegadores no permiten sonar antes) y reproduce un pitido de dos notas cuando se abre el cartel. No hay sonido ambiente ni de motor a propósito: en la Luna no hay atmósfera y el sonido no viaja, así que sería físicamente falso. Si el navegador no soporta Web Audio, el botón queda apagado y no pasa nada más.
- **Avisos del robot:** distinguen "pendiente de más de N°" de "límite del terreno cartografiado" (borde del mapa o alturas sin datos).
- **Modelo del rover:** NASA/JPL-Caltech, Perseverance Rover GLB; se usa como modelo visual de rover de seis ruedas, no como vehículo lunar exacto. El GLB va comprimido con Draco, así que el decodificador (de three.js) se sirve en local desde `web/public/draco/`. Fuente, crédito y atribución: `web/public/models/README.md`.
- **Imagen LROC en el suelo:** cuatro sitios (Connecting Ridge, Shackleton, Haworth y Malapert) tienen un mapa de tonos sacado del mosaico LROC NAC del polo sur (NASA/GSFC/Arizona State University), alineado con la malla del terreno (`albedo.bin`, un byte por celda). Se ve como un moteado y manchas claras y oscuras (cráteres pequeños y eyecta) sobre el suelo; el botón **Imagen LROC** lo apaga para comparar. Nobile Rim 1 queda fuera: el mosaico termina en 85,5° S y solo cubre el 11 % de su terreno. Ver «Imagen LROC: cómo se hace y límites» más abajo.
- **Módulo y rocas:** en el centro de cada sitio está el módulo lunar Apolo de NASA (NASA 3D Resources; es un modelo histórico usado solo como referencia visual de «un módulo de aterrizaje», no el vehículo de CLPS ni de Artemis; créditos en `web/public/models/README.md`). Mientras carga, o si no carga, se ve un módulo procedural propio con las patas ajustadas al terreno, y unas 2.100 rocas repartidas por el mapa (más densas junto al módulo y al punto de salida del robot) que evitan las pendientes fuertes. Son malla instanciada, tres llamadas de dibujo en total. El Sol tiene un halo suave que el relieve tapa.
- **La Tierra:** usa la imagen *Blue Marble: Next Generation* de NASA Earth Observatory (enero de 2004, reducida a 2048 × 1024; el océano profundo se recoloreó a azul porque el mapa original lo deja casi negro; detalles y crédito en `web/public/textures/README.md`). Las nubes son procedurales, en una capa aparte. Mientras la imagen carga, o si no carga, se ve una Tierra procedural. Gira con la hora UTC y con la fase de la Luna para que mire hacia el observador el meridiano correcto (precisión de unos pocos grados de longitud; el eje se deja vertical), y la luz del Sol le da la fase.
- **Polvo:** el rover lanza granos desde las ruedas traseras que siguen parábolas con la gravedad lunar (1,62 m/s²) y **sin rozamiento del aire**: suben lento y alto, no forman nubes y vuelven a caer donde salieron. Cada grano aterriza, descansa 0,6 s y desaparece.
- **Señales en el mapa:** cada sitio tiene tres etiquetas: la zona de aterrizaje (el módulo, en el centro), el punto más alto y el punto más bajo del mapa. Salen de la altura real del recorte LOLA y muestran altitud y distancia al robot en vivo. Un panel arriba a la izquierda dice dónde están el Sol y la Tierra (acimut, elevación, horizonte en esa dirección y si quedan sobre o bajo el horizonte).
- **Cartel del sitio:** además del texto, explica por qué importa el lugar, muestra datos calculados con los datos de 2026–2030 (% de luz solar, luz continua más larga, noche más larga, % de Tierra visible, mayor hueco sin Tierra) y enlaza las fuentes NASA.
- **Terreno:** la malla es la altura LOLA real. El color y el grano son **procedurales, no imágenes de satélite**: un regolito sintético que se repite cada 32 m (relieve fino con cráteres pequeños, usado también como mapa de relieve para que la luz rasante lo marque), un moteado suave y un tono algo más claro en las pendientes fuertes.
- **Accesibilidad:** el cartel cerrado no se expone a lectores de pantalla ni al foco, el lienzo 3D tiene etiqueta, `<html lang>` sigue al idioma de la interfaz y las teclas con Ctrl/Alt/Meta no se capturan.
- **Límite de pendiente por sitio:** cada sitio tiene su propio límite, el más bajo de 15°, 20°… 45° con el que la meta sigue siendo alcanzable desde ~400 m: hoy 15° en el Site 01, Haworth y Malapert, 20° en Nobile Rim 1 y 35° en el borde de Shackleton (una pared de cráter). El robot no entra en terreno más empinado (se detiene y avisa) y la ayuda de la escena muestra el límite.
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

Se ejecuta después de `build_site.py`, porque necesita el `terrain.bin` y el `info.json` del sitio. Necesita Pillow además de `requirements.txt`.

- **Fuente:** mosaico LROC NAC del polo sur sin controlar a 1 m/px (Wagner et al. 2015), 40 teselas polares entre 85,5° S y el polo. Las teselas completas pesan 2–3 GB cada una, así que se usan sus **vistas previas PNG** (unos 0,3–1 MB cada una, **unos 32 m por píxel**). En total se descargan 6 PNG, unos 3,6 MB. La geometría de las teselas (nombre, extensión) está en `data-pipeline/lunarnav/lroc.py` y se comprobó contra las cabeceras de los GeoTIFF originales.
- **No es una fotografía del suelo a 5 m:** a 32 m por píxel solo aporta variación de tono a gran escala. La malla del terreno sigue siendo LOLA a 5 m.
- **Las sombras de la imagen no se usan:** el mosaico se tomó en el solsticio de 2010 con el Sol casi en el horizonte, por lo que casi todo es sombra y el resto lleva la luz de ese día. La app ilumina el terreno por su cuenta en cualquier fecha, así que `relative_tone` solo conserva el contraste local de las zonas iluminadas (cada píxel dividido por el brillo medio de sus 100 m de alrededor) y marca la sombra como «sin información». Por eso el mapa cubre entre el 17 % y el 49 % del terreno según el sitio.
- **Alineación:** las imágenes se proyectaron sobre el DEM GLD100, no sobre el LOLA de 5 m. Se comprobó correlacionándolas con el relieve sombreado del propio terreno: correlación de 0,76 a 0,93 sin desplazar, y el mejor desplazamiento es de 20 a 40 m, es decir, del orden de un píxel de la vista previa. Es una comprobación de coherencia, no una validación contra una fuente externa.
- **Exageración:** la variación real de tono es de unos ±20 % a 30 m; con el Sol tan bajo apenas se vería, así que se muestra multiplicada por 1,7 (`ALBEDO_STRENGTH` en `terrainMesh.js`). El botón compara con el terreno sin ella.

## Uso

```bash
npm --prefix web install
npm --prefix web run dev      # http://localhost:5173
npm --prefix web test         # pruebas del panel y las métricas
npm --prefix web run build    # versión estática en web/dist
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

Los kernels SPICE (`de421.bsp`, `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf`, `pck00008.tpc`) se descargan a `data-pipeline/cache/` con Skyfield. La carpeta `cache/` no se versiona.

## Fuentes

- Topografía: LRO/LOLA, DEM de 5 m/píxel de [PGDA](https://pgda.gsfc.nasa.gov/products/78). Citar: Barker, M. K. et al. (2021), *Improved LOLA Elevation Maps for South Pole Landing Sites: Error Estimates and Their Impact on Illumination Conditions*, Planetary and Space Science 203, 105119, [doi:10.1016/j.pss.2020.105119](https://doi.org/10.1016/j.pss.2020.105119).
- Contexto topográfico lejano: [DEM LOLA regional de 80 m/píxel, 80–90°S (PGDA)](https://pgda.gsfc.nasa.gov/products/90), combinado con cada DEM local de 5 m para calcular el horizonte.
- Efemérides: [Skyfield](https://rhodesmill.org/skyfield/planetary.html) con kernels SPICE de NAIF/JPL. Validadas contra [JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html) (elevación y acimut, dos semanas de 2026 y 2030, en el sitio real y en (0, 0)): ver `data-pipeline/VALIDATION.md`.

## Límites conocidos (léelos antes de usar los números)

- **El punto de observación es el centro del DEM de cada región, no una posición de aterrizaje concreta.** Las coordenadas salen de la extensión del GeoTIFF (ver `coordinates_source` en `data-pipeline/config/sites.json`).
- **El horizonte combina el DEM local de 5 m con el DEM regional de 80 m.** El regional empieza a contribuir al 75 % del radio local por defecto, con solapamiento para evitar huecos. Solo cuenta el terreno contenido en los DEM disponibles.
- **Alrededor del 90 % de los píxeles de 5 m están interpolados**; el error típico es 0,30–0,50 m en altura y 1,5–2,5° en pendiente (Barker et al. 2021).
- **La validación con Horizons cubre las efemérides (Sol y Tierra), no el horizonte del terreno.** La orientación de la cuadrícula del DEM (norte verdadero frente a norte de la cuadrícula) está comprobada con un raster sintético, no contra una fuente externa.
- El Sol se considera visible cuando su **borde superior** supera el horizonte; la Tierra se considera por su **centro**.
- El semáforo compara la elevación del Sol con el horizonte *geométrico* (0° por defecto), así que un Sol visible sobre terreno bajo puede marcarse "por debajo del mínimo".
- Datos de 2026-01-01 a 2030-12-31, paso de 1 hora. Fuera de ese rango la fecha se ajusta al límite y se avisa.
- Hay cinco sitios con datos reales: Connecting Ridge (Site 01), Shackleton Rim (Site 04), Nobile Rim 1 (Site 06), Haworth y Malapert Massif (Site 23). Los puntos de observación son centros de regiones DEM, no coordenadas de aterrizaje.
- **Escena 3D:** las sombras cubren todo el recorte de 2,5 km (el marco se calcula con sus esquinas); más allá hay una silueta oscura sin iluminar calculada con el horizonte del observador en el centro del sitio, así que desde otro punto es solo aproximada. La Tierra es una esfera sin textura y el rover no tiene físicas (sigue la altura del mapa). La escena muestra solo el escenario A.
- **Horizonte del robot frente al del panel:** las métricas del panel son para el centro del sitio; desde otro punto del terreno el Sol puede quedar tapado aunque el panel diga que es visible.
- **Límite de pendiente:** se calcula al cargar cada sitio (~1 s la primera vez) con una búsqueda de ruta que exige 2° menos que el límite del robot y comprueba la pendiente cada 2,5 m a lo largo de cada tramo; si ni 45° sirve, la escena lo avisa y muestra el cartel desde el punto central. Que exista ruta no garantiza que sea fácil, y el DEM está interpolado en un ~90 %.
- **Textos de los sitios:** las cifras de cada cartel (tamaños de cráteres, iluminación, edades) vienen de páginas de NASA/USGS/LROC y de artículos citados en el propio cartel; algunas (el 90 % de luz de la cresta, el 56 % anual de un punto estudiado) son de puntos y métodos distintos y no son comparables entre sí. El estado de Artemis III cambia: los textos hablan de «las nueve regiones revisadas en 2024» y conviene volver a comprobarlo en NASA antes de presentarlo.
- **Textura:** el grano fino del suelo es sintético; el tono a gran escala viene de LROC en cuatro sitios (ver arriba) y la Tierra usa una imagen NASA. Usar el mosaico LROC NAC/WAC como albedo requiere descargar y remuestrear datos de varios GB en el pipeline.
- **Rendimiento:** el 3D usa la malla de terreno a 5 m, mapa de sombras de 4096 px y el modelo NASA GLB; con renderizado por software (sin GPU) puede ir a pocos fotogramas por segundo, y el movimiento del rover se ralentiza en vez de saltar.
