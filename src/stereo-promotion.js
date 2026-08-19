const CLIPPING_OVERFLOW_VALUES = new Set(['auto', 'clip', 'hidden', 'scroll']);

function styleValue(style, property, camelCaseProperty = property) {
  return (style.getPropertyValue?.(property) || style[camelCaseProperty] || '').trim();
}

function isActiveEffect(value, inactiveValue = 'none') {
  return Boolean(value && value !== inactiveValue);
}

function firstActiveEffect(...values) {
  return values.find((value) => isActiveEffect(value)) || '';
}

function hasNonZeroRadius(style) {
  const values = [
    styleValue(style, 'border-radius', 'borderRadius'),
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
  ].map((property) => (
    property.includes('-radius') ? styleValue(style, property) : property
  ));

  return values.some((value) => {
    if (!value) return false;
    const numbers = value.match(/-?(?:\d*\.)?\d+/g);
    return numbers ? numbers.some((part) => Number(part) !== 0) : value !== 'none';
  });
}

function elementLabel(element) {
  const tagName = element.localName || element.nodeName?.toLowerCase() || 'element';
  if (element.id) return `${tagName}#${element.id}`;
  if (element.classList?.length) return `${tagName}.${[...element.classList].slice(0, 2).join('.')}`;
  return `<${tagName}>`;
}

function addBlocker(blockers, element, code, property, value, description) {
  blockers.push({
    code,
    description,
    element,
    elementLabel: elementLabel(element),
    property,
    value,
  });
}

/**
 * Finds CSS effects known to flatten a canvas into an intermediate mono surface.
 * The output canvas must remain directly promotable for inline-stereo presentation.
 */
export function detectStereoPromotionBlockers(element) {
  const windowObject = element.ownerDocument?.defaultView ?? globalThis.window;
  if (!windowObject?.getComputedStyle) return [];

  const blockers = [];

  for (let current = element; current; current = current.parentElement) {
    const style = windowObject.getComputedStyle(current);

    const backdropFilter = firstActiveEffect(
      styleValue(style, 'backdrop-filter', 'backdropFilter'),
      styleValue(style, '-webkit-backdrop-filter', 'webkitBackdropFilter'),
    );
    if (isActiveEffect(backdropFilter)) {
      addBlocker(
        blockers,
        current,
        'backdrop-filter',
        'backdrop-filter',
        backdropFilter,
        'a backdrop filter requires an intermediate render surface',
      );
    }

    const filter = styleValue(style, 'filter');
    if (isActiveEffect(filter)) {
      addBlocker(
        blockers,
        current,
        'filter',
        'filter',
        filter,
        'a CSS filter requires an intermediate render surface',
      );
    }

    const clipPath = styleValue(style, 'clip-path', 'clipPath');
    if (isActiveEffect(clipPath)) {
      addBlocker(
        blockers,
        current,
        'clip-path',
        'clip-path',
        clipPath,
        'a clip path prevents direct canvas promotion',
      );
    }

    const maskImage = firstActiveEffect(
      styleValue(style, 'mask-image', 'maskImage'),
      styleValue(style, '-webkit-mask-image', 'webkitMaskImage'),
    );
    if (isActiveEffect(maskImage)) {
      addBlocker(
        blockers,
        current,
        'mask-image',
        'mask-image',
        maskImage,
        'a CSS mask prevents direct canvas promotion',
      );
    }

    const mixBlendMode = styleValue(style, 'mix-blend-mode', 'mixBlendMode');
    if (mixBlendMode && mixBlendMode !== 'normal') {
      addBlocker(
        blockers,
        current,
        'mix-blend-mode',
        'mix-blend-mode',
        mixBlendMode,
        'blending with page content requires an intermediate render surface',
      );
    }

    const opacity = Number.parseFloat(styleValue(style, 'opacity'));
    if (Number.isFinite(opacity) && opacity < 1) {
      addBlocker(
        blockers,
        current,
        'opacity',
        'opacity',
        String(opacity),
        'group opacity requires the subtree to be flattened before compositing',
      );
    }

    const overflow = styleValue(style, 'overflow');
    const overflowParts = overflow.split(/\s+/);
    const overflowX = styleValue(style, 'overflow-x', 'overflowX') || overflowParts[0];
    const overflowY = styleValue(style, 'overflow-y', 'overflowY') || overflowParts[1] || overflowParts[0];
    const clipsOverflow = CLIPPING_OVERFLOW_VALUES.has(overflowX)
      || CLIPPING_OVERFLOW_VALUES.has(overflowY);
    if (clipsOverflow && hasNonZeroRadius(style)) {
      addBlocker(
        blockers,
        current,
        'rounded-overflow-clip',
        'overflow / border-radius',
        `${overflowX} ${overflowY} / rounded corners`,
        'rounded overflow clipping requires an intermediate render surface',
      );
    }
  }

  return blockers;
}

export function formatStereoPromotionWarning(blockers) {
  const examples = blockers.slice(0, 2).map((blocker) => (
    `${blocker.property}: ${blocker.value} on ${blocker.elementLabel}`
  ));
  const remaining = blockers.length - examples.length;
  const suffix = remaining > 0 ? `, plus ${remaining} more` : '';
  return `Stereo disabled because CSS prevents direct canvas presentation (${examples.join('; ')}${suffix}). Showing mono.`;
}
