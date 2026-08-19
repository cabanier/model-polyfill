import {
  MODEL_CANVAS_CLASS,
  READY_ATTRIBUTE,
  UPGRADED_ATTRIBUTE,
} from './constants.js';

const STYLE_ID = 'model-element-webgpu-polyfill-styles';

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
  `;
  documentObject.head.appendChild(style);
}
