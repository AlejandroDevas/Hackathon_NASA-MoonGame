# M4 — Sonido y pulido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el sonido actual probado y robusto y cerrar el pulido pendiente de M4 (accesibilidad, avisos, sombras, pista de luz continua, README).

**Architecture:** Sin dependencias nuevas. Lo que era lógica dentro de `view3d.js` y no se podía probar sin WebGL (el cartel) pasa a un módulo propio; el resto son cambios pequeños en módulos que ya tienen tests.

**Tech Stack:** JavaScript puro, Three.js 0.187, vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-14-lunar-navigator-design.md` (§6 M4: "animación, sonido, textos, README con fuentes y límites"). El equipo decidió conservar el sonido actual: un pitido de dos notas al abrirse el cartel, apagado por defecto, activable con el botón del panel.

## Global Constraints

- El sonido es opcional y **no se crea ningún `AudioContext` hasta que el usuario pulsa el botón** (política de autoplay de los navegadores).
- En la Luna no hay atmósfera: no se añade sonido ambiente ni de motor (sería físicamente falso).
- Textos en es + en con las mismas claves (hay un test de paridad). Nada se descarga; sin dependencias nuevas.
- Escena: ejes x = este, y = arriba, z = sur; `MAX_SLOPE_DEG = 25` es solo el valor por defecto; cada sitio usa su límite (`planStart`).
- No se edita lo que no pertenece a esta tanda: la línea sobre el sonido del README sí entra (la describe).

## Review Focus

1. Navegador sin Web Audio (o que lanza al crear el contexto): el botón no rompe nada y el estado queda en "apagado" (Task 1).
2. Silenciar y volver a activar: se reutiliza el mismo contexto, no se crean varios, y `dispose` lo cierra una sola vez (Task 1).
3. Cartel cerrado: no debe estar expuesto a lectores de pantalla ni al orden de tabulación (Task 2).
4. Cambio de idioma: `<html lang>` y el texto del cartel se actualizan (Task 2).
5. Terreno girado (el Site 01 tiene rumbo ~222,5°): el marco de sombras debe cubrir las esquinas, que están a más de la mitad del lado (Task 4).

---

### Task 1: Sonido probado y robusto

**Files:** Modify `web/src/scene/audioCue.js`; Test `web/tests/audioCue.test.js` (nuevo), `web/tests/panelMount.test.js`

**Interfaces:**
- Produces: `createAudioCue({ AudioContextClass }?: { AudioContextClass?: typeof AudioContext }): { setEnabled(next: boolean): boolean, play(): void, dispose(): void }`. Por defecto `AudioContextClass` se resuelve de `window.AudioContext ?? window.webkitAudioContext` **al llamar a `setEnabled`**, no al crear. `setEnabled(true)` devuelve `false` (y deja el sonido apagado) si no hay clase o si construir el contexto lanza.
- Consumes: `mountPanel(..., { renderTimeline, audioCue })` (el botón `data-testid="sound-toggle"` ya existe).

- [ ] **Step 1: Tests que fallan** (`audioCue.test.js`, con un `FakeAudioContext` que cuenta instancias y registra osciladores): `createAudioCue` no construye ningún contexto; `setEnabled(true)` construye uno, lo reanuda si está `suspended` y devuelve `true`; `play()` con el contexto `running` crea 2 osciladores a 660 y 880 Hz; `play()` apagado, o con contexto `suspended`, no crea ninguno; `setEnabled(false)` + `setEnabled(true)` reutiliza la misma instancia (1 construcción en total); sin clase disponible `setEnabled(true) === false` y `play()` no lanza; si el constructor lanza, devuelve `false`; `dispose()` cierra el contexto una vez y un segundo `dispose()` no lanza. En `panelMount.test.js`: con un `audioCue` falso cuyo `setEnabled` devuelve `false`, pulsar `sound-toggle` deja `store.get().soundEnabled === false` y `aria-pressed="false"`; con uno que devuelve `true`, queda `true` y `aria-pressed="true"`.
- [ ] **Step 2:** `npm --prefix web test`; esperado: FAIL.
- [ ] **Step 3:** Implementar la inyección de `AudioContextClass`, el `try/catch` del constructor y `dispose` idempotente.
- [ ] **Step 4:** Esperado: PASS (suite completa). **Step 5:** commit `feat(web): tested and hardened audio cue`.

### Task 2: Cartel accesible (módulo propio) e idioma de la página

**Files:** Create `web/src/scene/signPanel.js`, `web/tests/signPanel.test.js`; Modify `web/src/scene/view3d.js`, `web/src/scene/scene.css`, `web/src/panel/panel.js`, `web/src/strings/es.json`, `web/src/strings/en.json`, `web/tests/panelMount.test.js`

**Interfaces:**
- Produces: `createSignPanel(): { el: HTMLElement, setInfo(info: object, locale: 'es'|'en'): void, setOpen(open: boolean): void, isOpen(): boolean }`. `el` es un `<aside class="scene-sign" role="status">`; cerrado lleva `aria-hidden="true"`, abierto `aria-hidden="false"` y la clase `open`. El contenido es el de `info.sign[locale]` (título, cuerpo, datos y la pista `scene.signClose`).
- `view3d.js` usa `createSignPanel` en lugar de construir el cartel a mano, y pone al lienzo `role="img"` y `aria-label = t('scene.label')`. `panel.js` fija `document.documentElement.lang` al idioma activo (al montar y al cambiarlo). Clave nueva: `scene.label` (es: "Vista 3D del sitio con el robot"; en: "3D view of the site with the rover").
- CSS: el cartel cerrado usa `visibility: hidden` (con la transición de salida retrasada) para que tampoco reciba foco.

- [ ] **Step 1: Tests que fallan** (`signPanel.test.js`): recién creado, `aria-hidden === "true"` e `isOpen() === false`; `setOpen(true)` → `aria-hidden === "false"`, clase `open` e `isOpen() === true`; `setInfo(info, 'es')` pone el título "Sitio sintético" (fixture) y `setInfo(info, 'en')` "Synthetic site"; incluye la pista `scene.signClose`; con una `info` sin `sign.en` cae a `es`. En `panelMount.test.js`: tras cambiar el selector de idioma a `en`, `document.documentElement.lang === 'en'` (y `'es'` al volver).
- [ ] **Step 2:** Esperado: FAIL. **Step 3:** Implementar `signPanel.js`, usarlo en `view3d.js`, `lang` en `panel.js`, `scene.label` y el CSS.
- [ ] **Step 4:** `npm --prefix web test` y `npm --prefix web run build`; esperado: PASS. **Step 5:** commit `feat(web): accessible sign panel and page language`.

### Task 3: El aviso distingue "demasiado empinado" de "borde del terreno"

**Files:** Modify `web/src/scene/robot.js`, `web/src/scene/view3d.js`, `web/src/strings/es.json`, `web/src/strings/en.json`; Test `web/tests/robot.test.js`

**Interfaces:**
- `RobotState` suma `blockedBy: 'slope' | 'edge' | null` (`blocked` sigue siendo booleano y es `blockedBy !== null`). `'edge'` cuando el siguiente punto queda fuera del terreno o su pendiente no es finita (borde o alturas sin datos); `'slope'` cuando es finita y supera el límite.
- Clave nueva `scene.blockedEdge` (es: "Límite del terreno cartografiado: el robot no puede seguir."; en: "Edge of the mapped terrain: the rover cannot go further."). `view3d.js` muestra `scene.blocked` o `scene.blockedEdge` según `robot.blockedBy`.

- [ ] **Step 1: Tests que fallan** (`robot.test.js`): contra el acantilado del tiny-site `blockedBy === 'slope'` (y `blocked === true`); en el borde (desde x = 249, rumbo 90) `blockedBy === 'edge'`; con la columna de alturas `NaN` `blockedBy === 'edge'`; con avance libre `blockedBy === null` y `blocked === false`; `createRobot(...).blockedBy === null`.
- [ ] **Step 2:** Esperado: FAIL. **Step 3:** Implementar. **Step 4:** Esperado: PASS. **Step 5:** commit `feat(web): tell slope blocks from terrain edge`.

### Task 4: El marco de sombras cubre todo el terreno

**Files:** Modify `web/src/scene/world.js`; Test `web/tests/world.test.js`

**Interfaces:**
- Produces: `shadowFrustumHalfSize(terrain: Terrain): number` = la mayor distancia desde el origen de escena a una de las 4 esquinas de la malla (vía `gridToScene`), más 100 m, redondeada hacia arriba a un múltiplo de 100. `createWorld` la usa para `left/right/top/bottom` de la cámara de sombras (hoy fija en ±2600).

- [ ] **Step 1: Tests que fallan:** `shadowFrustumHalfSize(tiny)` es `500` (esquinas a ~353,6 m); con un `makeTerrain` de 1001×1001 a 5 m, `observerRc [500, 500]` y `northBearingDeg 222.5` es `3700`; con el observador descentrado (`observerRc [100, 100]`, 1001×1001) cubre la esquina lejana (≥ la distancia real a esa esquina); `createWorld(tinySite).sun.shadow.camera.right === 500`.
- [ ] **Step 2:** Esperado: FAIL. **Step 3:** Implementar. **Step 4:** Esperado: PASS. **Step 5:** commit `fix(web): shadow frustum covers the whole terrain`.

### Task 5: Pista de luz continua más larga

**Files:** Modify `web/src/metrics/scenario.js`, `web/src/panel/scenarioCard.js`, `web/src/strings/es.json`, `web/src/strings/en.json`; Test `web/tests/scenario.test.js`, `web/tests/panel.test.js`

**Interfaces:**
- `evaluateScenario` devuelve además `longestSunMs: number`: la ventana solar más larga dentro de `[timeMs, windowEndMs]` (0 si no hay; ventana completa en día polar). `renderScenarioCard` añade `stat` con `data-testid="sun-longest"` y etiqueta `card.longestSun` (es: "Luz continua más larga"; en: "Longest continuous sunlight"). `viability` no cambia.

- [ ] **Step 1: Tests que fallan:** tiny-site, t = 5 h, ventana 24 h → `longestSunMs ≈ 4,62434 h` (±0,001 h); día polar (Sol siempre visible, ventana 24 h) → 24 h; noche polar → 0. En `panel.test.js`: la tarjeta con las métricas del tiny-site muestra `sun-longest` con "4 h 37 min".
- [ ] **Step 2:** Esperado: FAIL. **Step 3:** Implementar (máximo de `endMs − startMs` sobre las ventanas solares que ya se calculan). **Step 4:** Esperado: PASS. **Step 5:** commit `feat(web): longest continuous sunlight hint`.

### Task 6: README, verificación y cierre

**Files:** Modify `README.md`

- [ ] **Step 1:** README: sección de sonido (opcional, apagado por defecto, qué hace, por qué no hay sonido ambiente) y la lista de límites al día (cartel accesible, sombras sobre todo el terreno, pista de luz continua). La línea sobre sonido ya existente en el árbol de trabajo se conserva y se integra.
- [ ] **Step 2:** `npm --prefix web test`, `data-pipeline/.venv/Scripts/python -m pytest data-pipeline/tests -q -W ignore` y `npm --prefix web run build`; esperado: todo PASS.
- [ ] **Step 3: Navegador** (mostrar el panel del navegador, porque oculto pausa la animación): activar el sonido y ver que el botón cambia y no hay errores; cartel cerrado con `aria-hidden="true"` y abierto con `"false"`; cambiar a inglés y comprobar `document.documentElement.lang`; chocar contra el borde del terreno y ver el aviso de borde, y contra una pendiente y ver el de pendiente; la tarjeta muestra "Luz continua más larga"; las sombras llegan a las esquinas del terreno sin errores en consola.
- [ ] **Step 4:** commit `docs: M4 sound, accessibility and limits`.
