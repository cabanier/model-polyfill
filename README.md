# WebGPU `<model>` polyfill

This project provides a declarative fallback for the proposed HTML `<model>` element. It uses Three.js `WebGPURenderer`, which selects WebGPU when available and falls back to its WebGL2 backend on older browsers.

Native `<model>` implementations are left untouched.

## Run the example

```sh
npm install
npm run dev
```

Open the URL printed by Vite. The live example uses the same damaged-helmet assets as the immersive-web example.

## Use it

Import the module once, preferably from a module script in the document head:

```js
import 'model-element-webgpu-polyfill';
```

Then use declarative model markup:

```html
<model style="width: 400px; aspect-ratio: 1" stagemode="orbit" alt="Damaged helmet">
  <source src="helmet.usdz" type="model/vnd.usdz+zip">
  <source src="helmet.glb" type="model/gltf-binary">
  <img src="helmet.jpg" alt="Damaged helmet">
</model>
```

The fallback image remains visible while the renderer initializes and if every model source fails.

### Animated models

Embedded animation uses media-style controls:

```html
<model id="plane" autoplay loop alt="Animated plane">
  <source src="plane.usdz" type="model/vnd.usdz+zip">
  <source src="plane.glb" type="model/gltf-binary">
</model>

<script type="module">
  const plane = document.querySelector('#plane');
  await plane.ready;
  plane.playbackRate = 1.5;
  plane.pause();
  await plane.play();
</script>
```

The included demo has a live speed slider and play/pause control for the animated plane.

## Supported behavior

- glTF/GLB and USD/USDZ through Three.js loaders
- Multiple `<source>` elements, tried in order when parsing fails
- `stagemode="orbit"` with drag, wheel, pinch, keyboard control, and inertia
- `ready`, `complete`, `readyState`, `currentSrc`, `boundingBoxCenter`, and `boundingBoxExtents`
- `entityTransform` using `DOMMatrix`
- `autoplay`, `loop`, `play()`, `pause()`, `currentTime`, `duration`, and `playbackRate`
- `environmentmap`/`environmentMap` for equirectangular HDR lighting
- `load`, `loadstart`, `progress`, `error`, `play`, `pause`, `ended`, and `iblload` events
- Dynamic `<model>` elements and source/attribute changes

After initialization, `data-model-renderer` is set to `webgpu` or `webgl2`, which is useful for diagnostics.

Because `model` is not a valid autonomous-custom-element name, the package manually upgrades existing nodes, observes DOM additions, and patches `document.createElement('model')`. A registered `<model-polyfill>` custom element is also available when a forced fallback is useful for testing alongside native support.

## Programmatic installation

Importing the default entry installs automatically. It can also be controlled directly:

```js
import { installModelPolyfill } from 'model-element-webgpu-polyfill';

const installation = installModelPolyfill({
  cameraDistance: 0.3,
  maxPixelRatio: 2,
});
```

Set `force: true` only for controlled testing; it replaces native `<model>` behavior on that page.

## Build and test

```sh
npm test
npm run build
```

The library build keeps `three` external, so applications use their own compatible Three.js installation.

## Current limitations

- Each rendered element owns a `WebGPURenderer`; this is reliable across WebGPU canvases but is intended for pages with a modest number of simultaneously visible models.
- The first animation clip is exposed through the media-style playback API.
- The fallback cannot reproduce browser-only spatial privacy, system lighting, or native visionOS presentation behavior.
