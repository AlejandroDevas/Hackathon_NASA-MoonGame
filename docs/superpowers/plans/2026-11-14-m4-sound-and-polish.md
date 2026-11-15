# M4 — Sonido y pulido Implementation Plan

> **Plan histórico.** Ya se ejecutó; el estado actual del proyecto está en el [README](../../../README.md) y en los diseños de `docs/superpowers/specs/`. Se conserva como registro de cómo se construyó.

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
- [ ] **Step 3:** la verificación en el navegador de M4 se hace una sola vez al final, en la Task 9.
- [ ] **Step 4:** commit `docs: M4 sound, accessibility and limits`.

---

## Ampliación aprobada por el equipo: visual del 3D y arrastre en la línea de tiempo

> Origen: ideas tomadas de tres fragmentos de código que aportó el equipo (terreno procedural, función puntero→hora y arrastre sobre la gráfica). **No** se adopta el terreno procedural, la niebla, el Sol fijo ni Three r128 por CDN (rompen la coherencia con el DEM real o con la física lunar).

**Regla de trabajo del árbol compartido.** Otra herramienta edita este mismo árbol sin confirmar (rediseño del CSS, modelo NASA del rover, README, `index.html`, y cambios en `panel.js`, `timeline.js`, `view3d.js`, `world.js`, `robotMesh.js` y las cadenas). Se edita siempre sobre el contenido actual del disco con reemplazos puntuales y **solo se confirman las líneas propias**: se guarda una copia del archivo antes de editarlo y se prepara para el commit `git merge-file -p HEAD:archivo copia-antes archivo-después` (el resultado es HEAD más solo mis cambios; si hay conflicto se para y se avisa). Antes de cada commit se revisa `git diff --cached` para comprobar que solo hay hunks propios.

### Task 7: Aspecto del 3D (color por elevación, tone mapping, estrellas, ayuda de sombras, vista libre)

**Files:** Modify `web/src/scene/terrainMesh.js`, `web/src/scene/world.js`, `web/src/scene/view3d.js`, `web/src/panel/panel.js`, `web/src/main.js`, `web/src/strings/es.json`, `web/src/strings/en.json`; Test `web/tests/world.test.js`, `web/tests/panelMount.test.js`

**Interfaces:**
- `terrainColor(heightM: number, minM: number, maxM: number, r: number, c: number): number` (en `terrainMesh.js`): factor de brillo `0.62 + elevNorm·0.34 + grano`, con `elevNorm = (h − minM)/(maxM − minM)` recortado a 0..1 (0,5 si `maxM === minM`) y `grano = (hash(r·0.71, c·0.71) − 0.5)·0.06` determinista; resultado siempre en `[0.5, 1]`. `buildTerrainGeometry` añade el atributo `color` (itemSize 3, `g`, `g·0.995`, `g·1.012` recortado a 1) y el material del terreno pasa a `vertexColors: true` (conservando su color base).
- `createWorld` devuelve además `ambient: THREE.AmbientLight` y `setShadowLift(on: boolean): void` (apagado = intensidad base de la luz ambiental; encendido = 6× la base). Las estrellas pasan a 4500 con atributo `color` de brillo variable (0,45–1).
- Estado nuevo del store: `shadowLift: boolean` (false) y `viewMode: 'follow' | 'free'` ('follow'); botones del panel `data-testid="shadow-lift-toggle"` y `data-testid="view-toggle"` con `aria-pressed`; cadenas `app.shadowLift`, `app.viewFree`, `app.viewFollow`.
- `view3d.js`: tone mapping `ACESFilmicToneMapping` con exposición 1,15; suscripción a `shadowLift` (`world.setShadowLift`) y a `viewMode`. En vista libre se usa `OrbitControls` (`three/addons/controls/OrbitControls.js`) con `enableDamping`, `minDistance 8`, `maxDistance 6000`, `maxPolarAngle π/2 − 0.01`, objetivo = el robot (se sigue con suavizado) y la cámara nunca baja de `alturaTerreno + 2 m`; las teclas del robot siguen funcionando; al volver a "seguir" se recupera la cámara de seguimiento.

- [ ] **Step 1: Tests que fallan.** `terrainColor`: sube con la altura (`terrainColor(100,0,100,5,5) > terrainColor(0,0,100,5,5)`, con la misma `r, c` para descontar el grano), es determinista (misma entrada, mismo valor), vale entre 0,5 y 1 para alturas extremas y con `minM === maxM` no es NaN. `buildTerrainGeometry`: atributo `color` con `count === position.count`, `itemSize 3`, todos los valores en `[0, 1]`. `createWorld(tinySite)`: 4500 estrellas con atributo `color`; `setShadowLift(true)` sube `ambient.intensity` por encima del valor inicial y `setShadowLift(false)` lo devuelve exactamente. `panelMount`: pulsar `shadow-lift-toggle` alterna `store.get().shadowLift` y `aria-pressed`; pulsar `view-toggle` alterna `viewMode` entre `'follow'` y `'free'` y `aria-pressed`.
- [ ] **Step 2:** `npm --prefix web test`; esperado: FAIL.
- [ ] **Step 3:** Implementar (el cableado de `OrbitControls` y el tone mapping no tienen test: se verifican en la Task 9).
- [ ] **Step 4:** `npm --prefix web test` y `npm --prefix web run build`; esperado: PASS. **Step 5:** commit con solo mis hunks: `feat(web): 3D look and free view`.

### Task 8: Arrastrar y usar el teclado sobre la línea de tiempo

**Files:** Create `web/src/panel/scrub.js`, `web/tests/scrub.test.js`; Modify `web/src/panel/timeline.js`, `web/src/panel/panel.js`, `web/src/strings/es.json`, `web/src/strings/en.json`; Test `web/tests/panelMount.test.js`

**Interfaces:**
- `timeFromPointer(clientX: number, rect: {left: number, width: number}, fromMs: number, toMs: number): number`: `fromMs + razón·(toMs − fromMs)` con la razón recortada a 0..1 (ancho 0 → `fromMs`).
- `scrubKeyDeltaMs(key: string, shiftKey: boolean): number | null`: ArrowLeft/ArrowRight = ∓1 h (con Shift ∓6 h), PageDown/PageUp = ∓24 h; cualquier otra tecla `null`.
- `createScrubber({ element, getRange, getTime, onScrub, raf = requestAnimationFrame, caf = cancelAnimationFrame }): { dispose(): void }`; `getRange(): {fromMs, toMs}`; `getTime(): number`. Pone en `element` `tabindex="0"`, `role="slider"`, `aria-label = t('chart.scrub')`, `touch-action: none`. Con `pointerdown` (captura el puntero si puede), `pointermove` mientras se arrastra y `pointerup`/`pointercancel`; llama a `onScrub(ms)` **como mucho una vez por fotograma** (la última posición). El teclado llama a `onScrub(getTime() + delta)` y evita el desplazamiento de la página.
- `renderTimeline(el, site, fromMs, toMs, cursorMs, { onScrub, getTime } = {})`: desactiva el zoom por arrastre de uPlot (`cursor.drag.x/y = false`), engancha el scrubber a `plot.over` (rango = escala x actual en ms) y lo desmonta en `destroy()`; `setCursor` actualiza `aria-valuenow`/`aria-valuetext` (hora UTC).
- `panel.js` pasa `onScrub: (ms) => { player?.stop(); store.set(<escenario del slot con la hora recortada con clampTime>) }` y `getTime`. Clave nueva `chart.scrub` (es: "Hora del escenario: arrastra o usa las flechas"; en: "Scenario time: drag or use the arrow keys").

- [ ] **Step 1: Tests que fallan.** `timeFromPointer`: en el borde izquierdo → `fromMs`, en el derecho → `toMs`, en el centro → el punto medio, a la izquierda del rectángulo → `fromMs`, a la derecha → `toMs`, `width: 0` → `fromMs`. `scrubKeyDeltaMs`: `('ArrowRight', false) = 3 600 000`, `('ArrowLeft', true) = −21 600 000`, `('PageUp', false) = 86 400 000`, `('a', false) = null`. `createScrubber` (jsdom, `getBoundingClientRect` simulado y `raf` falso): `pointerdown` en la mitad llama a `onScrub` con el punto medio tras vaciar la cola de fotogramas; varios `pointermove` seguidos en un mismo fotograma producen **una** llamada con la última posición; tras `pointerup` los `pointermove` no hacen nada; `dispose` quita los listeners; el elemento queda con `role="slider"`, `tabindex="0"` y `touch-action: none`; `ArrowRight` llama a `onScrub(getTime() + 3 600 000)`. `panelMount` (con la gráfica falsa que captura sus opciones): `onScrub(T0 + 8h)` fija la hora del escenario A; con la animación en marcha (`playing true`) `onScrub` la deja en `false`; `onScrub(Date.UTC(2031,0,1))` recorta a la última muestra (`T0 + 47h`); en modo Comparar el `onScrub` de la gráfica de B solo mueve a B.
- [ ] **Step 2:** Esperado: FAIL. **Step 3:** Implementar. **Step 4:** `npm --prefix web test` y build; esperado: PASS. **Step 5:** commit con solo mis hunks: `feat(web): scrub the timeline by dragging or keyboard`.

### Task 9: Verificación final de M4 y README

**Files:** Modify `README.md` (solo mis líneas)

- [ ] **Step 1:** README: documentar vista libre (controles del ratón), "Aclarar sombras" como ayuda visual que no cambia ningún cálculo, color por elevación (el brillo varía con la altura real y un grano sintético muy sutil que no toca la geometría), y el arrastre/teclado sobre la línea de tiempo; añadir en límites que el color y el grano son solo aspecto.
- [ ] **Step 2:** `npm --prefix web test`, `data-pipeline/.venv/Scripts/python -m pytest data-pipeline/tests -q -W ignore` y `npm --prefix web run build`; esperado: todo PASS.
- [ ] **Step 3: Navegador** (con el panel del navegador visible): activar el sonido y ver que el botón cambia sin errores; cartel cerrado `aria-hidden="true"` y abierto `"false"`; inglés → `<html lang="en">`; borde del terreno y pendiente muestran avisos distintos; la tarjeta muestra "Luz continua más larga"; el terreno se ve con variación de color y las estrellas más densas; "Aclarar sombras" aclara y al apagarlo vuelve; vista libre: girar, hacer zoom y no atravesar el suelo, y volver a "Seguir al robot"; arrastrar sobre la gráfica mueve la hora, el Sol del 3D y las tarjetas, pausa la animación y no hace zoom; las flechas ←/→ sobre la gráfica la mueven; sin errores en la consola.
- [ ] **Step 4:** commit con solo mis hunks: `docs: M4 final README`.
