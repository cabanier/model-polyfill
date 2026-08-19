import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimationClip, BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';

const rendererState = vi.hoisted(() => ({ instances: [], renders: 0 }));

vi.mock('three/webgpu', async (importOriginal) => ({
  ...(await importOriginal()),
  WebGPURenderer: class {
    constructor(options) {
      this.options = options;
      this.backend = options.forceWebGL
        ? { isWebGLBackend: true }
        : { isWebGPUBackend: true };
      this.domElement = options.canvas;
      this.outputColorSpace = '';
      this.toneMapping = 0;
      this.toneMappingExposure = 1;
      this.viewportCalls = [];
      this.scissorCalls = [];
      this.renderCount = 0;
      rendererState.instances.push(this);
    }

    async init() {}
    dispose() {}
    clear() {}
    getContext() { return {}; }
    render() {
      this.renderCount += 1;
      rendererState.renders += 1;
    }
    setScissor(...values) { this.scissorCalls.push(values); }
    setScissorTest() {}
    setPixelRatio() {}
    setSize(width, height) {
      this.domElement.width = width;
      this.domElement.height = height;
    }
    setViewport(...values) { this.viewportCalls.push(values); }
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

import { CSS_PIXELS_PER_METRE, MODEL_READY_STATE } from '../src/constants.js';
import {
  getModelPolyfillInstallation,
  installModelPolyfill,
} from '../src/install.js';
import { getModelState } from '../src/model-element.js';
import { resetInlineStereoSupportForTests } from '../src/inline-stereo.js';

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for condition');
}

function identityTransform(x = 0, y = 0, z = 0) {
  return {
    matrix: new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      x, y, z, 1,
    ]),
  };
}

describe('render lifecycle', () => {
  afterEach(() => {
    getModelPolyfillInstallation()?.disconnect();
    document.body.replaceChildren();
    rendererState.renders = 0;
    rendererState.instances.length = 0;
    resetInlineStereoSupportForTests();
    delete window.XRWebGLLayer;
    delete navigator.xr;
    vi.restoreAllMocks();
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

  it('stays mono and displays a warning when CSS blocks stereo promotion', async () => {
    const session = {
      end: vi.fn().mockResolvedValue(undefined),
    };
    const requestSession = vi.fn().mockResolvedValue(session);
    Object.defineProperty(navigator, 'xr', {
      configurable: true,
      value: {
        isSessionSupported: vi.fn().mockResolvedValue(true),
        requestSession,
      },
    });
    window.XRWebGLLayer = class {};
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    installModelPolyfill();
    const wrapper = document.createElement('div');
    wrapper.style.filter = 'blur(2px)';
    const model = document.createElement('model');
    model.style.contain = 'none';
    model.style.overflow = 'visible';
    model.style.borderRadius = '0';
    model.getBoundingClientRect = () => ({
      bottom: 200,
      height: 200,
      left: 0,
      right: 300,
      top: 0,
      width: 300,
      x: 0,
      y: 0,
      toJSON() {},
    });
    wrapper.appendChild(model);
    document.body.appendChild(wrapper);

    let blockedDetail = null;
    model.addEventListener('stereoblocked', (event) => { blockedDetail = event.detail; });
    model.src = '/model.glb';
    await model.ready;
    await waitFor(() => Boolean(model.dataset.modelStereoBlocked));

    expect(requestSession).toHaveBeenCalledWith('inline', {
      requiredFeatures: ['inline-stereo'],
    });
    expect(session.end).toHaveBeenCalled();
    expect(model.dataset.modelRenderer).toBe('webgpu');
    expect(model.dataset.modelStereo).toBeUndefined();
    expect(model.dataset.modelStereoBlocked).toContain('filter');
    expect(blockedDetail.blockers.some(({ code }) => code === 'filter')).toBe(true);
    expect(model.querySelector('.model-element-polyfill__stereo-warning').textContent)
      .toContain('Showing mono');
    expect(rendererState.instances.some((renderer) => renderer.options.forceWebGL)).toBe(false);
  });

  it('switches to browser-provided inline stereo views when available', async () => {
    let xrFrameCallback = null;
    let trackedXrFrameCallback = null;
    let ended = false;
    let trackedEnded = false;
    const endListeners = new Set();
    const trackedEndListeners = new Set();
    const session = {
      addEventListener(type, listener) {
        if (type === 'end') endListeners.add(listener);
      },
      end() {
        ended = true;
        return Promise.resolve();
      },
      removeEventListener(type, listener) {
        if (type === 'end') endListeners.delete(listener);
      },
      renderState: {},
      requestAnimationFrame(callback) {
        xrFrameCallback = callback;
        return 1;
      },
      requestReferenceSpace: vi.fn().mockResolvedValue({ type: 'viewer' }),
      updateRenderState(state) {
        this.renderState = { ...this.renderState, ...state };
      },
    };
    const trackedSession = {
      addEventListener(type, listener) {
        if (type === 'end') trackedEndListeners.add(listener);
      },
      end() {
        trackedEnded = true;
        return Promise.resolve();
      },
      removeEventListener(type, listener) {
        if (type === 'end') trackedEndListeners.delete(listener);
      },
      renderState: {},
      requestAnimationFrame(callback) {
        trackedXrFrameCallback = callback;
        return 2;
      },
      requestReferenceSpace: vi.fn().mockResolvedValue({ type: 'local' }),
      updateRenderState(state) {
        this.renderState = { ...this.renderState, ...state };
      },
    };
    const requestSession = vi.fn()
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce(trackedSession);
    Object.defineProperty(navigator, 'xr', {
      configurable: true,
      value: {
        isSessionSupported: vi.fn().mockResolvedValue(true),
        requestSession,
      },
    });
    window.XRWebGLLayer = class {
      constructor(layerSession) {
        this.session = layerSession;
        this.framebuffer = null;
      }

      getViewport(view) {
        return view.eye === 'left'
          ? { x: 0, y: 0, width: 150, height: 200 }
          : { x: 150, y: 0, width: 150, height: 200 };
      }
    };

    const installation = installModelPolyfill();
    const model = document.createElement('model');
    model.style.contain = 'none';
    model.style.overflow = 'visible';
    model.style.borderRadius = '0';
    model.getBoundingClientRect = () => ({
      bottom: 200,
      height: 200,
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
    await waitFor(() => typeof xrFrameCallback === 'function');

    const expectedPageDistance = 0.6;
    const portalHeight = 200 / CSS_PIXELS_PER_METRE;
    const verticalFieldOfView = 2 * Math.atan(portalHeight / (2 * expectedPageDistance))
      * (180 / Math.PI);
    const projectionCamera = new (await import('three')).PerspectiveCamera(
      verticalFieldOfView,
      0.75,
      0.01,
      10,
    );
    const leftProjectionMatrix = new Float32Array(projectionCamera.projectionMatrix.elements);
    const rightProjectionMatrix = new Float32Array(projectionCamera.projectionMatrix.elements);
    const eyeSeparation = 0.064;
    const projectionOffset = projectionCamera.projectionMatrix.elements[0]
      * eyeSeparation / (2 * expectedPageDistance);
    leftProjectionMatrix[8] = projectionOffset;
    rightProjectionMatrix[8] = -projectionOffset;
    let stereoStarted = false;
    model.addEventListener('stereostart', () => { stereoStarted = true; });
    xrFrameCallback(100, {
      session,
      getViewerPose: () => ({
        views: [
          { eye: 'left', projectionMatrix: leftProjectionMatrix, transform: identityTransform(-0.032) },
          { eye: 'right', projectionMatrix: rightProjectionMatrix, transform: identityTransform(0.032) },
        ],
      }),
    });

    const stereoRenderer = rendererState.instances.find((renderer) => renderer.options.forceWebGL);
    expect(requestSession).toHaveBeenCalledWith('inline', {
      requiredFeatures: ['inline-stereo'],
    });
    expect(stereoStarted).toBe(true);
    expect(model.dataset.modelStereo).toBe('inline-stereo');
    expect(model.dataset.modelRenderer).toBe('webgl2-inline-stereo');
    expect(session.renderState.inlineVerticalFieldOfView).toBeGreaterThan(0);
    expect(stereoRenderer.renderCount).toBe(2);
    expect(stereoRenderer.viewportCalls).toContainEqual([0, 0, 150, 200]);
    expect(stereoRenderer.viewportCalls).toContainEqual([150, 0, 150, 200]);
    const modelRoot = getModelState(model).context.modelRoot;
    expect(modelRoot.position.z).toBeCloseTo(-expectedPageDistance - 0.01, 3);
    expect(modelRoot.scale.x).toBeCloseTo(1, 3);
    expect(model.dataset.modelPageDistance).toBe(expectedPageDistance.toFixed(4));
    const fixedModelPosition = modelRoot.position.clone();

    const trackingButton = model.querySelector('.model-element-polyfill__tracking-button');
    expect(trackingButton.hidden).toBe(false);
    expect(trackingButton.textContent).toBe('Enable head tracking');
    let trackingStarted = false;
    model.addEventListener('trackingstart', () => { trackingStarted = true; });
    trackingButton.click();
    await waitFor(() => model.dataset.modelTracking === 'head');

    expect(requestSession).toHaveBeenLastCalledWith('inline', {
      requiredFeatures: ['inline-stereo', 'local'],
    });
    expect(session.requestReferenceSpace).toHaveBeenCalledWith('viewer');
    expect(trackedSession.requestReferenceSpace).toHaveBeenCalledWith('local');
    expect(ended).toBe(true);
    expect(trackingStarted).toBe(true);
    expect(typeof trackedXrFrameCallback).toBe('function');

    const initialTrackedViewer = { x: 0.4, y: 1.6, z: 0.2 };
    const trackedPageDistance = 0.9;
    const trackedHorizontalProjectionOffset = 0.35;
    const trackedVerticalProjectionOffset = -0.2;
    const trackedLeftProjectionMatrix = new Float32Array(leftProjectionMatrix);
    const trackedRightProjectionMatrix = new Float32Array(rightProjectionMatrix);
    const trackedStereoProjectionOffset = projectionCamera.projectionMatrix.elements[0]
      * eyeSeparation / (2 * trackedPageDistance);
    trackedLeftProjectionMatrix[8] = trackedStereoProjectionOffset
      + trackedHorizontalProjectionOffset;
    trackedRightProjectionMatrix[8] = -trackedStereoProjectionOffset
      + trackedHorizontalProjectionOffset;
    trackedLeftProjectionMatrix[9] = trackedVerticalProjectionOffset;
    trackedRightProjectionMatrix[9] = trackedVerticalProjectionOffset;
    trackedXrFrameCallback(200, {
      session: trackedSession,
      getViewerPose: () => ({
        transform: identityTransform(
          initialTrackedViewer.x,
          initialTrackedViewer.y,
          initialTrackedViewer.z,
        ),
        views: [
          {
            eye: 'left',
            projectionMatrix: trackedLeftProjectionMatrix,
            transform: identityTransform(
              initialTrackedViewer.x - 0.032,
              initialTrackedViewer.y,
              initialTrackedViewer.z,
            ),
          },
          {
            eye: 'right',
            projectionMatrix: trackedRightProjectionMatrix,
            transform: identityTransform(
              initialTrackedViewer.x + 0.032,
              initialTrackedViewer.y,
              initialTrackedViewer.z,
            ),
          },
        ],
      }),
    });
    const insetPageDistance = trackedPageDistance + 0.01;
    const expectedTrackedXOffset = trackedHorizontalProjectionOffset
      * insetPageDistance / projectionCamera.projectionMatrix.elements[0];
    const expectedTrackedYOffset = trackedVerticalProjectionOffset
      * insetPageDistance / projectionCamera.projectionMatrix.elements[5];
    expect(modelRoot.position.x).toBeCloseTo(
      initialTrackedViewer.x + fixedModelPosition.x + expectedTrackedXOffset,
    );
    expect(modelRoot.position.y).toBeCloseTo(
      initialTrackedViewer.y + fixedModelPosition.y + expectedTrackedYOffset,
    );
    expect(modelRoot.position.z).toBeCloseTo(initialTrackedViewer.z - insetPageDistance);
    expect(modelRoot.scale.x).toBeCloseTo(trackedPageDistance / expectedPageDistance);
    expect(model.dataset.modelPageDistance).toBe(trackedPageDistance.toFixed(4));
    const anchoredModelPosition = modelRoot.position.clone();

    trackedXrFrameCallback(216, {
      session: trackedSession,
      getViewerPose: () => ({
        transform: identityTransform(0.55, 1.65, 0.1),
        views: [
          {
            eye: 'left',
            projectionMatrix: trackedLeftProjectionMatrix,
            transform: identityTransform(0.55 - 0.032, 1.65, 0.1),
          },
          {
            eye: 'right',
            projectionMatrix: trackedRightProjectionMatrix,
            transform: identityTransform(0.55 + 0.032, 1.65, 0.1),
          },
        ],
      }),
    });
    expect(modelRoot.position.toArray()).toEqual(anchoredModelPosition.toArray());
    expect(trackingButton.textContent).toBe('Head tracking on');
    expect(trackingButton.disabled).toBe(true);

    let stereoEnded = false;
    model.addEventListener('stereoend', () => { stereoEnded = true; });
    trackedEnded = true;
    for (const listener of [...trackedEndListeners]) listener({ session: trackedSession });

    expect(stereoEnded).toBe(true);
    expect(model.dataset.modelStereo).toBeUndefined();
    expect(model.dataset.modelRenderer).toBe('webgpu');

    installation.disconnect();
    expect(ended).toBe(true);
    expect(trackedEnded).toBe(true);
  });
});
