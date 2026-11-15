# Reglas de diseño — Lunar Landing Site Navigator

## Propósito

La interfaz debe ayudar a explorar el terreno lunar y, a la vez, responder rápido a la pregunta de planificación: qué sitio y fecha ofrecen mejores condiciones de luz y visibilidad. La escena 3D despierta curiosidad; el panel presenta los datos comparables y sus límites.

## Reglas visuales y de interacción

1. **Una identidad nacida del producto.** Usar negro y carbón como base, blanco cálido para lectura y dorado para acentos, acciones y Sol. La Tierra y los datos secundarios usan blanco o gris; no introducir azules decorativos.
2. **La información importante gana primero.** Ordenar el panel como título y herramientas, selección de sitio/fecha, veredicto, cuentas atrás, métricas y gráfica. El veredicto y los tiempos a ocaso deben identificarse sin leer todo el panel.
3. **El color nunca explica por sí solo.** Los estados conservan su etiqueta textual; los valores de Sol, Tierra y viabilidad usan color de forma consistente. Mantener contraste legible y foco visible para teclado.
4. **Una sola escala coherente.** Usar títulos condensados para identidad, texto sans serif para lectura y mono para horas/números técnicos. Mantener tamaños, espaciado y radios repetibles en tarjetas y controles.
5. **Controles previsibles y táctiles.** Agrupar fecha, sitio y periodo; mostrar unidades/etiquetas; disponer altura suficiente para interacción (40 px en controles) y conservar instrucciones de navegación visibles dentro de la escena.
6. **Comparar sin perder contexto.** A y B usan el mismo orden, escala y lenguaje visual; distinguirlos con acentos dorados sutiles y etiquetas claras. Las diferencias deben quedar junto a los escenarios.
7. **La simulación y el panel se apoyan.** La escena ocupa el área visual principal en escritorio y la selección/métricas permanecen en un panel desplazable. En móvil, la escena aparece primero y el panel fluye debajo; el HUD no debe tapar el terreno innecesariamente.
8. **Menos ruido, más señal.** Reducir marcos y mayúsculas decorativas; usar tarjetas para agrupar datos relacionados. Animaciones cortas y opcionales, respetando `prefers-reduced-motion`.
9. **Escritura clara y honesta.** Priorizar etiquetas comprensibles, estados explícitos y unidades. Las aproximaciones, cobertura de datos y límites del modelo siguen accesibles sin dominar la vista principal.
10. **Diseño adaptable.** Revisar el flujo a 320 px, tablet y escritorio; permitir que fechas, comparación, cronología y textos largos se reacomoden sin recortes ni desplazamiento horizontal.

## Estructura final aplicada

- **Escritorio:** terreno 3D a la izquierda y planificador con scroll a la derecha. En comparar, el panel gana anchura y muestra A/B en dos columnas.
- **Móvil:** vista 3D en la parte superior, controles en una columna y métricas en tarjetas apiladas.
- **Sistema visual:** negro `#090909`, carbón `#141414` / `#1d1d1b`, blanco cálido `#f4f1e9`, gris `#aaa69b`, dorado `#d4ad5b`; verde/ámbar/rojo solo para estados de viabilidad.
- **Componentes:** controles agrupados, veredictos tipo etiqueta, cuentas atrás destacadas, métricas con separadores y HUD negro translúcido con borde dorado.
- **Escena de superficie:** conservar la altura LOLA real y renderizar todos sus puntos de 5 m para dar más detalle al relieve. El rover usa el GLB de Perseverance de NASA/JPL como referencia visual de seis ruedas; el modelo se normaliza a escala de escena y conserva el rover simple como respaldo si no carga.

## Fundamento consultado

- [WCAG 2.2 (W3C)](https://www.w3.org/TR/WCAG22/): contraste, foco visible, uso por teclado y objetivos de interacción.
- [10 heurísticas de usabilidad (Nielsen Norman Group)](https://www.nngroup.com/articles/ten-usability-heuristics/): estado visible, lenguaje familiar, consistencia, prevención de errores y jerarquía sin ruido.
- [Material Design 3: tipografía](https://m3.material.io/styles/typography/applying-type) y [roles de color](https://m3.material.io/styles/color/roles): tipografía semántica y color con funciones consistentes.
- [NASA Horizon Design System](https://github.com/nasa/hds-core): referencia de sistema visual para contenido científico/espacial; se toma como inspiración, sin replicar identidad institucional.
