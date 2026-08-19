import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { CSS_PIXELS_PER_METRE } from './constants.js';

const _matrix = new Matrix4();
const _centerTranslation = new Matrix4();
const _position = new Vector3();
const _scaleVector = new Vector3();
const _quaternion = new Quaternion();
const _euler = new Euler(0, 0, 0, 'YXZ');

export function identityDOMMatrix() {
  return new DOMMatrix();
}

export function cloneDOMMatrix(matrix) {
  return new DOMMatrix(matrix.toFloat64Array());
}

export function calculateFitScale(element, size, orbit = false) {
  const rect = element.getBoundingClientRect();
  const portalWidth = rect.width / CSS_PIXELS_PER_METRE;
  const portalHeight = rect.height / CSS_PIXELS_PER_METRE;

  if (orbit) {
    const diameter = size.length();
    return diameter > 0 ? Math.min(portalWidth, portalHeight) / diameter : 1;
  }

  const scaleX = size.x > 0 ? portalWidth / size.x : Infinity;
  const scaleY = size.y > 0 ? portalHeight / size.y : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return Number.isFinite(scale) ? scale : 1;
}

export function buildEntityTransform({ center, size, scale, yaw = 0, pitch = 0, orbit = false }) {
  const depth = orbit ? size.length() / 2 : size.z / 2;
  const finalZ = -scale * depth;

  _euler.set(pitch, yaw, 0, 'YXZ');
  _quaternion.setFromEuler(_euler);
  _position.set(0, 0, finalZ);
  _scaleVector.setScalar(scale);
  _matrix.compose(_position, _quaternion, _scaleVector);
  _centerTranslation.makeTranslation(-center.x, -center.y, -center.z);
  _matrix.multiply(_centerTranslation);

  return new DOMMatrix(_matrix.elements);
}

export function applyDOMMatrixToObject(matrix, object) {
  _matrix.fromArray(matrix.toFloat64Array());
  _matrix.decompose(object.position, object.quaternion, object.scale);
  object.updateMatrixWorld(true);
}
