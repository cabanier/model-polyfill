import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { USDLoader } from 'three/addons/loaders/USDLoader.js';

function createProgressHandler(candidate, onProgress) {
  if (!onProgress) return undefined;
  return (event) => {
    onProgress({
      candidate,
      lengthComputable: Boolean(event.lengthComputable),
      loaded: event.loaded ?? 0,
      total: event.total ?? 0,
    });
  };
}

async function loadCandidate(candidate, onProgress) {
  const progress = createProgressHandler(candidate, onProgress);

  if (candidate.type === 'model/gltf-binary' || candidate.type === 'model/gltf+json') {
    const gltf = await new GLTFLoader().loadAsync(candidate.src, progress);
    return {
      animations: gltf.animations ?? [],
      candidate,
      object: gltf.scene,
    };
  }

  const object = await new USDLoader().loadAsync(candidate.src, progress);
  return {
    animations: object.animations ?? [],
    candidate,
    object,
  };
}

export async function loadModelCandidates(candidates, options = {}) {
  const errors = [];

  for (const candidate of candidates) {
    if (options.isStale?.()) return null;

    try {
      const result = await loadCandidate(candidate, options.onProgress);
      if (options.isStale?.()) {
        disposeObject3D(result.object);
        return null;
      }
      return result;
    } catch (error) {
      errors.push({ candidate, error });
    }
  }

  const detail = errors
    .map(({ candidate, error }) => `${candidate.src}: ${error?.message ?? error}`)
    .join('\n');
  const failure = new AggregateError(
    errors.map(({ error }) => error),
    detail ? `Unable to load a supported model source:\n${detail}` : 'No supported model source was found.',
  );
  failure.attempts = errors;
  throw failure;
}

function disposeMaterial(material) {
  for (const value of Object.values(material)) {
    if (value?.isTexture) value.dispose();
  }
  material.dispose?.();
}

export function disposeObject3D(object) {
  if (!object) return;

  object.traverse?.((child) => {
    child.geometry?.dispose?.();
    child.skeleton?.dispose?.();

    if (Array.isArray(child.material)) {
      child.material.forEach(disposeMaterial);
    } else if (child.material) {
      disposeMaterial(child.material);
    }
  });
}
