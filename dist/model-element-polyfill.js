import { AnimationMixer as e, Box3 as t, Euler as n, LoopOnce as r, LoopRepeat as i, MathUtils as a, Matrix4 as o, Quaternion as s, Vector3 as c } from "three";
import { GLTFLoader as l } from "three/addons/loaders/GLTFLoader.js";
import { USDLoader as u } from "three/addons/loaders/USDLoader.js";
import { ACESFilmicToneMapping as d, DirectionalLight as f, EquirectangularReflectionMapping as p, Group as m, HemisphereLight as ee, PerspectiveCamera as te, SRGBColorSpace as ne, Scene as re, Vector3 as h, WebGPURenderer as ie } from "three/webgpu";
import { HDRLoader as ae } from "three/addons/loaders/HDRLoader.js";
//#region src/constants.js
var g = Object.freeze({
	EMPTY: 0,
	LOADING: 1,
	COMPLETE: 2
}), _ = Object.freeze([
	"model/gltf-binary",
	"model/gltf+json",
	"model/vnd.usdz+zip",
	"model/vnd.usd"
]), v = Object.freeze([
	"alt",
	"autoplay",
	"environmentmap",
	"height",
	"loop",
	"src",
	"stagemode",
	"width"
]), y = 96 / .0254, b = "model-element-polyfill__canvas", x = "data-model-polyfilled", S = "data-model-ready";
//#endregion
//#region src/model-loader.js
function oe(e, t) {
	if (t) return (n) => {
		t({
			candidate: e,
			lengthComputable: !!n.lengthComputable,
			loaded: n.loaded ?? 0,
			total: n.total ?? 0
		});
	};
}
async function se(e, t) {
	let n = oe(e, t);
	if (e.type === "model/gltf-binary" || e.type === "model/gltf+json") {
		let t = await new l().loadAsync(e.src, n);
		return {
			animations: t.animations ?? [],
			candidate: e,
			object: t.scene
		};
	}
	let r = await new u().loadAsync(e.src, n);
	return {
		animations: r.animations ?? [],
		candidate: e,
		object: r
	};
}
async function ce(e, t = {}) {
	let n = [];
	for (let r of e) {
		if (t.isStale?.()) return null;
		try {
			let e = await se(r, t.onProgress);
			return t.isStale?.() ? (C(e.object), null) : e;
		} catch (e) {
			n.push({
				candidate: r,
				error: e
			});
		}
	}
	let r = n.map(({ candidate: e, error: t }) => `${e.src}: ${t?.message ?? t}`).join("\n"), i = AggregateError(n.map(({ error: e }) => e), r ? `Unable to load a supported model source:\n${r}` : "No supported model source was found.");
	throw i.attempts = n, i;
}
function le(e) {
	for (let t of Object.values(e)) t?.isTexture && t.dispose();
	e.dispose?.();
}
function C(e) {
	e && e.traverse?.((e) => {
		e.geometry?.dispose?.(), e.skeleton?.dispose?.(), Array.isArray(e.material) ? e.material.forEach(le) : e.material && le(e.material);
	});
}
//#endregion
//#region src/orbit-controller.js
var w = .25, T = 4, E = Math.PI * .49, ue = class {
	constructor(e, t, n) {
		this.element = e, this.canvas = t, this.onChange = n, this.enabled = !1, this.pointers = /* @__PURE__ */ new Map(), this.lastPinchDistance = 0, this.yaw = 0, this.pitch = 0, this.zoom = 1, this.yawVelocity = 0, this.pitchVelocity = 0, this.addedTabIndex = !1, this.onPointerDown = this.onPointerDown.bind(this), this.onPointerMove = this.onPointerMove.bind(this), this.onPointerUp = this.onPointerUp.bind(this), this.onWheel = this.onWheel.bind(this), this.onKeyDown = this.onKeyDown.bind(this);
	}
	enable() {
		this.enabled || (this.enabled = !0, this.canvas.addEventListener("pointerdown", this.onPointerDown), this.canvas.addEventListener("pointermove", this.onPointerMove), this.canvas.addEventListener("pointerup", this.onPointerUp), this.canvas.addEventListener("pointercancel", this.onPointerUp), this.canvas.addEventListener("wheel", this.onWheel, { passive: !1 }), this.element.addEventListener("keydown", this.onKeyDown), this.canvas.style.cursor = "grab", this.canvas.style.touchAction = "none", this.element.hasAttribute("tabindex") || (this.element.tabIndex = 0, this.addedTabIndex = !0), this.element.hasAttribute("aria-roledescription") || this.element.setAttribute("aria-roledescription", "interactive 3D model"));
	}
	disable() {
		this.enabled && (this.enabled = !1, this.pointers.clear(), this.lastPinchDistance = 0, this.yawVelocity = 0, this.pitchVelocity = 0, this.canvas.removeEventListener("pointerdown", this.onPointerDown), this.canvas.removeEventListener("pointermove", this.onPointerMove), this.canvas.removeEventListener("pointerup", this.onPointerUp), this.canvas.removeEventListener("pointercancel", this.onPointerUp), this.canvas.removeEventListener("wheel", this.onWheel), this.element.removeEventListener("keydown", this.onKeyDown), this.canvas.style.cursor = "", this.canvas.style.touchAction = "", this.addedTabIndex &&= (this.element.removeAttribute("tabindex"), !1));
	}
	dispose() {
		this.disable();
	}
	reset() {
		this.yaw = 0, this.pitch = 0, this.zoom = 1, this.yawVelocity = 0, this.pitchVelocity = 0, this.onChange();
	}
	onPointerDown(e) {
		e.preventDefault(), this.pointers.set(e.pointerId, {
			x: e.clientX,
			y: e.clientY,
			time: performance.now()
		}), this.canvas.setPointerCapture?.(e.pointerId), this.canvas.style.cursor = "grabbing", this.yawVelocity = 0, this.pitchVelocity = 0;
	}
	onPointerMove(e) {
		let t = this.pointers.get(e.pointerId);
		if (!t) return;
		let n = performance.now(), r = Math.max((n - t.time) / 1e3, 1 / 120), i = e.clientX - t.x, o = e.clientY - t.y;
		if (this.pointers.set(e.pointerId, {
			x: e.clientX,
			y: e.clientY,
			time: n
		}), this.pointers.size >= 2) {
			let [e, t] = [...this.pointers.values()], n = Math.hypot(e.x - t.x, e.y - t.y);
			this.lastPinchDistance > 0 && (this.zoom = a.clamp(this.zoom * (n / this.lastPinchDistance), w, T), this.onChange()), this.lastPinchDistance = n;
			return;
		}
		let s = .006;
		this.yaw += i * s, this.pitch = a.clamp(this.pitch + o * s, -E, E), this.yawVelocity = i * s / r, this.pitchVelocity = o * s / r, this.onChange();
	}
	onPointerUp(e) {
		this.pointers.delete(e.pointerId), this.lastPinchDistance = 0, this.canvas.releasePointerCapture?.(e.pointerId), this.pointers.size === 0 && (this.canvas.style.cursor = "grab", this.onChange());
	}
	onWheel(e) {
		e.preventDefault(), this.zoom = a.clamp(this.zoom * Math.exp(-e.deltaY * .001), w, T), this.onChange();
	}
	onKeyDown(e) {
		let t = e.shiftKey ? .25 : .08, n = !0;
		switch (e.key) {
			case "ArrowLeft":
				this.yaw -= t;
				break;
			case "ArrowRight":
				this.yaw += t;
				break;
			case "ArrowUp":
				this.pitch = a.clamp(this.pitch - t, -E, E);
				break;
			case "ArrowDown":
				this.pitch = a.clamp(this.pitch + t, -E, E);
				break;
			case "+":
			case "=":
				this.zoom = a.clamp(this.zoom * 1.1, w, T);
				break;
			case "-":
			case "_":
				this.zoom = a.clamp(this.zoom / 1.1, w, T);
				break;
			case "Home":
				this.yaw = 0, this.pitch = 0, this.zoom = 1, this.yawVelocity = 0, this.pitchVelocity = 0;
				break;
			default: n = !1;
		}
		n && (e.preventDefault(), this.onChange());
	}
	tick(e) {
		if (!this.enabled || this.pointers.size > 0 || Math.abs(this.yawVelocity) < .001 && Math.abs(this.pitchVelocity) < .001) return !1;
		this.yaw += this.yawVelocity * e, this.pitch = a.clamp(this.pitch + this.pitchVelocity * e, -E, E);
		let t = .015 ** e;
		return this.yawVelocity *= t, this.pitchVelocity *= t, this.onChange(), !0;
	}
}, de = class {
	constructor() {
		this.contexts = /* @__PURE__ */ new Set(), this.frameHandle = null, this.lastTime = 0, this.onFrame = this.onFrame.bind(this);
	}
	add(e) {
		this.contexts.add(e), this.request();
	}
	remove(e) {
		this.contexts.delete(e), this.contexts.size === 0 && this.frameHandle !== null && (cancelAnimationFrame(this.frameHandle), this.frameHandle = null, this.lastTime = 0);
	}
	request() {
		this.frameHandle === null && this.contexts.size > 0 && (this.frameHandle = requestAnimationFrame(this.onFrame));
	}
	onFrame(e) {
		this.frameHandle = null;
		let t = this.lastTime === 0 ? 0 : Math.min((e - this.lastTime) / 1e3, .1);
		this.lastTime = e;
		let n = !1;
		for (let r of this.contexts) try {
			n = r.frame(e, t) || n;
		} catch (e) {
			console.error("Error rendering <model>", e);
		}
		n ? this.request() : this.lastTime = 0;
	}
}, D;
function fe() {
	return D ??= new de(), D;
}
//#endregion
//#region src/transform.js
var O = new o(), k = new o(), A = new c(), j = new c(), M = new s(), N = new n(0, 0, 0, "YXZ");
function P() {
	return new DOMMatrix();
}
function F(e) {
	return new DOMMatrix(e.toFloat64Array());
}
function pe(e, t, n = !1) {
	let r = e.getBoundingClientRect(), i = r.width / y, a = r.height / y;
	if (n) {
		let e = t.length();
		return e > 0 ? Math.min(i, a) / e : 1;
	}
	let o = t.x > 0 ? i / t.x : Infinity, s = t.y > 0 ? a / t.y : Infinity, c = Math.min(o, s);
	return Number.isFinite(c) ? c : 1;
}
function me({ center: e, size: t, scale: n, yaw: r = 0, pitch: i = 0, orbit: a = !1 }) {
	let o = a ? t.length() / 2 : t.z / 2, s = -n * o;
	return N.set(i, r, 0, "YXZ"), M.setFromEuler(N), A.set(0, 0, s), j.setScalar(n), O.compose(A, M, j), k.makeTranslation(-e.x, -e.y, -e.z), O.multiply(k), new DOMMatrix(O.elements);
}
function he(e, t) {
	O.fromArray(e.toFloat64Array()), O.decompose(t.position, t.quaternion, t.scale), t.updateMatrixWorld(!0);
}
//#endregion
//#region src/render-context.js
var ge = class {
	constructor(e, t = {}) {
		this.element = e, this.cameraDistance = t.cameraDistance ?? .3, this.maxPixelRatio = t.maxPixelRatio ?? 2, this.onAnimationFrame = t.onAnimationFrame ?? (() => !1), this.onEntityTransformChange = t.onEntityTransformChange ?? (() => {}), this.onFirstRender = t.onFirstRender ?? (() => {}), this.scheduler = fe(), this.renderer = null, this.scene = null, this.camera = null, this.canvas = null, this.modelRoot = null, this.pivot = null, this.center = new h(), this.size = new h(), this.entityTransform = P(), this.environmentTexture = null, this.environmentVersion = 0, this.orbit = null, this.stageMode = "none", this.userTransform = !1, this.initialized = !1, this.disposed = !1, this.dirty = !0, this.forceRender = !1, this.waitingForFirstRender = !1, this.isVisible = typeof IntersectionObserver > "u", this.resizeObserver = null, this.intersectionObserver = null;
	}
	async init() {
		if (this.initialized) return this;
		this.canvas = document.createElement("canvas"), this.canvas.className = b, this.canvas.dataset.modelInternal = "", this.canvas.setAttribute("aria-hidden", "true"), this.element.appendChild(this.canvas), this.scene = new re(), this.camera = new te(30, 1, .005, 1e3), this.camera.position.set(0, 0, this.cameraDistance);
		let e = new ee(16777215, 2830400, 2.2), t = new f(16777215, 3.5), n = new f(10337791, 1.8), r = new f(16766896, 1.4);
		return t.position.set(2, 3, 4), n.position.set(-4, 1, 2), r.position.set(1, -3, -2), this.scene.add(e, t, n, r), this.modelRoot = new m(), this.pivot = new m(), this.modelRoot.add(this.pivot), this.scene.add(this.modelRoot), this.renderer = new ie({
			alpha: !0,
			antialias: !0,
			canvas: this.canvas
		}), this.renderer.outputColorSpace = ne, this.renderer.toneMapping = d, this.renderer.toneMappingExposure = 1.15, this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, this.maxPixelRatio)), this.resize(), await this.renderer.init(), this.disposed ? (this.renderer.dispose(), this) : (this.element.dataset.modelRenderer = this.renderer.backend?.isWebGPUBackend ? "webgpu" : "webgl2", this.orbit = new ue(this.element, this.canvas, () => {
			this.applyDefaultTransform(), this.invalidate();
		}), this.setStageMode(this.stageMode), typeof ResizeObserver < "u" && (this.resizeObserver = new ResizeObserver(() => this.resize()), this.resizeObserver.observe(this.element)), typeof IntersectionObserver < "u" && (this.intersectionObserver = new IntersectionObserver((e) => {
			let t = e[e.length - 1];
			this.isVisible = !!t?.isIntersecting, this.isVisible && this.invalidate();
		}), this.intersectionObserver.observe(this.element)), this.initialized = !0, this.scheduler.add(this), this.invalidate(), this);
	}
	resize() {
		if (!this.canvas || !this.camera || !this.renderer) return;
		let e = this.element.getBoundingClientRect(), t = Math.max(Math.round(e.width), 1), n = Math.max(Math.round(e.height), 1), r = n / y;
		this.renderer.setSize(t, n, !1), this.camera.aspect = t / n, this.camera.fov = 2 * Math.atan(r / (2 * this.cameraDistance)) * (180 / Math.PI), this.camera.updateProjectionMatrix(), this.pivot?.children.length && (!this.userTransform || this.stageMode === "orbit") && this.applyDefaultTransform(), this.invalidate();
	}
	setModel(e, t, n) {
		this.clearModel(), this.pivot.add(e), this.center.copy(t), this.size.copy(n), this.userTransform = !1, this.orbit?.reset(), this.applyDefaultTransform(), this.waitingForFirstRender = !0, this.forceRender = !0, this.invalidate();
	}
	clearModel() {
		if (this.pivot) for (; this.pivot.children.length;) this.pivot.remove(this.pivot.children[0]);
	}
	applyDefaultTransform() {
		if (!this.pivot || !this.pivot.children.length) return;
		let e = this.stageMode === "orbit", t = pe(this.element, this.size, e), n = e ? this.orbit?.zoom ?? 1 : 1, r = me({
			center: this.center,
			orbit: e,
			pitch: e ? this.orbit?.pitch ?? 0 : 0,
			scale: t * n,
			size: this.size,
			yaw: e ? this.orbit?.yaw ?? 0 : 0
		});
		this.setEntityTransform(r, !1);
	}
	setEntityTransform(e, t = !0) {
		this.pivot && (this.entityTransform = F(e), this.userTransform = t, he(this.entityTransform, this.pivot), this.onEntityTransformChange(F(this.entityTransform)), this.invalidate());
	}
	getEntityTransform() {
		return F(this.entityTransform);
	}
	setStageMode(e) {
		this.stageMode = e === "orbit" ? "orbit" : "none", this.orbit && (this.stageMode === "orbit" ? this.orbit.enable() : this.orbit.disable(), this.pivot?.children.length && (this.userTransform = !1, this.applyDefaultTransform()));
	}
	async setEnvironmentMap(e) {
		let t = ++this.environmentVersion;
		if (this.environmentTexture?.dispose(), this.environmentTexture = null, this.scene && (this.scene.environment = null), !e) {
			this.invalidate();
			return;
		}
		let n = new URL(e, this.element.ownerDocument.baseURI).href;
		try {
			let e = await new ae().loadAsync(n);
			if (this.disposed || t !== this.environmentVersion) {
				e.dispose();
				return;
			}
			e.mapping = p, this.environmentTexture = e, this.scene.environment = e, this.element.dispatchEvent(new Event("iblload")), this.invalidate();
		} catch (e) {
			if (t !== this.environmentVersion) return;
			this.element.dispatchEvent(new CustomEvent("error", { detail: e }));
		}
	}
	invalidate() {
		this.dirty = !0, this.scheduler.request();
	}
	frame(e, t) {
		if (this.disposed || !this.initialized || !this.isVisible && !this.forceRender) return !1;
		let n = this.onAnimationFrame(t), r = this.orbit?.tick(t) ?? !1;
		return (n || r) && (this.dirty = !0), this.dirty && (this.renderer.render(this.scene, this.camera), this.dirty = !1, this.forceRender = !1, this.waitingForFirstRender && (this.waitingForFirstRender = !1, this.onFirstRender())), this.isVisible && (n || r);
	}
	dispose() {
		this.disposed || (this.disposed = !0, this.scheduler.remove(this), this.resizeObserver?.disconnect(), this.intersectionObserver?.disconnect(), this.orbit?.dispose(), this.environmentTexture?.dispose(), this.renderer?.dispose(), this.canvas?.remove(), delete this.element.dataset.modelRenderer, this.clearModel(), this.renderer = null, this.scene = null, this.camera = null, this.canvas = null);
	}
}, _e = /* @__PURE__ */ new Map([
	["model/gltf", "model/gltf+json"],
	["model/usd", "model/vnd.usd"],
	["model/usdz", "model/vnd.usdz+zip"]
]), ve = /* @__PURE__ */ new Map([
	[".glb", "model/gltf-binary"],
	[".gltf", "model/gltf+json"],
	[".usd", "model/vnd.usd"],
	[".usda", "model/vnd.usd"],
	[".usdc", "model/vnd.usd"],
	[".usdz", "model/vnd.usdz+zip"]
]), ye = new Set(_);
function I(e = "") {
	let t = e.split(";", 1)[0].trim().toLowerCase();
	return _e.get(t) ?? t;
}
function L(e, t = "") {
	let n = I(t);
	if (n) return n;
	let r = String(e);
	try {
		r = new URL(e, globalThis.document?.baseURI).pathname;
	} catch {}
	let i = r.toLowerCase();
	for (let [e, t] of ve) if (i.endsWith(e)) return t;
	return "";
}
function R(e) {
	return ye.has(I(e));
}
function be(e) {
	let t = e.getAttribute("media");
	return !t || typeof globalThis.matchMedia != "function" || globalThis.matchMedia(t).matches;
}
function z(e, t, n, r) {
	return {
		src: new URL(e, r).href,
		type: L(e, t),
		source: n
	};
}
function B(e) {
	let t = e.ownerDocument?.baseURI ?? globalThis.document?.baseURI, n = [], r = e.getAttribute("src");
	if (r) {
		let i = z(r, e.getAttribute("type") ?? "", e, t);
		R(i.type) && n.push(i);
	}
	for (let r of e.querySelectorAll(":scope > source")) {
		let e = r.getAttribute("src");
		if (!e || !be(r)) continue;
		let i = z(e, r.getAttribute("type") ?? "", r, t);
		R(i.type) && n.push(i);
	}
	return n;
}
//#endregion
//#region src/model-element.js
var V = /* @__PURE__ */ new WeakMap(), H = new Set(v);
function U(e = 0, t = 0, n = 0, r = 1) {
	return new DOMPointReadOnly(e, t, n, r);
}
function W(e) {
	if (typeof DOMException < "u") return new DOMException(e, "AbortError");
	let t = Error(e);
	return t.name = "AbortError", t;
}
function xe(e, t) {
	return {
		boundingBoxCenter: U(),
		boundingBoxExtents: U(0, 0, 0, 0),
		complete: !0,
		connected: !1,
		context: null,
		contextGeneration: 0,
		contextPromise: null,
		currentAction: null,
		currentSrc: "",
		duration: 0,
		element: e,
		ended: !1,
		entityTransform: P(),
		finishedHandler: null,
		ignoredAttributeMutations: /* @__PURE__ */ new Map(),
		loadGeneration: 0,
		loadQueued: !1,
		mixer: null,
		model: null,
		mutationObserver: null,
		options: t,
		ownsAriaLabel: !1,
		ownsRole: !1,
		paused: !0,
		pendingRenderGeneration: 0,
		playbackRate: 1,
		ready: Promise.resolve(e),
		readyReject: null,
		readyResolve: null,
		readyState: g.EMPTY
	};
}
function Se(e) {
	return V.get(e);
}
function Ce(e, t) {
	e.ignoredAttributeMutations.set(t, (e.ignoredAttributeMutations.get(t) ?? 0) + 1);
}
function we(e, t) {
	let n = e.ignoredAttributeMutations.get(t) ?? 0;
	return n !== 0 && (n === 1 ? e.ignoredAttributeMutations.delete(t) : e.ignoredAttributeMutations.set(t, n - 1), !0);
}
function Te(e) {
	e.readyReject?.(W("The model source changed before loading completed.")), e.readyState = g.LOADING, e.complete = !1, e.element.removeAttribute(S), e.ready = new Promise((t, n) => {
		e.readyResolve = t, e.readyReject = n;
	}), e.ready.catch(() => {});
}
function Ee(e) {
	e.readyState = g.COMPLETE, e.complete = !0, e.element.setAttribute(S, ""), e.readyResolve?.(e.element), e.readyResolve = null, e.readyReject = null;
}
function De(e, t) {
	e.readyState = g.EMPTY, e.complete = !0, e.readyReject?.(t), e.readyResolve = null, e.readyReject = null;
}
function Oe(e) {
	let t = V.get(e), n = e.getAttribute("alt");
	n && (!e.hasAttribute("aria-label") || t?.ownsAriaLabel) ? (e.setAttribute("aria-label", n), t && (t.ownsAriaLabel = !0)) : !n && t?.ownsAriaLabel && (e.removeAttribute("aria-label"), t.ownsAriaLabel = !1), n && (!e.hasAttribute("role") || t?.ownsRole) ? (e.setAttribute("role", "img"), t && (t.ownsRole = !0)) : !n && t?.ownsRole && (e.removeAttribute("role"), t.ownsRole = !1);
}
function ke(e) {
	let t = Number(e.getAttribute("width")), n = Number(e.getAttribute("height"));
	Number.isFinite(t) && t > 0 ? e.style.setProperty("--model-element-width", `${t}px`) : e.style.removeProperty("--model-element-width"), Number.isFinite(n) && n > 0 ? e.style.setProperty("--model-element-height", `${n}px`) : e.style.removeProperty("--model-element-height"), V.get(e)?.context?.resize();
}
function G(e) {
	e.currentAction && (e.element.hasAttribute("loop") ? (e.currentAction.setLoop(i, Infinity), e.currentAction.clampWhenFinished = !1) : (e.currentAction.setLoop(r, 1), e.currentAction.clampWhenFinished = !0));
}
function Ae(e) {
	e.mixer && e.finishedHandler && e.mixer.removeEventListener("finished", e.finishedHandler), e.mixer?.stopAllAction(), e.mixer = null, e.currentAction = null, e.finishedHandler = null, e.duration = 0, e.ended = !1, e.paused = !0;
}
function je(t, n) {
	if (Ae(t), !n.length || !t.model) return;
	let r = n[0];
	t.mixer = new e(t.model), t.currentAction = t.mixer.clipAction(r), t.duration = r.duration, t.ended = !1, t.currentAction.timeScale = t.playbackRate, t.currentAction.paused = !0, t.currentAction.play(), G(t), t.finishedHandler = () => {
		t.element.hasAttribute("loop") || (t.ended = !0, t.paused = !0, t.element.dispatchEvent(new Event("ended")));
	}, t.mixer.addEventListener("finished", t.finishedHandler), t.element.hasAttribute("autoplay") && Z(t.element);
}
function Me(e) {
	Ae(e), e.context?.clearModel(), C(e.model), e.model = null, e.currentSrc = "", e.boundingBoxCenter = U(), e.boundingBoxExtents = U(0, 0, 0, 0);
}
async function Ne(e) {
	if (e.context) return e.context;
	if (e.contextPromise) return e.contextPromise;
	let t = new ge(e.element, {
		cameraDistance: e.options.cameraDistance,
		maxPixelRatio: e.options.maxPixelRatio,
		onAnimationFrame: (t) => !e.mixer || e.paused || e.playbackRate === 0 ? !1 : (e.mixer.update(t), !e.paused && e.playbackRate !== 0),
		onEntityTransformChange: (t) => {
			e.entityTransform = t;
		},
		onFirstRender: () => {
			e.pendingRenderGeneration === e.loadGeneration && Ee(e);
		}
	});
	t.stageMode = X(e.element);
	let n = ++e.contextGeneration, r = t.init().then(() => {
		if (!e.connected || n !== e.contextGeneration) throw t.dispose(), W("The model element was disconnected.");
		e.context = t, e.contextPromise === r && (e.contextPromise = null), t.setStageMode(X(e.element));
		let i = e.element.getAttribute("environmentmap");
		return i && t.setEnvironmentMap(i), t;
	}).catch((n) => {
		throw e.contextPromise === r && (e.contextPromise = null), t.dispose(), n;
	});
	return e.contextPromise = r, r;
}
async function Pe(e, n) {
	let r = V.get(e);
	if (!r || !r.connected || n !== r.loadGeneration) return;
	let i = B(e);
	if (Me(r), i.length === 0) {
		r.readyState = g.EMPTY, r.complete = !0, r.readyResolve?.(e), r.readyResolve = null, r.readyReject = null;
		return;
	}
	r.currentSrc = i[0].src, e.dispatchEvent(new Event("loadstart"));
	let a = null;
	try {
		if (a = await ce(i, {
			isStale: () => n !== r.loadGeneration || !r.connected,
			onProgress: (t) => e.dispatchEvent(new CustomEvent("progress", { detail: t }))
		}), !a || n !== r.loadGeneration || !r.connected) return;
		let o = await Ne(r);
		if (n !== r.loadGeneration || !r.connected) {
			C(a.object);
			return;
		}
		let s = new t().setFromObject(a.object), l = s.getCenter(new c()), u = s.getSize(new c());
		r.model = a.object, r.currentSrc = a.candidate.src, r.boundingBoxCenter = U(l.x, l.y, l.z, 1), r.boundingBoxExtents = U(u.x, u.y, u.z, 0), je(r, a.animations), r.pendingRenderGeneration = n, o.setStageMode(X(e)), o.setModel(a.object, l, u), e.dispatchEvent(new Event("load"));
	} catch (t) {
		if (a?.object && r.model !== a.object && C(a.object), n !== r.loadGeneration || !r.connected || t?.name === "AbortError") return;
		De(r, t), e.dispatchEvent(new CustomEvent("error", { detail: t }));
	}
}
function K(e) {
	let t = V.get(e);
	if (!t?.connected) return Promise.resolve(e);
	t.loadGeneration += 1;
	let n = t.loadGeneration;
	return Te(t), t.loadQueued || (t.loadQueued = !0, queueMicrotask(() => {
		t.loadQueued = !1, Pe(e, t.loadGeneration);
	})), t.pendingRenderGeneration = n, t.ready;
}
function q(e, t, n, r) {
	if (n === r) return;
	let i = V.get(e);
	if (i) switch (t) {
		case "alt":
			Oe(e);
			break;
		case "autoplay":
			r !== null && i.currentAction && i.paused && Z(e);
			break;
		case "environmentmap":
			i.context?.setEnvironmentMap(r || "");
			break;
		case "height":
		case "width":
			ke(e);
			break;
		case "loop":
			G(i);
			break;
		case "src":
			K(e);
			break;
		case "stagemode": i.context?.setStageMode(X(e));
	}
}
function Fe(e, t) {
	t.mutationObserver = new MutationObserver((n) => {
		let r = !1;
		for (let i of n) if (i.type === "attributes") {
			let n = i.attributeName;
			if (i.target === e) {
				if (we(t, n)) continue;
				H.has(n) && q(e, n, i.oldValue, e.getAttribute(n));
			} else i.target.nodeName === "SOURCE" && (r = !0);
		} else i.type === "childList" && [...i.addedNodes, ...i.removedNodes].some((e) => e.nodeType === 1 && e.nodeName === "SOURCE") && (r = !0);
		r && K(e);
	}), t.mutationObserver.observe(e, {
		attributeFilter: [
			...v,
			"media",
			"type"
		],
		attributeOldValue: !0,
		attributes: !0,
		childList: !0,
		subtree: !0
	});
}
function J(e) {
	let t = V.get(e);
	if (!(!t || t.connected)) {
		t.connected = !0, e.setAttribute(x, ""), ke(e), Oe(e), Fe(e, t);
		for (let t of v) {
			let n = e.getAttribute(t);
			n !== null && t !== "src" && q(e, t, null, n);
		}
		B(e).length && K(e);
	}
}
function Y(e) {
	let t = V.get(e);
	t?.connected && (t.connected = !1, t.loadGeneration += 1, t.mutationObserver?.disconnect(), t.mutationObserver = null, t.readyReject?.(W("The model element was disconnected.")), t.readyResolve = null, t.readyReject = null, Me(t), t.context?.dispose(), t.context = null, t.contextGeneration += 1, t.contextPromise = null, t.readyState = g.EMPTY, t.complete = !0, e.removeAttribute(S));
}
function Ie(e, t) {
	for (let n of Object.getOwnPropertyNames(t.prototype)) n !== "constructor" && n !== "connectedCallback" && n !== "disconnectedCallback" && Object.defineProperty(e, n, Object.getOwnPropertyDescriptor(t.prototype, n));
}
function Le(e, t, n) {
	if (V.has(e)) return J(e), e;
	try {
		Object.setPrototypeOf(e, t.prototype);
	} catch {
		Ie(e, t);
	}
	return V.set(e, xe(e, n)), J(e), e;
}
function X(e) {
	return e.getAttribute("stagemode") === "orbit" ? "orbit" : "none";
}
function Z(e) {
	let t = V.get(e);
	return !t?.currentAction || !t.paused ? Promise.resolve() : (t.ended &&= (t.currentAction.reset(), t.currentAction.timeScale = t.playbackRate, G(t), !1), t.paused = !1, t.currentAction.paused = !1, t.context?.invalidate(), e.dispatchEvent(new Event("play")), e.dispatchEvent(new Event("playing")), Promise.resolve());
}
function Re(e) {
	let t = V.get(e);
	!t?.currentAction || t.paused || (t.paused = !0, t.currentAction.paused = !0, e.dispatchEvent(new Event("pause")));
}
function ze(e, t) {
	return class extends e.HTMLElement {
		connectedCallback() {
			Le(this, this.constructor, t);
		}
		disconnectedCallback() {
			Y(this);
		}
		setAttribute(e, t) {
			let n = String(e).toLowerCase(), r = V.get(this), i = this.getAttribute(n);
			r && H.has(n) && Ce(r, n), super.setAttribute(e, t), r && H.has(n) && q(this, n, i, String(t));
		}
		removeAttribute(e) {
			let t = String(e).toLowerCase(), n = V.get(this), r = this.getAttribute(t);
			n && H.has(t) && Ce(n, t), super.removeAttribute(e), n && H.has(t) && q(this, t, r, null);
		}
		get alt() {
			return this.getAttribute("alt") ?? "";
		}
		set alt(e) {
			this.setAttribute("alt", e ?? "");
		}
		get autoplay() {
			return this.hasAttribute("autoplay");
		}
		set autoplay(e) {
			e ? this.setAttribute("autoplay", "") : this.removeAttribute("autoplay");
		}
		get boundingBoxCenter() {
			return V.get(this)?.boundingBoxCenter ?? U();
		}
		get boundingBoxExtents() {
			return V.get(this)?.boundingBoxExtents ?? U(0, 0, 0, 0);
		}
		get complete() {
			return V.get(this)?.complete ?? !0;
		}
		get currentSrc() {
			return V.get(this)?.currentSrc ?? "";
		}
		get currentTime() {
			return V.get(this)?.currentAction?.time ?? 0;
		}
		set currentTime(e) {
			let t = V.get(this), n = Number(e);
			!t?.currentAction || !Number.isFinite(n) || (t.currentAction.time = Math.min(Math.max(n, 0), t.duration), t.ended = t.currentAction.time >= t.duration, t.mixer.update(0), t.context?.invalidate(), this.dispatchEvent(new Event("timeupdate")));
		}
		get duration() {
			return V.get(this)?.duration ?? 0;
		}
		get entityTransform() {
			return V.get(this)?.context?.getEntityTransform() ?? F(V.get(this)?.entityTransform ?? P());
		}
		set entityTransform(e) {
			let t = V.get(this);
			!t?.context || X(this) === "orbit" || (e instanceof DOMMatrix || e instanceof DOMMatrixReadOnly) && t.context.setEntityTransform(e, !0);
		}
		get environmentMap() {
			return this.getAttribute("environmentmap") ?? "";
		}
		set environmentMap(e) {
			e ? this.setAttribute("environmentmap", e) : this.removeAttribute("environmentmap");
		}
		get height() {
			return Number(this.getAttribute("height")) || 0;
		}
		set height(e) {
			this.setAttribute("height", String(e));
		}
		get loop() {
			return this.hasAttribute("loop");
		}
		set loop(e) {
			e ? this.setAttribute("loop", "") : this.removeAttribute("loop");
		}
		get paused() {
			return V.get(this)?.paused ?? !0;
		}
		get playbackRate() {
			return V.get(this)?.playbackRate ?? 1;
		}
		set playbackRate(e) {
			let t = V.get(this), n = Number(e);
			!t || !Number.isFinite(n) || (t.playbackRate = n, t.currentAction && (t.currentAction.timeScale = n), t.context?.invalidate(), this.dispatchEvent(new Event("ratechange")));
		}
		get ready() {
			return V.get(this)?.ready ?? Promise.resolve(this);
		}
		get readyState() {
			return V.get(this)?.readyState ?? g.EMPTY;
		}
		get src() {
			return this.getAttribute("src") ?? this.querySelector(":scope > source")?.getAttribute("src") ?? "";
		}
		set src(e) {
			e ? this.setAttribute("src", e) : this.removeAttribute("src");
		}
		get stageMode() {
			return X(this);
		}
		set stageMode(e) {
			e === "orbit" ? this.setAttribute("stagemode", "orbit") : this.removeAttribute("stagemode");
		}
		get width() {
			return Number(this.getAttribute("width")) || 0;
		}
		set width(e) {
			this.setAttribute("width", String(e));
		}
		canPlayType(e) {
			return R(I(e)) ? "probably" : "";
		}
		load() {
			return K(this);
		}
		pause() {
			Re(this);
		}
		play() {
			return Z(this);
		}
	};
}
//#endregion
//#region src/styles.js
var Be = "model-element-webgpu-polyfill-styles";
function Ve(e = document) {
	if (e.getElementById(Be)) return;
	let t = e.createElement("style");
	t.id = Be, t.textContent = `
    :where(model),
    :where(model-polyfill) {
      display: inline-block;
      width: var(--model-element-width, 300px);
      height: var(--model-element-height, 150px);
      vertical-align: middle;
    }

    :where(model[${x}]),
    :where(model-polyfill[${x}]) {
      contain: layout paint style;
      overflow: hidden;
    }

    :where(model[${x}]) > source,
    :where(model-polyfill[${x}]) > source {
      display: none !important;
    }

    :where(model[${S}]) > :not(source):not([data-model-internal]),
    :where(model-polyfill[${S}]) > :not(source):not([data-model-internal]) {
      display: none !important;
    }

    :where(.${b}) {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
    }
  `, e.head.appendChild(t);
}
//#endregion
//#region src/install.js
var Q = Symbol.for("model-element-webgpu-polyfill.installation");
function He(e) {
	return {
		cameraDistance: e.cameraDistance,
		force: !!e.force,
		maxPixelRatio: e.maxPixelRatio
	};
}
function $(e = {}) {
	if (typeof window > "u" || typeof document > "u") return null;
	if (window[Q]) return window[Q];
	let t = He(e), n = Object.getOwnPropertyDescriptor(window, "HTMLModelElement"), r = window.HTMLModelElement, i = "HTMLModelElement" in window && r?.isPolyfill !== !0, a = ze(window, t), o = /* @__PURE__ */ new Set(), s = t.force || !i;
	Object.defineProperty(a, "isPolyfill", { value: !0 }), Ve(document), customElements.get("model-polyfill") || customElements.define("model-polyfill", a);
	function c(e) {
		if (!(e instanceof window.HTMLElement)) return e;
		let n = Le(e, a, t);
		return o.add(n), n;
	}
	if (s && !i) try {
		Object.defineProperty(window, "HTMLModelElement", {
			configurable: !0,
			value: a,
			writable: !0
		});
	} catch {
		window.HTMLModelElement = a;
	}
	s && document.querySelectorAll("model").forEach(c);
	let l = s ? new MutationObserver((e) => {
		for (let t of e) {
			for (let e of t.addedNodes) e.nodeType === 1 && (e.nodeName === "MODEL" ? c(e) : e.nodeName === "MODEL-POLYFILL" && J(e), e.querySelectorAll?.("model").forEach(c));
			for (let e of t.removedNodes) e.nodeType === 1 && (!e.isConnected && (e.nodeName === "MODEL" || e.nodeName === "MODEL-POLYFILL") && Y(e), e.querySelectorAll?.("model, model-polyfill").forEach((e) => {
				e.isConnected || Y(e);
			}));
		}
	}) : null;
	l?.observe(document.documentElement, {
		childList: !0,
		subtree: !0
	});
	let u = window.Document.prototype.createElement, d = window.Document.prototype.createElementNS;
	function f(e, t) {
		let n = u.call(this, e, t);
		return s && String(e).toLowerCase() === "model" && c(n), n;
	}
	function p(e, t, n) {
		let r = d.call(this, e, t, n);
		return s && (!e || e === "http://www.w3.org/1999/xhtml") && String(t).toLowerCase() === "model" && c(r), r;
	}
	s && (window.Document.prototype.createElement = f, window.Document.prototype.createElementNS = p);
	let m = {
		HTMLModelElement: a,
		hasNativeSupport: i,
		upgrade: c,
		disconnect() {
			l?.disconnect();
			for (let e of o) Y(e);
			o.clear(), window.Document.prototype.createElement === f && (window.Document.prototype.createElement = u), window.Document.prototype.createElementNS === p && (window.Document.prototype.createElementNS = d), !i && window.HTMLModelElement === a && (n ? Object.defineProperty(window, "HTMLModelElement", n) : delete window.HTMLModelElement), delete window[Q];
		}
	};
	return window[Q] = m, m;
}
function Ue() {
	return typeof window > "u" ? null : window[Q] ?? null;
}
//#endregion
//#region src/index.js
typeof window < "u" && typeof document < "u" && $();
//#endregion
export { g as MODEL_READY_STATE, _ as SUPPORTED_MODEL_TYPES, B as collectModelSources, Ue as getModelPolyfillInstallation, Se as getModelState, L as inferModelType, $ as installModelPolyfill, R as isSupportedModelType, I as normalizeModelType };

//# sourceMappingURL=model-element-polyfill.js.map