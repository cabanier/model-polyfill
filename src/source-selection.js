import { SUPPORTED_MODEL_TYPES } from './constants.js';

const TYPE_ALIASES = new Map([
  ['model/gltf', 'model/gltf+json'],
  ['model/usd', 'model/vnd.usd'],
  ['model/usdz', 'model/vnd.usdz+zip'],
]);

const EXTENSION_TYPES = new Map([
  ['.glb', 'model/gltf-binary'],
  ['.gltf', 'model/gltf+json'],
  ['.usd', 'model/vnd.usd'],
  ['.usda', 'model/vnd.usd'],
  ['.usdc', 'model/vnd.usd'],
  ['.usdz', 'model/vnd.usdz+zip'],
]);

const SUPPORTED_TYPE_SET = new Set(SUPPORTED_MODEL_TYPES);

export function normalizeModelType(type = '') {
  const normalized = type.split(';', 1)[0].trim().toLowerCase();
  return TYPE_ALIASES.get(normalized) ?? normalized;
}

export function inferModelType(url, declaredType = '') {
  const normalized = normalizeModelType(declaredType);
  if (normalized) return normalized;

  let pathname = String(url);
  try {
    pathname = new URL(url, globalThis.document?.baseURI).pathname;
  } catch {
    // The raw string is enough for extension matching.
  }

  const lowerPath = pathname.toLowerCase();
  for (const [extension, type] of EXTENSION_TYPES) {
    if (lowerPath.endsWith(extension)) return type;
  }
  return '';
}

export function isSupportedModelType(type) {
  return SUPPORTED_TYPE_SET.has(normalizeModelType(type));
}

function mediaMatches(source) {
  const media = source.getAttribute('media');
  if (!media || typeof globalThis.matchMedia !== 'function') return true;
  return globalThis.matchMedia(media).matches;
}

function toCandidate(src, type, source, baseURI) {
  return {
    src: new URL(src, baseURI).href,
    type: inferModelType(src, type),
    source,
  };
}

export function collectModelSources(element) {
  const baseURI = element.ownerDocument?.baseURI ?? globalThis.document?.baseURI;
  const candidates = [];
  const directSrc = element.getAttribute('src');

  if (directSrc) {
    const candidate = toCandidate(directSrc, element.getAttribute('type') ?? '', element, baseURI);
    if (isSupportedModelType(candidate.type)) candidates.push(candidate);
  }

  for (const source of element.querySelectorAll(':scope > source')) {
    const src = source.getAttribute('src');
    if (!src || !mediaMatches(source)) continue;

    const candidate = toCandidate(src, source.getAttribute('type') ?? '', source, baseURI);
    if (isSupportedModelType(candidate.type)) candidates.push(candidate);
  }

  return candidates;
}
