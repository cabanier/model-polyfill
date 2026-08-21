import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getModelPolyfillInstallation,
  installModelPolyfill,
} from '../src/install.js';
import { MODEL_READY_STATE } from '../src/constants.js';

describe('polyfill installation', () => {
  beforeEach(() => {
    getModelPolyfillInstallation()?.disconnect();
    document.body.replaceChildren();
  });

  afterEach(() => {
    getModelPolyfillInstallation()?.disconnect();
    document.body.replaceChildren();
  });

  it('upgrades existing model elements and exposes the media-like API', () => {
    document.body.innerHTML = '<model alt="Helmet" width="320" stagemode="orbit"></model>';
    const installation = installModelPolyfill();
    const model = document.querySelector('model');

    expect(installation.hasNativeSupport).toBe(false);
    expect(model).toBeInstanceOf(window.HTMLModelElement);
    expect(model.alt).toBe('Helmet');
    expect(model.stageMode).toBe('orbit');
    expect(model.width).toBe(320);
    expect(model.style.getPropertyValue('--model-element-width')).toBe('320px');
    expect(model.getAttribute('aria-label')).toBe('Helmet');
    expect(model.readyState).toBe(MODEL_READY_STATE.EMPTY);
    expect(model.canPlayType('model/gltf-binary')).toBe('probably');
  });

  it('upgrades model elements created through createElement synchronously', () => {
    installModelPolyfill();
    const model = document.createElement('model');

    expect(typeof model.load).toBe('function');
    expect(model).toBeInstanceOf(window.HTMLModelElement);
    model.playbackRate = 1.5;
    expect(model.playbackRate).toBe(1.5);
  });

  it('does not infer native support from the constructor alone', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'HTMLModelElement');
    class DisabledHTMLModelElement extends window.HTMLElement {}
    Object.defineProperty(window, 'HTMLModelElement', {
      configurable: true,
      value: DisabledHTMLModelElement,
    });

    try {
      const installation = installModelPolyfill();
      const model = document.createElement('model');

      expect(installation.hasNativeSupport).toBe(false);
      expect(model).toBeInstanceOf(installation.HTMLModelElement);
      expect(typeof model.load).toBe('function');
    } finally {
      getModelPolyfillInstallation()?.disconnect();
      if (originalDescriptor) {
        Object.defineProperty(window, 'HTMLModelElement', originalDescriptor);
      } else {
        delete window.HTMLModelElement;
      }
    }
  });

  it('leaves model elements untouched when the browser creates native instances', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'HTMLModelElement');
    const originalCreateElement = window.Document.prototype.createElement;
    class NativeHTMLModelElement extends window.HTMLElement {
      get ready() { return Promise.resolve(this); }
      get boundingBoxCenter() { return new DOMPointReadOnly(); }
      get boundingBoxExtents() { return new DOMPointReadOnly(); }
      get entityTransform() { return new DOMMatrixReadOnly(); }
    }
    Object.defineProperty(window, 'HTMLModelElement', {
      configurable: true,
      value: NativeHTMLModelElement,
    });
    const createElementSpy = vi.spyOn(window.Document.prototype, 'createElement')
      .mockImplementation(function createElement(name, options) {
        const element = originalCreateElement.call(this, name, options);
        if (String(name).toLowerCase() === 'model') {
          Object.setPrototypeOf(element, NativeHTMLModelElement.prototype);
        }
        return element;
      });

    try {
      const model = document.createElement('model');
      document.body.appendChild(model);
      const installation = installModelPolyfill();

      expect(installation.hasNativeSupport).toBe(true);
      expect(model).toBeInstanceOf(NativeHTMLModelElement);
      expect(typeof model.load).toBe('undefined');
      expect(window.Document.prototype.createElement).toBe(createElementSpy);
    } finally {
      getModelPolyfillInstallation()?.disconnect();
      createElementSpy.mockRestore();
      if (originalDescriptor) {
        Object.defineProperty(window, 'HTMLModelElement', originalDescriptor);
      } else {
        delete window.HTMLModelElement;
      }
    }
  });

  it('polyfills native-looking model elements that lack the model API', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'HTMLModelElement');
    const originalCreateElement = window.Document.prototype.createElement;
    class IncompleteHTMLModelElement extends window.HTMLElement {}
    Object.defineProperty(window, 'HTMLModelElement', {
      configurable: true,
      value: IncompleteHTMLModelElement,
    });
    const createElementSpy = vi.spyOn(window.Document.prototype, 'createElement')
      .mockImplementation(function createElement(name, options) {
        const element = originalCreateElement.call(this, name, options);
        if (String(name).toLowerCase() === 'model') {
          Object.setPrototypeOf(element, IncompleteHTMLModelElement.prototype);
        }
        return element;
      });

    try {
      const incompleteModel = document.createElement('model');
      incompleteModel.id = 'incomplete-model';
      incompleteModel.setAttribute('alt', 'Incomplete native model');
      incompleteModel.appendChild(document.createElement('source'));
      document.body.appendChild(incompleteModel);

      const installation = installModelPolyfill();
      const model = document.querySelector('#incomplete-model');
      const createdModel = document.createElement('model');

      expect(installation.hasNativeSupport).toBe(false);
      expect(incompleteModel.isConnected).toBe(false);
      expect(model.nodeName).toBe('MODEL-POLYFILL');
      expect(model.getAttribute('alt')).toBe('Incomplete native model');
      expect(model.querySelector('source')).not.toBeNull();
      expect(typeof model.load).toBe('function');
      expect(createdModel.nodeName).toBe('MODEL-POLYFILL');
      expect(typeof createdModel.load).toBe('function');
    } finally {
      getModelPolyfillInstallation()?.disconnect();
      createElementSpy.mockRestore();
      if (originalDescriptor) {
        Object.defineProperty(window, 'HTMLModelElement', originalDescriptor);
      } else {
        delete window.HTMLModelElement;
      }
    }
  });

  it('replaces the ready promise synchronously when src changes', () => {
    const installation = installModelPolyfill();
    const model = document.createElement('model');
    const previousReady = model.ready;

    model.setAttribute('src', 'asset.glb');

    expect(model.ready).not.toBe(previousReady);
    expect(model.readyState).toBe(MODEL_READY_STATE.LOADING);
    installation.disconnect();
  });

  it('keeps an author-provided accessible name intact', () => {
    installModelPolyfill();
    const model = document.createElement('model');
    model.setAttribute('aria-label', 'Custom name');
    model.alt = 'Fallback description';

    expect(model.getAttribute('aria-label')).toBe('Custom name');
  });
});
