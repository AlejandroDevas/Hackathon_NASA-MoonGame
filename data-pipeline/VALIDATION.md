# Validación de las efemérides contra JPL Horizons

- **Fecha de la comparación:** 2026-11-14
- **Muestras:** dos semanas de 168 horas consecutivas (paso 1 h): una desde 2026-01-01T00:00Z y otra desde 2030-12-24T00:00Z, para cubrir los dos extremos del rango de datos.
- **Nuestro cálculo:** Skyfield + `de421.bsp`, `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf`, `pck00008.tpc`, marco `MOON_ME_DE421`.
- **Referencia:** [API de Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html), centro `coord@301` (sitio geodético en la Luna), marco MEAN_ME, cuerpos 10 (Sol) y 399 (Tierra), cantidad 4 (acimut/elevación aparentes, sin refracción). Horizons usa DE441; nosotros DE421.
- **Criterio:** diferencia máxima ≤ 0,1° en elevación y ≤ 0,2° en acimut, en ambos puntos.
- **Script:** `scripts/validate_horizons.py` (solo envía coordenadas públicas).

| Semana desde | Punto | Cuerpo | Dif. máx. de elevación (°) | Dif. máx. de acimut (°) |
|---|---|---|---|---|
| 2026-01-01 | Centro del Site 01 (−89,4632; −137,4896) | Sol | 0,0000 | 0,0000 |
| 2026-01-01 | Centro del Site 01 | Tierra | 0,0000 | 0,0000 |
| 2026-01-01 | Región subterrestre (0, 0) | Sol | 0,0000 | 0,0003 |
| 2026-01-01 | Región subterrestre (0, 0) | Tierra | 0,0000 | 0,0001 |
| 2030-12-24 | Centro del Site 01 | Sol | 0,0000 | 0,0000 |
| 2030-12-24 | Centro del Site 01 | Tierra | 0,0000 | 0,0000 |
| 2030-12-24 | Región subterrestre (0, 0) | Sol | 0,0000 | 0,0004 |
| 2030-12-24 | Región subterrestre (0, 0) | Tierra | 0,0000 | 0,0001 |

**Resultado:** cumple el criterio con mucho margen (diferencias por debajo de 0,0005° en acimut y de 0,0001° en elevación), también en el acimut del sitio polar. Esto valida las efemérides, el marco de referencia y la longitud este positiva. **No** valida el horizonte del terreno ni la orientación de la cuadrícula del DEM (ver README, límites).
