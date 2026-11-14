# Validación de las efemérides contra JPL Horizons

- **Fecha de la comparación:** 2026-11-14
- **Muestras:** 168 horas consecutivas desde 2026-01-01T00:00Z (paso 1 h).
- **Nuestro cálculo:** Skyfield + `de421.bsp`, `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf`, `pck00008.tpc`, marco `MOON_ME_DE421`.
- **Referencia:** [API de Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html), centro `coord@301` (sitio geodético en la Luna), marco MEAN_ME, cuerpos 10 (Sol) y 399 (Tierra), cantidad 4 (acimut/elevación aparentes, sin refracción). Horizons usa DE441; nosotros DE421.
- **Criterio:** diferencia máxima de elevación ≤ 0,1° en ambos puntos; acimut ≤ 0,2° solo en (0, 0), porque cerca del polo el acimut está mal condicionado.
- **Script:** `scripts/validate_horizons.py` (solo envía coordenadas públicas).

| Punto | Cuerpo | Dif. máx. de elevación (°) | Dif. máx. de acimut (°) |
|---|---|---|---|
| Centro del Site 01 (−89,4632; −137,4896) | Sol | 0,0000 | n/a (cerca del polo) |
| Centro del Site 01 (−89,4632; −137,4896) | Tierra | 0,0000 | n/a (cerca del polo) |
| Región subterrestre (0, 0) | Sol | 0,0000 | 0,0003 |
| Región subterrestre (0, 0) | Tierra | 0,0000 | 0,0001 |

**Resultado:** cumple el criterio con mucho margen (diferencias por debajo de 0,0001° en elevación). Esto valida el marco de referencia y la longitud este positiva usada para las efemérides. **No** valida el horizonte del terreno ni la orientación de la cuadrícula del DEM (ver README, límites).
