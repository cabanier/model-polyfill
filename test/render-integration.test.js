import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimationClip, BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';

const rendererState = vi.hoisted(() => ({ renders: 0 }));

vi.mock('three/webgpu', async (importOriginal) => ({
  ...(await importOriginal()),
  WebGPURenderer: class {
    constructor(options) {
      this.backend = { isWebGPUBackend: true };
      this.domElement = options.canvas;
      this.outputColorSpace = '';
      this.toneMapping = 0;
      this.toneMappingExposure = 1;
    }

    async init() {}
    dispose() {}
    render() { rendererState.renders += 1; }
    setPixelRatio() {}
    setSize() {}
  },
}));

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    async loadAsync(src) {
      const scene = new Group();
      scene.add(new Mesh(new BoxGeometry(1, 2, 3), new MeshStandardMaterial()));
      const animations = src.includes('animated') ? [new AnimationClip('propeller', 2, [])] : [];
      return { animations, scene };
    }
  },
}));

vi.mock('three/addons/loaders/USDLoader.js', () => ({
  USDLoader: class {},
}));

import { MODEL_READY_STATE } from '../src/constants.js';
import {
  getModelPolyfillInstallation,
  installModelPolyfill,
} from '../src/install.js';
import { getModelState } from '../src/model-element.js';

describe('render lifecycle', () => {
  afterEach(() => {
    getModelPolyfillInstallation()?.disconnect();
    document.body.replaceChildren();
    rendererState.renders = 0;
  });

  it('loads, frames, and renders a model before resolving ready', async () => {
    installModelPolyfill();
    const model = document.createElement('model');
    model.getBoundingClientRect = () => ({
      bottom: 300,
      height: 300,
      left: 0,
      right: 300,
      top: 0,
      width: 300,
      x: 0,
      y: 0,
      toJSON() {},
    });
    document.body.appendChild(model);
    model.src = '/model.glb';

    await model.ready;

    expect(model.readyState).toBe(MODEL_READY_STATE.COMPLETE);
    expect(model.complete).toBe(true);
    expect(model.currentSrc).toMatch(/model\.glb$/);
    expect(model.boundingBoxExtents.x).toBeCloseTo(1);
    expect(model.boundingBoxExtents.y).toBeCloseTo(2);
    expect(model.boundingBoxExtents.z).toBeCloseTo(3);
    expect(model.dataset.modelRenderer).toBe('webgpu');
    expect(model.querySelector('canvas[data-model-internal]')).not.toBeNull();
    expect(rendererState.renders).toBeGreaterThan(0);
  });

  it('supports autoplay, looping, pause, play, and playbackRate', async () => {
    installModelPolyfill();
    const model = document.createElement('model');
    model.getBoundingClientRect = () => ({
      bottom: 180,
      height: 180,
      left: 0,
      right: 320,
      top: 0,
      width: 320,
      x: 0,
      y: 0,
      toJSON() {},
    });
    model.autoplay = true;
    model.loop = true;
    document.body.appendChild(model);
    model.src = '/animated.glb';

    await model.ready;

    expect(model.duration).toBe(2);
    expect(model.paused).toBe(false);
    model.pause();
    expect(model.paused).toBe(true);

    model.currentTime = 0;
    model.playbackRate = 2;
    await model.play();
    getModelState(model).context.frame(performance.now(), 0.25);

    expect(model.currentTime).toBeCloseTo(0.5);
    expect(model.paused).toBe(false);
    model.pause();
  });
});
