# Moon Insight 153

*Navegador de sitios de aterrizaje lunar.* Herramienta web para evaluar un sitio y una fecha de aterrizaje en el polo sur lunar, y un pequeño juego 3D para recorrer esos sitios. Proyecto para el NASA Space Apps Challenge 2026 (reto "CLPS Lunar Mission Browser").

Responde a la pregunta de planificación —¿qué sitio y qué fecha dan mejor luz y mejor visibilidad de la Tierra?— con la posición del Sol y de la Tierra respecto al **horizonte real del terreno**, y deja explorar el lugar en 3D con un rover.

## Qué incluye

- **Pantalla de inicio:** al abrir la página por primera vez en la sesión aparece la Luna en 3D con un anillo por cada sitio; se elige uno (clic para ver su ficha, doble clic o «Entrar al sitio» para abrirlo) y la aplicación arranca en él. Está en `web/public/inicio/`.
- **Interfaz tipo reproductor:** la escena 3D ocupa toda la pantalla; arriba, el nombre, el idioma, cuatro botones de la vista y un menú; abajo, un reproductor del tiempo simulado. El planificador (métricas, gráfica, umbrales y comparación) es un cajón oculto que se abre desde el menú.
- **Planificador:** altura del Sol y de la Tierra sobre el horizonte, tiempo hasta que se ponen o salen (con la fecha cuando falta un mes o más), % de luz, racha de luz continua más larga, noche más larga, mayor hueco sin Tierra, y un semáforo de viabilidad con umbrales editables. Gráfica de elevación con cursor arrastrable y modo **Comparar** (dos escenarios lado a lado).
- **Ventana de Análisis:** mejores ventanas de aterrizaje de 2026 a 2030, calendario de luz, gráfico polar del cielo y comparación de los cinco sitios con exportación a CSV.
- **Escena 3D:** terreno LOLA real de 5 m con sombras reales, un rover NASA que se conduce hasta el módulo de aterrizaje del sitio, señales con datos del lugar, una Tierra con imagen NASA que gira con la hora, polvo con gravedad lunar y, en cuatro sitios, un mapa de tonos de imágenes LROC.
- **Cinco sitios con datos reales:** Connecting Ridge (Site 01), Shackleton Rim (Site 04), Nobile Rim 1 (Site 06), Haworth y Malapert Massif (Site 23).
- **Español e inglés**, todo estático y sin servidor, y funciona sin conexión (la página no hace peticiones a terceros; una prueba lo vigila, también para el [juego](#juego-misión-rescate-lunar)).

## Estado del proyecto

Hitos del [diseño](docs/superpowers/specs/2026-11-14-lunar-navigator-design.md):

| Hito | Contenido | Estado |
|---|---|---|
| M0 | Pipeline de datos (horizonte, efemérides, terreno) con validación contra JPL Horizons | Hecho |
| M1 | Panel con datos reales, línea de tiempo y comparación | Hecho |
| M2 | Escena 3D con terreno, Sol, Tierra, rover y cartel | Hecho |
| M3 | Cinco regiones con horizonte lejano | Hecho |
| M4 | Animación, sonido, textos, accesibilidad, README con fuentes y límites | Hecho |
| Extras | Ventana de Análisis, señales y datos por sitio, módulo y rocas, Tierra NASA, polvo, mapa de tonos LROC, tutorial, juego «Misión Rescate Lunar» | Hecho |

Pendiente o por decidir: ver [Ideas y pendiente](#ideas-y-pendiente).

## Cómo funciona

```
data-pipeline/ (Python, se ejecuta una vez)       web/public/sites/<id>/                 web/ (JS, calcula en el navegador)
  DEM LOLA + Skyfield/SPICE            ->           ephemeris.bin · horizon.json    ->     métricas, panel, escena 3D
  DEM LOLA (recorte de 5 km)           ->           terrain.bin · info.json · start.json (npm run plan-starts)
  mosaico LROC NAC (vistas previas)    ->           albedo.bin (cuatro sitios)
```

- **No hay servidor.** Al arrancar se descargan solo las efemérides y el horizonte de los cinco sitios (~0,7 MB cada uno) y el terreno del primero. El terreno de cada sitio (`terrain.bin`, 2 MB, más `albedo.bin`, 1 MB, si lo tiene, y `start.json`, unos 200 bytes) se pide la primera vez que se elige.
- **Activos locales:** las fuentes (Barlow, Barlow Condensed e IBM Plex Mono, licencia OFL), los modelos 3D (`web/public/models/`), el decodificador Draco (`web/public/draco/`) y la imagen de la Tierra (`web/public/textures/`) van incluidos, así que no hay peticiones a terceros.
- **Qué se calcula dónde:** Python precalcula posiciones (Skyfield) y horizonte (a partir del DEM); el navegador calcula visibilidad, cuentas atrás, porcentajes, mejores ventanas y veredictos. No se usa ninguna librería de efemérides en el navegador.

## Interfaz

- **Pantalla de inicio (`web/public/inicio/`):** una Luna con la textura `moon.jpg` y un anillo por sitio, con el cartel de cada uno en español o inglés (botón ES / EN). Arrastrar gira, la rueda acerca, un clic muestra la ficha del sitio (qué es y por qué importa) y doble clic —o el botón «Entrar al sitio»— abre la aplicación con `?site=<id>&lang=<es|en>`. `web/src/main.js` la muestra solo la primera vez de cada sesión (`sessionStorage`) y se la salta si la dirección ya trae `?site=` o `?lang=`, como cuando el juego enlaza de vuelta. Es una página estática aparte con su propia copia de three.js (`three.module.js`, `three.core.js`), así que no pasa por Vite.
- **Barra superior:** a la izquierda el nombre de la aplicación y, a su derecha, el selector de idioma (ES/EN) y el **selector de sitio** (el sitio del escenario A, el que se ve en 3D). A la derecha, de derecha a izquierda: **Activar sonido** (con un deslizador de **volumen** a su izquierda), **Aclarar sombras**, **Imagen LROC** y **Vista libre** (o **Seguir al robot**), el botón **Juego** (un enlace al [juego](#juego-misión-rescate-lunar)) y, en la esquina, el **menú desplegable**. En pantallas estrechas los botones muestran solo su icono (siguen teniendo nombre para lectores de pantalla) y, en móvil, la barra pasa a dos filas: nombre, idioma y menú arriba; sitio y botones debajo.
- **Menú:** **Planificador** (abre o cierra el cajón de la derecha), **Análisis** (abre la ventana de Análisis), **Comparar** (activa o quita el escenario B; al activarlo se abre el planificador) y **Tutorial** (vuelve a abrir el recorrido guiado). Se maneja con el teclado: flechas, Inicio/Fin, Esc para cerrarlo.
- **Tutorial:** la primera vez que se abre la página aparece una ventana pequeña que recorre los controles en 15 pasos (bienvenida, idioma, sitio, vista libre, imagen LROC, aclarar sombras, volumen, sonido, juego, menú, reproducir, saltos, línea de tiempo, velocidad y cómo conducir el rover), oscureciendo la página y resaltando el botón que explica. Abajo a la izquierda están **Anterior** y **Siguiente** y abajo a la derecha **Saltar tutorial**; también valen las flechas ← → y Esc. El navegador recuerda que ya se vio (en `localStorage`; si lo bloquea, se muestra cada vez). Los pasos están en `web/src/ui/tutorial.js` y sus textos en `web/src/strings/`.
- **Barra inferior, como un reproductor de vídeo:**
  - **Saltos:** −1 día, −1 hora, +1 hora y +1 día, parando en los extremos de los datos.
  - **Reproducir:** un triángulo que se convierte en el signo de pausa. Si se pulsa al final de los datos, vuelve a empezar desde el principio.
  - **Línea de tiempo:** un control deslizante sobre **todo el tiempo calculado** (de 2026 a 2030, una muestra por hora), con marcas de cada año y el momento actual en UTC. Arrastrarla o usar las flechas del teclado mueve el escenario A; en modo Comparar el B se mueve igual, manteniendo la diferencia entre sus fechas. Si la animación está en marcha, sigue desde el nuevo punto.
  - **Velocidad:** un botón con la velocidad actual que abre un menú: 1 h/s, 6 h/s, 1 d/s, 7 d/s o 30 d/s.
- **Planificador (cajón de la derecha):** oculto al abrir la página. Contiene el escenario (sitio, fecha y hora en UTC, periodo que se analiza de 1 día, 7 días o 1 día lunar), el veredicto, las cuentas atrás, las métricas, la gráfica de elevación con cursor arrastrable (ratón o flechas) y, en modo Comparar, una tarjeta de diferencias respecto a A. Se cierra con su botón, con Esc (con el foco dentro) o desde el menú; cerrado, no recibe foco ni lo lee un lector de pantalla. Con Comparar se ensancha.
- **Veredicto:** *Viable*, *Dudoso* o *No viable* según tres límites editables: altura mínima del Sol (0° por defecto), noche máxima tolerable (120 h) y máximo tiempo sin ver la Tierra (48 h). Cada estado conserva su etiqueta de texto.
- **Cuentas atrás:** cuándo se pone o sale el Sol y la Tierra («El Sol se pone en…», «La Tierra sale en…»). Cuando faltan 30 días o más, bajo la duración aparece la fecha («≈ 7 may 2029 (UTC)»).
- **Elegir el sitio:** con el selector de la barra superior (escenario A); el escenario B, en modo Comparar, tiene el suyo en el planificador. Los dos selectores de A están sincronizados.

## Escena 3D

La escena muestra el sitio seleccionado en el escenario A a pantalla completa; la barra superior y la inferior flotan encima y los avisos de la escena (Sol y Tierra, ayuda de controles, cartel del sitio) se colocan fuera de ellas. El Sol y la Tierra se colocan según la fecha del panel y la animación los mueve. El rover parte a ~400 m del módulo de aterrizaje y el objetivo es llegar hasta él: a menos de 25 m se abre el cartel del lugar.

- **Controles:** W/↑ avanzar, S/↓ retroceder, A/D o ←/→ girar, Shift turbo. Las teclas se ignoran mientras escribes en un campo del panel. En **vista libre** se arrastra para girar y la rueda acerca. En móvil y tabletas (puntero táctil, o pantalla estrecha que declara toque) aparece un **pad en pantalla** con flechas y un interruptor de turbo: cada flecha se mantiene con su propio dedo, así que se puede avanzar y girar a la vez.
- **Llegada, enlace y preferencias:** al llegar al módulo, el cartel muestra arriba los metros recorridos y el tiempo de la primera llegada, con un enlace para elegir otro sitio. La dirección de la página sigue al sitio, la fecha (UTC, minuto) y el idioma del escenario A (`?site=…&t=2027-09-18T14:00&lang=es`), y el ítem **Copiar enlace** del menú la copia para compartir ese momento. Se guardan en el navegador (`localStorage`) la vista, aclarar sombras, imagen LROC, volumen, periodo de análisis y umbrales; el sonido siempre empieza apagado.
- **Terreno:** la malla es la altura LOLA real de un recorte de 5 km de lado (1001 × 1001 muestras de 5 m), dibujada por bloques de 320 m con nivel de detalle según la distancia a la cámara (vértices cada 5, 10, 20 o 40 m; ver [Rendimiento](#rendimiento)). El grano fino es un regolito **procedural** que se repite cada 32 m (con cráteres pequeños, usado también como mapa de relieve para que la luz rasante lo marque), con un moteado suave y un tono algo más claro en las pendientes fuertes. Más allá del recorte hay una silueta oscura del horizonte lejano.
- **Imagen LROC:** cuatro sitios (Connecting Ridge, Shackleton, Haworth y Malapert) tienen un mapa de tonos del mosaico LROC NAC del polo sur (NASA/GSFC/Arizona State University), alineado con la malla (`albedo.bin`, un byte por celda): moteado y manchas claras y oscuras de cráteres pequeños y eyecta. El botón **Imagen LROC** lo apaga para comparar. Nobile Rim 1 queda fuera (el mosaico termina en 85,5° S y solo cubre el 11 % de su terreno). Detalles y límites: [Imagen LROC](#imagen-lroc-cómo-se-hace-y-límites).
- **Módulo y rocas:** en el centro de cada sitio está el módulo lunar Apolo de NASA (NASA 3D Resources): un modelo histórico usado solo como referencia visual de «un módulo de aterrizaje», **no** el vehículo de CLPS ni de Artemis. Mientras carga, o si no carga, se ve un módulo procedural con las patas ajustadas al terreno. Unas 2.100 rocas repartidas por el mapa (más densas junto al módulo y al punto de salida) evitan las pendientes fuertes; son malla instanciada y **solo visuales** (el rover pasa por encima).
- **Señales:** tres etiquetas por sitio —la zona de aterrizaje, el punto más alto y el punto más bajo del mapa— con altitud y distancia al robot en vivo; salen de la altura real del terreno. Un panel arriba a la izquierda dice dónde están el Sol y la Tierra (acimut, elevación, horizonte en esa dirección y si quedan sobre o bajo el horizonte).
- **Cartel del sitio:** texto del lugar, por qué importa, datos calculados con las efemérides de 2026–2030 y enlaces a las fuentes. Los datos se escriben en lenguaje llano, una frase por cifra: **Energía solar** (% del tiempo con el Sol sobre el horizonte), **Récord de sol continuo**, **Noche más larga**, **Señal con la Tierra** (% del tiempo con la Tierra a la vista, cuando se puede comunicar directamente) y **Apagón máximo** (el tramo más largo sin ver la Tierra). Las duraciones se dan en días y horas completos («8 días y 18 horas»).
- **Sol:** disco con sombras reales y un halo suave que el relieve tapa cuando el Sol queda bajo el horizonte.
- **Tierra:** imagen *Blue Marble: Next Generation* de NASA Earth Observatory (enero de 2004, reducida a 2048 × 1024; el océano profundo se recoloreó a azul porque el mapa original lo deja casi negro) con nubes procedurales en una capa aparte. Gira con la hora UTC y con la fase media de la Luna para que mire al observador el meridiano que le toca (precisión de unos pocos grados de longitud; el eje se deja vertical), y la luz del Sol le da la fase. Mientras carga la imagen, o si falla, se ve una Tierra procedural.
- **Rover:** NASA/JPL-Caltech, *Mars 2020 Perseverance Rover* (GLB local); es un modelo visual de rover de seis ruedas, no un vehículo lunar. El GLB va comprimido con Draco y el decodificador se sirve en local. Si no carga, se ve un rover sencillo.
- **Polvo:** el rover lanza granos desde las ruedas traseras que siguen parábolas con la gravedad lunar (1,62 m/s²) y **sin rozamiento del aire**: suben lento y alto, no forman nubes y vuelven a caer donde salieron. Cada grano aterriza, descansa 0,6 s y desaparece.
- **Sonido (opcional):** apagado por defecto. El botón "Activar sonido" crea el audio solo cuando lo pulsas (los navegadores no permiten sonar antes) y suena en tres momentos: una llamada de radio al abrirse el cartel (tono de entrada Quindar de 2525 Hz, un soplo de estática y tono de salida de 2475 Hz, como en las comunicaciones del Apolo), un clic breve al usar un botón o selector de la barra, y un motivo corto cuando cambia el veredicto del escenario A (tres notas ascendentes en *Viable*, dos iguales en *Dudoso*, dos descendentes en *No viable*; no suena mientras corre la animación). Al activar el sonido también suena una música ambiental generativa (un bordón grave en re y la, con notas largas y suaves de la escala pentatónica de re menor y una reverberación sintética); su filtro se abre con la elevación del Sol del escenario A, así que la música se ilumina con la luz y se oscurece hacia la noche lunar. Un deslizador de volumen, a la izquierda del botón de sonido en la barra superior, ajusta todo el sonido. Todo se sintetiza con Web Audio: no hay archivos de audio ni licencias que atribuir. Mientras el rover avanza suena además un zumbido grave de motor, cuyo tono y volumen siguen la velocidad (y que calla en cuanto se detiene): es lo que se oiría a través del propio chasis, no un sonido del paisaje, y por eso solo pasa el rumbo grave. La música es banda sonora, no un sonido de la Luna: no hay sonido ambiente del paisaje a propósito, porque en la Luna no hay atmósfera y el sonido no viaja. Si el navegador no soporta Web Audio, el botón queda apagado.
- **Límite de pendiente por sitio:** cada sitio usa el más bajo de 15°, 20°… 45° con el que la meta sigue siendo alcanzable desde ~400 m: 15° en Connecting Ridge, Haworth y Malapert, 20° en Nobile Rim 1 y 35° en el borde de Shackleton (una pared de cráter). El robot no entra en terreno más empinado (se detiene y avisa; distingue "pendiente de más de N°" de "límite del terreno cartografiado") y la ayuda de la escena muestra el límite.
- **Accesibilidad:** el cartel cerrado no se expone a lectores de pantalla ni al foco, las etiquetas del mapa tienen una lista equivalente para lectores de pantalla, el lienzo 3D tiene etiqueta, `<html lang>` sigue al idioma de la interfaz y las teclas con Ctrl/Alt/Meta no se capturan.
- Sin WebGL, el panel sigue funcionando y la escena muestra un aviso.

## Juego: Misión Rescate Lunar

Un botón dorado con un mando, **Juego**, a la izquierda del menú de la barra superior, lleva (en la misma pestaña) a un juego en 2D ambientado en el polo sur lunar: ayudas a una tripulación a completar cinco misiones con un astronauta, un rover, una tienda y una radio. El tutorial lo explica en su propio paso.

- **Dónde está:** `web/public/juego/index.html` (una sola página con su código; se publica en `<sitio>/juego/index.html`). El botón es un enlace normal (`./juego/index.html`), así que funciona con cualquier ruta base.
- **Volver:** en el juego hay un botón **← Volver a Moon Insight 153** en la pantalla de introducción y otro, **← Moon Insight 153**, el primero de la barra de arriba durante la partida. Los dos enlazan con `../index.html`. Mientras hay un diálogo o la tienda abiertos, esa barra queda tapada: se cierran primero.
- **Sin internet:** el juego no pide nada a terceros. El CSS (Tailwind 3, el mismo que servía su CDN) está compilado en `web/public/juego/tailwind.css` (18 KB) y las fuentes Fredoka y JetBrains Mono (licencia OFL, de `@fontsource`) están en `web/public/juego/fonts/` (unos 90 KB). Si se cambian las clases de `index.html`, se regeneran con `npm --prefix web run build-game` (`web/scripts/build-game-assets.mjs`; `tailwindcss` es solo una dependencia de desarrollo).
- **Idioma:** español e inglés. Empieza en el idioma de la página principal (el botón del juego lo pasa con `?lang=`, y los dos comparten la elección en `localStorage`); la pantalla de introducción tiene un selector **ES/EN** (cambiarlo recarga el juego, así que conviene hacerlo antes de jugar), y los botones de vuelta devuelven a la página en el mismo idioma. El texto original está en español dentro del código y el inglés sale de un diccionario (`EN`, unas 200 entradas) que la función `tr()` aplica a los textos de la pantalla, a los datos (personajes, sitios, tienda, historia) y a los mensajes. Una prueba comprueba que no queda nada sin traducir.
- **Origen:** es el archivo entregado por el equipo, sin cambios en la jugabilidad; solo se le añadieron los dos botones de vuelta, el inglés y los archivos locales. Es independiente de la app: no comparte código ni datos con ella (solo la elección de idioma), y sus textos (por ejemplo, las cifras o las descripciones de la NASA) no están revisados contra las fuentes del resto del proyecto.

## Ventana de Análisis

El botón **Análisis** abre una ventana ampliada (se cierra con Esc) con su propio sitio, fecha de inicio y duración de estancia (3 días, 6,5 días —la estancia planificada de Artemis III— o 14 días):

- **Mejores ventanas de aterrizaje:** las 5 fechas de inicio con más Sol (a igualdad, más Tierra) en todo el rango 2026–2030, sin solaparse, con su veredicto. «Ver en la escena» lleva el escenario A a esa fecha.
- **Calendario de luz de 30 días:** un día por fila y una hora UTC por columna, para el Sol y para la Tierra.
- **Cielo visto desde el sitio:** recorrido del Sol y la Tierra durante 30 días contra la silueta del horizonte del terreno; los puntos tenues están tapados por el relieve.
- **Comparación de los 5 sitios** con la misma fecha y ventana, y descarga en CSV.

## Imagen LROC: cómo se hace y límites

```bash
python data-pipeline/scripts/make_albedo.py --list       # qué teselas necesita cada sitio, sin descargar nada
python data-pipeline/scripts/make_albedo.py --download   # baja esas vistas previas PNG a data-pipeline/cache/lroc y genera albedo.bin
```

Se ejecuta después de `build_site.py`, porque necesita el `terrain.bin` y el `info.json` del sitio. Necesita Pillow (incluido en `requirements.txt`).

- **Fuente:** mosaico LROC NAC del polo sur sin controlar a 1 m/px (Wagner et al. 2015), 40 teselas polares entre 85,5° S y el polo. Las teselas completas pesan 2–3 GB cada una, así que se usan sus **vistas previas PNG** (unos 0,3–1 MB cada una, **unos 32 m por píxel**); en total se descargan 6 PNG, unos 3,6 MB. La geometría de las teselas (nombre, extensión) está en `data-pipeline/lunarnav/lroc.py` y se comprobó contra las cabeceras de los GeoTIFF originales.
- **No es una fotografía del suelo a 5 m:** a 32 m por píxel solo aporta variación de tono a gran escala. La malla del terreno sigue siendo LOLA a 5 m.
- **Las sombras de la imagen no se usan:** el mosaico se tomó en el solsticio de 2010 con el Sol casi en el horizonte, por lo que casi todo es sombra y el resto lleva la luz de ese día. La app ilumina el terreno por su cuenta en cualquier fecha, así que `relative_tone` solo conserva el contraste local de las zonas iluminadas (cada píxel dividido por el brillo medio de sus 100 m de alrededor) y marca la sombra como «sin información». Por eso el mapa cubre entre el 17 % y el 49 % del terreno según el sitio.
- **Alineación:** las imágenes se proyectaron sobre el DEM GLD100, no sobre el LOLA de 5 m. Se comprobó correlacionándolas con el relieve sombreado del propio terreno: correlación de 0,76 a 0,93 sin desplazar y mejor desplazamiento de 20 a 40 m, del orden de un píxel de la vista previa. Es una comprobación de coherencia, no una validación contra una fuente externa.
- **Exageración:** la variación real de tono es de unos ±20 % a 30 m; con el Sol tan bajo apenas se vería, así que se muestra multiplicada por 1,7 (`ALBEDO_STRENGTH` en `terrainMesh.js`). El botón compara con el terreno sin ella.

## Rendimiento

El 3D dibuja el terreno de 5 m completo, los modelos NASA, rocas, polvo y un mapa de sombras de 4096 px. Para que vaya fluido sin una GPU potente se hizo esto (cifras medidas en un solo equipo, en la escena de Connecting Ridge con el rover parado, antes y después):

| | Antes | Después |
|---|---|---|
| Triángulos del terreno | 2.000.000 | ~180.000 |
| Triángulos por render (con el paso de sombras) | 7,3 millones | 0,28 millones |
| Llamadas de dibujo por render | 938 | 83 |
| Coste de un render con el paso de sombras (mediana, GPU sincronizada)* | ~15 ms | ~2 ms |
| Construir un sitio al elegirlo | 1,7–2,4 s | 0,55 s el primero, ~0,1 s los siguientes |

\* Medición con mucho ruido (la GPU del equipo de pruebas variaba entre 8 y 20 ms): vale como orden de magnitud, no como cifra exacta. Las filas de triángulos y llamadas de dibujo son recuentos exactos; el tiempo de construcción es una medida.

- **Terreno por bloques con nivel de detalle** (`terrainLod.js`): 256 bloques de 64 × 64 celdas. Cada uno se dibuja con vértices cada 5 m (a menos de 260 m de la cámara), 10 m (hasta 640 m), 20 m (hasta 1,5 km) o 40 m. La geometría fina se construye la primera vez que hace falta (como mucho 6 bloques por fotograma) y se conserva; las grietas entre niveles se tapan con un «faldón» vertical, y las normales salen de las alturas, así que el sombreado es continuo entre niveles. Lo que queda fuera de la vista no se dibuja.
- **Modelos NASA fusionados** (`mergeModel.js`): el rover (252 mallas) y el módulo (157) se fusionan por material al cargar, con los mismos triángulos: 46 y 12 llamadas de dibujo en vez de 409.
- **Sombras solo cuando cambian:** el mapa de sombras se vuelve a dibujar cuando se mueve el Sol, el rover o el nivel de detalle, no en cada fotograma. Solo las rocas grandes (≥ 1 m) proyectan sombra.
- **Fotogramas inactivos:** si no cambió nada visible (cámara, rover, fecha, polvo), no se vuelve a dibujar.
- **Resolución adaptable** (`quality.js`): si los fotogramas tardan más de ~24 ms durante un rato, baja la resolución de render (hasta la mitad por lado) y la sube de nuevo, con espera creciente si vuelve a ir lento. No cambia nada más. En una pantalla que no sea lenta se queda a resolución completa.
- **Salida del rover precalculada:** la búsqueda de ruta que decide dónde empieza el rover y el límite de pendiente (de 0,5 a 2 s) se calcula una vez con `npm --prefix web run plan-starts` y se guarda en `start.json`, con una huella del terreno; si el archivo falta o no corresponde al terreno, la app lo calcula como antes.
- **Profundidad normal:** se quitó el buffer de profundidad logarítmico (el rango de 0,5 m a 150 km cabe en el normal) y se pueden usar las optimizaciones de profundidad de la GPU.
- Una prueba comprueba que cada `start.json` sigue siendo el resultado de la búsqueda sobre su terreno.

Para medir en desarrollo, la consola del navegador ofrece `__navigator.info()` (llamadas y triángulos), `__navigator.lod()` (bloques por nivel), `__navigator.timeRender()` (coste de un render sin el límite de 60 fps) y `__navigator.forceScale(1)` (fija la resolución).

## Uso

```bash
npm --prefix web install
npm --prefix web run dev      # http://localhost:5173
npm --prefix web test         # pruebas (Vitest): métricas, panel, ventana de Análisis, escena y datos
npm --prefix web run lint     # ESLint (reglas recomendadas) sobre src/, tests/ y scripts/
npm --prefix web run build    # versión estática en web/dist
npm --prefix web run plan-starts   # recalcula web/public/sites/*/start.json (hay que repetirlo si cambia un terrain.bin)
```

**En Windows PowerShell:** si `npm` dice que la ejecución de scripts está deshabilitada, usa `npm.cmd` en su lugar (`npm.cmd --prefix web run build`). Y `&&` no existe en PowerShell 5.1: encadena con `;` o ejecuta cada comando por separado.

**Integración continua:** `.github/workflows/ci.yml` ejecuta en cada push a `main` y en cada pull request el lint, las pruebas y el build de `web/`, y las pruebas Python de `data-pipeline/` (las de efemérides se saltan solas si no están los kernels SPICE, que no se versionan). Los saltos de línea se normalizan a LF con `.gitattributes` y `.editorconfig`.

### Verlo desde otro dispositivo (red local)

Sirve para enseñar el proyecto en un móvil, una tableta u otro equipo conectado al **mismo Wi-Fi o red** que tu ordenador. No hace falta internet ni cuenta de nadie: el tráfico no sale de tu red.

1. **Arranca el servidor para la red** (elige una):

   ```bash
   npm --prefix web run build && npm --prefix web run preview:lan   # versión compilada, puerto 3000 (la recomendada para enseñarlo)
   npm --prefix web run dev:lan                                      # modo desarrollo con recarga automática, puerto 5173
   npx --yes serve web/dist                                          # alternativa si ya compilaste (puerto 3000)
   ```

   Los tres escuchan en todas las interfaces de red del equipo. La versión compilada hay que **volver a compilarla** (`npm --prefix web run build`) cada vez que cambie el código; el modo desarrollo no.

2. **Averigua la dirección IP de tu ordenador en esa red.** En Windows, `ipconfig` (o en PowerShell `Get-NetIPAddress -AddressFamily IPv4`) y busca el adaptador **Wi-Fi** o **Ethernet**, normalmente con una dirección como `192.168.x.x`, `10.x.x.x` o `172.16.x.x`. **Ignora los adaptadores virtuales**: `vEthernet (WSL…)`, `Hyper-V`, VPN o Docker (por ejemplo `172.22.x.x`) solo se alcanzan desde el propio ordenador, aunque el servidor las imprima en su línea «Network».
3. **Abre en el otro dispositivo** `http://<esa IP>:3000` (o `:5173` con `dev:lan`), por ejemplo `http://192.168.1.20:3000`. El juego está en `http://<esa IP>:3000/juego/`. El navegador marcará «No es seguro» porque es `http` y no `https`: es normal en una red propia.
4. **Si no abre**, casi siempre es el cortafuegos de Windows: la primera vez pide permiso para Node.js, y hay que **permitir las redes privadas** (en una red marcada como «Pública», que es lo habitual en el Wi-Fi de casa si no se cambió, Windows bloquea las conexiones entrantes; se puede pasar la red a «Privada» en Configuración › Red e Internet, o permitir `node.exe` en el cortafuegos). Comprueba también que los dos dispositivos están en la misma red, y no en una red de «invitados» con aislamiento entre clientes (algunos routers y redes de universidad lo hacen).
5. **Para parar**, pulsa Ctrl+C en la terminal.

Todo funciona por `http` en red local, también el sonido, el tutorial y el juego: no hay peticiones a terceros. No expongas el puerto a internet (no lo abras en el router): es un servidor de pruebas.

Pipeline de datos (necesita Python 3.11):

```bash
py -3.11 -m venv data-pipeline/.venv
data-pipeline/.venv/Scripts/python -m pip install -r data-pipeline/requirements.txt
data-pipeline/.venv/Scripts/python -m pytest data-pipeline/tests
# con el DEM del sitio descargado en data-pipeline/cache/ (ver config/sites.json):
data-pipeline/.venv/Scripts/python data-pipeline/scripts/build_site.py site01-connecting-ridge --dem data-pipeline/cache/Site01_final_adj_5mpp_surf.tif --radius-m 8000
# Opcional para sumar el horizonte distante de un DEM regional de menor resolución:
data-pipeline/.venv/Scripts/python data-pipeline/scripts/build_site.py site01-connecting-ridge --dem data-pipeline/cache/Site01_final_adj_5mpp_surf.tif --far-dem data-pipeline/cache/LDEM_80S_80MPP_ADJ.TIF
```

Los kernels SPICE (`de421.bsp`, `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf`, `pck00008.tpc`) se descargan a `data-pipeline/cache/` con Skyfield. La carpeta `cache/` no se versiona. Los textos de cada sitio (cartel, fuentes) viven en `data-pipeline/config/sites.json` y se copian al `info.json` de cada sitio; si se edita uno, hay que mantener el otro igual.

## Créditos de modelos, imágenes y datos

| Qué | Origen | Detalle |
|---|---|---|
| Topografía (terreno y horizonte) | NASA LRO/LOLA, [PGDA](https://pgda.gsfc.nasa.gov/products/78) | Barker et al. (2021) |
| Horizonte lejano | [DEM LOLA regional de 80 m/píxel, 80–90° S (PGDA)](https://pgda.gsfc.nasa.gov/products/90) | Se combina con cada DEM local de 5 m |
| Efemérides | [Skyfield](https://rhodesmill.org/skyfield/planetary.html) con kernels SPICE de NAIF/JPL | Validadas contra [JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html) |
| Imagen del suelo | LROC NAC, mosaico del polo sur | NASA/GSFC/Arizona State University; `data-pipeline/lunarnav/lroc.py` |
| Textura de la Luna (pantalla de inicio) | `web/public/inicio/moon.jpg` (2048 × 1024, escala de grises) | **Origen y licencia por documentar**: la subió un integrante del equipo sin indicar la fuente; hay que confirmarla y anotarla aquí antes de la entrega |
| Rover | NASA 3D Resources, *Mars 2020 Perseverance Rover* | NASA/JPL-Caltech; `web/public/models/README.md` |
| Módulo de aterrizaje | NASA 3D Resources, *Apollo Lunar Module* | `web/public/models/README.md` |
| Tierra | NASA Earth Observatory, *Blue Marble: Next Generation* | Recoloreado el océano; `web/public/textures/README.md` |
| Fuentes tipográficas | Barlow, Barlow Condensed, IBM Plex Mono; en el juego, Fredoka y JetBrains Mono | Licencia OFL (paquetes `@fontsource`) |
| CSS del juego | Tailwind CSS 3.4 | Licencia MIT; solo se usa para compilar `web/public/juego/tailwind.css` |

NASA no respalda este proyecto. Los modelos y las imágenes de NASA se usan según las [guías de uso de medios de NASA](https://www.nasa.gov/nasa-brand-center/images-and-media/).

Citar para la topografía: Barker, M. K. et al. (2021), *Improved LOLA Elevation Maps for South Pole Landing Sites: Error Estimates and Their Impact on Illumination Conditions*, Planetary and Space Science 203, 105119, [doi:10.1016/j.pss.2020.105119](https://doi.org/10.1016/j.pss.2020.105119). Las efemérides están validadas en `data-pipeline/VALIDATION.md` (elevación y acimut, dos semanas de 2026 y 2030, en el sitio real y en (0, 0)).

## Documentos y demostración

- `DEMO/VideoDEMO.mp4`: vídeo de demostración de la aplicación.
- `docs/entregables/`: documentos del equipo en Word. `Analisis_Moon_Insight_153.docx` y `Analisis_Moon_Insight_153_completo.docx` son el análisis del proyecto (el segundo, en su versión completa) y `Bitacora_Insight_Moon_153.docx` es la bitácora.
- `Juego/`: el HTML original del juego «Misión Rescate Lunar», tal como llegó antes de integrarlo; la versión que usa la aplicación (sin conexión y con inglés) es `web/public/juego/`.
- `docs/superpowers/` y `docs/diseno-interfaz.md`: diseños y planes; `INVESTIGACION_TECNOLOGIAS.md` e `docs/investigacion-audio.md`: investigación.

## Equipo

En orden alfabético por apellido:

- Israel Alejandro Calvario Mena
- Gerardo Andrés Galindo Aparicio
- Jessica Betzania Texis Juárez

En la página, los nombres aparecen discretos al final del planificador (menú → Planificador) y en la etiqueta `author` del HTML. Salen de un único archivo, `web/src/team.js`.

## Uso de inteligencia artificial

El proyecto se hizo con ayuda de herramientas de IA, y se declaran aquí. El equipo decidió el rumbo, revisó y aceptó los cambios. La IA no es una fuente de datos: las cifras salen de las fuentes de NASA, USGS y LROC citadas y de las efemérides de Skyfield, validadas contra JPL Horizons.

| Herramienta | Para qué se usó | Dónde se nota |
|---|---|---|
| **Claude** (Claude Code, de Anthropic; modelo Claude Sonnet 5.5) | **Codificación:** el pipeline de datos (horizonte, efemérides, terreno), el panel, la escena 3D, la ventana de Análisis, la interfaz tipo reproductor, el rendimiento del 3D, el tutorial, el sonido, la integración y la traducción al inglés del juego, y las pruebas automáticas. **Investigación:** fuentes de NASA, USGS y LROC para los carteles de los sitios, la elección de modelos 3D y texturas con licencia de NASA, las opciones de audio con sus licencias, y la revisión y redacción de este README y de las notas de diseño. | La mayoría de los commits (68 de 78 al 15 de noviembre de 2026) llevan la línea `Co-Authored-By: Claude`. Los diseños y planes están en `docs/superpowers/`, y las notas de audio en `docs/investigacion-audio.md` |
| **Cursor** | **Codificación:** la interfaz y el rendimiento. | Las reglas de dirección visual `.cursor/rules/ui-design.mdc` y el commit «Actualiza interfaz y rendimiento». Esas reglas describen el diseño anterior (panel fijo a la derecha); la interfaz actual está en `docs/diseno-interfaz.md` |
| **Gemini** (Google) | **Investigación** y documentos del proyecto. | No deja marcas en el historial: esta fila se basa en lo que declaró el equipo |

No se usó ChatGPT ni otras herramientas de IA. Estas herramientas se usaron para construir el proyecto, no forman parte de él: la aplicación no contiene ningún modelo de IA ni llama a ningún servicio de IA, y funciona sin conexión.

## Límites conocidos (léelos antes de usar los números)

- **El punto de observación es el centro del DEM de cada región, no una posición de aterrizaje concreta.** Las coordenadas salen de la extensión del GeoTIFF (ver `coordinates_source` en `data-pipeline/config/sites.json`). Un punto concreto del borde puede ver la Tierra o el Sol muy distinto: en Shackleton, por ejemplo, la próxima salida de la Tierra puede estar a más de dos años por la pared del cráter al sur.
- **El horizonte combina el DEM local de 5 m con el DEM regional de 80 m.** El regional empieza a contribuir al 75 % del radio local por defecto, con solapamiento para evitar huecos. Solo cuenta el terreno contenido en los DEM disponibles.
- **Alrededor del 90 % de los píxeles de 5 m están interpolados**; el error típico es 0,30–0,50 m en altura y 1,5–2,5° en pendiente (Barker et al. 2021).
- **La validación con Horizons cubre las efemérides (Sol y Tierra), no el horizonte del terreno.** La orientación de la cuadrícula del DEM (norte verdadero frente a norte de la cuadrícula) está comprobada con un raster sintético, no contra una fuente externa.
- El Sol se considera visible cuando su **borde superior** supera el horizonte; la Tierra se considera por su **centro**.
- El semáforo compara la elevación del Sol con el horizonte *geométrico* (0° por defecto), así que un Sol visible sobre terreno bajo puede marcarse "por debajo del mínimo".
- Datos de 2026-01-01 a 2030-12-31, paso de 1 hora. Fuera de ese rango la fecha se ajusta al límite y se avisa.
- **Escena 3D:** las sombras cubren todo el recorte (5 km de lado, 2,5 km de radio); más allá hay una silueta oscura sin iluminar calculada con el horizonte del observador en el centro del sitio, así que desde otro punto es solo aproximada. El rover no tiene físicas (sigue la altura del mapa) y las rocas y el polvo son solo visuales. La escena muestra solo el escenario A.
- **Horizonte del robot frente al del planificador:** las métricas del planificador son para el centro del sitio; desde otro punto del terreno el Sol puede quedar tapado aunque el panel diga que es visible.
- **Modelos y texturas:** el rover es el de Marte y el módulo es el histórico de Apolo; son referencias visuales, no los vehículos de CLPS o Artemis. El grano del suelo y las nubes son procedurales, y los continentes de la Tierra de respaldo, dibujados a mano.
- **La Tierra:** su giro usa la fase media de la Luna y deja el eje vertical; no es una vista astronómica exacta de qué cara mira a la Luna.
- **Límite de pendiente:** se precalcula (`start.json`, ver más abajo) con una búsqueda de ruta que exige 2° menos que el límite del robot y comprueba la pendiente cada 2,5 m a lo largo de cada tramo; si ni 45° sirve, la escena lo avisa y muestra el cartel desde el punto central. Que exista ruta no garantiza que sea fácil, y el DEM está interpolado en un ~90 %.
- **Textos de los sitios:** las cifras de cada cartel (tamaños de cráteres, iluminación, edades) vienen de páginas de NASA/USGS/LROC y de artículos citados en el propio cartel; algunas (el 90 % de luz de la cresta, el 56 % anual de un punto estudiado) son de puntos y métodos distintos y no son comparables entre sí. El estado de Artemis III cambia: los textos hablan de «las nueve regiones revisadas en 2024» y conviene volver a comprobarlo en NASA antes de presentarlo.
- **Rendimiento:** con renderizado por software (sin GPU) puede ir a pocos fotogramas por segundo; la resolución adaptable baja la calidad antes de que se note, y el movimiento del rover se ralentiza en vez de saltar. Las cifras de arriba son de un solo equipo.
- **Pérdida del contexto WebGL:** si el navegador pierde el contexto gráfico (poca memoria de GPU, muchas pestañas), la escena se vuelve a dibujar sola cuando se restaura.
- **Pruebas del pipeline:** necesitan los paquetes de `requirements.txt` (entre ellos Skyfield); sin ellos, algunos archivos de `data-pipeline/tests/` no se pueden ejecutar.

## Ideas y pendiente

- Documentar el origen y la licencia de `web/public/inicio/moon.jpg` (ver Créditos).
- Un módulo `web/src/ui/uxEnhance.js` que el `main.js` subido a GitHub importaba no llegó al repositorio; se quitó ese import para que la aplicación compile. Si existe en el equipo de quien lo escribió, hay que subirlo y volver a llamarlo desde `main.js`.
- Aplicar el mosaico LROC NAC a 1 m/px (teselas de 2–3 GB; haría falta además quitar las sombras de 2010) o usar un producto con iluminación uniforme; hoy solo se usan sus vistas previas de ~32 m.
- Un modelo de rover lunar: NASA 3D Resources no ofrece un LRV en GLB, y el rover actual es el de Marte.
- Inclinar el eje de la Tierra y usar la fase real de la Luna de las efemérides.
- Coordenadas de aterrizaje concretas en vez del centro del DEM, y más regiones.
- Precargar en reposo los terrenos de los sitios que faltan. El JavaScript ya va en bloques: la app (~194 kB), three.js (~579 kB, en su propio archivo para que el navegador lo conserve entre versiones) y, bajo demanda, la ventana de Análisis y los cargadores GLTF/Draco. No se divide más porque el 3D es lo primero que se ve.
