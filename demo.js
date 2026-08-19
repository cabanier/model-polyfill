import { installModelPolyfill } from './src/install.js';

const installation = installModelPolyfill();

// Native <model> is a replaced element, so its children (including an injected
// canvas) are not guaranteed to paint. Use the registered fallback element for
// this demo when a native or experimental implementation is present.
if (installation?.hasNativeSupport) {
  for (const nativeModel of document.querySelectorAll('model')) {
    const polyfilledModel = document.createElement('model-polyfill');
    for (const attribute of nativeModel.attributes) {
      polyfilledModel.setAttribute(attribute.name, attribute.value);
    }
    polyfilledModel.append(...nativeModel.childNodes);
    nativeModel.replaceWith(polyfilledModel);
  }
}

const model = document.querySelector('#helmet');
const status = document.querySelector('#status');
const backend = document.querySelector('#backend');
const source = document.querySelector('#source');
const plane = document.querySelector('#plane');
const planeStatus = document.querySelector('#plane-status');
const planeBackend = document.querySelector('#plane-backend');
const planeSource = document.querySelector('#plane-source');
const planeRate = document.querySelector('#plane-rate');
const planeRateOutput = document.querySelector('#plane-rate-output');
const planePlaying = document.querySelector('#plane-playing');
const chameleon = document.querySelector('#chameleon');
const chameleonStatus = document.querySelector('#chameleon-status');
const chameleonBackend = document.querySelector('#chameleon-backend');
const chameleonSource = document.querySelector('#chameleon-source');
const chameleonPlaying = document.querySelector('#chameleon-playing');

model.addEventListener('stereostart', () => {
  backend.textContent = model.dataset.modelRenderer;
  status.textContent = model.dataset.modelTracking === 'head'
    ? 'Ready — inline stereo with head tracking is active.'
    : 'Ready — browser inline stereo is active.';
});

model.addEventListener('stereoend', () => {
  backend.textContent = model.dataset.modelRenderer;
  status.textContent = 'Ready — inline stereo ended; using the regular renderer.';
});

model.addEventListener('stereoblocked', (event) => {
  backend.textContent = model.dataset.modelRenderer;
  status.textContent = event.detail.message;
});

model.addEventListener('trackingstart', () => {
  status.textContent = 'Ready — inline stereo with head tracking is active.';
});

model.addEventListener('trackingerror', (event) => {
  status.textContent = `Head tracking was not enabled: ${event.detail?.message ?? 'permission denied'}`;
});

plane.addEventListener('stereostart', () => {
  planeBackend.textContent = plane.dataset.modelRenderer;
  planeStatus.textContent = plane.dataset.modelTracking === 'head'
    ? `Ready — head-tracked inline stereo, ${plane.duration.toFixed(2)} seconds, looping.`
    : `Ready — inline stereo, ${plane.duration.toFixed(2)} seconds, looping.`;
});

plane.addEventListener('stereoend', () => {
  planeBackend.textContent = plane.dataset.modelRenderer;
  planeStatus.textContent = `Ready — ${plane.duration.toFixed(2)} seconds, looping.`;
});

plane.addEventListener('stereoblocked', (event) => {
  planeBackend.textContent = plane.dataset.modelRenderer;
  planeStatus.textContent = event.detail.message;
});

plane.addEventListener('trackingstart', () => {
  planeStatus.textContent = `Ready — head-tracked inline stereo, ${plane.duration.toFixed(2)} seconds, looping.`;
});

plane.addEventListener('trackingerror', (event) => {
  planeStatus.textContent = `Head tracking was not enabled: ${event.detail?.message ?? 'permission denied'}`;
});

function chameleonReadyMessage(prefix = 'Ready') {
  const duration = Number.isFinite(chameleon.duration) ? `, ${chameleon.duration.toFixed(2)} seconds` : '';
  return `${prefix}${duration}, looping.`;
}

chameleon.addEventListener('stereostart', () => {
  chameleonBackend.textContent = chameleon.dataset.modelRenderer;
  chameleonStatus.textContent = chameleonReadyMessage(
    chameleon.dataset.modelTracking === 'head'
      ? 'Ready — head-tracked inline stereo'
      : 'Ready — inline stereo',
  );
});

chameleon.addEventListener('stereoend', () => {
  chameleonBackend.textContent = chameleon.dataset.modelRenderer;
  chameleonStatus.textContent = chameleonReadyMessage();
});

chameleon.addEventListener('stereoblocked', (event) => {
  chameleonBackend.textContent = chameleon.dataset.modelRenderer;
  chameleonStatus.textContent = event.detail.message;
});

chameleon.addEventListener('trackingstart', () => {
  chameleonStatus.textContent = chameleonReadyMessage('Ready — head-tracked inline stereo');
});

chameleon.addEventListener('trackingerror', (event) => {
  chameleonStatus.textContent = `Head tracking was not enabled: ${event.detail?.message ?? 'permission denied'}`;
});

model.addEventListener('progress', (event) => {
  if (!event.detail.lengthComputable) return;
  const percent = Math.round((event.detail.loaded / event.detail.total) * 100);
  status.textContent = `Loading the model… ${percent}%`;
});

model.addEventListener('error', (event) => {
  status.textContent = `Could not load the 3D model: ${event.detail?.message ?? 'unknown error'}`;
  backend.textContent = 'Fallback image';
});

try {
  await model.ready;
  if (!model.dataset.modelStereoBlocked) {
    status.textContent = 'Ready — interact with the helmet.';
  }
  backend.textContent = model.dataset.modelRenderer ?? 'native';
  source.textContent = new URL(model.currentSrc, document.baseURI).pathname.split('/').pop();
} catch (error) {
  status.textContent = `Could not initialize the model: ${error.message}`;
}

planeRate.addEventListener('input', () => {
  const value = Number(planeRate.value);
  plane.playbackRate = value;
  planeRateOutput.value = `${value.toFixed(1)}×`;
});

planePlaying.addEventListener('change', () => {
  if (planePlaying.checked) plane.play();
  else plane.pause();
});

plane.addEventListener('play', () => {
  planePlaying.checked = true;
});

plane.addEventListener('pause', () => {
  planePlaying.checked = false;
});

plane.addEventListener('ended', () => {
  planePlaying.checked = false;
});

plane.addEventListener('error', (event) => {
  planeStatus.textContent = `Could not load the animated plane: ${event.detail?.message ?? 'unknown error'}`;
});

try {
  await plane.ready;
  if (!plane.dataset.modelStereoBlocked) {
    planeStatus.textContent = `Ready — ${plane.duration.toFixed(2)} seconds, looping.`;
  }
  planeBackend.textContent = plane.dataset.modelRenderer ?? 'native';
  planeSource.textContent = new URL(plane.currentSrc, document.baseURI).pathname.split('/').pop();
  planePlaying.checked = !plane.paused;

  const initialTransform = plane.entityTransform;
  if (initialTransform && Number.isFinite(initialTransform.m42) && typeof DOMMatrix === 'function') {
    try {
      const portalHalfHeight = plane.getBoundingClientRect().height / 2 * (0.0254 / 96);
      const deltaY = -portalHalfHeight - initialTransform.m42;
      const groundedTransform = new DOMMatrix().translate(0, deltaY, 0).multiply(initialTransform);
      plane.entityTransform = groundedTransform.rotate(0, 45, 0);
    } catch (error) {
      console.debug('The active <model> implementation does not support custom entity transforms.', error);
    }
  }
} catch (error) {
  planeStatus.textContent = `Could not initialize the animated plane: ${error.message}`;
}

chameleonPlaying.addEventListener('change', () => {
  if (chameleonPlaying.checked) chameleon.play();
  else chameleon.pause();
});

chameleon.addEventListener('play', () => {
  chameleonPlaying.checked = true;
});

chameleon.addEventListener('pause', () => {
  chameleonPlaying.checked = false;
});

chameleon.addEventListener('ended', () => {
  chameleonPlaying.checked = false;
});

chameleon.addEventListener('progress', (event) => {
  if (!event.detail.lengthComputable) return;
  const percent = Math.round((event.detail.loaded / event.detail.total) * 100);
  chameleonStatus.textContent = `Loading the animated chameleon… ${percent}%`;
});

chameleon.addEventListener('error', (event) => {
  chameleonStatus.textContent = `Could not load the animated chameleon: ${event.detail?.message ?? 'unknown error'}`;
});

try {
  await chameleon.ready;
  if (!chameleon.dataset.modelStereoBlocked) {
    chameleonStatus.textContent = chameleonReadyMessage();
  }
  chameleonBackend.textContent = chameleon.dataset.modelRenderer ?? 'native';
  chameleonSource.textContent = new URL(chameleon.currentSrc, document.baseURI).pathname.split('/').pop();
  chameleonPlaying.checked = !chameleon.paused;
} catch (error) {
  chameleonStatus.textContent = `Could not initialize the animated chameleon: ${error.message}`;
}
