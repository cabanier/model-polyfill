import {
  MODEL_CANVAS_CLASS,
  READY_ATTRIBUTE,
  UPGRADED_ATTRIBUTE,
} from './constants.js';

const STYLE_ID = 'model-polyfill-styles';

export function installDefaultStyles(documentObject = document) {
  if (documentObject.getElementById(STYLE_ID)) return;

  const style = documentObject.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :where(model),
    :where(model-polyfill) {
      display: inline-block;
      width: var(--model-element-width, 300px);
      height: var(--model-element-height, 150px);
      vertical-align: middle;
    }

    :where(model[${UPGRADED_ATTRIBUTE}]),
    :where(model-polyfill[${UPGRADED_ATTRIBUTE}]) {
      contain: layout paint style;
      overflow: hidden;
      position: relative;
    }

    :where(model[${UPGRADED_ATTRIBUTE}]) > source,
    :where(model-polyfill[${UPGRADED_ATTRIBUTE}]) > source {
      display: none !important;
    }

    :where(model[${READY_ATTRIBUTE}]) > :not(source):not([data-model-internal]),
    :where(model-polyfill[${READY_ATTRIBUTE}]) > :not(source):not([data-model-internal]) {
      display: none !important;
    }

    :where(.${MODEL_CANVAS_CLASS}) {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
    }

    :where(.model-element-polyfill__stereo-warning) {
      position: absolute;
      z-index: 2;
      right: 12px;
      bottom: 12px;
      left: 12px;
      display: block;
      padding: 8px 10px;
      border: 1px solid rgba(255, 205, 92, 0.55);
      border-radius: 8px;
      background: rgba(26, 20, 8, 0.94);
      color: #ffe7a3;
      font: 600 12px/1.4 system-ui, sans-serif;
      pointer-events: none;
    }

    :where(.model-element-polyfill__tracking-button) {
      position: absolute;
      z-index: 3;
      top: 10px;
      right: 10px;
      max-width: calc(100% - 20px);
      padding: 7px 10px;
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 999px;
      background: rgba(8, 10, 16, 0.86);
      color: #fff;
      font: 600 12px/1.2 system-ui, sans-serif;
      cursor: pointer;
      pointer-events: auto;
    }

    :where(.model-element-polyfill__tracking-button:hover:not(:disabled)) {
      background: rgba(28, 32, 46, 0.94);
    }

    :where(.model-element-polyfill__tracking-button:focus-visible) {
      outline: 2px solid #8fe7dd;
      outline-offset: 2px;
    }

    :where(.model-element-polyfill__tracking-button:disabled) {
      cursor: default;
      opacity: 0.8;
    }
  `;
  documentObject.head.appendChild(style);
}
