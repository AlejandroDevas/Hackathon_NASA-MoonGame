# Lunar Landing Site Navigator

Herramienta web para evaluar rápido un sitio y una fecha de aterrizaje en el polo sur lunar: posición del Sol y de la Tierra respecto al **horizonte real del terreno**, tiempo hasta el ocaso solar y terrestre, % de luz, ventanas de visibilidad de la Tierra y un semáforo de viabilidad con umbrales editables. Permite comparar dos escenarios (sitio + fecha) lado a lado y animar el paso del tiempo.

Proyecto para el NASA Space Apps Challenge 2026 (reto "CLPS Lunar Mission Browser"). Este repositorio contiene los hitos M0 (datos) y M1 (panel); la escena 3D con el robot viene después (ver `docs/superpowers/specs/`).

## Cómo funciona

```
data-pipeline/ (Python, se ejecuta una vez)  ->  web/public/sites/<id>/  ->  web/ (JS, calcula todo en el navegador)
  DEM LOLA + Skyfield/SPICE                        ephemeris.bin · horizon.json · info.json
```

No hay servidor: todo es estático.

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
```

Los kernels SPICE (`de421.bsp`, `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf`, `pck00008.tpc`) se descargan a `data-pipeline/cache/` con Skyfield. La carpeta `cache/` no se versiona.

## Fuentes

- Topografía: LRO/LOLA, DEM de 5 m/píxel de [PGDA](https://pgda.gsfc.nasa.gov/products/78). Citar: Barker, M. K. et al. (2021), *Improved LOLA Elevation Maps for South Pole Landing Sites: Error Estimates and Their Impact on Illumination Conditions*, Planetary and Space Science 203, 105119, [doi:10.1016/j.pss.2020.105119](https://doi.org/10.1016/j.pss.2020.105119).
- Efemérides: [Skyfield](https://rhodesmill.org/skyfield/planetary.html) con kernels SPICE de NAIF/JPL. Validadas contra [JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html): ver `data-pipeline/VALIDATION.md`.

## Límites conocidos (léelos antes de usar los números)

- **El punto de observación es el centro del DEM del sitio, no una posición de aterrizaje concreta.** Las coordenadas salen de la extensión del GeoTIFF (ver `coordinates_source` en `data-pipeline/config/sites.json`).
- **El horizonte usa solo el terreno del recorte del DEM** (8 km de radio en el Site 01). Las cumbres más lejanas no cuentan; el anillo de baja resolución queda para el hito M3.
- **Alrededor del 90 % de los píxeles de 5 m están interpolados**; el error típico es 0,30–0,50 m en altura y 1,5–2,5° en pendiente (Barker et al. 2021).
- **La validación con Horizons cubre las efemérides (Sol y Tierra), no el horizonte del terreno.** La orientación de la cuadrícula del DEM (norte verdadero frente a norte de la cuadrícula) está comprobada con un raster sintético, no contra una fuente externa.
- El Sol se considera visible cuando su **borde superior** supera el horizonte; la Tierra se considera por su **centro**.
- El semáforo compara la elevación del Sol con el horizonte *geométrico* (0° por defecto), así que un Sol visible sobre terreno bajo puede marcarse "por debajo del mínimo".
- Datos de 2026-01-01 a 2030-12-31, paso de 1 hora. Fuera de ese rango la fecha se ajusta al límite y se avisa.
- Hay un solo sitio real por ahora (M3 añadirá más).
