import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
