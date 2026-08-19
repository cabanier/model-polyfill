import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  collectModelSources,
  inferModelType,
  isSupportedModelType,
  normalizeModelType,
} from '../src/source-selection.js';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('model source selection', () => {
  it('normalizes aliases and infers types from URLs', () => {
    expect(normalizeModelType('MODEL/GLTF; charset=utf-8')).toBe('model/gltf+json');
    expect(inferModelType('/models/helmet.GLB?cache=1')).toBe('model/gltf-binary');
    expect(inferModelType('/models/helmet.usdz')).toBe('model/vnd.usdz+zip');
    expect(isSupportedModelType('model/usd')).toBe(true);
    expect(isSupportedModelType('application/octet-stream')).toBe(false);
  });

  it('collects supported direct and child sources in document order', () => {
    document.body.innerHTML = `
      <model src="direct.glb">
        <source src="helmet.usdz" type="model/vnd.usdz+zip">
        <source src="helmet.glb" type="model/gltf-binary">
        <source src="notes.txt" type="text/plain">
      </model>
    `;

    const candidates = collectModelSources(document.querySelector('model'));
    expect(candidates.map(({ src, type }) => [new URL(src).pathname, type])).toEqual([
      ['/direct.glb', 'model/gltf-binary'],
      ['/helmet.usdz', 'model/vnd.usdz+zip'],
      ['/helmet.glb', 'model/gltf-binary'],
    ]);
  });

  it('skips sources whose media query does not match', () => {
    vi.spyOn(globalThis, 'matchMedia').mockImplementation((query) => ({
      matches: query !== '(max-width: 1px)',
      media: query,
    }));
    document.body.innerHTML = `
      <model>
        <source src="small.glb" media="(max-width: 1px)">
        <source src="normal.glb">
      </model>
    `;

    const candidates = collectModelSources(document.querySelector('model'));
    expect(candidates).toHaveLength(1);
    expect(candidates[0].src).toMatch(/normal\.glb$/);
  });
});
