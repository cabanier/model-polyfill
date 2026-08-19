export const MODEL_READY_STATE: Readonly<{
  EMPTY: 0;
  LOADING: 1;
  COMPLETE: 2;
}>;

export const SUPPORTED_MODEL_TYPES: readonly string[];

export interface ModelSourceCandidate {
  src: string;
  type: string;
  source: Element;
}

export interface ModelElementLike extends HTMLElement {
  alt: string;
  autoplay: boolean;
  readonly boundingBoxCenter: DOMPointReadOnly;
  readonly boundingBoxExtents: DOMPointReadOnly;
  readonly complete: boolean;
  readonly currentSrc: string;
  currentTime: number;
  readonly duration: number;
  entityTransform: DOMMatrixReadOnly;
  environmentMap: string;
  height: number;
  loop: boolean;
  readonly paused: boolean;
  playbackRate: number;
  readonly ready: Promise<ModelElementLike>;
  readonly readyState: number;
  src: string;
  stageMode: 'none' | 'orbit';
  width: number;
  canPlayType(type: string): '' | 'probably';
  load(): Promise<ModelElementLike>;
  pause(): void;
  play(): Promise<void>;
}

export interface ModelPolyfillOptions {
  cameraDistance?: number;
  force?: boolean;
  maxPixelRatio?: number;
}

export interface ModelPolyfillInstallation {
  HTMLModelElement: CustomElementConstructor;
  hasNativeSupport: boolean;
  upgrade(element: HTMLElement): ModelElementLike;
  disconnect(): void;
}

export function installModelPolyfill(options?: ModelPolyfillOptions): ModelPolyfillInstallation | null;
export function getModelPolyfillInstallation(): ModelPolyfillInstallation | null;
export function collectModelSources(element: Element): ModelSourceCandidate[];
export function inferModelType(url: string, declaredType?: string): string;
export function isSupportedModelType(type: string): boolean;
export function normalizeModelType(type?: string): string;
export function getModelState(element: Element): object | undefined;
