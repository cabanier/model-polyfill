import {
  AnimationMixer,
  Box3,
  LoopOnce,
  LoopRepeat,
  Vector3,
} from 'three';
import {
  MODEL_READY_STATE,
  OBSERVED_ATTRIBUTES,
  READY_ATTRIBUTE,
  SUPPORTED_MODEL_TYPES,
  UPGRADED_ATTRIBUTE,
} from './constants.js';
import { disposeObject3D, loadModelCandidates } from './model-loader.js';
import { ModelRenderContext } from './render-context.js';
import {
  collectModelSources,
  isSupportedModelType,
  normalizeModelType,
} from './source-selection.js';
import { cloneDOMMatrix, identityDOMMatrix } from './transform.js';

const stateMap = new WeakMap();
const observedAttributeSet = new Set(OBSERVED_ATTRIBUTES);

function createPoint(x = 0, y = 0, z = 0, w = 1) {
  return new DOMPointReadOnly(x, y, z, w);
}

function createAbortError(message) {
  if (typeof DOMException !== 'undefined') return new DOMException(message, 'AbortError');
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function createState(element, options) {
  return {
    boundingBoxCenter: createPoint(),
    boundingBoxExtents: createPoint(0, 0, 0, 0),
    complete: true,
    connected: false,
    context: null,
    contextGeneration: 0,
    contextPromise: null,
    currentAction: null,
    currentSrc: '',
    duration: 0,
    element,
    ended: false,
    entityTransform: identityDOMMatrix(),
    finishedHandler: null,
    ignoredAttributeMutations: new Map(),
    loadGeneration: 0,
    loadQueued: false,
    mixer: null,
    model: null,
    mutationObserver: null,
    options,
    ownsAriaLabel: false,
    ownsRole: false,
    paused: true,
    pendingRenderGeneration: 0,
    playbackRate: 1,
    ready: Promise.resolve(element),
    readyReject: null,
    readyResolve: null,
    readyState: MODEL_READY_STATE.EMPTY,
  };
}

export function getModelState(element) {
  return stateMap.get(element);
}

function markIgnoredAttributeMutation(state, name) {
  state.ignoredAttributeMutations.set(name, (state.ignoredAttributeMutations.get(name) ?? 0) + 1);
}

function consumeIgnoredAttributeMutation(state, name) {
  const count = state.ignoredAttributeMutations.get(name) ?? 0;
  if (count === 0) return false;
  if (count === 1) state.ignoredAttributeMutations.delete(name);
  else state.ignoredAttributeMutations.set(name, count - 1);
  return true;
}

function beginReadyCycle(state) {
  state.readyReject?.(createAbortError('The model source changed before loading completed.'));
  state.readyState = MODEL_READY_STATE.LOADING;
  state.complete = false;
  state.element.removeAttribute(READY_ATTRIBUTE);
  state.ready = new Promise((resolve, reject) => {
    state.readyResolve = resolve;
    state.readyReject = reject;
  });
  state.ready.catch(() => {});
}

function resolveReady(state) {
  state.readyState = MODEL_READY_STATE.COMPLETE;
  state.complete = true;
  state.element.setAttribute(READY_ATTRIBUTE, '');
  state.readyResolve?.(state.element);
  state.readyResolve = null;
  state.readyReject = null;
}

function rejectReady(state, error) {
  state.readyState = MODEL_READY_STATE.EMPTY;
  state.complete = true;
  state.readyReject?.(error);
  state.readyResolve = null;
  state.readyReject = null;
}

function updateAccessibility(element) {
  const state = stateMap.get(element);
  const alt = element.getAttribute('alt');
  if (alt && (!element.hasAttribute('aria-label') || state?.ownsAriaLabel)) {
    element.setAttribute('aria-label', alt);
    if (state) state.ownsAriaLabel = true;
  } else if (!alt && state?.ownsAriaLabel) {
    element.removeAttribute('aria-label');
    state.ownsAriaLabel = false;
  }

  if (alt && (!element.hasAttribute('role') || state?.ownsRole)) {
    element.setAttribute('role', 'img');
    if (state) state.ownsRole = true;
  } else if (!alt && state?.ownsRole) {
    element.removeAttribute('role');
    state.ownsRole = false;
  }
}

function updateDimensions(element) {
  const width = Number(element.getAttribute('width'));
  const height = Number(element.getAttribute('height'));

  if (Number.isFinite(width) && width > 0) element.style.setProperty('--model-element-width', `${width}px`);
  else element.style.removeProperty('--model-element-width');

  if (Number.isFinite(height) && height > 0) element.style.setProperty('--model-element-height', `${height}px`);
  else element.style.removeProperty('--model-element-height');

  stateMap.get(element)?.context?.resize();
}

function updateLoop(state) {
  if (!state.currentAction) return;
  if (state.element.hasAttribute('loop')) {
    state.currentAction.setLoop(LoopRepeat, Infinity);
    state.currentAction.clampWhenFinished = false;
  } else {
    state.currentAction.setLoop(LoopOnce, 1);
    state.currentAction.clampWhenFinished = true;
  }
}

function clearAnimation(state) {
  if (state.mixer && state.finishedHandler) {
    state.mixer.removeEventListener('finished', state.finishedHandler);
  }
  state.mixer?.stopAllAction();
  state.mixer = null;
  state.currentAction = null;
  state.finishedHandler = null;
  state.duration = 0;
  state.ended = false;
  state.paused = true;
}

function setupAnimation(state, animations) {
  clearAnimation(state);
  if (!animations.length || !state.model) return;

  const clip = animations[0];
  state.mixer = new AnimationMixer(state.model);
  state.currentAction = state.mixer.clipAction(clip);
  state.duration = clip.duration;
  state.ended = false;
  state.currentAction.timeScale = state.playbackRate;
  state.currentAction.paused = true;
  state.currentAction.play();
  updateLoop(state);

  state.finishedHandler = () => {
    if (state.element.hasAttribute('loop')) return;
    state.ended = true;
    state.paused = true;
    state.element.dispatchEvent(new Event('ended'));
  };
  state.mixer.addEventListener('finished', state.finishedHandler);

  if (state.element.hasAttribute('autoplay')) playModel(state.element);
}

function clearLoadedModel(state) {
  clearAnimation(state);
  state.context?.clearModel();
  disposeObject3D(state.model);
  state.model = null;
  state.currentSrc = '';
  state.boundingBoxCenter = createPoint();
  state.boundingBoxExtents = createPoint(0, 0, 0, 0);
}

async function ensureRenderContext(state) {
  if (state.context) return state.context;
  if (state.contextPromise) return state.contextPromise;

  const context = new ModelRenderContext(state.element, {
    cameraDistance: state.options.cameraDistance,
    maxPixelRatio: state.options.maxPixelRatio,
    onAnimationFrame: (delta) => {
      if (!state.mixer || state.paused || state.playbackRate === 0) return false;
      state.mixer.update(delta);
      return !state.paused && state.playbackRate !== 0;
    },
    onEntityTransformChange: (matrix) => {
      state.entityTransform = matrix;
    },
    onFirstRender: () => {
      if (state.pendingRenderGeneration === state.loadGeneration) resolveReady(state);
    },
  });
  context.stageMode = getStageMode(state.element);
  const contextGeneration = ++state.contextGeneration;

  const initPromise = context.init()
    .then(() => {
      if (!state.connected || contextGeneration !== state.contextGeneration) {
        context.dispose();
        throw createAbortError('The model element was disconnected.');
      }
      state.context = context;
      if (state.contextPromise === initPromise) state.contextPromise = null;
      context.setStageMode(getStageMode(state.element));
      const environmentMap = state.element.getAttribute('environmentmap');
      if (environmentMap) context.setEnvironmentMap(environmentMap);
      return context;
    })
    .catch((error) => {
      if (state.contextPromise === initPromise) state.contextPromise = null;
      context.dispose();
      throw error;
    });

  state.contextPromise = initPromise;
  return initPromise;
}

async function performLoad(element, generation) {
  const state = stateMap.get(element);
  if (!state || !state.connected || generation !== state.loadGeneration) return;

  const candidates = collectModelSources(element);
  clearLoadedModel(state);

  if (candidates.length === 0) {
    state.readyState = MODEL_READY_STATE.EMPTY;
    state.complete = true;
    state.readyResolve?.(element);
    state.readyResolve = null;
    state.readyReject = null;
    return;
  }

  state.currentSrc = candidates[0].src;
  element.dispatchEvent(new Event('loadstart'));

  let result = null;
  try {
    result = await loadModelCandidates(candidates, {
      isStale: () => generation !== state.loadGeneration || !state.connected,
      onProgress: (detail) => element.dispatchEvent(new CustomEvent('progress', { detail })),
    });
    if (!result || generation !== state.loadGeneration || !state.connected) return;

    const context = await ensureRenderContext(state);
    if (generation !== state.loadGeneration || !state.connected) {
      disposeObject3D(result.object);
      return;
    }

    const box = new Box3().setFromObject(result.object);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    state.model = result.object;
    state.currentSrc = result.candidate.src;
    state.boundingBoxCenter = createPoint(center.x, center.y, center.z, 1);
    state.boundingBoxExtents = createPoint(size.x, size.y, size.z, 0);
    setupAnimation(state, result.animations);
    state.pendingRenderGeneration = generation;
    context.setStageMode(getStageMode(element));
    context.setModel(result.object, center, size);
    element.dispatchEvent(new Event('load'));
  } catch (error) {
    if (result?.object && state.model !== result.object) disposeObject3D(result.object);
    if (generation !== state.loadGeneration || !state.connected || error?.name === 'AbortError') return;
    rejectReady(state, error);
    element.dispatchEvent(new CustomEvent('error', { detail: error }));
  }
}

export function queueModelLoad(element) {
  const state = stateMap.get(element);
  if (!state?.connected) return Promise.resolve(element);

  state.loadGeneration += 1;
  const generation = state.loadGeneration;
  beginReadyCycle(state);

  if (!state.loadQueued) {
    state.loadQueued = true;
    queueMicrotask(() => {
      state.loadQueued = false;
      performLoad(element, state.loadGeneration);
    });
  }

  // Keep the generation captured so callers can inspect why their promise was superseded.
  state.pendingRenderGeneration = generation;
  return state.ready;
}

function handleAttributeChange(element, name, oldValue, newValue) {
  if (oldValue === newValue) return;
  const state = stateMap.get(element);
  if (!state) return;

  switch (name) {
    case 'alt':
      updateAccessibility(element);
      break;
    case 'autoplay':
      if (newValue !== null && state.currentAction && state.paused) playModel(element);
      break;
    case 'environmentmap':
      state.context?.setEnvironmentMap(newValue || '');
      break;
    case 'height':
    case 'width':
      updateDimensions(element);
      break;
    case 'loop':
      updateLoop(state);
      break;
    case 'src':
      queueModelLoad(element);
      break;
    case 'stagemode':
      state.context?.setStageMode(getStageMode(element));
      break;
  }
}

function observeElement(element, state) {
  state.mutationObserver = new MutationObserver((mutations) => {
    let sourcesChanged = false;

    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        const name = mutation.attributeName;
        if (mutation.target === element) {
          if (consumeIgnoredAttributeMutation(state, name)) continue;
          if (observedAttributeSet.has(name)) {
            handleAttributeChange(element, name, mutation.oldValue, element.getAttribute(name));
          }
        } else if (mutation.target.nodeName === 'SOURCE') {
          sourcesChanged = true;
        }
      } else if (mutation.type === 'childList') {
        const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
        if (changedNodes.some((node) => node.nodeType === 1 && node.nodeName === 'SOURCE')) {
          sourcesChanged = true;
        }
      }
    }

    if (sourcesChanged) queueModelLoad(element);
  });

  state.mutationObserver.observe(element, {
    attributeFilter: [...OBSERVED_ATTRIBUTES, 'media', 'type'],
    attributeOldValue: true,
    attributes: true,
    childList: true,
    subtree: true,
  });
}

export function connectModelElement(element) {
  const state = stateMap.get(element);
  if (!state || state.connected) return;
  state.connected = true;
  element.setAttribute(UPGRADED_ATTRIBUTE, '');
  updateDimensions(element);
  updateAccessibility(element);
  observeElement(element, state);

  for (const name of OBSERVED_ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (value !== null && name !== 'src') handleAttributeChange(element, name, null, value);
  }
  if (collectModelSources(element).length) queueModelLoad(element);
}

export function disconnectModelElement(element) {
  const state = stateMap.get(element);
  if (!state?.connected) return;
  state.connected = false;
  state.loadGeneration += 1;
  state.mutationObserver?.disconnect();
  state.mutationObserver = null;
  state.readyReject?.(createAbortError('The model element was disconnected.'));
  state.readyResolve = null;
  state.readyReject = null;
  clearLoadedModel(state);
  state.context?.dispose();
  state.context = null;
  state.contextGeneration += 1;
  state.contextPromise = null;
  state.readyState = MODEL_READY_STATE.EMPTY;
  state.complete = true;
  element.removeAttribute(READY_ATTRIBUTE);
}

function copyPrototypeApi(element, ModelElementClass) {
  for (const name of Object.getOwnPropertyNames(ModelElementClass.prototype)) {
    if (name === 'constructor' || name === 'connectedCallback' || name === 'disconnectedCallback') continue;
    Object.defineProperty(element, name, Object.getOwnPropertyDescriptor(ModelElementClass.prototype, name));
  }
}

export function upgradeModelElement(element, ModelElementClass, options) {
  if (stateMap.has(element)) {
    connectModelElement(element);
    return element;
  }

  try {
    Object.setPrototypeOf(element, ModelElementClass.prototype);
  } catch {
    copyPrototypeApi(element, ModelElementClass);
  }

  stateMap.set(element, createState(element, options));
  connectModelElement(element);
  return element;
}

export function getStageMode(element) {
  return element.getAttribute('stagemode') === 'orbit' ? 'orbit' : 'none';
}

export function playModel(element) {
  const state = stateMap.get(element);
  if (!state?.currentAction) return Promise.resolve();
  if (!state.paused) return Promise.resolve();
  if (state.ended) {
    state.currentAction.reset();
    state.currentAction.timeScale = state.playbackRate;
    updateLoop(state);
    state.ended = false;
  }
  state.paused = false;
  state.currentAction.paused = false;
  state.context?.invalidate();
  element.dispatchEvent(new Event('play'));
  element.dispatchEvent(new Event('playing'));
  return Promise.resolve();
}

export function pauseModel(element) {
  const state = stateMap.get(element);
  if (!state?.currentAction || state.paused) return;
  state.paused = true;
  state.currentAction.paused = true;
  element.dispatchEvent(new Event('pause'));
}

export function createHTMLModelElementPolyfillClass(windowObject, options) {
  return class HTMLModelElementPolyfill extends windowObject.HTMLElement {
    connectedCallback() {
      upgradeModelElement(this, this.constructor, options);
    }

    disconnectedCallback() {
      disconnectModelElement(this);
    }

    setAttribute(name, value) {
      const normalizedName = String(name).toLowerCase();
      const state = stateMap.get(this);
      const oldValue = this.getAttribute(normalizedName);
      if (state && observedAttributeSet.has(normalizedName)) markIgnoredAttributeMutation(state, normalizedName);
      super.setAttribute(name, value);
      if (state && observedAttributeSet.has(normalizedName)) {
        handleAttributeChange(this, normalizedName, oldValue, String(value));
      }
    }

    removeAttribute(name) {
      const normalizedName = String(name).toLowerCase();
      const state = stateMap.get(this);
      const oldValue = this.getAttribute(normalizedName);
      if (state && observedAttributeSet.has(normalizedName)) markIgnoredAttributeMutation(state, normalizedName);
      super.removeAttribute(name);
      if (state && observedAttributeSet.has(normalizedName)) {
        handleAttributeChange(this, normalizedName, oldValue, null);
      }
    }

    get alt() { return this.getAttribute('alt') ?? ''; }
    set alt(value) { this.setAttribute('alt', value ?? ''); }

    get autoplay() { return this.hasAttribute('autoplay'); }
    set autoplay(value) { value ? this.setAttribute('autoplay', '') : this.removeAttribute('autoplay'); }

    get boundingBoxCenter() { return stateMap.get(this)?.boundingBoxCenter ?? createPoint(); }
    get boundingBoxExtents() { return stateMap.get(this)?.boundingBoxExtents ?? createPoint(0, 0, 0, 0); }
    get complete() { return stateMap.get(this)?.complete ?? true; }
    get currentSrc() { return stateMap.get(this)?.currentSrc ?? ''; }

    get currentTime() { return stateMap.get(this)?.currentAction?.time ?? 0; }
    set currentTime(value) {
      const state = stateMap.get(this);
      const time = Number(value);
      if (!state?.currentAction || !Number.isFinite(time)) return;
      state.currentAction.time = Math.min(Math.max(time, 0), state.duration);
      state.ended = state.currentAction.time >= state.duration;
      state.mixer.update(0);
      state.context?.invalidate();
      this.dispatchEvent(new Event('timeupdate'));
    }

    get duration() { return stateMap.get(this)?.duration ?? 0; }

    get entityTransform() {
      return stateMap.get(this)?.context?.getEntityTransform()
        ?? cloneDOMMatrix(stateMap.get(this)?.entityTransform ?? identityDOMMatrix());
    }
    set entityTransform(value) {
      const state = stateMap.get(this);
      if (!state?.context || getStageMode(this) === 'orbit') return;
      if (value instanceof DOMMatrix || value instanceof DOMMatrixReadOnly) {
        state.context.setEntityTransform(value, true);
      }
    }

    get environmentMap() { return this.getAttribute('environmentmap') ?? ''; }
    set environmentMap(value) {
      value ? this.setAttribute('environmentmap', value) : this.removeAttribute('environmentmap');
    }

    get height() { return Number(this.getAttribute('height')) || 0; }
    set height(value) { this.setAttribute('height', String(value)); }

    get loop() { return this.hasAttribute('loop'); }
    set loop(value) { value ? this.setAttribute('loop', '') : this.removeAttribute('loop'); }

    get paused() { return stateMap.get(this)?.paused ?? true; }

    get playbackRate() { return stateMap.get(this)?.playbackRate ?? 1; }
    set playbackRate(value) {
      const state = stateMap.get(this);
      const rate = Number(value);
      if (!state || !Number.isFinite(rate)) return;
      state.playbackRate = rate;
      if (state.currentAction) state.currentAction.timeScale = rate;
      state.context?.invalidate();
      this.dispatchEvent(new Event('ratechange'));
    }

    get ready() { return stateMap.get(this)?.ready ?? Promise.resolve(this); }
    get readyState() { return stateMap.get(this)?.readyState ?? MODEL_READY_STATE.EMPTY; }

    get src() {
      return this.getAttribute('src') ?? this.querySelector(':scope > source')?.getAttribute('src') ?? '';
    }
    set src(value) {
      value ? this.setAttribute('src', value) : this.removeAttribute('src');
    }

    get stageMode() { return getStageMode(this); }
    set stageMode(value) {
      value === 'orbit' ? this.setAttribute('stagemode', 'orbit') : this.removeAttribute('stagemode');
    }

    get width() { return Number(this.getAttribute('width')) || 0; }
    set width(value) { this.setAttribute('width', String(value)); }

    canPlayType(type) {
      return isSupportedModelType(normalizeModelType(type)) ? 'probably' : '';
    }

    load() { return queueModelLoad(this); }
    pause() { pauseModel(this); }
    play() { return playModel(this); }
  };
}

export { MODEL_READY_STATE, SUPPORTED_MODEL_TYPES };
