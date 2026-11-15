# Lunar Landing Site Navigator — Investigación de tecnologías

#Investigación de tecnologías

> NASA Space Apps Challenge 2026 · Reto "CLPS Lunar Mission Browser"
> Objetivo: juego 3D interactivo donde el jugador es un robot que viaja entre sitios de aterrizaje del polo sur lunar.  El juego muestra las posiciones del Sol y la Tierra respecto al horizonte.



El problema consiste en seleccionar un sitio de aterrizaje en el polo sur de la Luna, ya que la oscuridad prolongada y la perdida de visión con la tierra suponen un desafío critico. 



Nuestra solución consiste en crear una plataforma web interactiva diseñada para evaluar, simular y validar la viabilidad de sitios de aterrizaje lunares en tiempo real plataforma web interactiva diseñada para evaluar, simular y validar la viabilidad de sitios de aterrizaje lunares en tiempo real.



El proyecto Lunar Landing Site Navigator se justifica en la imperiosa necesidad de contar con una herramienta computacional interactiva que automatice la evaluación de la viabilidad operativa (iluminación, oscuridad máxima y continuidad de comunicaciones) para ingenieros y planificadores de misiones

* Se integran los conjuntos de datos del South Pole LOLA DEM Mosaic y la topografía de alta resolución de LOLA para los sitios del polo sur proporcionados por el Planetary Data System / PGDA.
* Se incorpora el mosaico de elevación de alta precisión de 5 m/pix LOLA DEM (87–90°S), lo que permite evaluar micro-relieves, pendientes de crestas y obstáculos locales que podrían comprometer la estabilidad de un rover.
* Asimismo, se complementa con el uso de sistemas cartográficos de referencia como LROC QuickMap para la validación cruzada de sombras y condiciones de iluminación superficial.



La viabilidad temporal de un sitio de aterrizaje depende enteramente de la predictibilidad astronómica de las posiciones relativas entre la Luna, la Tierra y el Sol. Para resolver este desafío sin depender de aproximaciones empíricas, el motor de cálculo del sistema implementa estándares científicos de alta precisión:



Skyfield: Utilizado para la gestión de marcos de referencia planetarios, vectores de posición y transformaciones de coordenadas astronómicas en tiempo real.

Astronomy Engine (npm): Empleado para el cálculo eficiente y de alto rendimiento de efemérides, predicciones de eclipses, ángulos de elevación solar y ventanas de visibilidad de la Tierra desde puntos específicos de la superficie lunar.



El proyecto incorpora modelos tridimensionales y activos oficiales provenientes de los repositorios abiertos de la NASA 3D Resources (GitHub) junto con texturas y registros visuales de images.nasa.gov 



A nivel de rendimiento gráfico en el navegador, la aplicación aprovecha las características más recientes del ecosistema Three.js, integrando la manualidad técnica del WebGPURenderer y las innovaciones del estándar gráfico de 2026. Esto permite renderizar dinámicamente el terreno lunar, las sombras en evolución y el entorno del rover con una fluidez óptima y optimizada para la toma de decisiones en tiempo real.



\---

##Fuentes

* [High-Resolution LOLA Topography for Lunar South Pole Sites (PGDA)](https://pgda.gsfc.nasa.gov/products/78)
* [South Pole LOLA DEM Mosaic (PGDA)](https://pgda.gsfc.nasa.gov/products/81)
* [5 m/pix LOLA DEM Mosaic 87–90°S](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/)
* [Skyfield – Planetary reference frames](https://rhodesmill.org/skyfield/planetary.html)
* [Astronomy Engine (npm)](https://npmjs.com/package/astronomy-engine)
* [Three.js WebGPURenderer manual](https://threejs.org/manual/en/webgpurenderer)
* [What's New in Three.js (2026)](https://www.utsubo.com/blog/threejs-2026-what-changed)
* [NASA 3D Resources (GitHub)](https://github.com/nasa/NASA-3D-Resources)
* [NASA announces 9 possible Artemis 3 landing regions (Space.com)](https://www.space.com/space-exploration/artemis/nasa-announces-9-possible-moon-landing-sites-for-artemis-3-lunar-mission)
* https://images.nasa.gov/
* https://quickmap.lroc.im-ldi.com/?prjExtent=-3650461.2954186%2C-1737400%2C3650461.2954186%2C1737400\&earthShadowEnabled=true\&proj=10\&stack=3314\&defs=N4IgzGCMAsIFygPYAcCGBjAlgFwJ70gF9Cg 

