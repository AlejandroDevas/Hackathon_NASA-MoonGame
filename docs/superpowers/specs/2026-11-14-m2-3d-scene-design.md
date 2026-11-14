# M2 — Escena 3D con robot (diseño corto)

Fecha: 2026-11-14 · Estado: aprobado por el equipo en conversación (incluido el límite de pendiente de 25°).
Detalla el §5.4 del [diseño general](2026-11-14-lunar-navigator-design.md); lo demás de ese documento sigue vigente.

## Intención y por qué
Hacer visible lo que el panel calcula: terreno real del sitio, Sol rasante con sombras reales, Tierra sobre el horizonte, y un robot que el jugador conduce hasta el cartel del sitio. Es la parte "juego" del reto (educational game) y el atractivo para el jurado; el panel sigue siendo la fuente de las métricas.

## Objetivos
- Terreno LOLA real del Site 01 (recorte de ~5 km, 5 m/px) en 3D, alineado con el norte verdadero.
- Luz direccional según el Sol de la fecha del panel, con sombras; esfera de la Tierra en su posición; cielo negro con estrellas; silueta del horizonte lejano desde `horizon.json`.
- Robot en tercera persona (WASD/flechas) que sigue la altura del terreno, se inclina con la pendiente y **no puede subir pendientes de más de 25°** (obstáculo infranqueable).
- Cartel HTML con el texto de `info.json` (es/en) al acercarse a menos de 25 m del punto central.
- Integración con el panel: la fecha del escenario A (y la animación) mueven el Sol y la Tierra en el 3D. En modo Comparar el 3D muestra el escenario A.

## No-objetivos
- Físicas de choque con Rapier, modelos 3D descargados, texturas descargadas (la Tierra es una esfera con sombreado sencillo; una textura real se pedirá con permiso más adelante).
- Varios sitios en el 3D (M3), sonido y pulido (M4), móvil táctil.
- Vista del terreno más allá del recorte (solo la silueta del horizonte).

## Anti-objetivos
- Que el Sol o la Tierra del 3D no coincidan con las métricas del panel (misma fuente: `ephemeris.bin` + `horizon.json`).
- Que el terreno quede girado respecto al horizonte (error de norte): el acimut 0 del 3D debe ser el norte verdadero.

## Decisiones (mías, revisables)
- **Terreno:** `terrain.bin` = alturas Uint16 little-endian del recorte de 5 km (1001×1001), normalizadas entre `min_m` y `max_m` guardados en `info.json` (~2 MB). `info.json` suma un bloque `terrain` con `file`, `size`, `pixel_m`, `min_m`, `max_m`, `observer_rc` y `north_bearing_deg`. Los NaN se rellenan con `min_m` al exportar.
- **Ejes de escena:** x = este, y = arriba, z = sur (norte = −z). El terreno se rota para que el norte verdadero sea −z usando `north_bearing_deg`.
- **Sol y Tierra:** dirección = (acimut, elevación) del instante, interpolados entre muestras; luz direccional con sombras (shadow map acotado al recorte); la Tierra a distancia fija grande.
- **Robot:** procedural (cuerpo, ruedas, mástil), velocidad ~4 m/s (Shift = ×3); altura por muestreo bilineal; orientación por normal del terreno; movimiento bloqueado (se desliza o se detiene) si la pendiente del tramo supera 25°. Arranca a ~400 m del punto central, hacia el borde del recorte.
- **Cartel:** panel HTML sobre el canvas, abre/cierra por distancia al punto central.
- **Pruebas:** módulos puros con tests (lectura de `terrain.bin`, muestreo de altura, vector del Sol, cinemática del robot con límite de pendiente, estado del cartel). El dibujo WebGL se verifica en el navegador (el motor de pruebas no tiene WebGL).
- **Three.js** 0.187 vía npm, sin plugins.
