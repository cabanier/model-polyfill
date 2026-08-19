import { AnimationMixer as e, Box3 as t, Euler as n, LoopOnce as r, LoopRepeat as i, MathUtils as a, Matrix4 as o, Quaternion as s, Vector3 as c } from "three";
import { GLTFLoader as l } from "three/addons/loaders/GLTFLoader.js";
import { USDLoader as u } from "three/addons/loaders/USDLoader.js";
import { ACESFilmicToneMapping as d, DirectionalLight as f, EquirectangularReflectionMapping as p, Group as m, HemisphereLight as h, Matrix4 as g, PerspectiveCamera as _, SRGBColorSpace as ee, Scene as te, Vector3 as v, Vector4 as y, WebGPURenderer as ne } from "three/webgpu";
import { HDRLoader as re } from "three/addons/loaders/HDRLoader.js";
//#region src/constants.js
var b = Object.freeze({
	EMPTY: 0,
	LOADING: 1,
	COMPLETE: 2
}), ie = Object.freeze([
	"model/gltf-binary",
	"model/gltf+json",
	"model/vnd.usdz+zip",
	"model/vnd.usd"
]), x = Object.freeze([
	"alt",
	"autoplay",
	"environmentmap",
	"height",
	"loop",
	"src",
	"stagemode",
	"width"
]), S = 96 / .0254, ae = .3, C = "model-element-polyfill__canvas", w = "data-model-polyfilled", T = "data-model-ready";
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
			return t.isStale?.() ? (E(e.object), null) : e;
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
function E(e) {
	e && e.traverse?.((e) => {
		e.geometry?.dispose?.(), e.skeleton?.dispose?.(), Array.isArray(e.material) ? e.material.forEach(le) : e.material && le(e.material);
	});
}
//#endregion
//#region src/orbit-controller.js
var D = .25, O = 4, k = Math.PI * .49, ue = class {
	constructor(e, t, n) {
		this.element = e, this.canvas = t, this.onChange = n, this.enabled = !1, this.pointers = /* @__PURE__ */ new Map(), this.lastPinchDistance = 0, this.yaw = 0, this.pitch = 0, this.zoom = 1, this.yawVelocity = 0, this.pitchVelocity = 0, this.addedTabIndex = !1, this.onPointerDown = this.onPointerDown.bind(this), this.onPointerMove = this.onPointerMove.bind(this), this.onPointerUp = this.onPointerUp.bind(this), this.onWheel = this.onWheel.bind(this), this.onKeyDown = this.onKeyDown.bind(this);
	}
	enable() {
		this.enabled || (this.enabled = !0, this.attachCanvas(), this.element.addEventListener("keydown", this.onKeyDown), this.element.hasAttribute("tabindex") || (this.element.tabIndex = 0, this.addedTabIndex = !0), this.element.hasAttribute("aria-roledescription") || this.element.setAttribute("aria-roledescription", "interactive 3D model"));
	}
	attachCanvas() {
		this.canvas.addEventListener("pointerdown", this.onPointerDown), this.canvas.addEventListener("pointermove", this.onPointerMove), this.canvas.addEventListener("pointerup", this.onPointerUp), this.canvas.addEventListener("pointercancel", this.onPointerUp), this.canvas.addEventListener("wheel", this.onWheel, { passive: !1 }), this.canvas.style.cursor = "grab", this.canvas.style.touchAction = "none";
	}
	detachCanvas() {
		this.canvas.removeEventListener("pointerdown", this.onPointerDown), this.canvas.removeEventListener("pointermove", this.onPointerMove), this.canvas.removeEventListener("pointerup", this.onPointerUp), this.canvas.removeEventListener("pointercancel", this.onPointerUp), this.canvas.removeEventListener("wheel", this.onWheel), this.canvas.style.cursor = "", this.canvas.style.touchAction = "";
	}
	setCanvas(e) {
		!e || e === this.canvas || (this.enabled && this.detachCanvas(), this.pointers.clear(), this.lastPinchDistance = 0, this.canvas = e, this.enabled && this.attachCanvas());
	}
	disable() {
		this.enabled && (this.enabled = !1, this.pointers.clear(), this.lastPinchDistance = 0, this.yawVelocity = 0, this.pitchVelocity = 0, this.detachCanvas(), this.element.removeEventListener("keydown", this.onKeyDown), this.addedTabIndex &&= (this.element.removeAttribute("tabindex"), !1));
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
			this.lastPinchDistance > 0 && (this.zoom = a.clamp(this.zoom * (n / this.lastPinchDistance), D, O), this.onChange()), this.lastPinchDistance = n;
			return;
		}
		let s = .006;
		this.yaw += i * s, this.pitch = a.clamp(this.pitch + o * s, -k, k), this.yawVelocity = i * s / r, this.pitchVelocity = o * s / r, this.onChange();
	}
	onPointerUp(e) {
		this.pointers.delete(e.pointerId), this.lastPinchDistance = 0, this.canvas.releasePointerCapture?.(e.pointerId), this.pointers.size === 0 && (this.canvas.style.cursor = "grab", this.onChange());
	}
	onWheel(e) {
		e.preventDefault(), this.zoom = a.clamp(this.zoom * Math.exp(-e.deltaY * .001), D, O), this.onChange();
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
				this.pitch = a.clamp(this.pitch - t, -k, k);
				break;
			case "ArrowDown":
				this.pitch = a.clamp(this.pitch + t, -k, k);
				break;
			case "+":
			case "=":
				this.zoom = a.clamp(this.zoom * 1.1, D, O);
				break;
			case "-":
			case "_":
				this.zoom = a.clamp(this.zoom / 1.1, D, O);
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
		this.yaw += this.yawVelocity * e, this.pitch = a.clamp(this.pitch + this.pitchVelocity * e, -k, k);
		let t = .015 ** e;
		return this.yawVelocity *= t, this.pitchVelocity *= t, this.onChange(), !0;
	}
}, de = /* @__PURE__ */ new Set([
	"auto",
	"clip",
	"hidden",
	"scroll"
]);
function A(e, t, n = t) {
	return (e.getPropertyValue?.(t) || e[n] || "").trim();
}
function j(e, t = "none") {
	return !!(e && e !== t);
}
function fe(...e) {
	return e.find((e) => j(e)) || "";
}
function pe(e) {
	return [
		A(e, "border-radius", "borderRadius"),
		"border-top-left-radius",
		"border-top-right-radius",
		"border-bottom-right-radius",
		"border-bottom-left-radius"
	].map((t) => t.includes("-radius") ? A(e, t) : t).some((e) => {
		if (!e) return !1;
		let t = e.match(/-?(?:\d*\.)?\d+/g);
		return t ? t.some((e) => Number(e) !== 0) : e !== "none";
	});
}
function me(e) {
	let t = e.localName || e.nodeName?.toLowerCase() || "element";
	return e.id ? `${t}#${e.id}` : e.classList?.length ? `${t}.${[...e.classList].slice(0, 2).join(".")}` : `<${t}>`;
}
function M(e, t, n, r, i, a) {
	e.push({
		code: n,
		description: a,
		element: t,
		elementLabel: me(t),
		property: r,
		value: i
	});
}
function he(e) {
	let t = e.ownerDocument?.defaultView ?? globalThis.window;
	if (!t?.getComputedStyle) return [];
	let n = [];
	for (let r = e; r; r = r.parentElement) {
		let e = t.getComputedStyle(r), i = fe(A(e, "backdrop-filter", "backdropFilter"), A(e, "-webkit-backdrop-filter", "webkitBackdropFilter"));
		j(i) && M(n, r, "backdrop-filter", "backdrop-filter", i, "a backdrop filter requires an intermediate render surface");
		let a = A(e, "filter");
		j(a) && M(n, r, "filter", "filter", a, "a CSS filter requires an intermediate render surface");
		let o = A(e, "clip-path", "clipPath");
		j(o) && M(n, r, "clip-path", "clip-path", o, "a clip path prevents direct canvas promotion");
		let s = fe(A(e, "mask-image", "maskImage"), A(e, "-webkit-mask-image", "webkitMaskImage"));
		j(s) && M(n, r, "mask-image", "mask-image", s, "a CSS mask prevents direct canvas promotion");
		let c = A(e, "mix-blend-mode", "mixBlendMode");
		c && c !== "normal" && M(n, r, "mix-blend-mode", "mix-blend-mode", c, "blending with page content requires an intermediate render surface");
		let l = Number.parseFloat(A(e, "opacity"));
		Number.isFinite(l) && l < 1 && M(n, r, "opacity", "opacity", String(l), "group opacity requires the subtree to be flattened before compositing");
		let u = A(e, "overflow").split(/\s+/), d = A(e, "overflow-x", "overflowX") || u[0], f = A(e, "overflow-y", "overflowY") || u[1] || u[0];
		(de.has(d) || de.has(f)) && pe(e) && M(n, r, "rounded-overflow-clip", "overflow / border-radius", `${d} ${f} / rounded corners`, "rounded overflow clipping requires an intermediate render surface");
	}
	return n;
}
function ge(e) {
	let t = e.slice(0, 2).map((e) => `${e.property}: ${e.value} on ${e.elementLabel}`), n = e.length - t.length, r = n > 0 ? `, plus ${n} more` : "";
	return `Stereo disabled because CSS prevents direct canvas presentation (${t.join("; ")}${r}). Showing mono.`;
}
//#endregion
//#region src/inline-stereo.js
var _e = /* @__PURE__ */ new WeakMap(), ve = .01;
function ye(e) {
	return e.ownerDocument?.defaultView ?? globalThis.window;
}
async function be(e) {
	if (!e?.navigator?.xr || !e.XRWebGLLayer) return !1;
	let t = _e.get(e);
	return t || (t = e.navigator.xr.isSessionSupported("inline").catch(() => !1), _e.set(e, t)), t;
}
function xe(e, t) {
	e.matrix.fromArray(t.transform.matrix), e.matrix.decompose(e.position, e.quaternion, e.scale), e.matrixWorld.copy(e.matrix), e.matrixWorldInverse.copy(e.matrixWorld).invert(), e.projectionMatrix.fromArray(t.projectionMatrix), e.projectionMatrixInverse.copy(e.projectionMatrix).invert();
}
function Se(e, t, n) {
	let r = e.getBoundingClientRect().height / S, i = t.map((e) => Math.abs(Number(e.projectionMatrix?.[5]))).filter((e) => Number.isFinite(e) && e > 0);
	return !(r > 0) || !i.length ? n : r * (i.reduce((e, t) => e + t, 0) / i.length) / 2;
}
function Ce(e) {
	let t = e.views.find((e) => e.eye === "left"), n = e.views.find((e) => e.eye === "right");
	if (!t?.transform?.matrix || !n?.transform?.matrix) return null;
	let r = new g();
	e.transform?.matrix?.length === 16 ? r.fromArray(e.transform.matrix) : r.identity();
	let i = new g().fromArray(t.transform.matrix).invert(), a = new g().fromArray(n.transform.matrix).invert(), o = new g().fromArray(t.projectionMatrix), s = new g().fromArray(n.projectionMatrix), c = new y(), l = new y(), u = new y(), d = (e) => (c.set(0, 0, -e, 1).applyMatrix4(r), l.copy(c).applyMatrix4(i).applyMatrix4(o), u.copy(c).applyMatrix4(a).applyMatrix4(s), Math.abs(l.w) < 1e-8 || Math.abs(u.w) < 1e-8 ? NaN : l.x / l.w - u.x / u.w), f = .01, p = d(f), m = d(100);
	if (!Number.isFinite(p) || !Number.isFinite(m) || Math.abs(p) < 1e-7 && Math.abs(m) < 1e-7) return null;
	let h = f, _ = p;
	for (let e = 1; e <= 96; e += 1) {
		let t = e / 96, n = f * (100 / f) ** t, r = d(n);
		if (Number.isFinite(r)) {
			if (Math.abs(r) < 1e-7) return n;
			if (Math.sign(_) !== Math.sign(r)) {
				let e = h, t = n, r = _;
				for (let n = 0; n < 40; n += 1) {
					let n = (e + t) / 2, i = d(n);
					if (!Number.isFinite(i)) break;
					Math.sign(r) === Math.sign(i) ? (e = n, r = i) : t = n;
				}
				return (e + t) / 2;
			}
			h = n, _ = r;
		}
	}
	return null;
}
function N(e, t) {
	if (!(t > 0)) return {
		x: 0,
		y: 0
	};
	let n = new g();
	e.transform?.matrix?.length === 16 ? n.fromArray(e.transform.matrix) : n.identity();
	let r = n.clone().invert(), i = e.views.filter((e) => e.eye === "left" || e.eye === "right"), a = i.length ? i : e.views, o = new v(), s = 0;
	for (let e of a) {
		if (e.transform?.matrix?.length !== 16 || e.projectionMatrix?.length !== 16) continue;
		let n = new g().fromArray(e.transform.matrix), i = new g().multiplyMatrices(r, n), a = new g().fromArray(e.projectionMatrix).invert(), c = new y(0, 0, -1, 1).applyMatrix4(a);
		if (!Number.isFinite(c.w) || Math.abs(c.w) < 1e-8 || (c.multiplyScalar(1 / c.w).applyMatrix4(i), !Number.isFinite(c.w) || Math.abs(c.w) < 1e-8)) continue;
		c.multiplyScalar(1 / c.w);
		let l = new v().setFromMatrixPosition(i), u = new v(c.x - l.x, c.y - l.y, c.z - l.z);
		if (!Number.isFinite(u.z) || Math.abs(u.z) < 1e-8) continue;
		let d = (-t - l.z) / u.z;
		!Number.isFinite(d) || d <= 0 || (o.addScaledVector(u, d).add(l), s += 1);
	}
	return s ? (o.multiplyScalar(1 / s), {
		x: o.x,
		y: o.y
	}) : {
		x: 0,
		y: 0
	};
}
function we(e, t, n = ae) {
	let r = Se(e, t.views, n), i = Ce(t), a = i ?? n, o = r > 0 ? a / r : 1, s = N(t, a);
	return {
		distance: a,
		hasMeasuredConvergence: i !== null,
		offsetX: s.x,
		offsetY: s.y,
		scale: Math.min(Math.max(o, .25), 4)
	};
}
var Te = class {
	constructor(e, t, n, r = {}) {
		this.element = e, this.scene = t, this.modelRoot = n, this.cameraDistance = r.cameraDistance ?? .3, this.onFrame = r.onFrame ?? (() => {}), this.onPresented = r.onPresented ?? (() => {}), this.onStopped = r.onStopped ?? (() => {}), this.window = ye(e), this.canvas = null, this.renderer = null, this.session = null, this.layer = null, this.referenceSpace = null, this.referenceSpaceType = "viewer", this.trackedAnchorMatrix = new g(), this.modelPlacementMatrix = new g(), this.pageDepthMatrix = new g(), this.pageScaleMatrix = new g(), this.hasTrackedAnchor = !1, this.sessionPlacement = null, this.lastFixedPlacement = null, this.cameras = [], this.lastFrameTime = 0, this.presented = !1, this.disposed = !1, this.startPromise = null, this.startGeneration = 0, this.blockerSignature = "", this.promotionCheckQueued = !1, this.promotionObserver = typeof MutationObserver > "u" ? null : new MutationObserver(() => this.queuePromotionCheck()), this.trackingButton = null, this.trackingRequestPromise = null, this.warningElement = null, this.onXRFrame = this.onXRFrame.bind(this), this.onSessionEnd = this.onSessionEnd.bind(this), this.onTrackingButtonClick = () => this.requestHeadTracking(), this.onWindowResize = () => this.queuePromotionCheck();
	}
	start() {
		if (this.disposed || this.session) return Promise.resolve(!!this.session);
		if (this.startPromise) return this.startPromise;
		let e = ++this.startGeneration;
		return this.startPromise = this.startSession(e).catch(() => !1).finally(() => {
			e === this.startGeneration && (this.startPromise = null);
		}), this.startPromise;
	}
	async startSession(e) {
		if (!await be(this.window) || this.disposed || e !== this.startGeneration) return !1;
		let t = null;
		try {
			t = await this.window.navigator.xr.requestSession("inline", { requiredFeatures: ["inline-stereo"] });
		} catch {
			return !1;
		}
		return this.activateSession(t, e, "viewer");
	}
	async activateSession(e, t, n) {
		try {
			if (this.disposed || t !== this.startGeneration) return e.end().catch(() => {}), !1;
			this.observePromotionEnvironment();
			let r = he(this.element);
			if (r.length) return e.end().catch(() => {}), this.showPromotionWarning(r), !1;
			if (this.clearPromotionWarning(), this.canvas = this.element.ownerDocument.createElement("canvas"), this.canvas.className = `${C} model-element-polyfill__stereo-canvas`, this.canvas.dataset.modelInternal = "", this.canvas.setAttribute("aria-hidden", "true"), this.canvas.style.opacity = "0", this.canvas.style.pointerEvents = "none", this.element.appendChild(this.canvas), this.renderer = new ne({
				alpha: !0,
				antialias: !0,
				canvas: this.canvas,
				forceWebGL: !0
			}), this.renderer.autoClear = !1, this.renderer.outputColorSpace = ee, this.renderer.toneMapping = d, this.renderer.toneMappingExposure = 1.15, this.renderer.setPixelRatio(1), this.resize(), await this.renderer.init(), this.disposed || t !== this.startGeneration) return e.end().catch(() => {}), this.cleanup(!1), !1;
			let i = this.renderer.getContext();
			return this.layer = new this.window.XRWebGLLayer(e, i), e.updateRenderState({
				baseLayer: this.layer,
				depthFar: 1e3,
				depthNear: .005,
				inlineVerticalFieldOfView: this.getInlineVerticalFieldOfView()
			}), this.referenceSpace = await e.requestReferenceSpace(n), this.disposed || t !== this.startGeneration ? (e.end().catch(() => {}), this.cleanup(!1), !1) : (this.referenceSpaceType = n, this.hasTrackedAnchor = !1, this.sessionPlacement = null, this.session = e, this.element.dataset.modelTracking = n === "local" ? "head" : "fixed", e.addEventListener("end", this.onSessionEnd), e.requestAnimationFrame(this.onXRFrame), !0);
		} catch {
			return e?.removeEventListener?.("end", this.onSessionEnd), e?.end?.().catch?.(() => {}), this.cleanup(!1), !1;
		}
	}
	resize() {
		if (!this.renderer) return;
		let e = this.element.getBoundingClientRect(), t = this.window.devicePixelRatio || 1, n = Math.max(Math.round(e.width * t), 1), r = Math.max(Math.round(e.height * t), 1);
		if (this.renderer.setSize(n, r, !1), this.session) try {
			this.session.updateRenderState({ inlineVerticalFieldOfView: this.getInlineVerticalFieldOfView() });
		} catch {}
	}
	getInlineVerticalFieldOfView() {
		let e = Math.max(this.element.getBoundingClientRect().height, 1) / S;
		return 2 * Math.atan(e / (2 * this.cameraDistance));
	}
	getCamera(e) {
		let t = this.cameras[e];
		return t || (t = new _(), t.matrixAutoUpdate = !1, this.cameras[e] = t), t;
	}
	updateModelPlacement(e) {
		if (!this.sessionPlacement) {
			let t = we(this.element, e, this.cameraDistance);
			if (this.referenceSpaceType === "local" && this.lastFixedPlacement && !t.hasMeasuredConvergence) {
				let t = N(e, this.lastFixedPlacement.distance);
				this.sessionPlacement = {
					...this.lastFixedPlacement,
					offsetX: t.x,
					offsetY: t.y
				};
			} else this.sessionPlacement = t;
			this.referenceSpaceType === "viewer" && (this.lastFixedPlacement = { ...this.sessionPlacement });
		}
		let { distance: t, offsetX: n = 0, offsetY: r = 0, scale: i } = this.sessionPlacement, a = t > 0 ? (t + ve) / t : 1;
		if (this.pageDepthMatrix.makeTranslation(n * a, r * a, -t - ve), this.pageScaleMatrix.makeScale(i, i, i), this.pageDepthMatrix.multiply(this.pageScaleMatrix), this.referenceSpaceType === "local") {
			if (!this.hasTrackedAnchor) {
				let t = e.transform?.matrix;
				t?.length === 16 ? this.trackedAnchorMatrix.fromArray(t) : this.trackedAnchorMatrix.identity(), this.hasTrackedAnchor = !0;
			}
			this.modelPlacementMatrix.multiplyMatrices(this.trackedAnchorMatrix, this.pageDepthMatrix);
		} else this.modelPlacementMatrix.copy(this.pageDepthMatrix);
		this.modelPlacementMatrix.decompose(this.modelRoot.position, this.modelRoot.quaternion, this.modelRoot.scale), this.element.dataset.modelPageDistance = t.toFixed(4), this.element.dataset.modelPageScale = i.toFixed(4), this.modelRoot.updateMatrixWorld(!0);
	}
	ensureTrackingButton() {
		if (this.trackingButton) return this.trackingButton;
		let e = this.element.ownerDocument.createElement("button");
		return e.type = "button", e.className = "model-element-polyfill__tracking-button", e.dataset.modelInternal = "", e.hidden = !0, e.addEventListener("click", this.onTrackingButtonClick), this.element.appendChild(e), this.trackingButton = e, e;
	}
	updateTrackingButton() {
		if (this.disposed) return;
		let e = this.ensureTrackingButton();
		if (!this.presented || !this.session || this.blockerSignature) {
			e.hidden = !0;
			return;
		}
		e.hidden = !1, this.referenceSpaceType === "local" ? (e.disabled = !0, e.textContent = "Head tracking on", e.setAttribute("aria-pressed", "true")) : (e.disabled = !1, e.textContent = "Enable head tracking", e.setAttribute("aria-pressed", "false"));
	}
	requestHeadTracking() {
		if (this.disposed || this.referenceSpaceType === "local" || this.trackingRequestPromise || !this.window?.navigator?.xr) return this.trackingRequestPromise ?? Promise.resolve(!1);
		let e = this.ensureTrackingButton();
		e.hidden = !1, e.disabled = !0, e.textContent = "Requesting head tracking…";
		let t;
		try {
			t = this.window.navigator.xr.requestSession("inline", { requiredFeatures: ["inline-stereo", "local"] });
		} catch (e) {
			return this.handleTrackingError(e), Promise.resolve(!1);
		}
		let n = Promise.resolve(t).then(async (e) => {
			if (this.disposed) return e.end().catch(() => {}), !1;
			let t = this.session;
			t?.removeEventListener?.("end", this.onSessionEnd), this.cleanup(!0), t?.end?.().catch?.(() => {});
			let n = ++this.startGeneration;
			return await this.activateSession(e, n, "local") ? (this.element.dispatchEvent(new Event("trackingstart")), !0) : (this.handleTrackingError(/* @__PURE__ */ Error("The head-tracked stereo session could not start.")), !1);
		}).catch((e) => (this.handleTrackingError(e), !1)).finally(() => {
			this.trackingRequestPromise === n && (this.trackingRequestPromise = null), this.updateTrackingButton();
		});
		return this.trackingRequestPromise = n, n;
	}
	handleTrackingError(e) {
		this.updateTrackingButton(), this.element.dispatchEvent(new CustomEvent("trackingerror", { detail: e }));
	}
	observePromotionEnvironment() {
		if (!this.promotionObserver) return;
		this.promotionObserver.disconnect();
		for (let e = this.element; e; e = e.parentElement) this.promotionObserver.observe(e, {
			attributeFilter: ["class", "style"],
			attributes: !0
		});
		let e = this.element.ownerDocument.head;
		e && this.promotionObserver.observe(e, {
			attributes: !0,
			childList: !0,
			characterData: !0,
			subtree: !0
		}), this.window.addEventListener("resize", this.onWindowResize);
	}
	queuePromotionCheck() {
		this.disposed || this.promotionCheckQueued || (this.promotionCheckQueued = !0, queueMicrotask(() => {
			this.promotionCheckQueued = !1, this.checkPromotionSafety();
		}));
	}
	checkPromotionSafety() {
		if (this.disposed) return;
		let e = he(this.element);
		if (e.length) {
			(this.session || this.startPromise || this.trackingRequestPromise) && this.stop(), this.showPromotionWarning(e);
			return;
		}
		let t = !!this.blockerSignature;
		if (this.clearPromotionWarning(), !t || this.session) return;
		let n = () => {
			!this.disposed && !this.session && this.start();
		};
		this.startPromise ? this.startPromise.finally(n) : n();
	}
	showPromotionWarning(e) {
		let t = e.map(({ code: e, elementLabel: t, value: n }) => `${e}:${t}:${n}`).join("|");
		if (t === this.blockerSignature) return;
		this.blockerSignature = t;
		let n = ge(e);
		this.element.dataset.modelStereoBlocked = e.map(({ code: e }) => e).join(","), this.trackingButton && (this.trackingButton.hidden = !0), this.warningElement || (this.warningElement = this.element.ownerDocument.createElement("div"), this.warningElement.className = "model-element-polyfill__stereo-warning", this.warningElement.dataset.modelInternal = "", this.warningElement.setAttribute("role", "status"), this.warningElement.setAttribute("aria-live", "polite"), this.element.appendChild(this.warningElement)), this.warningElement.textContent = n, this.element.dispatchEvent(new CustomEvent("stereoblocked", { detail: {
			blockers: e,
			message: n
		} })), console.warn(`[<model> polyfill] ${n}`, e);
	}
	clearPromotionWarning() {
		this.blockerSignature = "", delete this.element.dataset.modelStereoBlocked, this.warningElement?.remove(), this.warningElement = null;
	}
	onXRFrame(e, t) {
		if (this.disposed || t.session !== this.session || !this.referenceSpace) return;
		this.session.requestAnimationFrame(this.onXRFrame);
		let n = t.getViewerPose(this.referenceSpace);
		if (!n || n.views.length === 0) return;
		let r = this.lastFrameTime === 0 ? 0 : Math.min((e - this.lastFrameTime) / 1e3, .1);
		this.lastFrameTime = e, this.onFrame(r), this.updateModelPlacement(n);
		let i = this.canvas.width, a = this.canvas.height;
		this.renderer.setScissorTest(!1), this.renderer.setViewport(0, 0, i, a), this.renderer.clear(!0, !0, !0), this.renderer.setScissorTest(!0);
		for (let e = 0; e < n.views.length; e += 1) {
			let t = n.views[e], r = this.layer.getViewport(t);
			if (!r) continue;
			let i = this.getCamera(e);
			xe(i, t), this.renderer.setViewport(r.x, r.y, r.width, r.height), this.renderer.setScissor(r.x, r.y, r.width, r.height), this.renderer.render(this.scene, i);
		}
		this.renderer.setScissorTest(!1), this.presented || (this.presented = !0, this.canvas.style.opacity = "1", this.canvas.style.pointerEvents = "", this.updateTrackingButton(), this.onPresented(this.canvas));
	}
	onSessionEnd() {
		this.cleanup(!0);
	}
	cleanup(e) {
		let t = this.presented;
		this.session?.removeEventListener?.("end", this.onSessionEnd), this.presented = !1, this.lastFrameTime = 0, this.layer = null, this.referenceSpace = null, this.referenceSpaceType = "viewer", this.hasTrackedAnchor = !1, this.sessionPlacement = null, this.cameras.length = 0, this.modelRoot.position.set(0, 0, 0), this.modelRoot.quaternion.identity(), this.modelRoot.scale.set(1, 1, 1), this.modelRoot.updateMatrixWorld(!0), this.renderer?.dispose(), this.renderer = null, this.canvas?.remove(), this.canvas = null, this.session = null, delete this.element.dataset.modelTracking, delete this.element.dataset.modelPageDistance, delete this.element.dataset.modelPageScale, this.trackingButton && (this.trackingButton.hidden = !0), e && t && this.onStopped();
	}
	stop() {
		this.startGeneration += 1;
		let e = this.session;
		e?.removeEventListener?.("end", this.onSessionEnd), this.cleanup(!0), e?.end?.().catch?.(() => {});
	}
	dispose() {
		this.disposed || (this.disposed = !0, this.promotionObserver?.disconnect(), this.window.removeEventListener("resize", this.onWindowResize), this.clearPromotionWarning(), this.stop(), this.trackingButton?.removeEventListener("click", this.onTrackingButtonClick), this.trackingButton?.remove(), this.trackingButton = null);
	}
}, Ee = class {
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
}, De;
function Oe() {
	return De ??= new Ee(), De;
}
//#endregion
//#region src/transform.js
var P = new o(), F = new o(), ke = new c(), Ae = new c(), je = new s(), Me = new n(0, 0, 0, "YXZ");
function I() {
	return new DOMMatrix();
}
function L(e) {
	return new DOMMatrix(e.toFloat64Array());
}
function Ne(e, t, n = !1) {
	let r = e.getBoundingClientRect(), i = r.width / S, a = r.height / S;
	if (n) {
		let e = t.length();
		return e > 0 ? Math.min(i, a) / e : 1;
	}
	let o = t.x > 0 ? i / t.x : Infinity, s = t.y > 0 ? a / t.y : Infinity, c = Math.min(o, s);
	return Number.isFinite(c) ? c : 1;
}
function Pe({ center: e, size: t, scale: n, yaw: r = 0, pitch: i = 0, orbit: a = !1 }) {
	let o = a ? t.length() / 2 : t.z / 2, s = -n * o;
	return Me.set(i, r, 0, "YXZ"), je.setFromEuler(Me), ke.set(0, 0, s), Ae.setScalar(n), P.compose(ke, je, Ae), F.makeTranslation(-e.x, -e.y, -e.z), P.multiply(F), new DOMMatrix(P.elements);
}
function Fe(e, t) {
	P.fromArray(e.toFloat64Array()), P.decompose(t.position, t.quaternion, t.scale), t.updateMatrixWorld(!0);
}
//#endregion
//#region src/render-context.js
var Ie = class {
	constructor(e, t = {}) {
		this.element = e, this.cameraDistance = t.cameraDistance ?? .3, this.maxPixelRatio = t.maxPixelRatio ?? 2, this.onAnimationFrame = t.onAnimationFrame ?? (() => !1), this.onEntityTransformChange = t.onEntityTransformChange ?? (() => {}), this.onFirstRender = t.onFirstRender ?? (() => {}), this.scheduler = Oe(), this.renderer = null, this.rendererBackend = "", this.scene = null, this.camera = null, this.canvas = null, this.modelRoot = null, this.pivot = null, this.center = new v(), this.size = new v(), this.entityTransform = I(), this.environmentTexture = null, this.environmentVersion = 0, this.orbit = null, this.stageMode = "none", this.userTransform = !1, this.initialized = !1, this.disposed = !1, this.dirty = !0, this.forceRender = !1, this.waitingForFirstRender = !1, this.isVisible = typeof IntersectionObserver > "u", this.resizeObserver = null, this.intersectionObserver = null, this.inlineStereo = null;
	}
	async init() {
		if (this.initialized) return this;
		this.canvas = document.createElement("canvas"), this.canvas.className = C, this.canvas.dataset.modelInternal = "", this.canvas.setAttribute("aria-hidden", "true"), this.element.appendChild(this.canvas), this.scene = new te(), this.camera = new _(30, 1, .005, 1e3), this.camera.position.set(0, 0, this.cameraDistance);
		let e = new h(16777215, 2830400, 2.2), t = new f(16777215, 3.5), n = new f(10337791, 1.8), r = new f(16766896, 1.4);
		return t.position.set(2, 3, 4), n.position.set(-4, 1, 2), r.position.set(1, -3, -2), this.scene.add(e, t, n, r), this.modelRoot = new m(), this.pivot = new m(), this.modelRoot.add(this.pivot), this.scene.add(this.modelRoot), this.renderer = new ne({
			alpha: !0,
			antialias: !0,
			canvas: this.canvas
		}), this.renderer.outputColorSpace = ee, this.renderer.toneMapping = d, this.renderer.toneMappingExposure = 1.15, this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, this.maxPixelRatio)), this.resize(), await this.renderer.init(), this.disposed ? (this.renderer.dispose(), this) : (this.rendererBackend = this.renderer.backend?.isWebGPUBackend ? "webgpu" : "webgl2", this.element.dataset.modelRenderer = this.rendererBackend, this.orbit = new ue(this.element, this.canvas, () => {
			this.applyDefaultTransform(), this.invalidate();
		}), this.setStageMode(this.stageMode), this.inlineStereo = new Te(this.element, this.scene, this.modelRoot, {
			cameraDistance: this.cameraDistance,
			onFrame: (e) => {
				this.onAnimationFrame(e), this.orbit?.tick(e);
			},
			onPresented: (e) => {
				this.disposed || (this.canvas.style.display = "none", this.orbit?.setCanvas(e), this.element.dataset.modelRenderer = "webgl2-inline-stereo", this.element.dataset.modelStereo = "inline-stereo", this.element.dispatchEvent(new Event("stereostart")), this.waitingForFirstRender && (this.waitingForFirstRender = !1, this.onFirstRender()));
			},
			onStopped: () => {
				this.disposed || (this.canvas.style.display = "block", this.orbit?.setCanvas(this.canvas), this.element.dataset.modelRenderer = this.rendererBackend, delete this.element.dataset.modelStereo, this.element.dispatchEvent(new Event("stereoend")), this.invalidate());
			}
		}), typeof ResizeObserver < "u" && (this.resizeObserver = new ResizeObserver(() => this.resize()), this.resizeObserver.observe(this.element)), typeof IntersectionObserver < "u" && (this.intersectionObserver = new IntersectionObserver((e) => {
			let t = e[e.length - 1];
			this.isVisible = !!t?.isIntersecting, this.isVisible && this.invalidate();
		}), this.intersectionObserver.observe(this.element)), this.initialized = !0, this.scheduler.add(this), this.invalidate(), this);
	}
	resize() {
		if (!this.canvas || !this.camera || !this.renderer) return;
		let e = this.element.getBoundingClientRect(), t = Math.max(Math.round(e.width), 1), n = Math.max(Math.round(e.height), 1), r = n / S;
		this.renderer.setSize(t, n, !1), this.inlineStereo?.resize(), this.camera.aspect = t / n, this.camera.fov = 2 * Math.atan(r / (2 * this.cameraDistance)) * (180 / Math.PI), this.camera.updateProjectionMatrix(), this.pivot?.children.length && (!this.userTransform || this.stageMode === "orbit") && this.applyDefaultTransform(), this.invalidate();
	}
	setModel(e, t, n) {
		this.clearModel(), this.pivot.add(e), this.center.copy(t), this.size.copy(n), this.userTransform = !1, this.orbit?.reset(), this.applyDefaultTransform(), this.waitingForFirstRender = !0, this.forceRender = !0, this.invalidate(), this.inlineStereo?.start();
	}
	clearModel() {
		if (this.pivot) for (; this.pivot.children.length;) this.pivot.remove(this.pivot.children[0]);
	}
	applyDefaultTransform() {
		if (!this.pivot || !this.pivot.children.length) return;
		let e = this.stageMode === "orbit", t = Ne(this.element, this.size, e), n = e ? this.orbit?.zoom ?? 1 : 1, r = Pe({
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
		this.pivot && (this.entityTransform = L(e), this.userTransform = t, Fe(this.entityTransform, this.pivot), this.onEntityTransformChange(L(this.entityTransform)), this.invalidate());
	}
	getEntityTransform() {
		return L(this.entityTransform);
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
			let e = await new re().loadAsync(n);
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
		this.dirty = !0, this.inlineStereo?.presented || this.scheduler.request();
	}
	frame(e, t) {
		if (this.disposed || !this.initialized || this.inlineStereo?.presented || !this.isVisible && !this.forceRender) return !1;
		let n = this.onAnimationFrame(t), r = this.orbit?.tick(t) ?? !1;
		return (n || r) && (this.dirty = !0), this.dirty && (this.renderer.render(this.scene, this.camera), this.dirty = !1, this.forceRender = !1, this.waitingForFirstRender && (this.waitingForFirstRender = !1, this.onFirstRender())), this.isVisible && (n || r);
	}
	dispose() {
		this.disposed || (this.disposed = !0, this.scheduler.remove(this), this.resizeObserver?.disconnect(), this.intersectionObserver?.disconnect(), this.inlineStereo?.dispose(), this.orbit?.dispose(), this.environmentTexture?.dispose(), this.renderer?.dispose(), this.canvas?.remove(), delete this.element.dataset.modelRenderer, delete this.element.dataset.modelStereo, this.clearModel(), this.renderer = null, this.scene = null, this.camera = null, this.canvas = null);
	}
}, Le = /* @__PURE__ */ new Map([
	["model/gltf", "model/gltf+json"],
	["model/usd", "model/vnd.usd"],
	["model/usdz", "model/vnd.usdz+zip"]
]), Re = /* @__PURE__ */ new Map([
	[".glb", "model/gltf-binary"],
	[".gltf", "model/gltf+json"],
	[".usd", "model/vnd.usd"],
	[".usda", "model/vnd.usd"],
	[".usdc", "model/vnd.usd"],
	[".usdz", "model/vnd.usdz+zip"]
]), ze = new Set(ie);
function R(e = "") {
	let t = e.split(";", 1)[0].trim().toLowerCase();
	return Le.get(t) ?? t;
}
function Be(e, t = "") {
	let n = R(t);
	if (n) return n;
	let r = String(e);
	try {
		r = new URL(e, globalThis.document?.baseURI).pathname;
	} catch {}
	let i = r.toLowerCase();
	for (let [e, t] of Re) if (i.endsWith(e)) return t;
	return "";
}
function z(e) {
	return ze.has(R(e));
}
function Ve(e) {
	let t = e.getAttribute("media");
	return !t || typeof globalThis.matchMedia != "function" || globalThis.matchMedia(t).matches;
}
function He(e, t, n, r) {
	return {
		src: new URL(e, r).href,
		type: Be(e, t),
		source: n
	};
}
function B(e) {
	let t = e.ownerDocument?.baseURI ?? globalThis.document?.baseURI, n = [], r = e.getAttribute("src");
	if (r) {
		let i = He(r, e.getAttribute("type") ?? "", e, t);
		z(i.type) && n.push(i);
	}
	for (let r of e.querySelectorAll(":scope > source")) {
		let e = r.getAttribute("src");
		if (!e || !Ve(r)) continue;
		let i = He(e, r.getAttribute("type") ?? "", r, t);
		z(i.type) && n.push(i);
	}
	return n;
}
//#endregion
//#region src/model-element.js
var V = /* @__PURE__ */ new WeakMap(), H = new Set(x);
function U(e = 0, t = 0, n = 0, r = 1) {
	return new DOMPointReadOnly(e, t, n, r);
}
function W(e) {
	if (typeof DOMException < "u") return new DOMException(e, "AbortError");
	let t = Error(e);
	return t.name = "AbortError", t;
}
function Ue(e, t) {
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
		entityTransform: I(),
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
		readyState: b.EMPTY
	};
}
function We(e) {
	return V.get(e);
}
function Ge(e, t) {
	e.ignoredAttributeMutations.set(t, (e.ignoredAttributeMutations.get(t) ?? 0) + 1);
}
function Ke(e, t) {
	let n = e.ignoredAttributeMutations.get(t) ?? 0;
	return n !== 0 && (n === 1 ? e.ignoredAttributeMutations.delete(t) : e.ignoredAttributeMutations.set(t, n - 1), !0);
}
function qe(e) {
	e.readyReject?.(W("The model source changed before loading completed.")), e.readyState = b.LOADING, e.complete = !1, e.element.removeAttribute(T), e.ready = new Promise((t, n) => {
		e.readyResolve = t, e.readyReject = n;
	}), e.ready.catch(() => {});
}
function Je(e) {
	e.readyState = b.COMPLETE, e.complete = !0, e.element.setAttribute(T, ""), e.readyResolve?.(e.element), e.readyResolve = null, e.readyReject = null;
}
function Ye(e, t) {
	e.readyState = b.EMPTY, e.complete = !0, e.readyReject?.(t), e.readyResolve = null, e.readyReject = null;
}
function Xe(e) {
	let t = V.get(e), n = e.getAttribute("alt");
	n && (!e.hasAttribute("aria-label") || t?.ownsAriaLabel) ? (e.setAttribute("aria-label", n), t && (t.ownsAriaLabel = !0)) : !n && t?.ownsAriaLabel && (e.removeAttribute("aria-label"), t.ownsAriaLabel = !1), n && (!e.hasAttribute("role") || t?.ownsRole) ? (e.setAttribute("role", "img"), t && (t.ownsRole = !0)) : !n && t?.ownsRole && (e.removeAttribute("role"), t.ownsRole = !1);
}
function Ze(e) {
	let t = Number(e.getAttribute("width")), n = Number(e.getAttribute("height"));
	Number.isFinite(t) && t > 0 ? e.style.setProperty("--model-element-width", `${t}px`) : e.style.removeProperty("--model-element-width"), Number.isFinite(n) && n > 0 ? e.style.setProperty("--model-element-height", `${n}px`) : e.style.removeProperty("--model-element-height"), V.get(e)?.context?.resize();
}
function G(e) {
	e.currentAction && (e.element.hasAttribute("loop") ? (e.currentAction.setLoop(i, Infinity), e.currentAction.clampWhenFinished = !1) : (e.currentAction.setLoop(r, 1), e.currentAction.clampWhenFinished = !0));
}
function Qe(e) {
	e.mixer && e.finishedHandler && e.mixer.removeEventListener("finished", e.finishedHandler), e.mixer?.stopAllAction(), e.mixer = null, e.currentAction = null, e.finishedHandler = null, e.duration = 0, e.ended = !1, e.paused = !0;
}
function $e(t, n) {
	if (Qe(t), !n.length || !t.model) return;
	let r = n[0];
	t.mixer = new e(t.model), t.currentAction = t.mixer.clipAction(r), t.duration = r.duration, t.ended = !1, t.currentAction.timeScale = t.playbackRate, t.currentAction.paused = !0, t.currentAction.play(), G(t), t.finishedHandler = () => {
		t.element.hasAttribute("loop") || (t.ended = !0, t.paused = !0, t.element.dispatchEvent(new Event("ended")));
	}, t.mixer.addEventListener("finished", t.finishedHandler), t.element.hasAttribute("autoplay") && Z(t.element);
}
function et(e) {
	Qe(e), e.context?.clearModel(), E(e.model), e.model = null, e.currentSrc = "", e.boundingBoxCenter = U(), e.boundingBoxExtents = U(0, 0, 0, 0);
}
async function tt(e) {
	if (e.context) return e.context;
	if (e.contextPromise) return e.contextPromise;
	let t = new Ie(e.element, {
		cameraDistance: e.options.cameraDistance,
		maxPixelRatio: e.options.maxPixelRatio,
		onAnimationFrame: (t) => !e.mixer || e.paused || e.playbackRate === 0 ? !1 : (e.mixer.update(t), !e.paused && e.playbackRate !== 0),
		onEntityTransformChange: (t) => {
			e.entityTransform = t;
		},
		onFirstRender: () => {
			e.pendingRenderGeneration === e.loadGeneration && Je(e);
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
async function nt(e, n) {
	let r = V.get(e);
	if (!r || !r.connected || n !== r.loadGeneration) return;
	let i = B(e);
	if (et(r), i.length === 0) {
		r.readyState = b.EMPTY, r.complete = !0, r.readyResolve?.(e), r.readyResolve = null, r.readyReject = null;
		return;
	}
	r.currentSrc = i[0].src, e.dispatchEvent(new Event("loadstart"));
	let a = null;
	try {
		if (a = await ce(i, {
			isStale: () => n !== r.loadGeneration || !r.connected,
			onProgress: (t) => e.dispatchEvent(new CustomEvent("progress", { detail: t }))
		}), !a || n !== r.loadGeneration || !r.connected) return;
		let o = await tt(r);
		if (n !== r.loadGeneration || !r.connected) {
			E(a.object);
			return;
		}
		let s = new t().setFromObject(a.object), l = s.getCenter(new c()), u = s.getSize(new c());
		r.model = a.object, r.currentSrc = a.candidate.src, r.boundingBoxCenter = U(l.x, l.y, l.z, 1), r.boundingBoxExtents = U(u.x, u.y, u.z, 0), $e(r, a.animations), r.pendingRenderGeneration = n, o.setStageMode(X(e)), o.setModel(a.object, l, u), e.dispatchEvent(new Event("load"));
	} catch (t) {
		if (a?.object && r.model !== a.object && E(a.object), n !== r.loadGeneration || !r.connected || t?.name === "AbortError") return;
		Ye(r, t), e.dispatchEvent(new CustomEvent("error", { detail: t }));
	}
}
function K(e) {
	let t = V.get(e);
	if (!t?.connected) return Promise.resolve(e);
	t.loadGeneration += 1;
	let n = t.loadGeneration;
	return qe(t), t.loadQueued || (t.loadQueued = !0, queueMicrotask(() => {
		t.loadQueued = !1, nt(e, t.loadGeneration);
	})), t.pendingRenderGeneration = n, t.ready;
}
function q(e, t, n, r) {
	if (n === r) return;
	let i = V.get(e);
	if (i) switch (t) {
		case "alt":
			Xe(e);
			break;
		case "autoplay":
			r !== null && i.currentAction && i.paused && Z(e);
			break;
		case "environmentmap":
			i.context?.setEnvironmentMap(r || "");
			break;
		case "height":
		case "width":
			Ze(e);
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
function rt(e, t) {
	t.mutationObserver = new MutationObserver((n) => {
		let r = !1;
		for (let i of n) if (i.type === "attributes") {
			let n = i.attributeName;
			if (i.target === e) {
				if (Ke(t, n)) continue;
				H.has(n) && q(e, n, i.oldValue, e.getAttribute(n));
			} else i.target.nodeName === "SOURCE" && (r = !0);
		} else i.type === "childList" && [...i.addedNodes, ...i.removedNodes].some((e) => e.nodeType === 1 && e.nodeName === "SOURCE") && (r = !0);
		r && K(e);
	}), t.mutationObserver.observe(e, {
		attributeFilter: [
			...x,
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
		t.connected = !0, e.setAttribute(w, ""), Ze(e), Xe(e), rt(e, t);
		for (let t of x) {
			let n = e.getAttribute(t);
			n !== null && t !== "src" && q(e, t, null, n);
		}
		B(e).length && K(e);
	}
}
function Y(e) {
	let t = V.get(e);
	t?.connected && (t.connected = !1, t.loadGeneration += 1, t.mutationObserver?.disconnect(), t.mutationObserver = null, t.readyReject?.(W("The model element was disconnected.")), t.readyResolve = null, t.readyReject = null, et(t), t.context?.dispose(), t.context = null, t.contextGeneration += 1, t.contextPromise = null, t.readyState = b.EMPTY, t.complete = !0, e.removeAttribute(T));
}
function it(e, t) {
	for (let n of Object.getOwnPropertyNames(t.prototype)) n !== "constructor" && n !== "connectedCallback" && n !== "disconnectedCallback" && Object.defineProperty(e, n, Object.getOwnPropertyDescriptor(t.prototype, n));
}
function at(e, t, n) {
	if (V.has(e)) return J(e), e;
	try {
		Object.setPrototypeOf(e, t.prototype);
	} catch {
		it(e, t);
	}
	return V.set(e, Ue(e, n)), J(e), e;
}
function X(e) {
	return e.getAttribute("stagemode") === "orbit" ? "orbit" : "none";
}
function Z(e) {
	let t = V.get(e);
	return !t?.currentAction || !t.paused ? Promise.resolve() : (t.ended &&= (t.currentAction.reset(), t.currentAction.timeScale = t.playbackRate, G(t), !1), t.paused = !1, t.currentAction.paused = !1, t.context?.invalidate(), e.dispatchEvent(new Event("play")), e.dispatchEvent(new Event("playing")), Promise.resolve());
}
function ot(e) {
	let t = V.get(e);
	!t?.currentAction || t.paused || (t.paused = !0, t.currentAction.paused = !0, e.dispatchEvent(new Event("pause")));
}
function st(e, t) {
	return class extends e.HTMLElement {
		connectedCallback() {
			at(this, this.constructor, t);
		}
		disconnectedCallback() {
			Y(this);
		}
		setAttribute(e, t) {
			let n = String(e).toLowerCase(), r = V.get(this), i = this.getAttribute(n);
			r && H.has(n) && Ge(r, n), super.setAttribute(e, t), r && H.has(n) && q(this, n, i, String(t));
		}
		removeAttribute(e) {
			let t = String(e).toLowerCase(), n = V.get(this), r = this.getAttribute(t);
			n && H.has(t) && Ge(n, t), super.removeAttribute(e), n && H.has(t) && q(this, t, r, null);
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
			return V.get(this)?.context?.getEntityTransform() ?? L(V.get(this)?.entityTransform ?? I());
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
			return V.get(this)?.readyState ?? b.EMPTY;
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
			return z(R(e)) ? "probably" : "";
		}
		load() {
			return K(this);
		}
		pause() {
			ot(this);
		}
		play() {
			return Z(this);
		}
	};
}
//#endregion
//#region src/styles.js
var ct = "model-element-webgpu-polyfill-styles";
function lt(e = document) {
	if (e.getElementById(ct)) return;
	let t = e.createElement("style");
	t.id = ct, t.textContent = `
    :where(model),
    :where(model-polyfill) {
      display: inline-block;
      width: var(--model-element-width, 300px);
      height: var(--model-element-height, 150px);
      vertical-align: middle;
    }

    :where(model[${w}]),
    :where(model-polyfill[${w}]) {
      contain: layout paint style;
      overflow: hidden;
      position: relative;
    }

    :where(model[${w}]) > source,
    :where(model-polyfill[${w}]) > source {
      display: none !important;
    }

    :where(model[${T}]) > :not(source):not([data-model-internal]),
    :where(model-polyfill[${T}]) > :not(source):not([data-model-internal]) {
      display: none !important;
    }

    :where(.${C}) {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
    }

    :where(.model-element-polyfill__stereo-warning) {
      position: absolute;
      z-index: 2;
      right: 12px;
      bottom: 12px;
      left: 12px;
      display: block;
      padding: 8px 10px;
      border: 1px solid rgba(255, 205, 92, 0.55);
      border-radius: 8px;
      background: rgba(26, 20, 8, 0.94);
      color: #ffe7a3;
      font: 600 12px/1.4 system-ui, sans-serif;
      pointer-events: none;
    }

    :where(.model-element-polyfill__tracking-button) {
      position: absolute;
      z-index: 3;
      top: 10px;
      right: 10px;
      max-width: calc(100% - 20px);
      padding: 7px 10px;
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 999px;
      background: rgba(8, 10, 16, 0.86);
      color: #fff;
      font: 600 12px/1.2 system-ui, sans-serif;
      cursor: pointer;
      pointer-events: auto;
    }

    :where(.model-element-polyfill__tracking-button:hover:not(:disabled)) {
      background: rgba(28, 32, 46, 0.94);
    }

    :where(.model-element-polyfill__tracking-button:focus-visible) {
      outline: 2px solid #8fe7dd;
      outline-offset: 2px;
    }

    :where(.model-element-polyfill__tracking-button:disabled) {
      cursor: default;
      opacity: 0.8;
    }
  `, e.head.appendChild(t);
}
//#endregion
//#region src/install.js
var Q = Symbol.for("model-element-webgpu-polyfill.installation");
function ut(e) {
	return {
		cameraDistance: e.cameraDistance,
		force: !!e.force,
		maxPixelRatio: e.maxPixelRatio
	};
}
function $(e = {}) {
	if (typeof window > "u" || typeof document > "u") return null;
	if (window[Q]) return window[Q];
	let t = ut(e), n = Object.getOwnPropertyDescriptor(window, "HTMLModelElement"), r = window.HTMLModelElement, i = "HTMLModelElement" in window && r?.isPolyfill !== !0, a = st(window, t), o = /* @__PURE__ */ new Set(), s = t.force || !i;
	Object.defineProperty(a, "isPolyfill", { value: !0 }), lt(document), customElements.get("model-polyfill") || customElements.define("model-polyfill", a);
	function c(e) {
		if (!(e instanceof window.HTMLElement)) return e;
		let n = at(e, a, t);
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
function dt() {
	return typeof window > "u" ? null : window[Q] ?? null;
}
//#endregion
//#region src/index.js
typeof window < "u" && typeof document < "u" && $();
//#endregion
export { b as MODEL_READY_STATE, ie as SUPPORTED_MODEL_TYPES, B as collectModelSources, dt as getModelPolyfillInstallation, We as getModelState, Be as inferModelType, $ as installModelPolyfill, z as isSupportedModelType, R as normalizeModelType };

//# sourceMappingURL=model-element-polyfill.js.map