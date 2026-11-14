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

## Adenda — límite de pendiente por sitio (aprobada 2026-11-14)

El límite fijo de 25° casi no estorbaba en 4 de los 5 sitios (0–0,6 % del terreno lo superaba) y hacía imposible el Site 04 (pared de cráter, pendiente de 32,7° en la meta). Se sustituye por un límite **por sitio, calculado al cargarlo**:

- Escalera de límites `15, 20, 25, 30, 35, 40, 45°`. Se usa el **más bajo** con el que la meta es alcanzable desde ~400 m (suelo en 15°, elegido por el equipo). Resultado esperado con los datos actuales: 15° en los sitios 01, 06, 23 y Haworth; 35° en el Site 04.
- La búsqueda de ruta exige `límite − 2°` (margen) para que un pasillo de un nodo siga siendo transitable por el robot continuo, que usa el límite completo.
- El robot recibe el límite del sitio; la ayuda de la escena lo muestra ("Límite de pendiente de este sitio: N°") y el aviso de bloqueo usa ese valor.
- Si ni 45° sirve, se mantiene el aviso "sin ruta" y el robot arranca en el cartel.
- `findStart` devuelve también la ruta (nodos de la salida a la meta) para poder probar con un piloto automático.
- Prueba de aceptación: un piloto automático que sigue la ruta con las reglas reales del robot llega al cartel en los 5 sitios.
