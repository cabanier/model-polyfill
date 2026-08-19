import { afterEach, describe, expect, it } from 'vitest';
import { detectStereoPromotionBlockers } from '../src/stereo-promotion.js';

describe('stereo canvas promotion checks', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('detects rounded overflow clipping on an ancestor', () => {
    const ancestor = document.createElement('div');
    ancestor.style.overflow = 'hidden';
    ancestor.style.borderRadius = '22px';
    const model = document.createElement('model');
    ancestor.appendChild(model);
    document.body.appendChild(ancestor);

    const blockers = detectStereoPromotionBlockers(model);

    expect(blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'rounded-overflow-clip',
        element: ancestor,
      }),
    ]));
  });

  it('allows ordinary overflow clipping without rounded corners', () => {
    const ancestor = document.createElement('div');
    ancestor.style.overflow = 'hidden';
    const model = document.createElement('model');
    ancestor.appendChild(model);
    document.body.appendChild(ancestor);

    const blockers = detectStereoPromotionBlockers(model);

    expect(blockers.some(({ code }) => code === 'rounded-overflow-clip')).toBe(false);
  });
});
