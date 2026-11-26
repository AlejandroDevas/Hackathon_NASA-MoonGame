# Investigación de audio: música y efectos de sonido

Fecha: 2026-11-15. Estado: hechas las fases 1 (clic y veredictos), 2 (llamada de radio Quindar con estática), 3 (música generativa y volumen), 4 (zumbido del rover por el chasis) y 6 (documentación); queda solo la fase 5, opcional (archivos CC0 externos), que no se ha hecho porque no hace falta mientras todo suene bien sintetizado.

## 1. Restricciones del proyecto que condicionan la elección

Estas decisiones ya están tomadas en el repo y filtran todo lo demás:

| Restricción | Dónde consta | Consecuencia para el audio |
|---|---|---|
| Todo estático, sin servidor y **sin peticiones a terceros** (una prueba lo vigila) | README, "Qué incluye" | Los archivos de audio deben ir **locales** en `web/public/` (como las fuentes y los modelos). Nada de streaming ni CDN. |
| Sonido opcional, **apagado por defecto**, el `AudioContext` solo se crea al pulsar el botón | `web/src/scene/audioCue.js`, plan M4 | Cualquier música o efecto nuevo debe colgar del mismo interruptor y respetar la política de autoplay. |
| **Sin sonido ambiente ni de motor a propósito**: en la Luna no hay atmósfera | README (sección Sonido), plan M4 | Es la restricción más importante. Ver §2. |
| Hoy solo hay un pitido de dos notas (660 Hz y 880 Hz, sinusoidal) al abrirse el cartel | `audioCue.js:33` | Es una buena base: ya hay síntesis en Web Audio sin archivos. |
| Funciona sin conexión y pesa poco (~0,7 MB por sitio de datos) | README, "Cómo funciona" | Presupuesto de peso: conviene que el audio añada menos de ~1-2 MB en total. |

## 2. Decisión de diseño previa: ¿qué sonido es "honesto" en la Luna?

El equipo decidió no poner sonido ambiente ni de motor porque el sonido no viaja en el vacío. Hay tres maneras de mantener esa coherencia y aun así tener audio. Recomiendo elegir una y escribirla en el README:

1. **Música como capa "de narración" (no diegética).** La música es banda sonora, no sonido del mundo. Es lo habitual en documentales y no contradice la física. Es lo más sencillo y lo que más cambia la sensación del juego.
2. **Sonido solo "dentro del casco / del rover".** Lo que sí se oye en el vacío es lo que viaja por el chasis o por la radio: el zumbido del motor del rover transmitido por la estructura, el ventilador del traje, la respiración, los pitidos de la radio. Es el truco que usan *The Martian* y *Gravity*. Permite un feedback de conducción sin mentir.
3. **Solo interfaz.** Pitidos y clics de interfaz (cartel, botones, éxito al llegar). Es la opción actual, ampliada.

Mi recomendación: **música ambiente suave (opción 1) + sonidos de interfaz y de radio (opción 3) + un zumbido muy bajo de rover "por el chasis" (opción 2) opcional**, todo tras el botón de sonido, con una frase en el README que lo explique.

## 3. Música

### 3.1 Opción A: música libre de derechos (archivos)

| Fuente | Licencia | Atribución | Notas |
|---|---|---|---|
| [OpenGameArt](https://opengameart.org/content/cc0-music-1) | Por pista; filtrar por **CC0** | No en CC0 | Hay varias pistas espaciales y ambient CC0 (p. ej. [outer space loop](https://opengameart.org/content/outer-space-loop)). Calidad variable; escuchar antes. Algunos autores piden crédito aunque sea CC0: leer la descripción. |
| [Freesound](https://freesound.org) | Por archivo; filtrar por **CC0** | No en CC0 | Más sonidos que música, pero hay drones y pads largos. Los CC BY-NC **no** valen si el proyecto pudiera usarse comercialmente. |
| [Incompetech (Kevin MacLeod)](https://incompetech.com/music/royalty-free/faq.html) | CC BY 4.0 (algunas pistas antiguas CC BY 3.0) | **Sí**, con el formato que da su FAQ | Catálogo enorme y bueno, con categorías cinemáticas y espaciales. Hay que copiar el crédito exacto y la versión de la licencia de cada pista. |
| [Pixabay Music](https://pixabay.com/service/faq/) | Pixabay Content License | No obligatoria | Uso comercial permitido. Es una licencia propia, no CC0: revisar las condiciones completas. Algunas pistas son generadas con IA. |
| Bandcamp, itch.io (packs "free to use") | Cada autor | Casi siempre sí | Ejemplos de la búsqueda: pistas CC BY 4.0 (p. ej. [Silvermansound](https://www.silvermansound.com/free-music/spacedman)). Útiles para variedad, pero hay que guardar la licencia de cada una. |

Reglas prácticas:
- Preferir **CC0**: no exige créditos y evita errores. Si se usa CC BY, añadir una pantalla/sección de **créditos de audio** (el README ya lista fuentes de datos; añadir ahí una tabla de audio).
- Guardar junto a cada archivo una captura o texto de la licencia y la URL de origen (`web/public/audio/LICENSES.md`).
- Evitar "gratis para uso personal", CC BY-NC y CC BY-ND (la ND prohíbe recortar o hacer bucles).
- Comprimir a **Ogg Vorbis/Opus** (60-96 kbps) y dejar un bucle de 1-3 minutos por pista: ~0,5-1 MB cada una.

### 3.2 Opción B: música de la NASA

- La NASA publica una [biblioteca de audio histórico](https://www.nasa.gov/historical-sounds/) y la [Artemis Audio Library](https://www.nasa.gov/artemisaudio). Según las [Media Usage Guidelines](https://www.nasa.gov/multimedia/guidelines/index.html) el audio de la NASA generalmente no tiene copyright y se puede reusar **sin que implique respaldo de la NASA**. El proyecto es para el NASA Space Apps Challenge, así que encaja temáticamente.
- Cuidado: los logos (insignia, "gusano", sello) **no** son de dominio público, y el material de la NASA puede incluir música o personas identificables con derechos de terceros. Revisar los créditos de cada archivo.
- Es más útil como **textura** (radio de misión, ruido de fondo, voz de CAPCOM) que como música de fondo.

### 3.3 Opción C: generar la música nosotros (recomendada para este proyecto)

Encaja mejor con el proyecto: cero archivos, cero licencias, cero peso, y reacciona al estado del juego.

**C1. Música generativa en el navegador con Web Audio** (sin dependencias extra, como el cue actual):
- Un **drone** grave (dos osciladores ligeramente desafinados + filtro paso-bajo) y un **pad** de acordes largos y lentos, con un LFO muy lento sobre el filtro. Es el sonido clásico "espacio profundo".
- Notas aleatorias de una escala pentatónica o modal (p. ej. re eólico) muy espaciadas, con reverberación larga (`ConvolverNode` con un impulso sintético generado con ruido que decae, sin archivos).
- Se puede enlazar con los datos: la **elevación del Sol** abre o cierra el filtro (más luz = más brillante), la **Tierra visible** añade un tono agudo, la noche solar baja la tonalidad. Esto convierte el audio en una pequeña sonificación de los datos (algo que además encaja con la NASA).
- Referencias de la técnica: [Tone.js](https://tonejs.github.io) (licencia MIT, ~150 kB min) o Web Audio a pelo, y proyectos como [generative.fm](https://github.com/generativefm/generative.fm) (ojo: parte de sus piezas usan muestras). Hay tutoriales de [audio procedural sin muestras](https://dev.to/hexshift/how-to-generate-procedural-audio-textures-in-the-browser-no-samples-needed-332l).
- Recomendación: **Web Audio nativo**, no Tone.js. El proyecto ya evita dependencias y `audioCue.js` ya sigue ese camino; Tone.js añade peso para algo que se resuelve con ~150 líneas.
- Coste: tiempo de desarrollo y ajustar a oído. Riesgo: sonar "a demo" si no se afina; mitigar con 2-3 capas y mucho reverb.

**C2. Componer una pista con herramientas libres y exportarla:**
- [Surge XT](https://surge-synthesizer.github.io/faq) (GPL3): la licencia del programa **no afecta** a lo que compones; lo creado es tuyo y se puede usar comercialmente. [Vital](https://forum.vital.audio/t/free-version-of-vital-allowed-to-be-used-commercial/13526) (versión gratuita): según el foro se permite uso comercial, pero la fuente es secundaria; leer el EULA actual.
- LMMS, VCV Rack u otro DAW libre para montar el bucle. Es el camino de más calidad, pero requiere a alguien con oído musical. Exportar a Ogg/Opus en bucle.
- Mantener un archivo de **proyecto fuente** en el repo, para demostrar autoría.

**C3. Música con IA (con cautela):**
- Servicios como Suno o Udio: según las [guías de 2026](https://blog.dubspot.com/ai-music-licensing-explained-2026) los planes de pago suelen dar derechos comerciales, pero las condiciones **cambian** y hay litigios abiertos con discográficas. Además, la autoría de obras íntegramente generadas por IA es discutible en varias jurisdicciones.
- Modelos abiertos como Stable Audio Open o MusicGen: las licencias (Stability Community License, términos de Meta) tienen condiciones y las fuentes secundarias se contradicen. Hay que leer la licencia de la versión exacta.
- Si se usa: guardar la captura de los términos y del plan del día de la generación, e indicarlo en los créditos. **Para un concurso de la NASA es la opción con más riesgo de explicaciones incómodas**; las opciones C1/C2 son más defendibles.

### 3.4 Recomendación de música

1. **Primera elección:** música generativa Web Audio (C1), un drone + pad que reacciona a la elevación solar. Solo código, sin licencias.
2. **Plan B o complemento:** una o dos pistas CC0 de OpenGameArt/Freesound en bucle (peso < 2 MB), con su `LICENSES.md`.
3. Evitar IA generativa de terceros salvo que alguien del equipo lea y archive los términos.

## 4. Efectos de sonido

### 4.1 Lista de eventos que podrían sonar

| Evento | Tipo de sonido | Cómo conseguirlo |
|---|---|---|
| Abrir el cartel de un sitio | Pitido de dos notas (ya existe) | Mantener o refinar `audioCue.js`. |
| Clic de botón / cambio de idioma / alternar comparar | Clic corto de interfaz | Kenney Interface Sounds o síntesis. |
| Cambiar de sitio o de escenario | "Whoosh" suave o doble tono | Síntesis (ruido filtrado). |
| Arrancar / pausar la animación | Tono ascendente / descendente | Síntesis. |
| Veredicto *Viable* / *Dudoso* / *No viable* | Tres sonidos distintos (acorde, neutro, grave) | Síntesis; además refuerzan la accesibilidad. |
| Llegar al módulo de aterrizaje | Pequeña fanfarria de éxito | Síntesis o pack CC0. |
| Conducir el rover | Zumbido grave "por el chasis" (opción 2 del §2) | Síntesis: ruido filtrado + oscilador cuya frecuencia sigue la velocidad. |
| Polvo / impacto de ruedas | Golpes sordos, sin silbido de aire | Síntesis de ruido con paso-bajo. |
| Radio de misión (ambiente temático) | Pitidos Quindar, estática, voces | NASA (archivo) o tonos generados. |
| Cambio de día/noche solar | Tono suave ascendente/descendente | Síntesis ligada a datos. |

### 4.2 Fuentes de efectos libres

| Fuente | Licencia | Contenido útil |
|---|---|---|
| [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | **CC0**, 100 archivos | Clics, botones, confirmaciones. La mejor fuente para la interfaz. |
| [Kenney Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds) | **CC0**, 70 archivos | Motores, láseres, zumbidos, efectos "espaciales". |
| [Kenney UI Audio](https://godotengine.org/asset-library/asset/795) (espejo) | CC0 | Pack menor de 50 sonidos de interfaz. |
| [Freesound](https://freesound.org) filtrando **Creative Commons 0** | Por archivo | Estática de radio, zumbidos, pasos sobre grava. Leer la descripción por si el autor pide crédito. |
| [OpenGameArt](https://opengameart.org/content/sci-fi-sounds) | Por archivo | Packs de sci-fi y ambientes. |
| [NASA Artemis / sonidos históricos](https://www.nasa.gov/artemisaudio) | Material NASA, sin respaldo implícito | Audio real de misiones: Apollo, Quindar tones, radio. |
| Archive.org (colecciones Apollo) | Verificar por archivo | Mucho audio de Apollo; comprobar derechos de cada archivo. |
| [Pixabay Sound Effects](https://pixabay.com/service/faq/) | Pixabay Content License | Biblioteca grande y gratuita; licencia propia, no CC0. |

Sobre los **Quindar tones** (los pitidos de la radio Apollo): son dos tonos puros de ~250 ms (el primero de 2525 Hz al abrir el canal y el segundo de 2475 Hz al cerrarlo; las frecuencias están confirmadas en [Wikipedia](https://en.wikipedia.org/wiki/Quindar_tones), y el Apollo Lunar Surface Journal da 2474 Hz para la segunda). Aunque hay grabaciones de la NASA, la forma más segura es **generarlos con un oscilador** (un `OscillatorNode` sinusoidal de 250 ms). Es sencillo, pesa cero y evita dudas de derechos. Los valores de frecuencia son los habituales en las fuentes sobre el tema; conviene confirmarlos contra la [documentación del Apollo Lunar Surface Journal](https://www.nasa.gov/wp-content/uploads/static/history/alsj/quindar.html) antes de citarlos en el README.

### 4.3 Generar los efectos nosotros

Opción más coherente con el proyecto: **síntesis en el navegador**, sin archivos, igual que el pitido actual.

- Pitidos, clics y subidas/bajadas de tono: osciladores + envolvente de ganancia (ya hay un ejemplo en `audioCue.js`).
- Whoosh, estática, polvo: ruido blanco (un `AudioBuffer` lleno de `Math.random()`) pasado por filtros y envolventes.
- Zumbido del rover: oscilador de diente de sierra a 40-80 Hz con filtro paso-bajo, y la frecuencia ligada a la velocidad del rover.
- Ventaja: ~0 KB, no hay licencias, funciona sin conexión, se puede probar con la inyección de `AudioContextClass` que ya existe para los tests.

Herramientas gráficas para **diseñar** un sonido y luego decidir si se exporta o se reproduce en código:
- [ChipTone](https://sfbgames.itch.io/chiptone): los sonidos creados se dedican al dominio público (**CC0**).
- [Bfxr](https://www.bfxr.net): según su web, tienes todos los derechos sobre lo que creas, incluido uso comercial.
- [jfxr](https://github.com/ttencate/jfxr): el autor indica que lo creado es tuyo y la atribución no es obligatoria.
- jsfxr/sfxr: no encontré una licencia clara en las fuentes consultadas; mirar el `LICENSE` del repositorio antes de usarlos.
- Estos generadores producen un estilo "8 bits / arcade". Para un tono más sobrio (ciencia ficción realista) conviene síntesis propia o los packs Kenney.

## 5. Plan sugerido por fases (de menor a mayor esfuerzo)

1. **Hecho. Ampliar el interruptor actual (1-2 h).** Añadir a `audioCue` más eventos de interfaz sintetizados: clic, veredicto (3 sonidos), éxito al llegar al módulo. Sin archivos. Cada uno con prueba usando `AudioContextClass` inyectado.
2. **Hecho. Quindar y estática de radio generados (1 h).** Da identidad "misión lunar" con cero archivos.
3. **Hecho. Música ambiental generativa (3-6 h).** Drone + pad + notas esporádicas + reverb sintético, con el filtro ligado a la elevación solar. Detrás del mismo botón de sonido, con control de volumen.
4. **Hecho. Zumbido de rover "por el chasis".** Solo si el equipo acepta la opción 2 del §2 y lo explica en el README.
5. **Pendiente, opcional: pistas o efectos CC0 externos** (Kenney / OpenGameArt) si algo no queda bien sintetizado. Archivar licencia y origen.
6. **Hecho. Documentación (30 min).** Actualizar la sección "Sonido" del README: qué suena, por qué, y la tabla de créditos/licencias de audio.

## 6. Checklist legal antes de incluir cualquier archivo de audio

- [ ] Anotar nombre, autor, URL, licencia y fecha de descarga en `web/public/audio/LICENSES.md`.
- [ ] Si la licencia es CC BY, incluir el crédito exacto en el README y en la página (créditos).
- [ ] Rechazar CC BY-NC (uso comercial), CC BY-ND (impide cortar/hacer bucles) y "solo uso personal".
- [ ] En material NASA: no usar logos ni sugerir respaldo; evitar clips con música o voces identificables de terceros.
- [ ] Mantener la prueba de "sin peticiones a terceros": los archivos van en `web/public/`.
- [ ] Respetar el diseño existente: apagado por defecto, `AudioContext` solo tras el clic, `aria-pressed` ya presente en el botón.

## 7. Límites de esta investigación

- Las búsquedas devolvieron sobre todo blogs y foros. Las licencias deben **verificarse en la página de cada archivo** el día que se descargue; las condiciones de Pixabay, Suno/Udio y Stability cambian con frecuencia.
- No pude abrir el texto actual completo de las Media Usage Guidelines de la NASA ni de la Pixabay Content License; la información viene de resúmenes y páginas archivadas.
- No es asesoría legal. Para el concurso, revisar también las reglas del NASA Space Apps Challenge sobre material de terceros.
- No he probado ninguno de los sonidos ni las pistas: el criterio estético habrá que hacerlo escuchando.

## Fuentes

- [OpenGameArt: CC0 music](https://opengameart.org/content/cc0-music-1) · [outer space loop](https://opengameart.org/content/outer-space-loop)
- [Incompetech FAQ (formato de atribución)](https://incompetech.com/music/royalty-free/faq.html)
- [Pixabay FAQ](https://pixabay.com/service/faq/) · [Pixabay Terms](https://pixabay.com/service/terms/)
- [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) · [Kenney Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds)
- [NASA: sonidos históricos](https://www.nasa.gov/historical-sounds/) · [Artemis Audio](https://www.nasa.gov/artemisaudio) · [Media Usage Guidelines](https://www.nasa.gov/multimedia/guidelines/index.html) · [NASA Brand Center](https://nasa.gov/nasa-brand-center/images-and-media)
- [Apollo Lunar Surface Journal: Quindar tones](https://www.nasa.gov/wp-content/uploads/static/history/alsj/quindar.html)
- [ChipTone](https://sfbgames.itch.io/chiptone) · [Bfxr](https://www.bfxr.net) · [jfxr](https://github.com/ttencate/jfxr)
- [Surge XT FAQ](https://surge-synthesizer.github.io/faq) · [Vital: uso comercial (foro)](https://forum.vital.audio/t/free-version-of-vital-allowed-to-be-used-commercial/13526)
- [Audio procedural en el navegador](https://dev.to/hexshift/how-to-generate-procedural-audio-textures-in-the-browser-no-samples-needed-332l) · [generative.fm](https://github.com/generativefm/generative.fm)
- [Licencias de música con IA en 2026 (Dubspot)](https://blog.dubspot.com/ai-music-licensing-explained-2026) · [Stable Audio Open (arXiv)](https://arxiv.org/html/2407.14358v2)
- [Freesound: guía de licencias (foro)](https://freesound.org/forum/legal-help-and-attribution-questions/34067/)
