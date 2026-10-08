import { installModelPolyfill } from './src/install.js';

installModelPolyfill();

const model = document.querySelector('#apple-model');
const buttons = [...document.querySelectorAll('.model-buttons button')];
const status = document.querySelector('#gallery-status');
const backend = document.querySelector('#gallery-backend');
const source = document.querySelector('#gallery-source');
const appleSourceLink = document.querySelector('#apple-source-link');

let selectionGeneration = 0;
let selectedButton = buttons.find((button) => button.getAttribute('aria-pressed') === 'true') ?? buttons[0];

function selectedName() {
  return selectedButton.textContent.trim();
}

function readyMessage() {
  const duration = Number.isFinite(model.duration) && model.duration > 0
    ? ` The animation is ${model.duration.toFixed(2)} seconds and loops automatically.`
    : '';
  return `${selectedName()} is ready.${duration}`;
}

async function showSelectedModel(button) {
  const generation = ++selectionGeneration;
  selectedButton = button;
  for (const candidate of buttons) {
    candidate.setAttribute('aria-pressed', String(candidate === selectedButton));
  }
  const name = selectedName();

  status.textContent = `Loading ${name}…`;
  backend.textContent = 'Loading…';
  source.textContent = new URL(button.dataset.src, document.baseURI).pathname.split('/').pop();
  appleSourceLink.href = button.dataset.appleUrl;
  appleSourceLink.setAttribute('aria-label', `Download ${name} from Apple`);
  model.alt = button.dataset.alt;
  model.src = button.dataset.src;

  try {
    await model.ready;
    if (generation !== selectionGeneration) return;
    status.textContent = readyMessage();
    backend.textContent = model.dataset.modelRenderer ?? 'native';
    source.textContent = new URL(model.currentSrc, document.baseURI).pathname.split('/').pop();
  } catch (error) {
    if (generation !== selectionGeneration || error?.name === 'AbortError') return;
    status.textContent = `Could not load ${name}: ${error.message}`;
    backend.textContent = 'Unavailable';
  }
}

model.addEventListener('progress', (event) => {
  if (!event.detail.lengthComputable) return;
  const percent = Math.round((event.detail.loaded / event.detail.total) * 100);
  status.textContent = `Loading ${selectedName()}… ${percent}%`;
});

model.addEventListener('stereostart', () => {
  backend.textContent = model.dataset.modelRenderer;
});

model.addEventListener('stereoend', () => {
  backend.textContent = model.dataset.modelRenderer;
});

for (const button of buttons) {
  button.addEventListener('click', () => showSelectedModel(button));
}

showSelectedModel(selectedButton);
