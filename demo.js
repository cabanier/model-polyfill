import './src/index.js';

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
  status.textContent = 'Ready — interact with the helmet.';
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
  planeStatus.textContent = `Ready — ${plane.duration.toFixed(2)} seconds, looping.`;
  planeBackend.textContent = plane.dataset.modelRenderer ?? 'native';
  planeSource.textContent = new URL(plane.currentSrc, document.baseURI).pathname.split('/').pop();
  planePlaying.checked = !plane.paused;

  const initialTransform = plane.entityTransform;
  const portalHalfHeight = plane.getBoundingClientRect().height / 2 * (0.0254 / 96);
  const deltaY = -portalHalfHeight - initialTransform.m42;
  const groundedTransform = new DOMMatrix().translate(0, deltaY, 0).multiply(initialTransform);
  plane.entityTransform = groundedTransform.rotate(0, 45, 0);
} catch (error) {
  planeStatus.textContent = `Could not initialize the animated plane: ${error.message}`;
}
