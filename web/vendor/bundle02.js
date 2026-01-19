//#region rolldown:runtime
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", {
	value,
	configurable: true
});

//#endregion
//#region node_modules/lit-html/lit-html.js
const t$2 = globalThis;
const i$2 = /* @__PURE__ */ __name((t$3) => t$3, "i");
const s$2 = t$2.trustedTypes;
const e$3 = s$2 ? s$2.createPolicy("lit-html", { createHTML: (t$3) => t$3 }) : void 0;
const h$3 = "$lit$";
const o$3 = `lit$${Math.random().toFixed(9).slice(2)}$`;
const n$2 = "?" + o$3;
const r$2 = `<${n$2}>`;
const l = document;
const c$2 = /* @__PURE__ */ __name(() => l.createComment(""), "c");
const a = (t$3) => null === t$3 || "object" != typeof t$3 && "function" != typeof t$3;
const u$2 = Array.isArray;
const d = (t$3) => u$2(t$3) || "function" == typeof t$3?.[Symbol.iterator];
const f$1 = "[ 	\n\f\r]";
const v$1 = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
const _ = /-->/g;
const m$1 = />/g;
const p$1 = RegExp(`>|${f$1}(?:([^\\s"'>=/]+)(${f$1}*=${f$1}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g");
const g = /'/g;
const $ = /"/g;
const y = /^(?:script|style|textarea|title)$/i;
const x = (t$3) => (i$3, ...s$3) => ({
	_$litType$: t$3,
	strings: i$3,
	values: s$3
});
const b = x(1);
const w = x(2);
const T = x(3);
const E = Symbol.for("lit-noChange");
const A = Symbol.for("lit-nothing");
const C = /* @__PURE__ */ new WeakMap();
const P = l.createTreeWalker(l, 129);
function V(t$3, i$3) {
	if (!u$2(t$3) || !t$3.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return void 0 !== e$3 ? e$3.createHTML(i$3) : i$3;
}
const N = (t$3, i$3) => {
	const s$3 = t$3.length - 1;
	const e$4 = [];
	let n$3;
	let l = 2 === i$3 ? "<svg>" : 3 === i$3 ? "<math>" : "";
	let c$3 = v$1;
	for (let i$4 = 0; i$4 < s$3; i$4++) {
		const s$4 = t$3[i$4];
		let a;
		let u$3;
		let d = -1;
		let f$2 = 0;
		for (; f$2 < s$4.length && (c$3.lastIndex = f$2, u$3 = c$3.exec(s$4), null !== u$3);) f$2 = c$3.lastIndex, c$3 === v$1 ? "!--" === u$3[1] ? c$3 = _ : void 0 !== u$3[1] ? c$3 = m$1 : void 0 !== u$3[2] ? (y.test(u$3[2]) && (n$3 = RegExp("</" + u$3[2], "g")), c$3 = p$1) : void 0 !== u$3[3] && (c$3 = p$1) : c$3 === p$1 ? ">" === u$3[0] ? (c$3 = n$3 ?? v$1, d = -1) : void 0 === u$3[1] ? d = -2 : (d = c$3.lastIndex - u$3[2].length, a = u$3[1], c$3 = void 0 === u$3[3] ? p$1 : "\"" === u$3[3] ? $ : g) : c$3 === $ || c$3 === g ? c$3 = p$1 : c$3 === _ || c$3 === m$1 ? c$3 = v$1 : (c$3 = p$1, n$3 = void 0);
		const x = c$3 === p$1 && t$3[i$4 + 1].startsWith("/>") ? " " : "";
		l += c$3 === v$1 ? s$4 + r$2 : d >= 0 ? (e$4.push(a), s$4.slice(0, d) + h$3 + s$4.slice(d) + o$3 + x) : s$4 + o$3 + (-2 === d ? i$4 : x);
	}
	return [V(t$3, l + (t$3[s$3] || "<?>") + (2 === i$3 ? "</svg>" : 3 === i$3 ? "</math>" : "")), e$4];
};
var S = class S {
	constructor({ strings: t$3, _$litType$: i$3 }, e$4) {
		let r$3;
		this.parts = [];
		let l = 0;
		let a = 0;
		const u$3 = t$3.length - 1;
		const d = this.parts;
		const [f$2, v$2] = N(t$3, i$3);
		if (this.el = S.createElement(f$2, e$4), P.currentNode = this.el.content, 2 === i$3 || 3 === i$3) {
			const t$4 = this.el.content.firstChild;
			t$4.replaceWith(...t$4.childNodes);
		}
		for (; null !== (r$3 = P.nextNode()) && d.length < u$3;) {
			if (1 === r$3.nodeType) {
				if (r$3.hasAttributes()) for (const t$4 of r$3.getAttributeNames()) if (t$4.endsWith(h$3)) {
					const i$4 = v$2[a++];
					const s$3 = r$3.getAttribute(t$4).split(o$3);
					const e$5 = /([.?@])?(.*)/.exec(i$4);
					d.push({
						type: 1,
						index: l,
						name: e$5[2],
						strings: s$3,
						ctor: "." === e$5[1] ? I : "?" === e$5[1] ? L : "@" === e$5[1] ? z : H
					}), r$3.removeAttribute(t$4);
				} else t$4.startsWith(o$3) && (d.push({
					type: 6,
					index: l
				}), r$3.removeAttribute(t$4));
				if (y.test(r$3.tagName)) {
					const t$4 = r$3.textContent.split(o$3);
					const i$4 = t$4.length - 1;
					if (i$4 > 0) {
						r$3.textContent = s$2 ? s$2.emptyScript : "";
						for (let s$3 = 0; s$3 < i$4; s$3++) r$3.append(t$4[s$3], c$2()), P.nextNode(), d.push({
							type: 2,
							index: ++l
						});
						r$3.append(t$4[i$4], c$2());
					}
				}
			} else if (8 === r$3.nodeType) if (r$3.data === n$2) d.push({
				type: 2,
				index: l
			});
			else {
				let t$4 = -1;
				for (; -1 !== (t$4 = r$3.data.indexOf(o$3, t$4 + 1));) d.push({
					type: 7,
					index: l
				}), t$4 += o$3.length - 1;
			}
			l++;
		}
	}
	static createElement(t$3, i$3) {
		const s$3 = l.createElement("template");
		return s$3.innerHTML = t$3, s$3;
	}
};
function M$1(t$3, i$3, s$3 = t$3, e$4) {
	if (i$3 === E) return i$3;
	let h$4 = void 0 !== e$4 ? s$3._$Co?.[e$4] : s$3._$Cl;
	const o$4 = a(i$3) ? void 0 : i$3._$litDirective$;
	return h$4?.constructor !== o$4 && (h$4?._$AO?.(!1), void 0 === o$4 ? h$4 = void 0 : (h$4 = new o$4(t$3), h$4._$AT(t$3, s$3, e$4)), void 0 !== e$4 ? (s$3._$Co ??= [])[e$4] = h$4 : s$3._$Cl = h$4), void 0 !== h$4 && (i$3 = M$1(t$3, h$4._$AS(t$3, i$3.values), h$4, e$4)), i$3;
}
__name(M$1, "M");
var R = class {
	constructor(t$3, i$3) {
		this._$AV = [], this._$AN = void 0, this._$AD = t$3, this._$AM = i$3;
	}
	get parentNode() {
		return this._$AM.parentNode;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	u(t$3) {
		const { el: { content: i$3 }, parts: s$3 } = this._$AD;
		const e$4 = (t$3?.creationScope ?? l).importNode(i$3, !0);
		P.currentNode = e$4;
		let h$4 = P.nextNode();
		let o$4 = 0;
		let n$3 = 0;
		let r$3 = s$3[0];
		for (; void 0 !== r$3;) {
			if (o$4 === r$3.index) {
				let i$4;
				2 === r$3.type ? i$4 = new k(h$4, h$4.nextSibling, this, t$3) : 1 === r$3.type ? i$4 = new r$3.ctor(h$4, r$3.name, r$3.strings, this, t$3) : 6 === r$3.type && (i$4 = new Z(h$4, this, t$3)), this._$AV.push(i$4), r$3 = s$3[++n$3];
			}
			o$4 !== r$3?.index && (h$4 = P.nextNode(), o$4++);
		}
		return P.currentNode = l, e$4;
	}
	p(t$3) {
		let i$3 = 0;
		for (const s$3 of this._$AV) void 0 !== s$3 && (void 0 !== s$3.strings ? (s$3._$AI(t$3, s$3, i$3), i$3 += s$3.strings.length - 2) : s$3._$AI(t$3[i$3])), i$3++;
	}
};
var k = class k {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(t$3, i$3, s$3, e$4) {
		this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t$3, this._$AB = i$3, this._$AM = s$3, this.options = e$4, this._$Cv = e$4?.isConnected ?? !0;
	}
	get parentNode() {
		let t$3 = this._$AA.parentNode;
		const i$3 = this._$AM;
		return void 0 !== i$3 && 11 === t$3?.nodeType && (t$3 = i$3.parentNode), t$3;
	}
	get startNode() {
		return this._$AA;
	}
	get endNode() {
		return this._$AB;
	}
	_$AI(t$3, i$3 = this) {
		t$3 = M$1(this, t$3, i$3), a(t$3) ? t$3 === A || null == t$3 || "" === t$3 ? (this._$AH !== A && this._$AR(), this._$AH = A) : t$3 !== this._$AH && t$3 !== E && this._(t$3) : void 0 !== t$3._$litType$ ? this.$(t$3) : void 0 !== t$3.nodeType ? this.T(t$3) : d(t$3) ? this.k(t$3) : this._(t$3);
	}
	O(t$3) {
		return this._$AA.parentNode.insertBefore(t$3, this._$AB);
	}
	T(t$3) {
		this._$AH !== t$3 && (this._$AR(), this._$AH = this.O(t$3));
	}
	_(t$3) {
		this._$AH !== A && a(this._$AH) ? this._$AA.nextSibling.data = t$3 : this.T(l.createTextNode(t$3)), this._$AH = t$3;
	}
	$(t$3) {
		const { values: i$3, _$litType$: s$3 } = t$3;
		const e$4 = "number" == typeof s$3 ? this._$AC(t$3) : (void 0 === s$3.el && (s$3.el = S.createElement(V(s$3.h, s$3.h[0]), this.options)), s$3);
		if (this._$AH?._$AD === e$4) this._$AH.p(i$3);
		else {
			const t$4 = new R(e$4, this);
			const s$4 = t$4.u(this.options);
			t$4.p(i$3), this.T(s$4), this._$AH = t$4;
		}
	}
	_$AC(t$3) {
		let i$3 = C.get(t$3.strings);
		return void 0 === i$3 && C.set(t$3.strings, i$3 = new S(t$3)), i$3;
	}
	k(t$3) {
		u$2(this._$AH) || (this._$AH = [], this._$AR());
		const i$3 = this._$AH;
		let s$3;
		let e$4 = 0;
		for (const h$4 of t$3) e$4 === i$3.length ? i$3.push(s$3 = new k(this.O(c$2()), this.O(c$2()), this, this.options)) : s$3 = i$3[e$4], s$3._$AI(h$4), e$4++;
		e$4 < i$3.length && (this._$AR(s$3 && s$3._$AB.nextSibling, e$4), i$3.length = e$4);
	}
	_$AR(t$3 = this._$AA.nextSibling, s$3) {
		for (this._$AP?.(!1, !0, s$3); t$3 !== this._$AB;) {
			const s$4 = i$2(t$3).nextSibling;
			i$2(t$3).remove(), t$3 = s$4;
		}
	}
	setConnected(t$3) {
		void 0 === this._$AM && (this._$Cv = t$3, this._$AP?.(t$3));
	}
};
var H = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(t$3, i$3, s$3, e$4, h$4) {
		this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t$3, this.name = i$3, this._$AM = e$4, this.options = h$4, s$3.length > 2 || "" !== s$3[0] || "" !== s$3[1] ? (this._$AH = Array(s$3.length - 1).fill(/* @__PURE__ */ new String()), this.strings = s$3) : this._$AH = A;
	}
	_$AI(t$3, i$3 = this, s$3, e$4) {
		const h$4 = this.strings;
		let o$4 = !1;
		if (void 0 === h$4) t$3 = M$1(this, t$3, i$3, 0), o$4 = !a(t$3) || t$3 !== this._$AH && t$3 !== E, o$4 && (this._$AH = t$3);
		else {
			const e$5 = t$3;
			let n$3;
			let r$3;
			for (t$3 = h$4[0], n$3 = 0; n$3 < h$4.length - 1; n$3++) r$3 = M$1(this, e$5[s$3 + n$3], i$3, n$3), r$3 === E && (r$3 = this._$AH[n$3]), o$4 ||= !a(r$3) || r$3 !== this._$AH[n$3], r$3 === A ? t$3 = A : t$3 !== A && (t$3 += (r$3 ?? "") + h$4[n$3 + 1]), this._$AH[n$3] = r$3;
		}
		o$4 && !e$4 && this.j(t$3);
	}
	j(t$3) {
		t$3 === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t$3 ?? "");
	}
};
var I = class extends H {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(t$3) {
		this.element[this.name] = t$3 === A ? void 0 : t$3;
	}
};
var L = class extends H {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(t$3) {
		this.element.toggleAttribute(this.name, !!t$3 && t$3 !== A);
	}
};
var z = class extends H {
	constructor(t$3, i$3, s$3, e$4, h$4) {
		super(t$3, i$3, s$3, e$4, h$4), this.type = 5;
	}
	_$AI(t$3, i$3 = this) {
		if ((t$3 = M$1(this, t$3, i$3, 0) ?? A) === E) return;
		const s$3 = this._$AH;
		const e$4 = t$3 === A && s$3 !== A || t$3.capture !== s$3.capture || t$3.once !== s$3.once || t$3.passive !== s$3.passive;
		const h$4 = t$3 !== A && (s$3 === A || e$4);
		e$4 && this.element.removeEventListener(this.name, this, s$3), h$4 && this.element.addEventListener(this.name, this, t$3), this._$AH = t$3;
	}
	handleEvent(t$3) {
		"function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t$3) : this._$AH.handleEvent(t$3);
	}
};
var Z = class {
	constructor(t$3, i$3, s$3) {
		this.element = t$3, this.type = 6, this._$AN = void 0, this._$AM = i$3, this.options = s$3;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(t$3) {
		M$1(this, t$3);
	}
};
const j = {
	M: h$3,
	P: o$3,
	A: n$2,
	C: 1,
	L: N,
	R,
	D: d,
	V: M$1,
	I: k,
	H,
	N: L,
	U: z,
	B: I,
	F: Z
};
const B = t$2.litHtmlPolyfillSupport;
B?.(S, k), (t$2.litHtmlVersions ??= []).push("3.3.2");
const D = (t$3, i$3, s$3) => {
	const e$4 = s$3?.renderBefore ?? i$3;
	let h$4 = e$4._$litPart$;
	if (void 0 === h$4) {
		const t$4 = s$3?.renderBefore ?? null;
		e$4._$litPart$ = h$4 = new k(i$3.insertBefore(c$2(), t$4), t$4, void 0, s$3 ?? {});
	}
	return h$4._$AI(t$3), h$4;
};

//#endregion
//#region node_modules/lit-html/directive-helpers.js
const { I: t$1 } = j;
const i$1 = /* @__PURE__ */ __name((o$4) => o$4, "i");
const r$1 = /* @__PURE__ */ __name((o$4) => void 0 === o$4.strings, "r");
const s$1 = /* @__PURE__ */ __name(() => document.createComment(""), "s");
const v = (o$4, n$3, e$4) => {
	const l$1 = o$4._$AA.parentNode, d$1 = void 0 === n$3 ? o$4._$AB : n$3._$AA;
	if (void 0 === e$4) e$4 = new t$1(l$1.insertBefore(s$1(), d$1), l$1.insertBefore(s$1(), d$1), o$4, o$4.options);
	else {
		const t$3 = e$4._$AB.nextSibling, n$4 = e$4._$AM, c$3 = n$4 !== o$4;
		if (c$3) {
			let t$4;
			e$4._$AQ?.(o$4), e$4._$AM = o$4, void 0 !== e$4._$AP && (t$4 = o$4._$AU) !== n$4._$AU && e$4._$AP(t$4);
		}
		if (t$3 !== d$1 || c$3) {
			let o$5 = e$4._$AA;
			for (; o$5 !== t$3;) {
				const t$4 = i$1(o$5).nextSibling;
				i$1(l$1).insertBefore(o$5, d$1), o$5 = t$4;
			}
		}
	}
	return e$4;
};
const u$1 = /* @__PURE__ */ __name((o$4, t$3, i$3 = o$4) => (o$4._$AI(t$3, i$3), o$4), "u");
const m = {};
const p = (o$4, t$3 = m) => o$4._$AH = t$3;
const M = (o$4) => o$4._$AH;
const h$2 = /* @__PURE__ */ __name((o$4) => {
	o$4._$AR(), o$4._$AA.remove();
}, "h");

//#endregion
//#region node_modules/lit-html/directive.js
const t = {
	ATTRIBUTE: 1,
	CHILD: 2,
	PROPERTY: 3,
	BOOLEAN_ATTRIBUTE: 4,
	EVENT: 5,
	ELEMENT: 6
};
const e$1 = /* @__PURE__ */ __name((t) => (...e$4) => ({
	_$litDirective$: t,
	values: e$4
}), "e");
var i = class {
	constructor(t) {}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AT(t, e$4, i) {
		this._$Ct = t, this._$AM = e$4, this._$Ci = i;
	}
	_$AS(t, e$4) {
		return this.update(t, e$4);
	}
	update(t, e$4) {
		return this.render(...e$4);
	}
};

//#endregion
//#region node_modules/lit-html/async-directive.js
const s = (i$3, t$3) => {
	const e$4 = i$3._$AN;
	if (void 0 === e$4) return !1;
	for (const i$4 of e$4) i$4._$AO?.(t$3, !1), s(i$4, t$3);
	return !0;
};
const o$2 = /* @__PURE__ */ __name((i$3) => {
	let t$3, e$4;
	do {
		if (void 0 === (t$3 = i$3._$AM)) break;
		e$4 = t$3._$AN, e$4.delete(i$3), i$3 = t$3;
	} while (0 === e$4?.size);
}, "o");
const r = (i$3) => {
	for (let t$3; t$3 = i$3._$AM; i$3 = t$3) {
		let e$4 = t$3._$AN;
		if (void 0 === e$4) t$3._$AN = e$4 = /* @__PURE__ */ new Set();
		else if (e$4.has(i$3)) break;
		e$4.add(i$3), c$1(t$3);
	}
};
function h$1(i$3) {
	void 0 !== this._$AN ? (o$2(this), this._$AM = i$3, r(this)) : this._$AM = i$3;
}
__name(h$1, "h");
function n$1(i$3, t$3 = !1, e$4 = 0) {
	const r = this._$AH;
	const h$4 = this._$AN;
	if (void 0 !== h$4 && 0 !== h$4.size) if (t$3) if (Array.isArray(r)) for (let i$4 = e$4; i$4 < r.length; i$4++) s(r[i$4], !1), o$2(r[i$4]);
	else null != r && (s(r, !1), o$2(r));
	else s(this, i$3);
}
__name(n$1, "n");
const c$1 = /* @__PURE__ */ __name((i$3) => {
	i$3.type == t.CHILD && (i$3._$AP ??= n$1, i$3._$AQ ??= h$1);
}, "c");
var f = class extends i {
	constructor() {
		super(...arguments), this._$AN = void 0;
	}
	_$AT(i$3, t$3, e$4) {
		super._$AT(i$3, t$3, e$4), r(this), this.isConnected = i$3._$AU;
	}
	_$AO(i$3, t$3 = !0) {
		i$3 !== this.isConnected && (this.isConnected = i$3, i$3 ? this.reconnected?.() : this.disconnected?.()), t$3 && (s(this, i$3), o$2(this));
	}
	setValue(t$3) {
		if (r$1(this._$Ct)) this._$Ct._$AI(t$3, this);
		else {
			const i$3 = [...this._$Ct._$AH];
			i$3[this._$Ci] = t$3, this._$Ct._$AI(i$3, this, 0);
		}
	}
	disconnected() {}
	reconnected() {}
};

//#endregion
//#region node_modules/lit-html/directives/ref.js
/**
* @license
* Copyright 2020 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/ const e = () => new h();
var h = class {};
const o$1 = /* @__PURE__ */ new WeakMap();
const n = e$1(class extends f {
	render(i$3) {
		return A;
	}
	update(i$3, [s$3]) {
		const e = s$3 !== this.G;
		return e && void 0 !== this.G && this.rt(void 0), (e || this.lt !== this.ct) && (this.G = s$3, this.ht = i$3.options?.host, this.rt(this.ct = i$3.element)), A;
	}
	rt(t$3) {
		if (this.isConnected || (t$3 = void 0), "function" == typeof this.G) {
			const i$3 = this.ht ?? globalThis;
			let s$3 = o$1.get(i$3);
			void 0 === s$3 && (s$3 = /* @__PURE__ */ new WeakMap(), o$1.set(i$3, s$3)), void 0 !== s$3.get(this.G) && this.G.call(this.ht, void 0), s$3.set(this.G, t$3), void 0 !== t$3 && this.G.call(this.ht, t$3);
		} else this.G.value = t$3;
	}
	get lt() {
		return "function" == typeof this.G ? o$1.get(this.ht ?? globalThis)?.get(this.G) : this.G?.value;
	}
	disconnected() {
		this.lt === this.ct && this.rt(void 0);
	}
	reconnected() {
		this.rt(this.ct);
	}
});

//#endregion
//#region node_modules/lit-html/directives/repeat.js
const u = (e$4, s$3, t$3) => {
	const r$3 = /* @__PURE__ */ new Map();
	for (let l$1 = s$3; l$1 <= t$3; l$1++) r$3.set(e$4[l$1], l$1);
	return r$3;
};
const c = e$1(class extends i {
	constructor(e$4) {
		if (super(e$4), e$4.type !== t.CHILD) throw Error("repeat() can only be used in text expressions");
	}
	dt(e$4, s$3, t$3) {
		let r$3;
		void 0 === t$3 ? t$3 = s$3 : void 0 !== s$3 && (r$3 = s$3);
		const l$1 = [], o$4 = [];
		let i$3 = 0;
		for (const s$4 of e$4) l$1[i$3] = r$3 ? r$3(s$4, i$3) : i$3, o$4[i$3] = t$3(s$4, i$3), i$3++;
		return {
			values: o$4,
			keys: l$1
		};
	}
	render(e$4, s$3, t$3) {
		return this.dt(e$4, s$3, t$3).values;
	}
	update(s$3, [t$3, r$3, c]) {
		const d$1 = M(s$3), { values: p$2, keys: a$1 } = this.dt(t$3, r$3, c);
		if (!Array.isArray(d$1)) return this.ut = a$1, p$2;
		const h$4 = this.ut ??= [], v$2 = [];
		let m$2, y$1, x$1 = 0, j$1 = d$1.length - 1, k$1 = 0, w$1 = p$2.length - 1;
		for (; x$1 <= j$1 && k$1 <= w$1;) if (null === d$1[x$1]) x$1++;
		else if (null === d$1[j$1]) j$1--;
		else if (h$4[x$1] === a$1[k$1]) v$2[k$1] = u$1(d$1[x$1], p$2[k$1]), x$1++, k$1++;
		else if (h$4[j$1] === a$1[w$1]) v$2[w$1] = u$1(d$1[j$1], p$2[w$1]), j$1--, w$1--;
		else if (h$4[x$1] === a$1[w$1]) v$2[w$1] = u$1(d$1[x$1], p$2[w$1]), v(s$3, v$2[w$1 + 1], d$1[x$1]), x$1++, w$1--;
		else if (h$4[j$1] === a$1[k$1]) v$2[k$1] = u$1(d$1[j$1], p$2[k$1]), v(s$3, d$1[x$1], d$1[j$1]), j$1--, k$1++;
		else if (void 0 === m$2 && (m$2 = u(a$1, k$1, w$1), y$1 = u(h$4, x$1, j$1)), m$2.has(h$4[x$1])) if (m$2.has(h$4[j$1])) {
			const e$4 = y$1.get(a$1[k$1]), t$4 = void 0 !== e$4 ? d$1[e$4] : null;
			if (null === t$4) {
				const e$5 = v(s$3, d$1[x$1]);
				u$1(e$5, p$2[k$1]), v$2[k$1] = e$5;
			} else v$2[k$1] = u$1(t$4, p$2[k$1]), v(s$3, d$1[x$1], t$4), d$1[e$4] = null;
			k$1++;
		} else h$2(d$1[j$1]), j$1--;
		else h$2(d$1[x$1]), x$1++;
		for (; k$1 <= w$1;) {
			const e$4 = v(s$3, v$2[w$1 + 1]);
			u$1(e$4, p$2[k$1]), v$2[k$1++] = e$4;
		}
		for (; x$1 <= j$1;) {
			const e$4 = d$1[x$1++];
			null !== e$4 && h$2(e$4);
		}
		return this.ut = a$1, p(s$3, v$2), E;
	}
});

//#endregion
//#region node_modules/lit-html/directives/unsafe-html.js
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/ var e$2 = class extends i {
	static {
		__name(this, "e");
	}
	constructor(i$3) {
		if (super(i$3), this.it = A, i$3.type !== t.CHILD) throw Error(this.constructor.directiveName + "() can only be used in child bindings");
	}
	render(r$3) {
		if (r$3 === A || null == r$3) return this._t = void 0, this.it = r$3;
		if (r$3 === E) return r$3;
		if ("string" != typeof r$3) throw Error(this.constructor.directiveName + "() called with a non-string value");
		if (r$3 === this.it) return this._t;
		this.it = r$3;
		const s$3 = [r$3];
		return s$3.raw = s$3, this._t = {
			_$litType$: this.constructor.resultType,
			strings: s$3,
			values: []
		};
	}
};
e$2.directiveName = "unsafeHTML", e$2.resultType = 1;
const o = e$1(e$2);

//#endregion
export { f as AsyncDirective, i as Directive, t as PartType, j as _$LH, e as createRef, e$1 as directive, b as html, E as noChange, A as nothing, n as ref, D as render, c as repeat, o as unsafeHTML };
//# sourceMappingURL=bundle02.js.map