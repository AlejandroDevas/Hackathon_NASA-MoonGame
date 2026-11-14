# Lunar Landing Site Navigator — Diseño

Fecha: 2026-11-14 · Estado: **borrador pendiente de aprobación**
Reto: NASA Space Apps 2026, "CLPS Lunar Mission Browser" (enunciado oficial pegado por el equipo).

## 1. Intención y por qué

Los planificadores de misiones lunares necesitan evaluar rápido qué pasa con la luz solar y la visibilidad de la Tierra si cambian el sitio o la fecha de aterrizaje. Las herramientas actuales (Quickmap, Moon Trek, JPL Horizons) son potentes pero difíciles para no especialistas.

Construimos un **juego educativo 3D en el navegador**: el jugador conduce un robot por sitios reales del polo sur lunar. Cada sitio tiene un cartel explicativo. Un **panel de planificación** muestra las métricas del reto y permite comparar sitios y fechas. El juego es la puerta de entrada; el panel es lo que responde al reto.

Tiene que servir a dos públicos: planificadores (métricas precisas, comparación rápida) y público general/educadores (entender por qué el polo sur es tan distinto).

## 2. Objetivos, no-objetivos y anti-objetivos

**Objetivos (v1)**
- Elegir un sitio de una lista curada y una fecha/hora; ver Sol y Tierra respecto al horizonte real del sitio.
- Métricas: elevación solar, ¿hay Sol?, ¿hay Tierra?, tiempo hasta el próximo ocaso solar y terrestre, % de horas con luz, ventanas de visibilidad de la Tierra, periodo oscuro más largo.
- Línea de tiempo de un día lunar y de un mes, con animación.
- Comparar dos escenarios (sitio+fecha) lado a lado.
- Robot conducible sobre terreno LOLA real, con sombras reales y cartel en cada sitio.
- Todo estático, sin servidor, publicable en GitHub Pages o Netlify.

**No-objetivos (v1)**
- Coordenadas personalizadas con terreno real (extra posterior, ver §7).
- Físicas de choque con Rapier; el robot sigue la altura del mapa.
- Simulación de potencia o térmica detallada.
- Móvil como objetivo principal (que no se rompa, pero no se optimiza).

**Anti-objetivos (sería un fracaso aunque funcione)**
- Un juego bonito sin métricas verificables.
- Números que no coincidan con una fuente oficial (JPL Horizons).
- Que un planificador necesite más de unos pocos clics para comparar dos escenarios.

## 3. Restricciones

- Equipo con Python + HTML/CSS/JS. Entorno: Node 24, Python 3.11, git.
- Sin atmósfera: el horizonte lo da el terreno y la curvatura lunar, sin refracción.
- Datos públicos de NASA (PGDA/LOLA, SPICE vía Skyfield). Citar Barker et al. 2021 (doi:10.1016/j.pss.2020.105119). Los píxeles de 5 m están en su mayoría interpolados (incertidumbre típica 0,3–0,5 m en altura y 1,5–2,5° en pendiente).
- Los DEM de 5 m solo cubren el polo sur (mosaico 87–90°S de 3,3 GB, o recortes por sitio). Sitios fuera de esa zona (Apolo, Chandrayaan-3 a ~69°S) necesitan un DEM global de menor resolución (producto exacto por verificar).
- Coordenadas exactas de los sitios: **sin verificar**. Hay que tomarlas de fuentes oficiales (p. ej. NTRS 20250011660) antes de precalcular.

## 4. Enfoques considerados

| | Enfoque | Ventaja | Costo |
|---|---|---|---|
| **A (elegido)** | Robot 3D en cada sitio + panel de planificación + modo comparar | Mejor efecto visual (sombras reales) y cubre las métricas del reto | Es el que más trabajo lleva (terreno 3D) |
| B | Mapa polar 2D como tablero | Rápido; comparación muy clara | Pierde las sombras reales y el atractivo del robot |
| C | A + misiones con objetivos | Más educativo | Trabajo extra; queda como extra sobre A |

Elegido por el equipo: **A**, empezando por el panel y los datos.

## 5. Diseño

### 5.1 Pipeline de datos (Python, se ejecuta una vez, offline)

Por cada sitio, entrada: lat/lon (MOON_ME) y altura del observador (parámetro, por defecto 2 m).

1. **Terreno:** recorte del DEM alrededor del sitio (~5 km de lado a 5 m/px para el 3D) guardado como altura de 16 bits.
2. **Horizonte:** para cada acimut (360, uno por grado), ángulo máximo del terreno hasta el alcance disponible del DEM, con curvatura lunar (R = 1737,4 km). Un anillo de menor resolución aporta las cumbres lejanas.
3. **Efemérides:** Skyfield con `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf` y `pck00008.tpc`. Elevación y acimut del Sol y de la Tierra vistos desde el sitio, con libración real. Rango por defecto **2026-01-01 a 2030-12-31, paso de 1 hora**, cuantizado a Int16 (0,01°): unos 350 KB por sitio.
4. **Validación:** comparar una muestra contra JPL Horizons. Tolerancia a definir en el plan; el resultado va en el README.
5. **Salida** en `public/sites/<id>/`: `terrain.bin`, `horizon.json`, `ephemeris.bin`, `info.json` (nombre, coordenadas, texto del cartel es/en, fuentes).

### 5.2 Motor de métricas (JavaScript, en el navegador)

Corre sobre `ephemeris.bin` + `horizon.json`, sin servidor.

- **Visible** = elevación del cuerpo > horizonte en ese acimut. Para el Sol se usa el **borde superior del disco** (elevación + radio angular). Decisión mía; se puede afinar.
- Tiempo hasta ocaso solar / terrestre: búsqueda hacia delante en la serie, con interpolación lineal en el cruce para no depender del paso de 1 h.
- % de luz y periodo oscuro más largo sobre una ventana elegida (día lunar, mes, rango libre).
- Ventanas de visibilidad de la Tierra: lista de intervalos de inicio/fin.
- **Semáforo de viabilidad:** el usuario fija umbrales (elevación solar mínima, oscuridad máxima soportable, hueco máximo sin Tierra) y cada escenario sale verde/ámbar/rojo. Es propuesta mía, no viene del enunciado.

### 5.3 Panel (HTML/CSS, encima de la escena 3D)

- Selector de sitio y de fecha/hora, con línea de tiempo y botón de animación.
- Tarjetas de métricas con las cuentas atrás del ocaso solar y terrestre muy visibles.
- Gráfica de elevación de Sol y Tierra contra el horizonte (uPlot).
- **Modo comparar:** dos columnas (A y B), cada una sitio+fecha, con diferencias resaltadas.
- Textos en archivo de traducciones (es/en).

### 5.4 Escena 3D y robot (después del panel)

Three.js + Vite. Terreno desde `terrain.bin`, luz direccional orientada por el Sol calculado (las sombras salen solas), Tierra como esfera con textura en su posición real, cielo negro. El horizonte lejano se dibuja con un anillo generado desde `horizon.json`. Robot en tercera persona que sigue la altura del mapa; cartel como panel HTML al llegar al punto del sitio.

## 6. Orden de entrega

- **M0 — Datos:** pipeline para **un** sitio, con validación contra Horizons.
- **M1 — Panel con datos reales** (sin 3D): métricas, línea de tiempo, comparar dos escenarios.
- **M2 — Escena 3D:** terreno, luz solar, Tierra, robot y cartel.
- **M3 — Escalar** a 5–8 sitios curados (Artemis III, CLPS, Apolo/Chandrayaan-3 como contraste).
- **M4 — Pulir:** animación, sonido, textos, README con fuentes y límites.

## 7. Decisiones mías (revisables)

- Lado del recorte 3D: ~5 km; paso de efemérides: 1 h; rango 2026–2030.
- Borde superior del Sol para decidir visibilidad.
- Semáforo de viabilidad con umbrales editables.
- Coordenadas personalizadas **fuera de v1**. Extra posible más adelante: cuadrícula precalculada de métricas con horizonte plano (sin terreno), indicando claramente esa limitación.
- Sitios de la lista curada: los 9 de Artemis III más IM-1, IM-2, Chandrayaan-3, Apolo 11 y 17; v1 puede empezar con 3.

## 8. Pendiente del equipo / abierto

- Fecha de entrega y número de personas (cambia cuántos sitios y qué extras entran).
- Idioma principal de la interfaz (propuesta: es + en).
- Qué debe aprender o sentir el jugador en dos minutos (afecta a los carteles y al tono).
- Permiso para descargar archivos cuando toque (kernels SPICE de Skyfield, DEM de PGDA); se pedirá cada vez con nombre, origen y tamaño.

## 9. Lo que queda al constructor

Estructura exacta de carpetas, formato binario concreto, tolerancias de validación, librería de gráficas definitiva, estética y UX de detalle.
