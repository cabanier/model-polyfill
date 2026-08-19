import {
  connectModelElement,
  createHTMLModelElementPolyfillClass,
  disconnectModelElement,
  upgradeModelElement,
} from './model-element.js';
import { installDefaultStyles } from './styles.js';

const INSTALLATION_KEY = Symbol.for('model-element-webgpu-polyfill.installation');

function normalizeOptions(options) {
  return {
    cameraDistance: options.cameraDistance,
    force: Boolean(options.force),
    maxPixelRatio: options.maxPixelRatio,
  };
}

export function installModelPolyfill(options = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  if (window[INSTALLATION_KEY]) return window[INSTALLATION_KEY];

  const normalizedOptions = normalizeOptions(options);
  const originalHTMLModelElementDescriptor = Object.getOwnPropertyDescriptor(window, 'HTMLModelElement');
  const existingHTMLModelElement = window.HTMLModelElement;
  const hasNativeSupport = 'HTMLModelElement' in window && existingHTMLModelElement?.isPolyfill !== true;
  const ModelElementClass = createHTMLModelElementPolyfillClass(window, normalizedOptions);
  const trackedElements = new Set();
  const shouldUpgradeModel = normalizedOptions.force || !hasNativeSupport;

  Object.defineProperty(ModelElementClass, 'isPolyfill', { value: true });
  installDefaultStyles(document);

  if (!customElements.get('model-polyfill')) {
    customElements.define('model-polyfill', ModelElementClass);
  }

  function upgrade(element) {
    if (!(element instanceof window.HTMLElement)) return element;
    const upgraded = upgradeModelElement(element, ModelElementClass, normalizedOptions);
    trackedElements.add(upgraded);
    return upgraded;
  }

  if (shouldUpgradeModel && !hasNativeSupport) {
    try {
      Object.defineProperty(window, 'HTMLModelElement', {
        configurable: true,
        value: ModelElementClass,
        writable: true,
      });
    } catch {
      window.HTMLModelElement = ModelElementClass;
    }
  }

  if (shouldUpgradeModel) document.querySelectorAll('model').forEach(upgrade);

  const observer = shouldUpgradeModel
    ? new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.nodeName === 'MODEL') upgrade(node);
            else if (node.nodeName === 'MODEL-POLYFILL') connectModelElement(node);
            node.querySelectorAll?.('model').forEach(upgrade);
          }

          for (const node of mutation.removedNodes) {
            if (node.nodeType !== 1) continue;
            if (!node.isConnected && (node.nodeName === 'MODEL' || node.nodeName === 'MODEL-POLYFILL')) {
              disconnectModelElement(node);
            }
            node.querySelectorAll?.('model, model-polyfill').forEach((element) => {
              if (!element.isConnected) disconnectModelElement(element);
            });
          }
        }
      })
    : null;
  observer?.observe(document.documentElement, { childList: true, subtree: true });

  const originalCreateElement = window.Document.prototype.createElement;
  const originalCreateElementNS = window.Document.prototype.createElementNS;

  function patchedCreateElement(name, elementOptions) {
    const element = originalCreateElement.call(this, name, elementOptions);
    if (shouldUpgradeModel && String(name).toLowerCase() === 'model') upgrade(element);
    return element;
  }

  function patchedCreateElementNS(namespace, name, elementOptions) {
    const element = originalCreateElementNS.call(this, namespace, name, elementOptions);
    const isHTML = !namespace || namespace === 'http://www.w3.org/1999/xhtml';
    if (shouldUpgradeModel && isHTML && String(name).toLowerCase() === 'model') upgrade(element);
    return element;
  }

  if (shouldUpgradeModel) {
    window.Document.prototype.createElement = patchedCreateElement;
    window.Document.prototype.createElementNS = patchedCreateElementNS;
  }

  const installation = {
    HTMLModelElement: ModelElementClass,
    hasNativeSupport,
    upgrade,
    disconnect() {
      observer?.disconnect();
      for (const element of trackedElements) disconnectModelElement(element);
      trackedElements.clear();

      if (window.Document.prototype.createElement === patchedCreateElement) {
        window.Document.prototype.createElement = originalCreateElement;
      }
      if (window.Document.prototype.createElementNS === patchedCreateElementNS) {
        window.Document.prototype.createElementNS = originalCreateElementNS;
      }
      if (!hasNativeSupport && window.HTMLModelElement === ModelElementClass) {
        if (originalHTMLModelElementDescriptor) {
          Object.defineProperty(window, 'HTMLModelElement', originalHTMLModelElementDescriptor);
        } else {
          delete window.HTMLModelElement;
        }
      }
      delete window[INSTALLATION_KEY];
    },
  };

  window[INSTALLATION_KEY] = installation;
  return installation;
}

export function getModelPolyfillInstallation() {
  return typeof window === 'undefined' ? null : window[INSTALLATION_KEY] ?? null;
}
