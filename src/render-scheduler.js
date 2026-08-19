class RenderScheduler {
  constructor() {
    this.contexts = new Set();
    this.frameHandle = null;
    this.lastTime = 0;
    this.onFrame = this.onFrame.bind(this);
  }

  add(context) {
    this.contexts.add(context);
    this.request();
  }

  remove(context) {
    this.contexts.delete(context);
    if (this.contexts.size === 0 && this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
      this.lastTime = 0;
    }
  }

  request() {
    if (this.frameHandle === null && this.contexts.size > 0) {
      this.frameHandle = requestAnimationFrame(this.onFrame);
    }
  }

  onFrame(time) {
    this.frameHandle = null;
    const delta = this.lastTime === 0 ? 0 : Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    let keepRunning = false;

    for (const context of this.contexts) {
      try {
        keepRunning = context.frame(time, delta) || keepRunning;
      } catch (error) {
        console.error('Error rendering <model>', error);
      }
    }

    if (keepRunning) this.request();
    else this.lastTime = 0;
  }
}

let scheduler;

export function getRenderScheduler() {
  scheduler ??= new RenderScheduler();
  return scheduler;
}
