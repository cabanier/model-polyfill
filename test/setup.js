class TestDOMMatrix {
  constructor(values) {
    this.values = values
      ? Array.from(values)
      : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  toFloat32Array() { return new Float32Array(this.values); }
  toFloat64Array() { return new Float64Array(this.values); }
}

class TestDOMPointReadOnly {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
}

globalThis.DOMMatrix = TestDOMMatrix;
globalThis.DOMMatrixReadOnly = TestDOMMatrix;
globalThis.DOMPointReadOnly = TestDOMPointReadOnly;
window.DOMMatrix = TestDOMMatrix;
window.DOMMatrixReadOnly = TestDOMMatrix;
window.DOMPointReadOnly = TestDOMPointReadOnly;

globalThis.matchMedia = (query) => ({
  addEventListener() {},
  matches: true,
  media: query,
  removeEventListener() {},
});
window.matchMedia = globalThis.matchMedia;

globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 0);
globalThis.cancelAnimationFrame = (handle) => clearTimeout(handle);
window.requestAnimationFrame = globalThis.requestAnimationFrame;
window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
