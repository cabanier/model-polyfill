import { beforeEach, describe, expect, it, vi } from 'vitest';

const loaderState = vi.hoisted(() => ({ attempts: [] }));

vi.mock('three/addons/loaders/USDLoader.js', () => ({
  USDLoader: class {
    async loadAsync(src) {
      loaderState.attempts.push(src);
      throw new Error('USD parse failed');
    }
  },
}));

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    async loadAsync(src) {
      loaderState.attempts.push(src);
      return { animations: [{ name: 'idle' }], scene: { traverse() {} } };
    }
  },
}));

import { loadModelCandidates } from '../src/model-loader.js';

describe('model loading fallback', () => {
  beforeEach(() => {
    loaderState.attempts.length = 0;
  });

  it('tries the next supported source after a loader failure', async () => {
    const result = await loadModelCandidates([
      { src: 'https://example.test/model.usdz', type: 'model/vnd.usdz+zip' },
      { src: 'https://example.test/model.glb', type: 'model/gltf-binary' },
    ]);

    expect(loaderState.attempts).toEqual([
      'https://example.test/model.usdz',
      'https://example.test/model.glb',
    ]);
    expect(result.candidate.type).toBe('model/gltf-binary');
    expect(result.animations).toHaveLength(1);
  });
});
