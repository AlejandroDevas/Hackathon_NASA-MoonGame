# NASA rover model

- Asset: Mars 2020 Perseverance Rover GLB (4.76 MB).
- Source: NASA/JPL-Caltech, [NASA Science 3D Resources](https://science.nasa.gov/3d-resources/mars-2020-perseverance-rover/).
- The model is used as a visual stand-in for the six-wheeled rover in the lunar terrain scene. It is not an exact lunar vehicle; NASA's PROMISE page describes a rover based on Curiosity/Perseverance hardware and currently provides an interactive model rather than a downloadable GLB.
- NASA's 3D Resources says assets are free to download and use. Keep NASA/JPL-Caltech attribution and follow [NASA's media usage guidance](https://www.nasa.gov/general/nasa-brand-center/images-and-media/). NASA is not endorsing this project.
- The GLB is Draco-compressed. The decoder (`draco_wasm_wrapper.js` and `draco_decoder.wasm`, from the three.js distribution, MIT licence) is served locally from `public/draco/`, so the page still makes no third-party requests.
