import { MathUtils } from 'three';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const MAX_PITCH = Math.PI * 0.49;

export class OrbitController {
  constructor(element, canvas, onChange) {
    this.element = element;
    this.canvas = canvas;
    this.onChange = onChange;
    this.enabled = false;
    this.pointers = new Map();
    this.lastPinchDistance = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.zoom = 1;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.addedTabIndex = false;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.element.addEventListener('keydown', this.onKeyDown);
    this.canvas.style.cursor = 'grab';
    this.canvas.style.touchAction = 'none';

    if (!this.element.hasAttribute('tabindex')) {
      this.element.tabIndex = 0;
      this.addedTabIndex = true;
    }
    if (!this.element.hasAttribute('aria-roledescription')) {
      this.element.setAttribute('aria-roledescription', 'interactive 3D model');
    }
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.pointers.clear();
    this.lastPinchDistance = 0;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.element.removeEventListener('keydown', this.onKeyDown);
    this.canvas.style.cursor = '';
    this.canvas.style.touchAction = '';

    if (this.addedTabIndex) {
      this.element.removeAttribute('tabindex');
      this.addedTabIndex = false;
    }
  }

  dispose() {
    this.disable();
  }

  reset() {
    this.yaw = 0;
    this.pitch = 0;
    this.zoom = 1;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.onChange();
  }

  onPointerDown(event) {
    event.preventDefault();
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, time: performance.now() });
    this.canvas.setPointerCapture?.(event.pointerId);
    this.canvas.style.cursor = 'grabbing';
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
  }

  onPointerMove(event) {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;

    const now = performance.now();
    const elapsed = Math.max((now - previous.time) / 1000, 1 / 120);
    const deltaX = event.clientX - previous.x;
    const deltaY = event.clientY - previous.y;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, time: now });

    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.lastPinchDistance > 0) {
        this.zoom = MathUtils.clamp(this.zoom * (distance / this.lastPinchDistance), MIN_ZOOM, MAX_ZOOM);
        this.onChange();
      }
      this.lastPinchDistance = distance;
      return;
    }

    const sensitivity = 0.006;
    this.yaw += deltaX * sensitivity;
    this.pitch = MathUtils.clamp(this.pitch + deltaY * sensitivity, -MAX_PITCH, MAX_PITCH);
    this.yawVelocity = (deltaX * sensitivity) / elapsed;
    this.pitchVelocity = (deltaY * sensitivity) / elapsed;
    this.onChange();
  }

  onPointerUp(event) {
    this.pointers.delete(event.pointerId);
    this.lastPinchDistance = 0;
    this.canvas.releasePointerCapture?.(event.pointerId);
    if (this.pointers.size === 0) {
      this.canvas.style.cursor = 'grab';
      this.onChange();
    }
  }

  onWheel(event) {
    event.preventDefault();
    this.zoom = MathUtils.clamp(this.zoom * Math.exp(-event.deltaY * 0.001), MIN_ZOOM, MAX_ZOOM);
    this.onChange();
  }

  onKeyDown(event) {
    const rotationStep = event.shiftKey ? 0.25 : 0.08;
    let handled = true;

    switch (event.key) {
      case 'ArrowLeft': this.yaw -= rotationStep; break;
      case 'ArrowRight': this.yaw += rotationStep; break;
      case 'ArrowUp': this.pitch = MathUtils.clamp(this.pitch - rotationStep, -MAX_PITCH, MAX_PITCH); break;
      case 'ArrowDown': this.pitch = MathUtils.clamp(this.pitch + rotationStep, -MAX_PITCH, MAX_PITCH); break;
      case '+':
      case '=': this.zoom = MathUtils.clamp(this.zoom * 1.1, MIN_ZOOM, MAX_ZOOM); break;
      case '-':
      case '_': this.zoom = MathUtils.clamp(this.zoom / 1.1, MIN_ZOOM, MAX_ZOOM); break;
      case 'Home':
        this.yaw = 0;
        this.pitch = 0;
        this.zoom = 1;
        this.yawVelocity = 0;
        this.pitchVelocity = 0;
        break;
      default: handled = false;
    }

    if (handled) {
      event.preventDefault();
      this.onChange();
    }
  }

  tick(delta) {
    if (!this.enabled || this.pointers.size > 0) return false;
    if (Math.abs(this.yawVelocity) < 0.001 && Math.abs(this.pitchVelocity) < 0.001) return false;

    this.yaw += this.yawVelocity * delta;
    this.pitch = MathUtils.clamp(this.pitch + this.pitchVelocity * delta, -MAX_PITCH, MAX_PITCH);
    const damping = Math.pow(0.015, delta);
    this.yawVelocity *= damping;
    this.pitchVelocity *= damping;
    this.onChange();
    return true;
  }
}
