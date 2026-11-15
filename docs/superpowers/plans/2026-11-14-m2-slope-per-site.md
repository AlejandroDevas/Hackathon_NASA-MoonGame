# Límite de pendiente por sitio Implementation Plan

> **Plan histórico.** Ya se ejecutó; el estado actual del proyecto está en el [README](../../../README.md) y en los diseños de `docs/superpowers/specs/`. Se conserva como registro de cómo se construyó.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada sitio usa el límite de pendiente más bajo (desde 15°, pasos de 5°) con el que la meta sigue siendo alcanzable.

**Architecture:** `traversal.js` calcula el límite y la ruta (BFS con margen de 2°); `robot.js` recibe el límite como parámetro; `view3d.js` lo aplica y lo muestra.

**Tech Stack:** JavaScript puro, vitest + jsdom (sin cambios de dependencias).

**Spec:** `docs/superpowers/specs/2026-11-14-m2-3d-scene-design.md` (sección "Adenda — límite de pendiente por sitio").

## Global Constraints

- Escalera `SLOPE_LADDER_DEG = [15, 20, 25, 30, 35, 40, 45]`; margen de búsqueda de ruta `ROUTE_MARGIN_DEG = 2`; el robot usa el límite completo. `MAX_SLOPE_DEG = 25` sigue exportado como valor por defecto de `stepRobot`.
- Distancia objetivo de salida 400 m; semilla a ≤ 20 m de la meta; cartel a < 25 m.
- Textos es + en con las mismas claves; nada se descarga.

## Review Focus

1. Desajuste entre la ruta BFS (con margen) y el robot continuo: la ruta debe poder recorrerse (Task 3, piloto automático en los 5 sitios reales).
2. Terreno plano o muy empinado por todas partes: el límite devuelto es 15 o 45 respectivamente, y el caso imposible no falla en silencio (Task 2).
3. Cambiar de sitio: el robot y el aviso usan el límite del sitio nuevo, no el del anterior (Task 3).

---

### Task 1: El robot acepta un límite de pendiente

**Files:** Modify `web/src/scene/robot.js`; Test `web/tests/robot.test.js`

**Interfaces:** Produces: `stepRobot(state, input, terrain, dtSeconds, limitDeg = MAX_SLOPE_DEG): RobotState` (el candidato se rechaza si `slopeDegAt > limitDeg`).

- [ ] **Step 1: Test que falla.** Con `makeTerrain({rows: 101, cols: 101, observerRc: [50, 50], height: (r, c) => 1.82 * c})` (≈ 20° al este): desde (0,0) rumbo 90, 1 s → con `limitDeg = 15` queda `blocked true` y `x ≈ 0`; sin el parámetro (25°) avanza `x ≈ 4` y `blocked false`.
- [ ] **Step 2:** `npm --prefix web test`; esperado: FAIL.
- [ ] **Step 3:** Añadir el parámetro y usarlo en lugar de la constante. **Step 4:** esperado: PASS (suite completa). **Step 5:** commit `feat(web): robot slope limit as a parameter`.

### Task 2: Límite por sitio y ruta en `traversal.js`

**Files:** Modify `web/src/scene/traversal.js`; Test `web/tests/traversal.test.js`

**Interfaces:**
- `SLOPE_LADDER_DEG`, `ROUTE_MARGIN_DEG` (constantes exportadas).
- `findStart(t, goal, targetDistM, {strideM = 10, limitDeg = MAX_SLOPE_DEG, marginDeg = 0}): {x, z, headingDeg, distanceM, route: Array<{x, z}>} | null` (un nodo es transitable si `slopeDegAt ≤ limitDeg − marginDeg`; `route` va del punto de salida a la semilla, ambos incluidos).
- `planStart(t, goal, targetDistM, opts): {x, z, headingDeg, distanceM, route, limitDeg, reachable}`: recorre la escalera, usa el primer límite con ruta (con `marginDeg = ROUTE_MARGIN_DEG`); si ninguno sirve, `{x: goal.x, z: goal.z, headingDeg: 0, distanceM: 0, route: [], limitDeg: 45, reachable: false}`.

- [ ] **Step 1: Tests que fallan** (reemplazan los de `planStart` actuales): tiny-site → `reachable true`, `limitDeg 15`, `route` no vacía, primer punto = salida; terreno de ≈ 32° por todas partes (`height = 3.1 * c`) → `limitDeg 35`; terreno de ≈ 50° (`height = 6 * c`) → `reachable false`, `limitDeg 45`, `route` vacía; `findStart` con `limitDeg: 15` y `marginDeg: 2` sobre el tiny-site exige pendiente ≤ 13 en cada nodo de la ruta (comprobar con `slopeDegAt`).
- [ ] **Step 2:** esperado: FAIL. **Step 3:** implementar (BFS con mapa de padres para la ruta). **Step 4:** esperado: PASS. **Step 5:** commit `feat(web): per-site slope limit and route`.

### Task 3: Aplicarlo en la escena y probarlo con los 5 sitios reales

**Files:** Modify `web/src/scene/view3d.js`, `web/src/strings/es.json`, `web/src/strings/en.json`; Test `web/tests/autopilot.test.js` (nuevo)

**Interfaces:** Consumes: `planStart` (Task 2), `stepRobot(..., limitDeg)` (Task 1). Claves nuevas: `scene.slopeLimit` ("Límite de pendiente de este sitio: {limit}°" / en); `scene.blocked` pasa a llevar `{limit}`.

- [ ] **Step 1: Test que falla** (`autopilot.test.js`, datos reales de `web/public/sites/index.json`, un test por sitio con timeout de 30 s): `planStart` es `reachable`; un piloto automático (robot con `stepRobot(..., plan.limitDeg)`, `dt = 0.1`, rumbo hacia el siguiente nodo de `route`, avanzar hasta estar a < 3 m del nodo) recorre toda la ruta sin más de 20 pasos bloqueados seguidos y termina a < 25 m del origen. Se espera `limitDeg 15` para `site01-connecting-ridge` y `35` para `site04-shackleton-rim`.
- [ ] **Step 2:** esperado: FAIL (aún sin la lógica en la escena el test de ruta ya pasa por Task 2; si pasara de entrada, el test que falla es el de `scene.slopeLimit` en `es.json`/`en.json` con las mismas claves). **Step 3:** en `view3d.js`: guardar `slopeLimitDeg = plan.limitDeg` al cargar el sitio, pasarlo a `stepRobot`, escribirlo en la ayuda y en el aviso de bloqueo (`t('scene.blocked', {limit})`); recalcular textos al cambiar de sitio. Actualizar las cadenas.
- [ ] **Step 4:** `npm --prefix web test` y `npm --prefix web run build`; esperado: PASS. **Step 5: Navegador:** cambiar entre los 5 sitios: la ayuda muestra 15° o 35° según el sitio, el robot arranca a ~400 m (el Site 04 ya no muestra el aviso de "sin ruta"), sin errores en consola; conducir en el Site 01 hasta un tramo de más de 15° y ver el bloqueo con el valor correcto.
- [ ] **Step 6:** commit `feat(web): per-site slope limit in the 3D scene`.
