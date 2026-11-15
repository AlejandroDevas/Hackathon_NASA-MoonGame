# Datos y Panel (M0 + M1) Implementation Plan

> **Plan histórico.** Ya se ejecutó; el estado actual del proyecto está en el [README](../../../README.md) y en los diseños de `docs/superpowers/specs/`. Se conserva como registro de cómo se construyó.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un pipeline en Python que genera horizonte + efemérides reales de un sitio, y un panel web (sin 3D) que calcula y compara métricas de luz y visibilidad de la Tierra sobre esos datos.

**Architecture:** `data-pipeline/` (Python) escribe archivos estáticos en `web/public/sites/<id>/`. `web/` (Vite + JS puro) los carga y calcula todas las métricas en el navegador; el panel es DOM + CSS, la gráfica es uPlot. No hay servidor.

**Tech Stack:** Python 3.11 (numpy, rasterio, pyproj, skyfield, pytest) · Node 24 (vite, vitest, jsdom, uplot).

**Spec:** `docs/superpowers/specs/2026-11-14-lunar-navigator-design.md`

**Fuera de este plan:** escena 3D, robot, `terrain.bin` (M2); anillo de DEM lejano para cumbres a más de ~10 km, más sitios y Apolo/Chandrayaan-3 (M3); coordenadas personalizadas (extra).

## Global Constraints

- Radio lunar R = 1 737 400 m; sin refracción atmosférica (el horizonte es terreno + curvatura).
- Horizonte: 360 acimutes (1 por grado); 0° = norte, 90° = este, sentido horario. Altura del observador por defecto 2 m.
- Efemérides con Skyfield y los kernels `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf`, `pck00008.tpc` (más `de421.bsp`). Rango **2026-01-01T00:00Z a 2030-12-31T23:00Z, paso 1 h** = 43 824 muestras.
- Visible = elevación del cuerpo + su radio angular > horizonte en su acimut (Sol: borde superior, radio 0,2666°; Tierra: centro, radio 0).
- Semáforo: umbrales editables; por defecto `minSunElDeg=0`, `maxDarkH=120`, `maxEarthGapH=48`.
- Todo estático, sin servidor. Textos de interfaz y carteles en es + en (archivo de traducciones).
- Citar Barker et al. 2021 (doi:10.1016/j.pss.2020.105119) en el README. Nada de datos descargados sin permiso explícito del usuario (nombre, origen y tamaño).
- **Cambio frente al diseño (§9 deja el formato al constructor):** `ephemeris.bin` usa Float32 (no Int16): 43 824 × 4 × 4 B = 701 184 B por sitio.

## Review Focus

1. DEM con NaN/nodata o con el observador cerca del borde: el horizonte nunca debe contener NaN (Task 2).
2. Sitio con día o noche polar en toda la ventana: sin transición próxima (`null`), 0 o 1 de fracción, y oscuridad = ventana completa (Task 10).
3. Cuerpo en acimut 359,9° con horizonte muestreado en enteros: interpolar cruzando 360→0 (Task 9).
4. Fecha elegida fuera de 2026–2030: error claro, no `NaN` ni pantalla vacía (Tasks 9 y 13).
5. Ventana que se pasa del final de los datos o intervalo visible que sigue abierto al terminar: recortar, marcar `truncated`, no inventar eventos (Task 10).

---

### Task 1: Andamiaje (git, Python, web)

**Files:**
- Create: `.gitignore`, `data-pipeline/requirements.txt`, `data-pipeline/pytest.ini`, `data-pipeline/tests/test_smoke.py`, `web/package.json`, `web/vite.config.js`, `web/index.html`, `web/src/main.js`, `web/tests/smoke.test.js`

**Interfaces:** Produces: comandos de prueba `data-pipeline/.venv/Scripts/python -m pytest data-pipeline/tests` y `npm --prefix web test`.

- [ ] **Step 1:** `git init` en `D:\PROGRAMHackhaton2026`. `.gitignore`: `.venv/`, `node_modules/`, `data-pipeline/cache/`, `dist/`, `__pycache__/`. (Los datos generados en `web/public/sites/` **sí** se versionan.)
- [ ] **Step 2:** Crear el venv con `py -3.11 -m venv data-pipeline/.venv`; `requirements.txt` con `numpy rasterio pyproj skyfield pytest`; instalar. (Instala dependencias: pedir confirmación al usuario antes.) `pytest.ini`: `[pytest]` / `pythonpath = .` / `testpaths = tests`.
- [ ] **Step 3:** `web/package.json` (type module; scripts `dev`, `build`, `test` = `vitest run`); dependencias `uplot`; dev `vite vitest jsdom`; `vite.config.js` con `test.environment = 'jsdom'`. Instalar (también con confirmación).
- [ ] **Step 4:** Tests de humo (`assert 1 + 1 == 2` / `expect(1+1).toBe(2)`); ejecutar ambos; esperado: PASS.
- [ ] **Step 5:** Commit `chore: scaffold data-pipeline and web`.

### Task 2: Algoritmo del horizonte

**Files:** Create `data-pipeline/lunarnav/__init__.py`, `data-pipeline/lunarnav/horizon.py`; Test `data-pipeline/tests/test_horizon.py`

**Interfaces:** Produces: `MOON_RADIUS_M: float = 1_737_400.0`; `compute_horizon(dem: np.ndarray, pixel_m: float, observer_rc: tuple[float, float], north_bearing_deg: float, observer_height_m: float = 2.0) -> np.ndarray` → forma `(360,)`, float64, grados; `dem[r, c]` con `x = +c`, `y = −r` (norte arriba), alturas en metros; `north_bearing_deg` = rumbo del norte verdadero medido en sentido horario desde "arriba" de la cuadrícula.

- [ ] **Step 1: Escribir los tests** (DEM de `(400, 600)` ceros a 5 m/px, observador en `(200, 200)`, columnas ≥ 400 = 100 m, que es un muro a 1000 m al este):
  - `test_flat_terrain_gives_geometric_dip`: DEM plano → los 360 valores ≈ −0,0869° (±0,005; es `acos(R/(R+2))`).
  - `test_ridge_east`: con `north_bearing_deg=0`, `h[90] ≈ 5,60° (±0,05)` y `h[270] ≈ −0,087° (±0,005)`.
  - `test_north_bearing_rotates`: con `north_bearing_deg=90`, `h[0] ≈ 5,60°` (±0,05).
  - `test_nan_and_edge_never_nan`: poner una franja de NaN en 10 columnas y el observador en `(200, 5)`; `np.isfinite(h).all()`.
- [ ] **Step 2:** Ejecutar `pytest tests/test_horizon.py -v`; esperado: FAIL (módulo inexistente).
- [ ] **Step 3: Implementar `compute_horizon`.** Por cada acimut `az`, rumbo en la cuadrícula `g = az + north_bearing_deg`; recorrer muestras cada `pixel_m` en dirección `(Δc, Δr) = (sin g, −cos g)` hasta salir del DEM (muestreo bilineal; ignorar NaN). Elevación de una muestra a distancia `d` y altura `h` sobre un observador de altura `h0`: con `θ = d/R`, `atan2((R+h)cosθ − (R+h0), (R+h)sinθ)`. El horizonte es el máximo por rayo; si un rayo no tiene muestras válidas, usar `−degrees(acos(R/(R+h0)))`. Vectorizar con numpy.
- [ ] **Step 4:** Ejecutar los tests; esperado: PASS.
- [ ] **Step 5:** Commit `feat: horizon profile from DEM`.

### Task 3: Recorte del DEM y rumbo del norte

**Files:** Create `data-pipeline/lunarnav/dem.py`; Test `data-pipeline/tests/test_dem.py`

**Interfaces:** Consumes: nada. Produces: `@dataclass DemCrop(heights: np.ndarray, pixel_m: float, observer_rc: tuple[float, float], north_bearing_deg: float)`; `load_dem_crop(path: str, lat_deg: float, lon_deg: float, radius_m: float = 10_000.0) -> DemCrop`.

- [ ] **Step 1: Test.** Un fixture crea con rasterio un GeoTIFF sintético de 400×400 px a 20 m/px con CRS `+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 +units=m`, centrado en el polo. `test_north_bearing_equals_longitude`: para `lon_deg=0` y `lon_deg=90` (lat −89,9) → `north_bearing_deg` ≈ `lon_deg` (±0,05; en este CRS el norte verdadero apunta radialmente hacia afuera). `test_pixel_size_and_observer_pixel`: `pixel_m == 20` y `observer_rc` coincide (±0,5 px) con la proyección del punto. `test_nodata_becomes_nan`: un valor nodata del raster aparece como `NaN`.
- [ ] **Step 2:** Ejecutar; esperado: FAIL.
- [ ] **Step 3: Implementar.** Leer con rasterio la ventana de ±`radius_m` (recortada a los bordes del raster); proyectar `(lon, lat)` con un `pyproj.Transformer` desde `crs.geodetic_crs`; `north_bearing_deg` = rumbo (desde "arriba" de la cuadrícula, horario) del vector entre el punto y el mismo punto con `lat + 0,001°`.
- [ ] **Step 4:** Ejecutar; esperado: PASS.
- [ ] **Step 5:** Commit `feat: DEM crop with grid-north bearing`.

### Task 4: Efemérides con Skyfield

**Files:** Create `data-pipeline/lunarnav/ephemeris.py`, `data-pipeline/tests/conftest.py`; Test `data-pipeline/tests/test_ephemeris.py`

**Interfaces:** Produces: `@dataclass Ephemeris(start_utc: datetime, step_s: int, sun_el: np.ndarray, sun_az: np.ndarray, earth_el: np.ndarray, earth_az: np.ndarray)` (arrays float32, grados, acimut 0–360); `compute_ephemeris(lat_deg: float, lon_deg: float, start_utc: datetime = datetime(2026,1,1,tzinfo=timezone.utc), count: int = 43_824, step_s: int = 3_600, cache_dir: Path = Path("cache")) -> Ephemeris`.

- [ ] **Step 1:** **Pedir permiso al usuario** para descargar a `data-pipeline/cache/` de NAIF/JPL: `de421.bsp` (~17 MB), `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf` y `pck00008.tpc` (confirmar los tamaños exactos al pedir). Sin permiso, los tests de este task se saltan (`conftest.py` expone un fixture `kernels_ready` que hace `pytest.skip` si faltan).
- [ ] **Step 2: Tests.** `test_default_count`: la salida por defecto tiene 43 824 muestras. `test_south_pole_sun_stays_near_horizon`: a lat −89,99, lon 0 → `abs(sun_el).max() < 2,0` (la oblicuidad lunar es 1,54°). `test_near_side_center_earth_high`: a lat 0, lon 0 → `earth_el.min() > 75` durante un mes. `test_azimuth_range`: todo acimut en `[0, 360)`.
- [ ] **Step 3:** Ejecutar; esperado: FAIL.
- [ ] **Step 4: Implementar** con `PlanetaryConstants` (leer los `.tf`, `.tpc` y el `.bpc`), `build_frame_named('MOON_ME_DE421')`, `build_latlon_degrees(frame, lat, lon)` y `(eph['moon'] + ubicación).at(t).observe(cuerpo).apparent().altaz()` para el Sol y la Tierra, con `t` en vectores de `ts.utc(...)`.
- [ ] **Step 5:** Ejecutar; esperado: PASS. Commit `feat: sun and earth ephemeris from a lunar site`.

### Task 5: Exportador, CLI y fixture sintético

**Files:** Create `data-pipeline/lunarnav/export.py`, `data-pipeline/scripts/build_site.py`, `data-pipeline/scripts/make_fixture.py`; Test `data-pipeline/tests/test_export.py`

**Interfaces:** Consumes: `Ephemeris` (Task 4). Produces: `write_site(out_dir: Path, site: dict, horizon: np.ndarray, eph: Ephemeris) -> None`. `site` trae `id, name, lat_deg, lon_deg, observer_height_m, coordinates_source, sign{es,en:{title,body,facts[]}}, sources[]`.

Formato de salida en `out_dir`:
- `ephemeris.bin`: float32 little-endian, por muestra `[sun_el, sun_az, earth_el, earth_az]`.
- `horizon.json`: `{"azimuth_step_deg": 1, "elevation_deg": [360 números]}` (índice = acimut en grados).
- `info.json`: los campos de `site` más `ephemeris{start_utc:"2026-01-01T00:00:00Z", step_s, count, file:"ephemeris.bin"}` y `bodies{sun_radius_deg:0.2666, earth_radius_deg:0}`.

- [ ] **Step 1: Test.** Con `count=48`, `test_roundtrip`: `np.fromfile` devuelve `(48, 4)` iguales a la entrada y el archivo pesa `48*16` B; `horizon.json` tiene 360 valores; `info.json` tiene `ephemeris.count == 48` y `bodies.sun_radius_deg == 0.2666`.
- [ ] **Step 2:** Ejecutar; esperado: FAIL.
- [ ] **Step 3:** Implementar `write_site`. `build_site.py <site_id> --dem <ruta> [--radius-m 10000]` lee `config/sites.json`, usa Tasks 3, 2 y 4, escribe en `web/public/sites/<id>/` y actualiza `web/public/sites/index.json` (`[{id, name}]`).
- [ ] **Step 4:** `make_fixture.py` genera con `write_site` el sitio sintético `web/tests/fixtures/tiny-site/` (id `tiny-site`, count 48, paso 3600, inicio 2026-01-01T00:00Z): horizonte `2.0` en acimut 90 y `−0.1` en el resto; Sol con `az = 90` y `el = 3·sin(2π·i/24)`; Tierra con `az = 180` y `el = −1` para `12 ≤ i < 20`, `5` en el resto. Ejecutar y comprobar los 3 archivos.
- [ ] **Step 5:** Ejecutar los tests; esperado: PASS. Commit `feat: site exporter, build CLI and synthetic fixture`.

### Task 6: Primer sitio real

**Files:** Create `data-pipeline/config/sites.json`, `data-pipeline/tests/test_sites_config.py`; genera `web/public/sites/<id>/*`

**Interfaces:** Produces: sitio real servido en `web/public/sites/<id>/` e `index.json` con una entrada.

- [ ] **Step 1: Test de configuración.** Para cada sitio: `lat_deg ∈ [−90, 90]`, `coordinates_source` y `sources` no vacíos, `sign.es` y `sign.en` con título, cuerpo y ≥ 2 datos. Esperado: FAIL (falta el archivo).
- [ ] **Step 2:** Primer sitio = **Site 01 (cresta de conexión Shackleton–de Gerlache)** de [PGDA producto 78](https://pgda.gsfc.nasa.gov/products/78). Leer sus coordenadas del README o shapefile del mismo producto (no de memoria) y registrarlas con `coordinates_source`. Redactar el cartel es/en con datos citables de fuentes NASA, sin cifras inventadas, y listar las fuentes.
- [ ] **Step 3:** **Pedir permiso** para descargar el DEM de altura del Site 01 desde `https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/`; indicar nombre y tamaño leídos del listado. Guardarlo en `data-pipeline/cache/`.
- [ ] **Step 4:** Ejecutar `data-pipeline/.venv/Scripts/python data-pipeline/scripts/build_site.py <id> --dem <ruta>`. Esperado: 3 archivos nuevos, `ephemeris.bin` de 701 184 B, `horizon.json` con 360 valores finitos.
- [ ] **Step 5:** Ejecutar el test de configuración; esperado: PASS. Commit `feat: first real site (PGDA site 01)`.

### Task 7: Validación contra JPL Horizons

**Files:** Create `data-pipeline/scripts/validate_horizons.py`, `data-pipeline/VALIDATION.md`

**Interfaces:** Consumes: `compute_ephemeris`.

- [ ] **Step 1:** El script consulta la [API de Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html) (cuerpos 10 y 399; centro `coord@301`; `COORD_TYPE='GEODETIC'`; `SITE_COORD='lon,lat,0'`; `QUANTITIES='4'`) y compara contra `compute_ephemeris` para dos puntos: el sitio de Task 6 y (lat 0, lon 0). Solo coordenadas públicas viajan a la API.
- [ ] **Step 2:** Criterio: diferencia máxima de elevación ≤ 0,1° en ambos puntos; acimut solo en (0, 0) (cerca del polo está mal condicionado), ≤ 0,2°. Ejecutar el script sobre una semana de muestras.
- [ ] **Step 3:** Escribir en `VALIDATION.md` la tabla de diferencias, la fecha y los puntos. Si se supera el umbral, investigar la convención de ejes (MOON_ME vs principal) antes de seguir.
- [ ] **Step 4:** Commit `docs: validation against JPL Horizons`.

### Task 8: Cargador de datos (JS)

**Files:** Create `web/src/data/siteData.js`; Test `web/tests/siteData.test.js`

**Interfaces:** Produces: `loadSite(baseUrl: string, id: string): Promise<Site>`; `Site = { info: object, horizon: Float32Array /*360*/, eph: { startMs: number, stepMs: number, count: number, sunEl, sunAz, earthEl, earthAz: Float32Array } }`; `parseEphemeris(buffer: ArrayBuffer, meta: {start_utc: string, step_s: number, count: number}): Site['eph']`.

- [ ] **Step 1: Test** (con `web/tests/fixtures/tiny-site/`; `fetch` simulado leyendo del disco): `eph.count === 48`, `eph.stepMs === 3_600_000`, `eph.startMs === Date.UTC(2026,0,1)`, `eph.sunEl[3]` ≈ `3·sin(π/4)` (±1e-4), `horizon.length === 360 && horizon[90] === 2`. `parseEphemeris` con un buffer de tamaño incorrecto lanza `Error` que menciona el tamaño esperado.
- [ ] **Step 2:** `npm --prefix web test`; esperado: FAIL.
- [ ] **Step 3:** Implementar con `Float32Array` sobre el buffer (de-interleaved a 4 arrays).
- [ ] **Step 4:** Esperado: PASS. Commit `feat(web): site data loader`.

### Task 9: Horizonte, índice de tiempo y margen

**Files:** Create `web/src/metrics/visibility.js`; Test `web/tests/visibility.test.js`

**Interfaces:** Consumes: `Site` (Task 8). Produces: `horizonAt(horizon: Float32Array, azDeg: number): number`; `indexAt(eph, timeMs: number): number` (índice fraccional; lanza `RangeError` fuera de `[0, count−1]`); `marginSeries(site: Site, body: 'sun'|'earth'): Float32Array` con `margin[i] = el[i] + radio − horizonAt(horizon, az[i])` (radio de `info.bodies`); visible ⇔ `margin > 0`.

- [ ] **Step 1: Tests.** `horizonAt` con un arreglo de 360 donde `h[359]=1` y `h[0]=3`: `horizonAt(h, 359.5) = 2` y `horizonAt(h, 360) = h[0]`. `indexAt(fixture.eph, start + 5·3600000) = 5`; `indexAt` en 2031 lanza `RangeError`. `marginSeries(tiny, 'sun')[2] ≈ −0,2334` y `[3] ≈ 0,3879` (±1e-3); `marginSeries(tiny, 'earth')[12] ≈ −0,9`.
- [ ] **Step 2:** Esperado: FAIL.
- [ ] **Step 3:** Implementar; interpolación lineal circular en `horizonAt`.
- [ ] **Step 4:** Esperado: PASS. Commit `feat(web): horizon lookup and visibility margin`.

### Task 10: Transiciones y ventanas

**Files:** Create `web/src/metrics/events.js`; Test `web/tests/events.test.js`

**Interfaces:** Consumes: `indexAt`, `marginSeries`. Produces: `nextTransition(site: Site, body: 'sun'|'earth', timeMs: number): { kind: 'set'|'rise', atMs: number } | null`; `visibilityWindows(site: Site, body: 'sun'|'earth', fromMs: number, toMs: number): Array<{ startMs: number, endMs: number }>`. Los cruces se interpolan linealmente entre muestras. `toMs` se recorta al final de los datos.

- [ ] **Step 1: Tests** (fixture `tiny-site`, `t0 = Date.UTC(2026,0,1)`, horas `h`; tolerancia 0,001 h):
  - Sol visible a las 5 h → `nextTransition('sun', 5h) = {kind:'set', atMs ≈ 9,62434 h}`; a las 12 h → `{kind:'rise', ≈ 26,37566 h}`.
  - Tierra a las 5 h → `set ≈ 11,85 h`; a las 15 h → `rise ≈ 19,15 h`.
  - `visibilityWindows('earth', 5h, 29h)` = `[5h–11,85h]`, `[19,15h–29h]`.
  - Día polar: sitio sintético en el test con `margin > 0` en todas las muestras → `nextTransition` es `null` y las ventanas son `[ventana completa]`. Noche polar (`margin < 0`) → `null` y `[]`.
  - Intervalo abierto al final: ventana pedida `[40h, 60h]` sobre datos que acaban en 47 h → ventanas recortadas en `47 h` (nunca pasan de `47 h`).
- [ ] **Step 2:** Esperado: FAIL.
- [ ] **Step 3:** Implementar con una pasada por la serie de márgenes.
- [ ] **Step 4:** Esperado: PASS. Commit `feat(web): rise/set transitions and visibility windows`.

### Task 11: Escenario y semáforo

**Files:** Create `web/src/metrics/scenario.js`; Test `web/tests/scenario.test.js`

**Interfaces:** Consumes: Tasks 9 y 10. Produces:
- `evaluateScenario(site: Site, timeMs: number, windowMs: number): ScenarioMetrics`, con `ScenarioMetrics = { timeMs, windowEndMs, truncated: boolean, sunElDeg, earthElDeg, sunVisible: boolean, earthVisible: boolean, nextSun, nextEarth /* resultado de nextTransition */, sunFraction, earthFraction /* 0–1 sobre la ventana */, longestDarkMs, longestEarthGapMs, earthWindows }`.
- `DEFAULT_THRESHOLDS = { minSunElDeg: 0, maxDarkH: 120, maxEarthGapH: 48 }`; `viability(m: ScenarioMetrics, th = DEFAULT_THRESHOLDS): { level: 'green'|'amber'|'red', failed: Array<'sunEl'|'dark'|'earthGap'> }` (0 fallos = verde; 1 = ámbar; ≥ 2 = rojo; fallo `sunEl` si `sunElDeg < minSunElDeg`).

- [ ] **Step 1: Tests** (tiny-site, `t = 5 h`, ventana 24 h; tolerancia 0,001): `sunElDeg ≈ 2,898`, `earthElDeg = 5`, ambos visibles; `sunFraction ≈ 0,30203`; `earthFraction ≈ 0,69583`; `longestDarkMs ≈ 16,75132 h`; `longestEarthGapMs ≈ 7,3 h`; `truncated === false`. Con ventana de 100 h → `truncated === true` y `windowEndMs` = final de los datos. `viability` con los valores por defecto = verde; con `maxDarkH: 10` = ámbar `['dark']`; con además `maxEarthGapH: 5` = rojo `['dark','earthGap']`.
- [ ] **Step 2:** Esperado: FAIL.
- [ ] **Step 3:** Implementar componiendo `nextTransition` y `visibilityWindows`; `longestDarkMs` = hueco más largo entre ventanas solares (incluidos los extremos de la ventana).
- [ ] **Step 4:** Esperado: PASS. Commit `feat(web): scenario metrics and viability`.

### Task 12: Estado, traducciones y duraciones

**Files:** Create `web/src/state.js`, `web/src/i18n.js`, `web/src/strings/es.json`, `web/src/strings/en.json`; Test `web/tests/state_i18n.test.js`

**Interfaces:** Produces: `createStore<T>(initial: T): { get(): T, set(partial: Partial<T>): void, subscribe(fn: (s: T) => void): () => void }`; `t(key: string, params?: object): string` y `setLocale(l: 'es'|'en')`; `formatDuration(ms: number): string`.

- [ ] **Step 1: Tests.** `subscribe` recibe el nuevo estado tras `set` y deja de recibir tras llamar al unsubscribe. `formatDuration(7.3*3600000) === '7 h 18 min'`; `formatDuration(51*3600000) === '2 d 3 h'`; `formatDuration(30*60000) === '30 min'`; `formatDuration(20000) === '<1 min'`. `t` devuelve la cadena según el idioma y la clave si no existe. `es.json` y `en.json` tienen exactamente las mismas claves.
- [ ] **Step 2:** Esperado: FAIL. **Step 3:** Implementar; estado de la app: `{ scenarios: { A: {siteId, timeMs}, B: {siteId, timeMs} | null }, windowMs, thresholds, playing, locale }`. **Step 4:** Esperado: PASS.
- [ ] **Step 5:** Commit `feat(web): store, i18n and duration formatting`.

### Task 13: Controles y tarjeta de escenario

**Files:** Create `web/src/panel/controls.js`, `web/src/panel/scenarioCard.js`, `web/src/panel/panel.css`; Test `web/tests/panel.test.js`

**Interfaces:** Consumes: Tasks 11 y 12. Produces: `clampTime(eph, timeMs: number): { timeMs: number, clamped: boolean }`; `renderScenarioCard(el: HTMLElement, m: ScenarioMetrics, v: ReturnType<typeof viability>, info: object): void`; `renderControls(el: HTMLElement, store, siteList: Array<{id, name}>, sites: Map<string, Site>, slot: 'A'|'B'): void`.

- [ ] **Step 1: Tests (jsdom).** `clampTime` con una fecha de 2031 devuelve el final de los datos y `clamped: true`; dentro del rango, `clamped: false`. La tarjeta con las métricas de Task 11 muestra: `[data-testid=sun-countdown]` con "4 h 37 min" (es decir `formatDuration(atMs − timeMs)`: el ocaso ocurre a las 9,62434 h y el instante es 5 h), `[data-testid=earth-gap]` con "7 h 18 min", la clase `verdict-green` y el título del sitio. En los controles, poner el `datetime-local` en 2031 deja `store.get().scenarios.A.timeMs` en el final de los datos y muestra `[data-testid=range-warning]`.
- [ ] **Step 2:** Esperado: FAIL. **Step 3:** Implementar DOM + CSS (tarjeta con cuenta atrás del ocaso solar/terrestre muy grande, semáforo, textos desde `t()`); selector de sitio, fecha/hora, ventana (1 día lunar ≈ 29,5 d, 7 d, 30 d) y umbrales editables. **Step 4:** Esperado: PASS.
- [ ] **Step 5:** Commit `feat(web): scenario card and controls`.

### Task 14: Línea de tiempo y animación

**Files:** Create `web/src/panel/timeline.js`, `web/src/panel/player.js`; Test `web/tests/timeline.test.js`

**Interfaces:** Produces: `timelineData(site: Site, fromMs: number, toMs: number): uPlot.AlignedData` (`[tSeg, sunEl, sunHorizon, earthEl, earthHorizon]`, horizonte evaluado en el acimut del cuerpo); `renderTimeline(el: HTMLElement, site: Site, fromMs: number, toMs: number, cursorMs: number): { destroy(): void }`; `advanceTime(eph, timeMs: number, dtSimMs: number): { timeMs: number, ended: boolean }`; `createPlayer(store, speedMsPerSec: number): { start(): void, stop(): void }`.

- [ ] **Step 1: Tests.** `timelineData(tiny, t0, t0+47h)`: 5 arreglos de 48 elementos; el 2º en `[3]` ≈ `2,1213`; el 3º vale `2` en todos (acimut del Sol = 90). `advanceTime` suma `dt` y con un `dt` que pasa del final devuelve `ended: true` y `timeMs` = final.
- [ ] **Step 2:** Esperado: FAIL. **Step 3:** Implementar con uPlot (cursor vertical en `cursorMs`) y `requestAnimationFrame`; velocidades 1 h/s, 6 h/s, 1 d/s; al terminar o al cambiar de sitio se detiene. **Step 4:** Esperado: PASS.
- [ ] **Step 5:** Commit `feat(web): timeline chart and player`.

### Task 15: Comparar, app completa y verificación

**Files:** Create `web/src/panel/compare.js`, `web/src/panel/panel.js`, `README.md`; Modify `web/src/main.js`, `web/index.html`; Test `web/tests/compare.test.js`

**Interfaces:** Produces: `diffMetrics(a: ScenarioMetrics, b: ScenarioMetrics): { sunFraction: number, earthFraction: number, longestDarkMs: number, longestEarthGapMs: number }` (siempre `b − a`); `mountPanel(root: HTMLElement, store, siteList, sites: Map<string, Site>): void`.

- [ ] **Step 1: Test.** `diffMetrics` con `a.sunFraction = 0.3, b.sunFraction = 0.5` → `0.2` (±1e-9); idem para los otros tres campos con valores inventados.
- [ ] **Step 2:** Esperado: FAIL. **Step 3:** Implementar `diffMetrics` y `mountPanel`: botón "Comparar" que activa el escenario B (copia de A) y muestra dos tarjetas con la diferencia resaltada (clase `better` / `worse` según el campo: más luz o más Tierra es mejor; más oscuridad o más hueco sin Tierra es peor). Misma selección de sitio con distinta fecha en A y B es válida. `main.js` carga `index.json` y todos los sitios.
- [ ] **Step 4:** Esperado: PASS (`npm --prefix web test` completo).
- [ ] **Step 5: Verificar en el navegador.** `npm --prefix web run dev`; en el navegador integrado: elegir el sitio real, una fecha, ver tarjeta, gráfica y cuentas atrás; activar Comparar con otra fecha; poner una fecha de 2031 (debe aparecer el aviso y fijarse en el límite); reproducir la animación hasta el final. Sin errores en consola. Comprobar que el ocaso solar cuadra con el cruce de la gráfica.
- [ ] **Step 6:** `README.md`: qué hace, cómo regenerar datos, fuentes, cita de Barker et al. 2021 y límites (DEM sin anillo lejano, píxeles interpolados, Tierra por su centro). Commit `feat: compare mode, app wiring and README`.
