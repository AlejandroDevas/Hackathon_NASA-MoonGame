# Reglas de diseño — Lunar Landing Site Navigator

## Propósito

La interfaz debe ayudar a explorar el terreno lunar y, a la vez, responder rápido a la pregunta de planificación: qué sitio y fecha ofrecen mejores condiciones de luz y visibilidad. La escena 3D despierta curiosidad; el panel presenta los datos comparables y sus límites.

## Reglas visuales y de interacción

1. **Una identidad nacida del producto.** Usar negro y carbón como base, blanco cálido para lectura y dorado para acentos, acciones y Sol. La Tierra y los datos secundarios usan blanco o gris en la interfaz; no introducir azules decorativos (la Tierra 3D, al ser una imagen de NASA, conserva su azul real).
2. **La información importante gana primero.** Ordenar el panel como título y herramientas, selección de sitio/fecha, veredicto, cuentas atrás, métricas y gráfica. El veredicto y los tiempos a ocaso deben identificarse sin leer todo el panel.
3. **El color nunca explica por sí solo.** Los estados conservan su etiqueta textual; los valores de Sol, Tierra y viabilidad usan color de forma consistente. Mantener contraste legible y foco visible para teclado.
4. **Una sola escala coherente.** Usar títulos condensados para identidad, texto sans serif para lectura y mono para horas/números técnicos. Mantener tamaños, espaciado y radios repetibles en tarjetas y controles.
5. **Controles previsibles y táctiles.** Agrupar fecha, sitio y periodo; mostrar unidades/etiquetas; disponer altura suficiente para interacción (40 px en controles) y conservar instrucciones de navegación visibles dentro de la escena.
6. **Comparar sin perder contexto.** A y B usan el mismo orden, escala y lenguaje visual; distinguirlos con acentos dorados sutiles y etiquetas claras. Las diferencias deben quedar junto a los escenarios.
7. **La simulación y el panel se apoyan.** La escena ocupa el área visual principal en escritorio y la selección/métricas permanecen en un panel desplazable. En móvil, la escena aparece primero y el panel fluye debajo; el HUD no debe tapar el terreno innecesariamente.
8. **Menos ruido, más señal.** Reducir marcos y mayúsculas decorativas; usar tarjetas para agrupar datos relacionados. Animaciones cortas y opcionales, respetando `prefers-reduced-motion`.
9. **Escritura clara y honesta.** Priorizar etiquetas comprensibles, estados explícitos y unidades. Las aproximaciones, cobertura de datos y límites del modelo siguen accesibles sin dominar la vista principal. Lo que se exagera o se inventa (grano procedural, tono LROC ×1,7, modelos de referencia) se dice en la documentación y, cuando se puede, se puede apagar.
10. **Diseño adaptable.** Revisar el flujo a 320 px, tablet y escritorio; permitir que fechas, comparación, cronología y textos largos se reacomoden sin recortes ni desplazamiento horizontal.

## Estructura final aplicada

- **Escritorio y móvil:** la escena 3D ocupa toda la pantalla; la barra superior y la inferior son fijas y translúcidas; el planificador es un cajón que entra por la derecha, entre las dos barras, y empieza cerrado. En móvil el cajón ocupa todo el ancho y la barra inferior pasa a dos filas (la línea de tiempo arriba; los controles y la velocidad abajo).
- **Sistema visual:** negro `#090909`, carbón `#141414` / `#1d1d1b`, blanco cálido `#f4f1e9`, gris `#aaa69b`, dorado `#d4ad5b`; verde/ámbar/rojo solo para estados de viabilidad.
- **Componentes del planificador:** controles agrupados, veredictos tipo etiqueta, cuentas atrás destacadas (con la fecha debajo cuando faltan 30 días o más), métricas con separadores y gráfica con cursor arrastrable.
- **Barra superior:** nombre de la aplicación (con la leyenda pequeña encima), selector de idioma y selector de sitio (el del escenario A) a la izquierda; a la derecha, de derecha a izquierda, sonido, aclarar sombras, imagen LROC (desactivada, con explicación, en el sitio que queda fuera del mosaico) y vista libre o seguir al robot, y el menú en la esquina con Planificador, Análisis y Comparar. Los botones con estado usan `aria-pressed`; por debajo de ~1180 px solo muestran el icono, con el nombre accesible intacto. El menú es un `role="menu"` con teclado completo.
- **Barra inferior (reproductor):** cuatro saltos (−1 d, −1 h, +1 h, +1 d), un botón de reproducir en forma de triángulo que pasa a pausa, una línea de tiempo sobre todo el rango calculado con marcas de año y el momento en UTC, y un botón de velocidad con su menú. Mismos colores que el resto: dorado para el botón principal y el tramo recorrido.
- **Ventana de Análisis:** capa modal (`role="dialog"`, foco atrapado, se cierra con Esc o con el fondo) de hasta 1180 px, con sus propios controles y cuatro secciones (mejores ventanas, calendario de luz, cielo, comparación de sitios). Los gráficos son SVG con los mismos colores: dorado para el Sol, blanco para la Tierra y gris para el relieve; los estados de viabilidad conservan su texto.
- **HUD de la escena:** ayuda de controles abajo a la izquierda, panel del Sol y la Tierra arriba a la izquierda, etiquetas flotantes de los puntos de interés (con una lista equivalente solo para lectores de pantalla) y el cartel del sitio arriba a la derecha, con datos calculados y enlaces a las fuentes. Todo en negro translúcido con borde dorado, sin tapar el terreno más de lo necesario.
- **Escena de superficie:** altura LOLA real a 5 m con grano procedural y, en cuatro sitios, un mapa de tonos LROC que se puede apagar. Modelos NASA: rover Perseverance (GLB) y módulo lunar Apolo (GLB), cada uno con un modelo procedural de respaldo; rocas instanciadas; polvo con gravedad lunar; Sol con halo; y la Tierra con la imagen Blue Marble, con nubes procedurales y fase real por la luz del Sol.

## Decisiones que cambiaron

- **La interfaz pasó de panel fijo a escena completa con barras (2026-11-15).** Antes el planificador ocupaba un 38 % de la pantalla a la derecha; ahora la escena es lo principal y el planificador se abre a petición desde el menú. El selector de sitio se movió a la barra superior (también está en el planificador, sincronizado, y allí tiene el suyo el escenario B). En móvil la barra pasa a dos filas para que quepan nombre, idioma, sitio, botones y menú.

- **La Tierra volvió a ser azul.** Primero se dibujó gris cálido siguiendo la regla de «no introducir azules decorativos»; una esfera gris se leía como otra Luna. El azul de la Tierra es el color real del planeta (imagen de NASA), no decoración, y es el único azul de la escena; la interfaz sigue sin azules.
- **El tono del suelo LROC se exagera** (×1,7) porque a Sol rasante apenas se vería; está documentado en el README y el botón «Imagen LROC» lo compara con el terreno liso.

## Fundamento consultado

- [WCAG 2.2 (W3C)](https://www.w3.org/TR/WCAG22/): contraste, foco visible, uso por teclado y objetivos de interacción.
- [10 heurísticas de usabilidad (Nielsen Norman Group)](https://www.nngroup.com/articles/ten-usability-heuristics/): estado visible, lenguaje familiar, consistencia, prevención de errores y jerarquía sin ruido.
- [Material Design 3: tipografía](https://m3.material.io/styles/typography/applying-type) y [roles de color](https://m3.material.io/styles/color/roles): tipografía semántica y color con funciones consistentes.
- [NASA Horizon Design System](https://github.com/nasa/hds-core): referencia de sistema visual para contenido científico/espacial; se toma como inspiración, sin replicar identidad institucional.
