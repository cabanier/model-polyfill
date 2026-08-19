export const MODEL_READY_STATE = Object.freeze({
  EMPTY: 0,
  LOADING: 1,
  COMPLETE: 2,
});

export const SUPPORTED_MODEL_TYPES = Object.freeze([
  'model/gltf-binary',
  'model/gltf+json',
  'model/vnd.usdz+zip',
  'model/vnd.usd',
]);

export const OBSERVED_ATTRIBUTES = Object.freeze([
  'alt',
  'autoplay',
  'environmentmap',
  'height',
  'loop',
  'src',
  'stagemode',
  'width',
]);

export const CSS_PIXELS_PER_METRE = 96 / 0.0254;
export const DEFAULT_CAMERA_DISTANCE = 0.3;
export const DEFAULT_MAX_PIXEL_RATIO = 2;
export const MODEL_CANVAS_CLASS = 'model-element-polyfill__canvas';
export const UPGRADED_ATTRIBUTE = 'data-model-polyfilled';
export const READY_ATTRIBUTE = 'data-model-ready';
