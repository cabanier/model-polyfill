import {
  ACESFilmicToneMapping,
  Matrix4,
  PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
  Vector4,
  WebGPURenderer,
} from 'three/webgpu';
import {
  CSS_PIXELS_PER_METRE,
  DEFAULT_CAMERA_DISTANCE,
  MODEL_CANVAS_CLASS,
} from './constants.js';
import {
  detectStereoPromotionBlockers,
  formatStereoPromotionWarning,
} from './stereo-promotion.js';

let inlineSessionSupportPromises = new WeakMap();
const PAGE_DEPTH_INSET_METRES = 0.01;

function getWindow(element) {
  return element.ownerDocument?.defaultView ?? globalThis.window;
}

async function supportsInlineSessions(windowObject) {
  if (!windowObject?.navigator?.xr || !windowObject.XRWebGLLayer) return false;
  let supportPromise = inlineSessionSupportPromises.get(windowObject);
  if (!supportPromise) {
    supportPromise = windowObject.navigator.xr.isSessionSupported('inline').catch(() => false);
    inlineSessionSupportPromises.set(windowObject, supportPromise);
  }
  return supportPromise;
}

function updateCameraFromView(camera, view) {
  camera.matrix.fromArray(view.transform.matrix);
  camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
  camera.matrixWorld.copy(camera.matrix);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  camera.projectionMatrix.fromArray(view.projectionMatrix);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

function projectionPageDistance(element, views, fallback) {
  const portalHeight = element.getBoundingClientRect().height / CSS_PIXELS_PER_METRE;
  const scales = views
    .map((view) => Math.abs(Number(view.projectionMatrix?.[5])))
    .filter((scale) => Number.isFinite(scale) && scale > 0);
  if (!(portalHeight > 0) || !scales.length) return fallback;
  const averageScale = scales.reduce((sum, scale) => sum + scale, 0) / scales.length;
  return portalHeight * averageScale / 2;
}

function stereoConvergenceDistance(pose) {
  const leftView = pose.views.find((view) => view.eye === 'left');
  const rightView = pose.views.find((view) => view.eye === 'right');
  if (!leftView?.transform?.matrix || !rightView?.transform?.matrix) return null;

  const viewerMatrix = new Matrix4();
  if (pose.transform?.matrix?.length === 16) viewerMatrix.fromArray(pose.transform.matrix);
  else viewerMatrix.identity();

  const leftViewMatrix = new Matrix4().fromArray(leftView.transform.matrix).invert();
  const rightViewMatrix = new Matrix4().fromArray(rightView.transform.matrix).invert();
  const leftProjection = new Matrix4().fromArray(leftView.projectionMatrix);
  const rightProjection = new Matrix4().fromArray(rightView.projectionMatrix);
  const worldPoint = new Vector4();
  const leftClip = new Vector4();
  const rightClip = new Vector4();

  const disparity = (distance) => {
    worldPoint.set(0, 0, -distance, 1).applyMatrix4(viewerMatrix);
    leftClip.copy(worldPoint).applyMatrix4(leftViewMatrix).applyMatrix4(leftProjection);
    rightClip.copy(worldPoint).applyMatrix4(rightViewMatrix).applyMatrix4(rightProjection);
    if (Math.abs(leftClip.w) < 1e-8 || Math.abs(rightClip.w) < 1e-8) return NaN;
    return leftClip.x / leftClip.w - rightClip.x / rightClip.w;
  };

  const minimumDistance = 0.01;
  const maximumDistance = 100;
  const minimumDisparity = disparity(minimumDistance);
  const maximumDisparity = disparity(maximumDistance);
  if (!Number.isFinite(minimumDisparity) || !Number.isFinite(maximumDisparity)) return null;
  if (Math.abs(minimumDisparity) < 1e-7 && Math.abs(maximumDisparity) < 1e-7) return null;

  let previousDistance = minimumDistance;
  let previousDisparity = minimumDisparity;
  for (let index = 1; index <= 96; index += 1) {
    const ratio = index / 96;
    const distance = minimumDistance * ((maximumDistance / minimumDistance) ** ratio);
    const currentDisparity = disparity(distance);
    if (!Number.isFinite(currentDisparity)) continue;
    if (Math.abs(currentDisparity) < 1e-7) return distance;

    if (Math.sign(previousDisparity) !== Math.sign(currentDisparity)) {
      let low = previousDistance;
      let high = distance;
      let lowDisparity = previousDisparity;
      for (let iteration = 0; iteration < 40; iteration += 1) {
        const midpoint = (low + high) / 2;
        const midpointDisparity = disparity(midpoint);
        if (!Number.isFinite(midpointDisparity)) break;
        if (Math.sign(lowDisparity) === Math.sign(midpointDisparity)) {
          low = midpoint;
          lowDisparity = midpointDisparity;
        } else {
          high = midpoint;
        }
      }
      return (low + high) / 2;
    }

    previousDistance = distance;
    previousDisparity = currentDisparity;
  }

  return null;
}

function stereoPageCenterOffset(pose, distance) {
  if (!(distance > 0)) return { x: 0, y: 0 };

  const viewerMatrix = new Matrix4();
  if (pose.transform?.matrix?.length === 16) viewerMatrix.fromArray(pose.transform.matrix);
  else viewerMatrix.identity();
  const referenceToViewerMatrix = viewerMatrix.clone().invert();

  const primaryViews = pose.views.filter((view) => view.eye === 'left' || view.eye === 'right');
  const views = primaryViews.length ? primaryViews : pose.views;
  const center = new Vector3();
  let rayCount = 0;

  for (const view of views) {
    if (view.transform?.matrix?.length !== 16 || view.projectionMatrix?.length !== 16) continue;

    const eyeToReferenceMatrix = new Matrix4().fromArray(view.transform.matrix);
    const eyeToViewerMatrix = new Matrix4().multiplyMatrices(
      referenceToViewerMatrix,
      eyeToReferenceMatrix,
    );
    const inverseProjectionMatrix = new Matrix4().fromArray(view.projectionMatrix).invert();
    const pointOnRay = new Vector4(0, 0, -1, 1).applyMatrix4(inverseProjectionMatrix);
    if (!Number.isFinite(pointOnRay.w) || Math.abs(pointOnRay.w) < 1e-8) continue;
    pointOnRay.multiplyScalar(1 / pointOnRay.w).applyMatrix4(eyeToViewerMatrix);
    if (!Number.isFinite(pointOnRay.w) || Math.abs(pointOnRay.w) < 1e-8) continue;
    pointOnRay.multiplyScalar(1 / pointOnRay.w);

    const origin = new Vector3().setFromMatrixPosition(eyeToViewerMatrix);
    const direction = new Vector3(
      pointOnRay.x - origin.x,
      pointOnRay.y - origin.y,
      pointOnRay.z - origin.z,
    );
    if (!Number.isFinite(direction.z) || Math.abs(direction.z) < 1e-8) continue;

    const rayDistance = (-distance - origin.z) / direction.z;
    if (!Number.isFinite(rayDistance) || rayDistance <= 0) continue;
    center.addScaledVector(direction, rayDistance).add(origin);
    rayCount += 1;
  }

  if (!rayCount) return { x: 0, y: 0 };
  center.multiplyScalar(1 / rayCount);
  return { x: center.x, y: center.y };
}

export function calculateStereoPagePlacement(element, pose, fallback = DEFAULT_CAMERA_DISTANCE) {
  const projectedDistance = projectionPageDistance(element, pose.views, fallback);
  const measuredConvergenceDistance = stereoConvergenceDistance(pose);
  const convergenceDistance = measuredConvergenceDistance ?? fallback;
  const scale = projectedDistance > 0 ? convergenceDistance / projectedDistance : 1;
  const centerOffset = stereoPageCenterOffset(pose, convergenceDistance);
  return {
    distance: convergenceDistance,
    hasMeasuredConvergence: measuredConvergenceDistance !== null,
    offsetX: centerOffset.x,
    offsetY: centerOffset.y,
    scale: Math.min(Math.max(scale, 0.25), 4),
  };
}

export class InlineStereoPresenter {
  constructor(element, scene, modelRoot, options = {}) {
    this.element = element;
    this.scene = scene;
    this.modelRoot = modelRoot;
    this.cameraDistance = options.cameraDistance ?? DEFAULT_CAMERA_DISTANCE;
    this.onFrame = options.onFrame ?? (() => {});
    this.onPresented = options.onPresented ?? (() => {});
    this.onStopped = options.onStopped ?? (() => {});
    this.window = getWindow(element);
    this.canvas = null;
    this.renderer = null;
    this.session = null;
    this.layer = null;
    this.referenceSpace = null;
    this.referenceSpaceType = 'viewer';
    this.trackedAnchorMatrix = new Matrix4();
    this.modelPlacementMatrix = new Matrix4();
    this.pageDepthMatrix = new Matrix4();
    this.pageScaleMatrix = new Matrix4();
    this.hasTrackedAnchor = false;
    this.sessionPlacement = null;
    this.lastFixedPlacement = null;
    this.cameras = [];
    this.lastFrameTime = 0;
    this.presented = false;
    this.disposed = false;
    this.startPromise = null;
    this.startGeneration = 0;
    this.blockerSignature = '';
    this.promotionCheckQueued = false;
    this.promotionObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => this.queuePromotionCheck());
    this.trackingButton = null;
    this.trackingRequestPromise = null;
    this.warningElement = null;
    this.onXRFrame = this.onXRFrame.bind(this);
    this.onSessionEnd = this.onSessionEnd.bind(this);
    this.onTrackingButtonClick = () => this.requestHeadTracking();
    this.onWindowResize = () => this.queuePromotionCheck();
  }

  start() {
    if (this.disposed || this.session) return Promise.resolve(Boolean(this.session));
    if (this.startPromise) return this.startPromise;

    const generation = ++this.startGeneration;
    this.startPromise = this.startSession(generation)
      .catch(() => false)
      .finally(() => {
        if (generation === this.startGeneration) this.startPromise = null;
      });
    return this.startPromise;
  }

  async startSession(generation) {
    if (!(await supportsInlineSessions(this.window))) return false;
    if (this.disposed || generation !== this.startGeneration) return false;

    let session = null;
    try {
      session = await this.window.navigator.xr.requestSession('inline', {
        requiredFeatures: ['inline-stereo'],
      });
    } catch (error) {
      return false;
    }

    return this.activateSession(session, generation, 'viewer');
  }

  async activateSession(session, generation, referenceSpaceType) {
    try {
      if (this.disposed || generation !== this.startGeneration) {
        session.end().catch(() => {});
        return false;
      }

      this.observePromotionEnvironment();
      const blockers = detectStereoPromotionBlockers(this.element);
      if (blockers.length) {
        session.end().catch(() => {});
        this.showPromotionWarning(blockers);
        return false;
      }
      this.clearPromotionWarning();

      this.canvas = this.element.ownerDocument.createElement('canvas');
      this.canvas.className = `${MODEL_CANVAS_CLASS} model-element-polyfill__stereo-canvas`;
      this.canvas.dataset.modelInternal = '';
      this.canvas.setAttribute('aria-hidden', 'true');
      this.canvas.style.opacity = '0';
      this.canvas.style.pointerEvents = 'none';
      this.element.appendChild(this.canvas);

      this.renderer = new WebGPURenderer({
        alpha: true,
        antialias: true,
        canvas: this.canvas,
        forceWebGL: true,
      });
      this.renderer.autoClear = false;
      this.renderer.outputColorSpace = SRGBColorSpace;
      this.renderer.toneMapping = ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;
      this.renderer.setPixelRatio(1);
      this.resize();
      await this.renderer.init();

      if (this.disposed || generation !== this.startGeneration) {
        session.end().catch(() => {});
        this.cleanup(false);
        return false;
      }

      const gl = this.renderer.getContext();
      this.layer = new this.window.XRWebGLLayer(session, gl);
      session.updateRenderState({
        baseLayer: this.layer,
        depthFar: 1000,
        depthNear: 0.005,
        inlineVerticalFieldOfView: this.getInlineVerticalFieldOfView(),
      });
      this.referenceSpace = await session.requestReferenceSpace(referenceSpaceType);

      if (this.disposed || generation !== this.startGeneration) {
        session.end().catch(() => {});
        this.cleanup(false);
        return false;
      }

      this.referenceSpaceType = referenceSpaceType;
      this.hasTrackedAnchor = false;
      this.sessionPlacement = null;
      this.session = session;
      this.element.dataset.modelTracking = referenceSpaceType === 'local' ? 'head' : 'fixed';
      session.addEventListener('end', this.onSessionEnd);
      session.requestAnimationFrame(this.onXRFrame);
      return true;
    } catch (error) {
      session?.removeEventListener?.('end', this.onSessionEnd);
      session?.end?.().catch?.(() => {});
      this.cleanup(false);
      return false;
    }
  }

  resize() {
    if (!this.renderer) return;
    const rect = this.element.getBoundingClientRect();
    const pixelRatio = this.window.devicePixelRatio || 1;
    const eyeWidth = Math.max(Math.round(rect.width * pixelRatio), 1);
    const eyeHeight = Math.max(Math.round(rect.height * pixelRatio), 1);
    this.renderer.setSize(eyeWidth * 2, eyeHeight, false);
    if (this.session) {
      try {
        this.session.updateRenderState({
          inlineVerticalFieldOfView: this.getInlineVerticalFieldOfView(),
        });
      } catch {
        // The session may have ended between the resize notification and this update.
      }
    }
  }

  getInlineVerticalFieldOfView() {
    const portalHeight = Math.max(this.element.getBoundingClientRect().height, 1) / CSS_PIXELS_PER_METRE;
    return 2 * Math.atan(portalHeight / (2 * this.cameraDistance));
  }

  getCamera(index) {
    let camera = this.cameras[index];
    if (!camera) {
      camera = new PerspectiveCamera();
      camera.matrixAutoUpdate = false;
      this.cameras[index] = camera;
    }
    return camera;
  }

  updateModelPlacement(pose) {
    if (!this.sessionPlacement) {
      const calculatedPlacement = calculateStereoPagePlacement(
        this.element,
        pose,
        this.cameraDistance,
      );
      if (
        this.referenceSpaceType === 'local'
        && this.lastFixedPlacement
        && !calculatedPlacement.hasMeasuredConvergence
      ) {
        // A tracked projection normally identifies the page's spatial plane.
        // Preserve the fixed placement only when the browser does not provide
        // enough stereo information to measure that plane.
        const centerOffset = stereoPageCenterOffset(pose, this.lastFixedPlacement.distance);
        this.sessionPlacement = {
          ...this.lastFixedPlacement,
          offsetX: centerOffset.x,
          offsetY: centerOffset.y,
        };
      } else {
        this.sessionPlacement = calculatedPlacement;
      }
      if (this.referenceSpaceType === 'viewer') {
        this.lastFixedPlacement = { ...this.sessionPlacement };
      }
    }

    const {
      distance,
      offsetX = 0,
      offsetY = 0,
      scale,
    } = this.sessionPlacement;
    const insetScale = distance > 0 ? (distance + PAGE_DEPTH_INSET_METRES) / distance : 1;
    this.pageDepthMatrix.makeTranslation(
      offsetX * insetScale,
      offsetY * insetScale,
      -distance - PAGE_DEPTH_INSET_METRES,
    );
    this.pageScaleMatrix.makeScale(scale, scale, scale);
    this.pageDepthMatrix.multiply(this.pageScaleMatrix);

    if (this.referenceSpaceType === 'local') {
      if (!this.hasTrackedAnchor) {
        const viewerMatrix = pose.transform?.matrix;
        if (viewerMatrix?.length === 16) this.trackedAnchorMatrix.fromArray(viewerMatrix);
        else this.trackedAnchorMatrix.identity();
        this.hasTrackedAnchor = true;
      }
      this.modelPlacementMatrix.multiplyMatrices(this.trackedAnchorMatrix, this.pageDepthMatrix);
    } else {
      this.modelPlacementMatrix.copy(this.pageDepthMatrix);
    }

    this.modelPlacementMatrix.decompose(
      this.modelRoot.position,
      this.modelRoot.quaternion,
      this.modelRoot.scale,
    );
    this.element.dataset.modelPageDistance = distance.toFixed(4);
    this.element.dataset.modelPageScale = scale.toFixed(4);
    this.modelRoot.updateMatrixWorld(true);
  }

  ensureTrackingButton() {
    if (this.trackingButton) return this.trackingButton;

    const button = this.element.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = 'model-element-polyfill__tracking-button';
    button.dataset.modelInternal = '';
    button.hidden = true;
    button.addEventListener('click', this.onTrackingButtonClick);
    this.element.appendChild(button);
    this.trackingButton = button;
    return button;
  }

  updateTrackingButton() {
    if (this.disposed) return;
    const button = this.ensureTrackingButton();
    if (!this.presented || !this.session || this.blockerSignature) {
      button.hidden = true;
      return;
    }

    button.hidden = false;
    if (this.referenceSpaceType === 'local') {
      button.disabled = true;
      button.textContent = 'Head tracking on';
      button.setAttribute('aria-pressed', 'true');
    } else {
      button.disabled = false;
      button.textContent = 'Enable head tracking';
      button.setAttribute('aria-pressed', 'false');
    }
  }

  requestHeadTracking() {
    if (
      this.disposed
      || this.referenceSpaceType === 'local'
      || this.trackingRequestPromise
      || !this.window?.navigator?.xr
    ) {
      return this.trackingRequestPromise ?? Promise.resolve(false);
    }

    const button = this.ensureTrackingButton();
    button.hidden = false;
    button.disabled = true;
    button.textContent = 'Requesting head tracking…';

    let sessionRequest;
    try {
      // Call requestSession directly from the click handler so transient user
      // activation is still available for the spatial-tracking permission.
      sessionRequest = this.window.navigator.xr.requestSession('inline', {
        requiredFeatures: ['inline-stereo', 'local'],
      });
    } catch (error) {
      this.handleTrackingError(error);
      return Promise.resolve(false);
    }

    const request = Promise.resolve(sessionRequest)
      .then(async (trackedSession) => {
        if (this.disposed) {
          trackedSession.end().catch(() => {});
          return false;
        }

        const previousSession = this.session;
        previousSession?.removeEventListener?.('end', this.onSessionEnd);
        this.cleanup(true);
        previousSession?.end?.().catch?.(() => {});

        const generation = ++this.startGeneration;
        const activated = await this.activateSession(trackedSession, generation, 'local');
        if (!activated) {
          this.handleTrackingError(new Error('The head-tracked stereo session could not start.'));
          return false;
        }

        this.element.dispatchEvent(new Event('trackingstart'));
        return true;
      })
      .catch((error) => {
        this.handleTrackingError(error);
        return false;
      })
      .finally(() => {
        if (this.trackingRequestPromise === request) this.trackingRequestPromise = null;
        this.updateTrackingButton();
      });

    this.trackingRequestPromise = request;
    return request;
  }

  handleTrackingError(error) {
    this.updateTrackingButton();
    this.element.dispatchEvent(new CustomEvent('trackingerror', { detail: error }));
  }

  observePromotionEnvironment() {
    if (!this.promotionObserver) return;
    this.promotionObserver.disconnect();

    for (let current = this.element; current; current = current.parentElement) {
      this.promotionObserver.observe(current, {
        attributeFilter: ['class', 'style'],
        attributes: true,
      });
    }

    const head = this.element.ownerDocument.head;
    if (head) {
      this.promotionObserver.observe(head, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
    this.window.addEventListener('resize', this.onWindowResize);
  }

  queuePromotionCheck() {
    if (this.disposed || this.promotionCheckQueued) return;
    this.promotionCheckQueued = true;
    queueMicrotask(() => {
      this.promotionCheckQueued = false;
      this.checkPromotionSafety();
    });
  }

  checkPromotionSafety() {
    if (this.disposed) return;
    const blockers = detectStereoPromotionBlockers(this.element);

    if (blockers.length) {
      if (this.session || this.startPromise || this.trackingRequestPromise) this.stop();
      this.showPromotionWarning(blockers);
      return;
    }

    const wasBlocked = Boolean(this.blockerSignature);
    this.clearPromotionWarning();
    if (!wasBlocked || this.session) return;

    const restart = () => {
      if (!this.disposed && !this.session) this.start();
    };
    if (this.startPromise) this.startPromise.finally(restart);
    else restart();
  }

  showPromotionWarning(blockers) {
    const signature = blockers
      .map(({ code, elementLabel: label, value }) => `${code}:${label}:${value}`)
      .join('|');
    if (signature === this.blockerSignature) return;

    this.blockerSignature = signature;
    const message = formatStereoPromotionWarning(blockers);
    this.element.dataset.modelStereoBlocked = blockers.map(({ code }) => code).join(',');
    if (this.trackingButton) this.trackingButton.hidden = true;

    if (!this.warningElement) {
      this.warningElement = this.element.ownerDocument.createElement('div');
      this.warningElement.className = 'model-element-polyfill__stereo-warning';
      this.warningElement.dataset.modelInternal = '';
      this.warningElement.setAttribute('role', 'status');
      this.warningElement.setAttribute('aria-live', 'polite');
      this.element.appendChild(this.warningElement);
    }
    this.warningElement.textContent = message;

    this.element.dispatchEvent(new CustomEvent('stereoblocked', {
      detail: { blockers, message },
    }));
    console.warn(`[<model> polyfill] ${message}`, blockers);
  }

  clearPromotionWarning() {
    this.blockerSignature = '';
    delete this.element.dataset.modelStereoBlocked;
    this.warningElement?.remove();
    this.warningElement = null;
  }

  onXRFrame(time, frame) {
    if (this.disposed || frame.session !== this.session || !this.referenceSpace) return;
    this.session.requestAnimationFrame(this.onXRFrame);

    const pose = frame.getViewerPose(this.referenceSpace);
    if (!pose || pose.views.length === 0) return;

    const delta = this.lastFrameTime === 0 ? 0 : Math.min((time - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = time;
    this.onFrame(delta);

    this.updateModelPlacement(pose);

    const width = this.canvas.width;
    const height = this.canvas.height;
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, width, height);
    this.renderer.clear(true, true, true);
    this.renderer.setScissorTest(true);

    for (let index = 0; index < pose.views.length; index += 1) {
      const view = pose.views[index];
      const viewport = this.layer.getViewport(view);
      if (!viewport) continue;

      const camera = this.getCamera(index);
      updateCameraFromView(camera, view);
      this.renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
      this.renderer.setScissor(viewport.x, viewport.y, viewport.width, viewport.height);
      this.renderer.render(this.scene, camera);
    }

    this.renderer.setScissorTest(false);

    if (!this.presented) {
      this.presented = true;
      this.canvas.style.opacity = '1';
      this.canvas.style.pointerEvents = '';
      this.updateTrackingButton();
      this.onPresented(this.canvas);
    }
  }

  onSessionEnd() {
    this.cleanup(true);
  }

  cleanup(notify) {
    const wasPresented = this.presented;
    this.session?.removeEventListener?.('end', this.onSessionEnd);
    this.presented = false;
    this.lastFrameTime = 0;
    this.layer = null;
    this.referenceSpace = null;
    this.referenceSpaceType = 'viewer';
    this.hasTrackedAnchor = false;
    this.sessionPlacement = null;
    this.cameras.length = 0;
    this.modelRoot.position.set(0, 0, 0);
    this.modelRoot.quaternion.identity();
    this.modelRoot.scale.set(1, 1, 1);
    this.modelRoot.updateMatrixWorld(true);
    this.renderer?.dispose();
    this.renderer = null;
    this.canvas?.remove();
    this.canvas = null;
    this.session = null;
    delete this.element.dataset.modelTracking;
    delete this.element.dataset.modelPageDistance;
    delete this.element.dataset.modelPageScale;
    if (this.trackingButton) this.trackingButton.hidden = true;
    if (notify && wasPresented) this.onStopped();
  }

  stop() {
    this.startGeneration += 1;
    const session = this.session;
    session?.removeEventListener?.('end', this.onSessionEnd);
    this.cleanup(true);
    session?.end?.().catch?.(() => {});
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.promotionObserver?.disconnect();
    this.window.removeEventListener('resize', this.onWindowResize);
    this.clearPromotionWarning();
    this.stop();
    this.trackingButton?.removeEventListener('click', this.onTrackingButtonClick);
    this.trackingButton?.remove();
    this.trackingButton = null;
  }
}

export function resetInlineStereoSupportForTests() {
  inlineSessionSupportPromises = new WeakMap();
}
