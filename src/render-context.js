import {
  ACESFilmicToneMapping,
  DirectionalLight,
  EquirectangularReflectionMapping,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import {
  CSS_PIXELS_PER_METRE,
  DEFAULT_CAMERA_DISTANCE,
  DEFAULT_MAX_PIXEL_RATIO,
  MODEL_CANVAS_CLASS,
} from './constants.js';
import { OrbitController } from './orbit-controller.js';
import { InlineStereoPresenter } from './inline-stereo.js';
import { getRenderScheduler } from './render-scheduler.js';
import {
  applyDOMMatrixToObject,
  buildEntityTransform,
  calculateFitScale,
  cloneDOMMatrix,
  identityDOMMatrix,
} from './transform.js';

export class ModelRenderContext {
  constructor(element, options = {}) {
    this.element = element;
    this.cameraDistance = options.cameraDistance ?? DEFAULT_CAMERA_DISTANCE;
    this.maxPixelRatio = options.maxPixelRatio ?? DEFAULT_MAX_PIXEL_RATIO;
    this.onAnimationFrame = options.onAnimationFrame ?? (() => false);
    this.onEntityTransformChange = options.onEntityTransformChange ?? (() => {});
    this.onFirstRender = options.onFirstRender ?? (() => {});
    this.scheduler = getRenderScheduler();
    this.renderer = null;
    this.rendererBackend = '';
    this.scene = null;
    this.camera = null;
    this.canvas = null;
    this.modelRoot = null;
    this.pivot = null;
    this.center = new Vector3();
    this.size = new Vector3();
    this.entityTransform = identityDOMMatrix();
    this.environmentTexture = null;
    this.environmentVersion = 0;
    this.orbit = null;
    this.stageMode = 'none';
    this.userTransform = false;
    this.initialized = false;
    this.disposed = false;
    this.dirty = true;
    this.forceRender = false;
    this.waitingForFirstRender = false;
    this.isVisible = typeof IntersectionObserver === 'undefined';
    this.resizeObserver = null;
    this.intersectionObserver = null;
    this.inlineStereo = null;
  }

  async init() {
    if (this.initialized) return this;

    this.canvas = document.createElement('canvas');
    this.canvas.className = MODEL_CANVAS_CLASS;
    this.canvas.dataset.modelInternal = '';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.element.appendChild(this.canvas);

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(30, 1, 0.005, 1000);
    this.camera.position.set(0, 0, this.cameraDistance);

    const hemisphere = new HemisphereLight(0xffffff, 0x2b3040, 2.2);
    const key = new DirectionalLight(0xffffff, 3.5);
    const fill = new DirectionalLight(0x9dbdff, 1.8);
    const rim = new DirectionalLight(0xffd7b0, 1.4);
    key.position.set(2, 3, 4);
    fill.position.set(-4, 1, 2);
    rim.position.set(1, -3, -2);
    this.scene.add(hemisphere, key, fill, rim);

    this.modelRoot = new Group();
    this.pivot = new Group();
    this.modelRoot.add(this.pivot);
    this.scene.add(this.modelRoot);

    this.renderer = new WebGPURenderer({
      alpha: true,
      antialias: true,
      canvas: this.canvas,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, this.maxPixelRatio));
    this.resize();

    await this.renderer.init();
    if (this.disposed) {
      this.renderer.dispose();
      return this;
    }

    this.rendererBackend = this.renderer.backend?.isWebGPUBackend ? 'webgpu' : 'webgl2';
    this.element.dataset.modelRenderer = this.rendererBackend;
    this.orbit = new OrbitController(this.element, this.canvas, () => {
      this.applyDefaultTransform();
      this.invalidate();
    });
    this.setStageMode(this.stageMode);
    this.inlineStereo = new InlineStereoPresenter(this.element, this.scene, this.modelRoot, {
      cameraDistance: this.cameraDistance,
      onFrame: (delta) => {
        this.onAnimationFrame(delta);
        this.orbit?.tick(delta);
      },
      onPresented: (stereoCanvas) => {
        if (this.disposed) return;
        this.canvas.style.display = 'none';
        this.orbit?.setCanvas(stereoCanvas);
        this.element.dataset.modelRenderer = 'webgl2-inline-stereo';
        this.element.dataset.modelStereo = 'inline-stereo';
        this.element.dispatchEvent(new Event('stereostart'));
        if (this.waitingForFirstRender) {
          this.waitingForFirstRender = false;
          this.onFirstRender();
        }
      },
      onStopped: () => {
        if (this.disposed) return;
        this.canvas.style.display = 'block';
        this.orbit?.setCanvas(this.canvas);
        this.element.dataset.modelRenderer = this.rendererBackend;
        delete this.element.dataset.modelStereo;
        this.element.dispatchEvent(new Event('stereoend'));
        this.invalidate();
      },
    });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.element);
    }

    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        const entry = entries[entries.length - 1];
        this.isVisible = Boolean(entry?.isIntersecting);
        if (this.isVisible) this.invalidate();
      });
      this.intersectionObserver.observe(this.element);
    }

    this.initialized = true;
    this.scheduler.add(this);
    this.invalidate();
    return this;
  }

  resize() {
    if (!this.canvas || !this.camera || !this.renderer) return;
    const rect = this.element.getBoundingClientRect();
    const width = Math.max(Math.round(rect.width), 1);
    const height = Math.max(Math.round(rect.height), 1);
    const portalHeight = height / CSS_PIXELS_PER_METRE;

    this.renderer.setSize(width, height, false);
    this.inlineStereo?.resize();
    this.camera.aspect = width / height;
    this.camera.fov = 2 * Math.atan(portalHeight / (2 * this.cameraDistance)) * (180 / Math.PI);
    this.camera.updateProjectionMatrix();

    if (this.pivot?.children.length && (!this.userTransform || this.stageMode === 'orbit')) {
      this.applyDefaultTransform();
    }
    this.invalidate();
  }

  setModel(object, center, size) {
    this.clearModel();
    this.pivot.add(object);
    this.center.copy(center);
    this.size.copy(size);
    this.userTransform = false;
    this.orbit?.reset();
    this.applyDefaultTransform();
    this.waitingForFirstRender = true;
    this.forceRender = true;
    this.invalidate();
    this.inlineStereo?.start();
  }

  clearModel() {
    if (!this.pivot) return;
    while (this.pivot.children.length) this.pivot.remove(this.pivot.children[0]);
  }

  applyDefaultTransform() {
    if (!this.pivot || !this.pivot.children.length) return;
    const orbit = this.stageMode === 'orbit';
    const fitScale = calculateFitScale(this.element, this.size, orbit);
    const zoom = orbit ? this.orbit?.zoom ?? 1 : 1;
    const transform = buildEntityTransform({
      center: this.center,
      orbit,
      pitch: orbit ? this.orbit?.pitch ?? 0 : 0,
      scale: fitScale * zoom,
      size: this.size,
      yaw: orbit ? this.orbit?.yaw ?? 0 : 0,
    });
    this.setEntityTransform(transform, false);
  }

  setEntityTransform(value, userTransform = true) {
    if (!this.pivot) return;
    this.entityTransform = cloneDOMMatrix(value);
    this.userTransform = userTransform;
    applyDOMMatrixToObject(this.entityTransform, this.pivot);
    this.onEntityTransformChange(cloneDOMMatrix(this.entityTransform));
    this.invalidate();
  }

  getEntityTransform() {
    return cloneDOMMatrix(this.entityTransform);
  }

  setStageMode(mode) {
    this.stageMode = mode === 'orbit' ? 'orbit' : 'none';
    if (!this.orbit) return;

    if (this.stageMode === 'orbit') this.orbit.enable();
    else this.orbit.disable();

    if (this.pivot?.children.length) {
      this.userTransform = false;
      this.applyDefaultTransform();
    }
  }

  async setEnvironmentMap(url) {
    const version = ++this.environmentVersion;
    this.environmentTexture?.dispose();
    this.environmentTexture = null;
    if (this.scene) this.scene.environment = null;

    if (!url) {
      this.invalidate();
      return;
    }

    const resolved = new URL(url, this.element.ownerDocument.baseURI).href;
    try {
      const texture = await new HDRLoader().loadAsync(resolved);
      if (this.disposed || version !== this.environmentVersion) {
        texture.dispose();
        return;
      }
      texture.mapping = EquirectangularReflectionMapping;
      this.environmentTexture = texture;
      this.scene.environment = texture;
      this.element.dispatchEvent(new Event('iblload'));
      this.invalidate();
    } catch (error) {
      if (version !== this.environmentVersion) return;
      this.element.dispatchEvent(new CustomEvent('error', { detail: error }));
    }
  }

  invalidate() {
    this.dirty = true;
    if (!this.inlineStereo?.presented) this.scheduler.request();
  }

  frame(_time, delta) {
    if (this.disposed || !this.initialized) return false;
    if (this.inlineStereo?.presented) return false;
    if (!this.isVisible && !this.forceRender) return false;

    const animationActive = this.onAnimationFrame(delta);
    const orbitActive = this.orbit?.tick(delta) ?? false;
    if (animationActive || orbitActive) this.dirty = true;

    if (this.dirty) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
      this.forceRender = false;

      if (this.waitingForFirstRender) {
        this.waitingForFirstRender = false;
        this.onFirstRender();
      }
    }

    return this.isVisible && (animationActive || orbitActive);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scheduler.remove(this);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.inlineStereo?.dispose();
    this.orbit?.dispose();
    this.environmentTexture?.dispose();
    this.renderer?.dispose();
    this.canvas?.remove();
    delete this.element.dataset.modelRenderer;
    delete this.element.dataset.modelStereo;
    this.clearModel();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.canvas = null;
  }
}
