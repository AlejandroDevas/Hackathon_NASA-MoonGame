# NASA 3D models

Both models are NASA assets with their credit below; neither is a CLPS or Artemis vehicle.

## Rover

- Asset: Mars 2020 Perseverance Rover GLB (4.76 MB).
- Source: NASA/JPL-Caltech, [NASA Science 3D Resources](https://science.nasa.gov/3d-resources/mars-2020-perseverance-rover/).
- The model is used as a visual stand-in for the six-wheeled rover in the lunar terrain scene. It is not an exact lunar vehicle; NASA's PROMISE page describes a rover based on Curiosity/Perseverance hardware and currently provides an interactive model rather than a downloadable GLB.
- NASA's 3D Resources says assets are free to download and use. Keep NASA/JPL-Caltech attribution and follow [NASA's media usage guidance](https://www.nasa.gov/general/nasa-brand-center/images-and-media/). NASA is not endorsing this project.
- The GLB is Draco-compressed. The decoder (`draco_wasm_wrapper.js` and `draco_decoder.wasm`, from the three.js distribution, MIT licence) is served locally from `public/draco/`, so the page still makes no third-party requests.

## Lunar module

- Asset: Apollo Lunar Module GLB (`apollo-lunar-module.glb`, 716,840 bytes; Draco-compressed, WebP textures).
- Source: NASA 3D Resources, [NASA-3D-Resources on GitHub](https://github.com/nasa/NASA-3D-Resources) (`3D Models/Apollo Lunar Module/Apollo Lunar Module.glb`); the catalogue entry is on [data.nasa.gov](https://data.nasa.gov/dataset/nasa-3d-models-apollo-lunar-module).
- It is the historical Apollo vehicle, used here only as a recognisable stand-in for "a lunar lander" at the landing zone. It is NOT a CLPS or Artemis lander. NASA's 3D Resources hub says its assets are free to download and use under the NASA Images and Media Usage Guidelines (the data.nasa.gov page itself says "license not specified"). Keep the NASA credit; NASA does not endorse this project.
- While it loads, or if it cannot load, the scene shows a simple procedural lander instead.
