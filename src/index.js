export {
  getModelPolyfillInstallation,
  installModelPolyfill,
} from './install.js';
export {
  getModelState,
  MODEL_READY_STATE,
  SUPPORTED_MODEL_TYPES,
} from './model-element.js';
export {
  collectModelSources,
  inferModelType,
  isSupportedModelType,
  normalizeModelType,
} from './source-selection.js';

import { installModelPolyfill } from './install.js';

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installModelPolyfill();
}
