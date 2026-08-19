# WebGPU `<model>` polyfill

This project provides a declarative fallback for the proposed HTML `<model>` element. It uses Three.js `WebGPURenderer`, which selects WebGPU when available and falls back to its WebGL2 backend on older browsers.

Native `<model>` implementations are left untouched.

When the browser grants the experimental WebXR `inline-stereo` feature, each loaded model automatically switches to the browser-provided left- and right-eye views. The regular WebGPU canvas remains available as the fallback if the session is unsupported or ends.

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

The live page includes the animated plane with playback speed and play/pause controls.

## Supported behavior

- glTF/GLB and USD/USDZ through Three.js loaders
- Multiple `<source>` elements, tried in order when parsing fails
- `stagemode="orbit"` with drag, wheel, pinch, keyboard control, and inertia
- `ready`, `complete`, `readyState`, `currentSrc`, `boundingBoxCenter`, and `boundingBoxExtents`
- `entityTransform` using `DOMMatrix`
- `autoplay`, `loop`, `play()`, `pause()`, `currentTime`, `duration`, and `playbackRate`
- `environmentmap`/`environmentMap` for equirectangular HDR lighting
- Automatic fixed-view `inline-stereo` rendering through browser-provided `XRView` projection matrices and viewports
- `load`, `loadstart`, `progress`, `error`, `play`, `pause`, `ended`, `iblload`, `stereostart`, `stereoend`, `stereoblocked`, `trackingstart`, and `trackingerror` events
- Dynamic `<model>` elements and source/attribute changes

After initialization, `data-model-renderer` is set to `webgpu`, `webgl2`, or `webgl2-inline-stereo`, which is useful for diagnostics. `data-model-stereo="inline-stereo"` is present while stereo presentation is active.

Before presenting inline stereo, the polyfill checks the model and its ancestors for CSS effects that flatten descendants into an intermediate mono surface, including filters, backdrop filters, masks, clip paths, group opacity, blending, and overflow clipping combined with rounded corners. When found, it stays on the normal mono renderer, displays a warning on the model, emits `stereoblocked`, and sets `data-model-stereo-blocked` to the detected blocker codes.

The inline-stereo path intentionally uses a second `WebGPURenderer({ forceWebGL: true })`. The current feature is defined around an `XRWebGLLayer` and its DOM output canvas, so WebGL2 is required for that presentation path even when ordinary rendering uses WebGPU. Viewport packing is never assumed; every frame uses `XRWebGLLayer.getViewport(view)`.

Stereo placement derives the page's zero-disparity distance from the browser-provided left- and right-eye matrices, then normalizes model scale against the vertical projection. The model is recessed slightly beyond that plane so its nearest fitted surface appears behind the page rather than protruding in front of it. When tracking starts, the first local viewer pose anchors the existing placement in the stationary reference space, avoiding a visual jump between modes. The selected values are exposed as `data-model-page-distance` and `data-model-page-scale` for diagnostics.

Fixed stereo starts with the non-tracking `viewer` reference space. While it is active, a small “Enable head tracking” button requests a replacement session with the user-granted `local` reference space. `data-model-tracking` is `fixed` or `head` for diagnostics.

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
- Each stereo model requires its own inline XR session and WebGL2-backed presentation canvas.
- Inline stereo starts without spatial permission; head tracking is requested only from the model's user-activated control.
- The first animation clip is exposed through the media-style playback API.
- The fallback cannot reproduce browser-only spatial privacy, system lighting, or native visionOS presentation behavior.
