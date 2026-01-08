//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", {
	value,
	configurable: true
});
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") {
		for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
			key = keys[i];
			if (!__hasOwnProp.call(to, key) && key !== except) {
				__defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
		}
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
//#region node_modules/@libsql/core/lib-esm/api.js
/** Error thrown by the client. */
var LibsqlError = class extends Error {
	/** Machine-readable error code. */
	code;
	/** Raw numeric error code */
	rawCode;
	constructor(message, code, rawCode, cause) {
		if (code !== void 0) message = `${code}: ${message}`;
		super(message, { cause });
		this.code = code;
		this.rawCode = rawCode;
		this.name = "LibsqlError";
	}
};

//#endregion
//#region node_modules/@libsql/core/lib-esm/uri.js
function parseUri(text) {
	const match = URI_RE.exec(text);
	if (match === null) throw new LibsqlError(`The URL '${text}' is not in a valid format`, "URL_INVALID");
	const groups = match.groups;
	return {
		scheme: groups["scheme"],
		authority: groups["authority"] !== void 0 ? parseAuthority(groups["authority"]) : void 0,
		path: percentDecode(groups["path"]),
		query: groups["query"] !== void 0 ? parseQuery(groups["query"]) : void 0,
		fragment: groups["fragment"] !== void 0 ? percentDecode(groups["fragment"]) : void 0
	};
}
const URI_RE = new RegExp(`^(?<scheme>[A-Za-z][A-Za-z.+-]*):(//(?<authority>[^/?#]*))?(?<path>[^?#]*)(\\?(?<query>[^#]*))?(#(?<fragment>.*))?$`, "su");
function parseAuthority(text) {
	const match = AUTHORITY_RE.exec(text);
	if (match === null) throw new LibsqlError("The authority part of the URL is not in a valid format", "URL_INVALID");
	const groups = match.groups;
	return {
		host: percentDecode(groups["host_br"] ?? groups["host"]),
		port: groups["port"] ? parseInt(groups["port"], 10) : void 0,
		userinfo: groups["username"] !== void 0 ? {
			username: percentDecode(groups["username"]),
			password: groups["password"] !== void 0 ? percentDecode(groups["password"]) : void 0
		} : void 0
	};
}
const AUTHORITY_RE = new RegExp(`^((?<username>[^:]*)(:(?<password>.*))?@)?((?<host>[^:\\[\\]]*)|(\\[(?<host_br>[^\\[\\]]*)\\]))(:(?<port>[0-9]*))?$`, "su");
function parseQuery(text) {
	const sequences = text.split("&");
	const pairs = [];
	for (const sequence of sequences) {
		if (sequence === "") continue;
		let key;
		let value;
		const splitIdx = sequence.indexOf("=");
		if (splitIdx < 0) {
			key = sequence;
			value = "";
		} else {
			key = sequence.substring(0, splitIdx);
			value = sequence.substring(splitIdx + 1);
		}
		pairs.push({
			key: percentDecode(key.replaceAll("+", " ")),
			value: percentDecode(value.replaceAll("+", " "))
		});
	}
	return { pairs };
}
function percentDecode(text) {
	try {
		return decodeURIComponent(text);
	} catch (e) {
		if (e instanceof URIError) throw new LibsqlError(`URL component has invalid percent encoding: ${e}`, "URL_INVALID", void 0, e);
		throw e;
	}
}
function encodeBaseUrl(scheme, authority, path) {
	if (authority === void 0) throw new LibsqlError(`URL with scheme ${JSON.stringify(scheme + ":")} requires authority (the "//" part)`, "URL_INVALID");
	const schemeText = `${scheme}:`;
	const hostText = encodeHost(authority.host);
	const portText = encodePort(authority.port);
	const authorityText = `//${encodeUserinfo(authority.userinfo)}${hostText}${portText}`;
	let pathText = path.split("/").map(encodeURIComponent).join("/");
	if (pathText !== "" && !pathText.startsWith("/")) pathText = "/" + pathText;
	return new URL(`${schemeText}${authorityText}${pathText}`);
}
function encodeHost(host) {
	return host.includes(":") ? `[${encodeURI(host)}]` : encodeURI(host);
}
function encodePort(port) {
	return port !== void 0 ? `:${port}` : "";
}
function encodeUserinfo(userinfo) {
	if (userinfo === void 0) return "";
	return `${encodeURIComponent(userinfo.username)}${userinfo.password !== void 0 ? `:${encodeURIComponent(userinfo.password)}` : ""}@`;
}

//#endregion
//#region node_modules/js-base64/base64.mjs
/**
*  base64.ts
*
*  Licensed under the BSD 3-Clause License.
*    http://opensource.org/licenses/BSD-3-Clause
*
*  References:
*    http://en.wikipedia.org/wiki/Base64
*
* @author Dan Kogai (https://github.com/dankogai)
*/
const version = "3.7.8";
/**
* @deprecated use lowercase `version`.
*/
const VERSION = version;
const _hasBuffer = typeof Buffer === "function";
const _TD = typeof TextDecoder === "function" ? new TextDecoder() : void 0;
const _TE = typeof TextEncoder === "function" ? new TextEncoder() : void 0;
const b64chs = Array.prototype.slice.call("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=");
const b64tab = ((a) => {
	let tab = {};
	a.forEach((c, i) => tab[c] = i);
	return tab;
})(b64chs);
const b64re = /^(?:[A-Za-z\d+\/]{4})*?(?:[A-Za-z\d+\/]{2}(?:==)?|[A-Za-z\d+\/]{3}=?)?$/;
const _fromCC = String.fromCharCode.bind(String);
const _U8Afrom = typeof Uint8Array.from === "function" ? Uint8Array.from.bind(Uint8Array) : (it) => new Uint8Array(Array.prototype.slice.call(it, 0));
const _mkUriSafe = (src) => src.replace(/=/g, "").replace(/[+\/]/g, (m0) => m0 == "+" ? "-" : "_");
const _tidyB64 = (s) => s.replace(/[^A-Za-z0-9\+\/]/g, "");
/**
* polyfill version of `btoa`
*/
const btoaPolyfill = (bin) => {
	let u32;
	let c0;
	let c1;
	let c2;
	let asc = "";
	const pad = bin.length % 3;
	for (let i = 0; i < bin.length;) {
		if ((c0 = bin.charCodeAt(i++)) > 255 || (c1 = bin.charCodeAt(i++)) > 255 || (c2 = bin.charCodeAt(i++)) > 255) throw new TypeError("invalid character found");
		u32 = c0 << 16 | c1 << 8 | c2;
		asc += b64chs[u32 >> 18 & 63] + b64chs[u32 >> 12 & 63] + b64chs[u32 >> 6 & 63] + b64chs[u32 & 63];
	}
	return pad ? asc.slice(0, pad - 3) + "===".substring(pad) : asc;
};
/**
* does what `window.btoa` of web browsers do.
* @param {String} bin binary string
* @returns {string} Base64-encoded string
*/
const _btoa = typeof btoa === "function" ? (bin) => btoa(bin) : _hasBuffer ? (bin) => Buffer.from(bin, "binary").toString("base64") : btoaPolyfill;
const _fromUint8Array = _hasBuffer ? (u8a) => Buffer.from(u8a).toString("base64") : (u8a) => {
	const maxargs = 4096;
	let strs = [];
	for (let i = 0, l = u8a.length; i < l; i += maxargs) strs.push(_fromCC.apply(null, u8a.subarray(i, i + maxargs)));
	return _btoa(strs.join(""));
};
/**
* converts a Uint8Array to a Base64 string.
* @param {boolean} [urlsafe] URL-and-filename-safe a la RFC4648 §5
* @returns {string} Base64 string
*/
const fromUint8Array = (u8a, urlsafe = false) => urlsafe ? _mkUriSafe(_fromUint8Array(u8a)) : _fromUint8Array(u8a);
const cb_utob = (c) => {
	if (c.length < 2) {
		var cc = c.charCodeAt(0);
		return cc < 128 ? c : cc < 2048 ? _fromCC(192 | cc >>> 6) + _fromCC(128 | cc & 63) : _fromCC(224 | cc >>> 12 & 15) + _fromCC(128 | cc >>> 6 & 63) + _fromCC(128 | cc & 63);
	} else {
		var cc = 65536 + (c.charCodeAt(0) - 55296) * 1024 + (c.charCodeAt(1) - 56320);
		return _fromCC(240 | cc >>> 18 & 7) + _fromCC(128 | cc >>> 12 & 63) + _fromCC(128 | cc >>> 6 & 63) + _fromCC(128 | cc & 63);
	}
};
const re_utob = /[\uD800-\uDBFF][\uDC00-\uDFFFF]|[^\x00-\x7F]/g;
/**
* @deprecated should have been internal use only.
* @param {string} src UTF-8 string
* @returns {string} UTF-16 string
*/
const utob = (u) => u.replace(re_utob, cb_utob);
const _encode = _hasBuffer ? (s) => Buffer.from(s, "utf8").toString("base64") : _TE ? (s) => _fromUint8Array(_TE.encode(s)) : (s) => _btoa(utob(s));
/**
* converts a UTF-8-encoded string to a Base64 string.
* @param {boolean} [urlsafe] if `true` make the result URL-safe
* @returns {string} Base64 string
*/
const encode = (src, urlsafe = false) => urlsafe ? _mkUriSafe(_encode(src)) : _encode(src);
/**
* converts a UTF-8-encoded string to URL-safe Base64 RFC4648 §5.
* @returns {string} Base64 string
*/
const encodeURI$1 = /* @__PURE__ */ __name((src) => encode(src, true), "encodeURI");
const re_btou = /[\xC0-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}|[\xF0-\xF7][\x80-\xBF]{3}/g;
const cb_btou = (cccc) => {
	switch (cccc.length) {
		case 4:
			var offset = ((7 & cccc.charCodeAt(0)) << 18 | (63 & cccc.charCodeAt(1)) << 12 | (63 & cccc.charCodeAt(2)) << 6 | 63 & cccc.charCodeAt(3)) - 65536;
			return _fromCC((offset >>> 10) + 55296) + _fromCC((offset & 1023) + 56320);
		case 3: return _fromCC((15 & cccc.charCodeAt(0)) << 12 | (63 & cccc.charCodeAt(1)) << 6 | 63 & cccc.charCodeAt(2));
		default: return _fromCC((31 & cccc.charCodeAt(0)) << 6 | 63 & cccc.charCodeAt(1));
	}
};
/**
* @deprecated should have been internal use only.
* @param {string} src UTF-16 string
* @returns {string} UTF-8 string
*/
const btou = (b) => b.replace(re_btou, cb_btou);
/**
* polyfill version of `atob`
*/
const atobPolyfill = (asc) => {
	asc = asc.replace(/\s+/g, "");
	if (!b64re.test(asc)) throw new TypeError("malformed base64.");
	asc += "==".slice(2 - (asc.length & 3));
	let u24;
	let r1;
	let r2;
	let binArray = [];
	for (let i = 0; i < asc.length;) {
		u24 = b64tab[asc.charAt(i++)] << 18 | b64tab[asc.charAt(i++)] << 12 | (r1 = b64tab[asc.charAt(i++)]) << 6 | (r2 = b64tab[asc.charAt(i++)]);
		if (r1 === 64) binArray.push(_fromCC(u24 >> 16 & 255));
		else if (r2 === 64) binArray.push(_fromCC(u24 >> 16 & 255, u24 >> 8 & 255));
		else binArray.push(_fromCC(u24 >> 16 & 255, u24 >> 8 & 255, u24 & 255));
	}
	return binArray.join("");
};
/**
* does what `window.atob` of web browsers do.
* @param {String} asc Base64-encoded string
* @returns {string} binary string
*/
const _atob = typeof atob === "function" ? (asc) => atob(_tidyB64(asc)) : _hasBuffer ? (asc) => Buffer.from(asc, "base64").toString("binary") : atobPolyfill;
const _toUint8Array = _hasBuffer ? (a) => _U8Afrom(Buffer.from(a, "base64")) : (a) => _U8Afrom(_atob(a).split("").map((c) => c.charCodeAt(0)));
/**
* converts a Base64 string to a Uint8Array.
*/
const toUint8Array = (a) => _toUint8Array(_unURI(a));
const _decode = _hasBuffer ? (a) => Buffer.from(a, "base64").toString("utf8") : _TD ? (a) => _TD.decode(_toUint8Array(a)) : (a) => btou(_atob(a));
const _unURI = (a) => _tidyB64(a.replace(/[-_]/g, (m0) => m0 == "-" ? "+" : "/"));
/**
* converts a Base64 string to a UTF-8 string.
* @param {String} src Base64 string.  Both normal and URL-safe are supported
* @returns {string} UTF-8 string
*/
const decode = (src) => _decode(_unURI(src));
/**
* check if a value is a valid Base64 string
* @param {String} src a value to check
*/
const isValid = (src) => {
	if (typeof src !== "string") return false;
	const s = src.replace(/\s+/g, "").replace(/={0,2}$/, "");
	return !/[^\s0-9a-zA-Z\+/]/.test(s) || !/[^\s0-9a-zA-Z\-_]/.test(s);
};
const _noEnum = (v) => {
	return {
		value: v,
		enumerable: false,
		writable: true,
		configurable: true
	};
};
/**
* extend String.prototype with relevant methods
*/
const extendString = function() {
	const _add = (name, body) => Object.defineProperty(String.prototype, name, _noEnum(body));
	_add("fromBase64", function() {
		return decode(this);
	});
	_add("toBase64", function(urlsafe) {
		return encode(this, urlsafe);
	});
	_add("toBase64URI", function() {
		return encode(this, true);
	});
	_add("toBase64URL", function() {
		return encode(this, true);
	});
	_add("toUint8Array", function() {
		return toUint8Array(this);
	});
};
/**
* extend Uint8Array.prototype with relevant methods
*/
const extendUint8Array = function() {
	const _add = (name, body) => Object.defineProperty(Uint8Array.prototype, name, _noEnum(body));
	_add("toBase64", function(urlsafe) {
		return fromUint8Array(this, urlsafe);
	});
	_add("toBase64URI", function() {
		return fromUint8Array(this, true);
	});
	_add("toBase64URL", function() {
		return fromUint8Array(this, true);
	});
};
/**
* extend Builtin prototypes with relevant methods
*/
const extendBuiltins = () => {
	extendString();
	extendUint8Array();
};
const gBase64 = {
	version,
	VERSION,
	atob: _atob,
	atobPolyfill,
	btoa: _btoa,
	btoaPolyfill,
	fromBase64: decode,
	toBase64: encode,
	encode,
	encodeURI: encodeURI$1,
	encodeURL: encodeURI$1,
	utob,
	btou,
	decode,
	isValid,
	fromUint8Array,
	toUint8Array,
	extendString,
	extendUint8Array,
	extendBuiltins
};

//#endregion
//#region node_modules/@libsql/core/lib-esm/util.js
const supportedUrlLink = "https://github.com/libsql/libsql-client-ts#supported-urls";
function transactionModeToBegin(mode) {
	if (mode === "write") return "BEGIN IMMEDIATE";
	else if (mode === "read") return "BEGIN TRANSACTION READONLY";
	else if (mode === "deferred") return "BEGIN DEFERRED";
	else throw RangeError("Unknown transaction mode, supported values are \"write\", \"read\" and \"deferred\"");
}
var ResultSetImpl = class {
	columns;
	columnTypes;
	rows;
	rowsAffected;
	lastInsertRowid;
	constructor(columns, columnTypes, rows, rowsAffected, lastInsertRowid) {
		this.columns = columns;
		this.columnTypes = columnTypes;
		this.rows = rows;
		this.rowsAffected = rowsAffected;
		this.lastInsertRowid = lastInsertRowid;
	}
	toJSON() {
		return {
			columns: this.columns,
			columnTypes: this.columnTypes,
			rows: this.rows.map(rowToJson),
			rowsAffected: this.rowsAffected,
			lastInsertRowid: this.lastInsertRowid !== void 0 ? "" + this.lastInsertRowid : null
		};
	}
};
function rowToJson(row) {
	return Array.prototype.map.call(row, valueToJson);
}
function valueToJson(value) {
	if (typeof value === "bigint") return "" + value;
	else if (value instanceof ArrayBuffer) return gBase64.fromUint8Array(new Uint8Array(value));
	else return value;
}

//#endregion
//#region node_modules/@libsql/core/lib-esm/config.js
const inMemoryMode = ":memory:";
function expandConfig(config, preferHttp) {
	if (typeof config !== "object") throw new TypeError(`Expected client configuration as object, got ${typeof config}`);
	let { url, authToken, tls, intMode, concurrency } = config;
	concurrency = Math.max(0, concurrency || 20);
	intMode ??= "number";
	let connectionQueryParams = [];
	if (url === inMemoryMode) url = "file::memory:";
	const uri = parseUri(url);
	const originalUriScheme = uri.scheme.toLowerCase();
	const isInMemoryMode = originalUriScheme === "file" && uri.path === inMemoryMode && uri.authority === void 0;
	let queryParamsDef;
	if (isInMemoryMode) queryParamsDef = { cache: {
		values: ["shared", "private"],
		update: (key, value) => connectionQueryParams.push(`${key}=${value}`)
	} };
	else queryParamsDef = {
		tls: {
			values: ["0", "1"],
			update: (_, value) => tls = value === "1"
		},
		authToken: { update: (_, value) => authToken = value }
	};
	for (const { key, value } of uri.query?.pairs ?? []) {
		if (!Object.hasOwn(queryParamsDef, key)) throw new LibsqlError(`Unsupported URL query parameter ${JSON.stringify(key)}`, "URL_PARAM_NOT_SUPPORTED");
		const queryParamDef = queryParamsDef[key];
		if (queryParamDef.values !== void 0 && !queryParamDef.values.includes(value)) throw new LibsqlError(`Unknown value for the "${key}" query argument: ${JSON.stringify(value)}. Supported values are: [${queryParamDef.values.map((x) => "\"" + x + "\"").join(", ")}]`, "URL_INVALID");
		if (queryParamDef.update !== void 0) queryParamDef?.update(key, value);
	}
	const connectionQueryParamsString = connectionQueryParams.length === 0 ? "" : `?${connectionQueryParams.join("&")}`;
	const path = uri.path + connectionQueryParamsString;
	let scheme;
	if (originalUriScheme === "libsql") if (tls === false) {
		if (uri.authority?.port === void 0) throw new LibsqlError("A \"libsql:\" URL with ?tls=0 must specify an explicit port", "URL_INVALID");
		scheme = preferHttp ? "http" : "ws";
	} else scheme = preferHttp ? "https" : "wss";
	else scheme = originalUriScheme;
	if (scheme === "http" || scheme === "ws") tls ??= false;
	else tls ??= true;
	if (scheme !== "http" && scheme !== "ws" && scheme !== "https" && scheme !== "wss" && scheme !== "file") throw new LibsqlError(`The client supports only "libsql:", "wss:", "ws:", "https:", "http:" and "file:" URLs, got ${JSON.stringify(uri.scheme + ":")}. For more information, please read ${supportedUrlLink}`, "URL_SCHEME_NOT_SUPPORTED");
	if (intMode !== "number" && intMode !== "bigint" && intMode !== "string") throw new TypeError(`Invalid value for intMode, expected "number", "bigint" or "string", got ${JSON.stringify(intMode)}`);
	if (uri.fragment !== void 0) throw new LibsqlError(`URL fragments are not supported: ${JSON.stringify("#" + uri.fragment)}`, "URL_INVALID");
	if (isInMemoryMode) return {
		scheme: "file",
		tls: false,
		path,
		intMode,
		concurrency,
		syncUrl: config.syncUrl,
		syncInterval: config.syncInterval,
		readYourWrites: config.readYourWrites,
		offline: config.offline,
		fetch: config.fetch,
		authToken: void 0,
		encryptionKey: void 0,
		authority: void 0
	};
	return {
		scheme,
		tls,
		authority: uri.authority,
		path,
		authToken,
		intMode,
		concurrency,
		encryptionKey: config.encryptionKey,
		syncUrl: config.syncUrl,
		syncInterval: config.syncInterval,
		readYourWrites: config.readYourWrites,
		offline: config.offline,
		fetch: config.fetch
	};
}

//#endregion
//#region node_modules/@libsql/isomorphic-ws/web.mjs
let _WebSocket;
if (typeof WebSocket !== "undefined") _WebSocket = WebSocket;
else if (typeof global !== "undefined") _WebSocket = global.WebSocket;
else if (typeof window !== "undefined") _WebSocket = window.WebSocket;
else if (typeof self !== "undefined") _WebSocket = self.WebSocket;

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/client.js
/** A client for the Hrana protocol (a "database connection pool"). */
var Client = class {
	/** @private */
	constructor() {
		this.intMode = "number";
	}
	/** Representation of integers returned from the database. See {@link IntMode}.
	*
	* This value is inherited by {@link Stream} objects created with {@link openStream}, but you can
	* override the integer mode for every stream by setting {@link Stream.intMode} on the stream.
	*/
	intMode;
};

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/errors.js
/** Generic error produced by the Hrana client. */
var ClientError = class extends Error {
	/** @private */
	constructor(message) {
		super(message);
		this.name = "ClientError";
	}
};
/** Error thrown when the server violates the protocol. */
var ProtoError = class extends ClientError {
	/** @private */
	constructor(message) {
		super(message);
		this.name = "ProtoError";
	}
};
/** Error thrown when the server returns an error response. */
var ResponseError = class extends ClientError {
	code;
	/** @internal */
	proto;
	/** @private */
	constructor(message, protoError) {
		super(message);
		this.name = "ResponseError";
		this.code = protoError.code;
		this.proto = protoError;
		this.stack = void 0;
	}
};
/** Error thrown when the client or stream is closed. */
var ClosedError = class extends ClientError {
	/** @private */
	constructor(message, cause) {
		if (cause !== void 0) {
			super(`${message}: ${cause}`);
			this.cause = cause;
		} else super(message);
		this.name = "ClosedError";
	}
};
/** Error thrown when the environment does not seem to support WebSockets. */
var WebSocketUnsupportedError = class extends ClientError {
	/** @private */
	constructor(message) {
		super(message);
		this.name = "WebSocketUnsupportedError";
	}
};
/** Error thrown when we encounter a WebSocket error. */
var WebSocketError = class extends ClientError {
	/** @private */
	constructor(message) {
		super(message);
		this.name = "WebSocketError";
	}
};
/** Error thrown when the HTTP server returns an error response. */
var HttpServerError = class extends ClientError {
	status;
	/** @private */
	constructor(message, status) {
		super(message);
		this.status = status;
		this.name = "HttpServerError";
	}
};
/** Error thrown when the protocol version is too low to support a feature. */
var ProtocolVersionError = class extends ClientError {
	/** @private */
	constructor(message) {
		super(message);
		this.name = "ProtocolVersionError";
	}
};
/** Error thrown when an internal client error happens. */
var InternalError = class extends ClientError {
	/** @private */
	constructor(message) {
		super(message);
		this.name = "InternalError";
	}
};
/** Error thrown when the API is misused. */
var MisuseError = class extends ClientError {
	/** @private */
	constructor(message) {
		super(message);
		this.name = "MisuseError";
	}
};

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/encoding/json/decode.js
function string(value) {
	if (typeof value === "string") return value;
	throw typeError(value, "string");
}
function stringOpt(value) {
	if (value === null || value === void 0) return;
	else if (typeof value === "string") return value;
	throw typeError(value, "string or null");
}
function number(value) {
	if (typeof value === "number") return value;
	throw typeError(value, "number");
}
function boolean(value) {
	if (typeof value === "boolean") return value;
	throw typeError(value, "boolean");
}
function array(value) {
	if (Array.isArray(value)) return value;
	throw typeError(value, "array");
}
function object(value) {
	if (value !== null && typeof value === "object" && !Array.isArray(value)) return value;
	throw typeError(value, "object");
}
function arrayObjectsMap(value, fun) {
	return array(value).map((elemValue) => fun(object(elemValue)));
}
function typeError(value, expected) {
	if (value === void 0) return new ProtoError(`Expected ${expected}, but the property was missing`);
	let received = typeof value;
	if (value === null) received = "null";
	else if (Array.isArray(value)) received = "array";
	return new ProtoError(`Expected ${expected}, received ${received}`);
}
function readJsonObject(value, fun) {
	return fun(object(value));
}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/encoding/json/encode.js
var ObjectWriter = class {
	#output;
	#isFirst;
	constructor(output) {
		this.#output = output;
		this.#isFirst = false;
	}
	begin() {
		this.#output.push("{");
		this.#isFirst = true;
	}
	end() {
		this.#output.push("}");
		this.#isFirst = false;
	}
	#key(name) {
		if (this.#isFirst) {
			this.#output.push("\"");
			this.#isFirst = false;
		} else this.#output.push(",\"");
		this.#output.push(name);
		this.#output.push("\":");
	}
	string(name, value) {
		this.#key(name);
		this.#output.push(JSON.stringify(value));
	}
	stringRaw(name, value) {
		this.#key(name);
		this.#output.push("\"");
		this.#output.push(value);
		this.#output.push("\"");
	}
	number(name, value) {
		this.#key(name);
		this.#output.push("" + value);
	}
	boolean(name, value) {
		this.#key(name);
		this.#output.push(value ? "true" : "false");
	}
	object(name, value, valueFun) {
		this.#key(name);
		this.begin();
		valueFun(this, value);
		this.end();
	}
	arrayObjects(name, values, valueFun) {
		this.#key(name);
		this.#output.push("[");
		for (let i = 0; i < values.length; ++i) {
			if (i !== 0) this.#output.push(",");
			this.begin();
			valueFun(this, values[i]);
			this.end();
		}
		this.#output.push("]");
	}
};
function writeJsonObject(value, fun) {
	const output = [];
	const writer = new ObjectWriter(output);
	writer.begin();
	fun(writer, value);
	writer.end();
	return output.join("");
}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/encoding/protobuf/util.js
const VARINT = 0;
const FIXED_64 = 1;
const LENGTH_DELIMITED = 2;
const FIXED_32 = 5;

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/encoding/protobuf/decode.js
var MessageReader = class {
	#array;
	#view;
	#pos;
	constructor(array$1) {
		this.#array = array$1;
		this.#view = new DataView(array$1.buffer, array$1.byteOffset, array$1.byteLength);
		this.#pos = 0;
	}
	varint() {
		let value = 0;
		for (let shift = 0;; shift += 7) {
			const byte = this.#array[this.#pos++];
			value |= (byte & 127) << shift;
			if (!(byte & 128)) break;
		}
		return value;
	}
	varintBig() {
		let value = 0n;
		for (let shift = 0n;; shift += 7n) {
			const byte = this.#array[this.#pos++];
			value |= BigInt(byte & 127) << shift;
			if (!(byte & 128)) break;
		}
		return value;
	}
	bytes(length) {
		const array$1 = new Uint8Array(this.#array.buffer, this.#array.byteOffset + this.#pos, length);
		this.#pos += length;
		return array$1;
	}
	double() {
		const value = this.#view.getFloat64(this.#pos, true);
		this.#pos += 8;
		return value;
	}
	skipVarint() {
		for (;;) if (!(this.#array[this.#pos++] & 128)) break;
	}
	skip(count) {
		this.#pos += count;
	}
	eof() {
		return this.#pos >= this.#array.byteLength;
	}
};
var FieldReader = class {
	#reader;
	#wireType;
	constructor(reader) {
		this.#reader = reader;
		this.#wireType = -1;
	}
	setup(wireType) {
		this.#wireType = wireType;
	}
	#expect(expectedWireType) {
		if (this.#wireType !== expectedWireType) throw new ProtoError(`Expected wire type ${expectedWireType}, got ${this.#wireType}`);
		this.#wireType = -1;
	}
	bytes() {
		this.#expect(LENGTH_DELIMITED);
		const length = this.#reader.varint();
		return this.#reader.bytes(length);
	}
	string() {
		return new TextDecoder().decode(this.bytes());
	}
	message(def) {
		return readProtobufMessage(this.bytes(), def);
	}
	int32() {
		this.#expect(VARINT);
		return this.#reader.varint();
	}
	uint32() {
		return this.int32();
	}
	bool() {
		return this.int32() !== 0;
	}
	uint64() {
		this.#expect(VARINT);
		return this.#reader.varintBig();
	}
	sint64() {
		const value = this.uint64();
		return value >> 1n ^ -(value & 1n);
	}
	double() {
		this.#expect(FIXED_64);
		return this.#reader.double();
	}
	maybeSkip() {
		if (this.#wireType < 0) return;
		else if (this.#wireType === VARINT) this.#reader.skipVarint();
		else if (this.#wireType === FIXED_64) this.#reader.skip(8);
		else if (this.#wireType === LENGTH_DELIMITED) {
			const length = this.#reader.varint();
			this.#reader.skip(length);
		} else if (this.#wireType === FIXED_32) this.#reader.skip(4);
		else throw new ProtoError(`Unexpected wire type ${this.#wireType}`);
		this.#wireType = -1;
	}
};
function readProtobufMessage(data, def) {
	const msgReader = new MessageReader(data);
	const fieldReader = new FieldReader(msgReader);
	let value = def.default();
	while (!msgReader.eof()) {
		const key = msgReader.varint();
		const tag = key >> 3;
		const wireType = key & 7;
		fieldReader.setup(wireType);
		const tagFun = def[tag];
		if (tagFun !== void 0) {
			const returnedValue = tagFun(fieldReader, value);
			if (returnedValue !== void 0) value = returnedValue;
		}
		fieldReader.maybeSkip();
	}
	return value;
}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/encoding/protobuf/encode.js
var MessageWriter = class MessageWriter {
	#buf;
	#array;
	#view;
	#pos;
	constructor() {
		this.#buf = /* @__PURE__ */ new ArrayBuffer(256);
		this.#array = new Uint8Array(this.#buf);
		this.#view = new DataView(this.#buf);
		this.#pos = 0;
	}
	#ensure(extra) {
		if (this.#pos + extra <= this.#buf.byteLength) return;
		let newCap = this.#buf.byteLength;
		while (newCap < this.#pos + extra) newCap *= 2;
		const newBuf = new ArrayBuffer(newCap);
		const newArray = new Uint8Array(newBuf);
		const newView = new DataView(newBuf);
		newArray.set(new Uint8Array(this.#buf, 0, this.#pos));
		this.#buf = newBuf;
		this.#array = newArray;
		this.#view = newView;
	}
	#varint(value) {
		this.#ensure(5);
		value = 0 | value;
		do {
			let byte = value & 127;
			value >>>= 7;
			byte |= value ? 128 : 0;
			this.#array[this.#pos++] = byte;
		} while (value);
	}
	#varintBig(value) {
		this.#ensure(10);
		value = value & 18446744073709551615n;
		do {
			let byte = Number(value & 127n);
			value >>= 7n;
			byte |= value ? 128 : 0;
			this.#array[this.#pos++] = byte;
		} while (value);
	}
	#tag(tag, wireType) {
		this.#varint(tag << 3 | wireType);
	}
	bytes(tag, value) {
		this.#tag(tag, LENGTH_DELIMITED);
		this.#varint(value.byteLength);
		this.#ensure(value.byteLength);
		this.#array.set(value, this.#pos);
		this.#pos += value.byteLength;
	}
	string(tag, value) {
		this.bytes(tag, new TextEncoder().encode(value));
	}
	message(tag, value, fun) {
		const writer = new MessageWriter();
		fun(writer, value);
		this.bytes(tag, writer.data());
	}
	int32(tag, value) {
		this.#tag(tag, VARINT);
		this.#varint(value);
	}
	uint32(tag, value) {
		this.int32(tag, value);
	}
	bool(tag, value) {
		this.int32(tag, value ? 1 : 0);
	}
	sint64(tag, value) {
		this.#tag(tag, VARINT);
		this.#varintBig(value << 1n ^ value >> 63n);
	}
	double(tag, value) {
		this.#tag(tag, FIXED_64);
		this.#ensure(8);
		this.#view.setFloat64(this.#pos, value, true);
		this.#pos += 8;
	}
	data() {
		return new Uint8Array(this.#buf, 0, this.#pos);
	}
};
function writeProtobufMessage(value, fun) {
	const w = new MessageWriter();
	fun(w, value);
	return w.data();
}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/id_alloc.js
var IdAlloc = class {
	#usedIds;
	#freeIds;
	constructor() {
		this.#usedIds = /* @__PURE__ */ new Set();
		this.#freeIds = /* @__PURE__ */ new Set();
	}
	alloc() {
		for (const freeId$1 of this.#freeIds) {
			this.#freeIds.delete(freeId$1);
			this.#usedIds.add(freeId$1);
			if (!this.#usedIds.has(this.#usedIds.size - 1)) this.#freeIds.add(this.#usedIds.size - 1);
			return freeId$1;
		}
		const freeId = this.#usedIds.size;
		this.#usedIds.add(freeId);
		return freeId;
	}
	free(id) {
		if (!this.#usedIds.delete(id)) throw new InternalError("Freeing an id that is not allocated");
		this.#freeIds.delete(this.#usedIds.size);
		if (id < this.#usedIds.size) this.#freeIds.add(id);
	}
};

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/util.js
function impossible(value, message) {
	throw new InternalError(message);
}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/value.js
function valueToProto(value) {
	if (value === null) return null;
	else if (typeof value === "string") return value;
	else if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new RangeError("Only finite numbers (not Infinity or NaN) can be passed as arguments");
		return value;
	} else if (typeof value === "bigint") {
		if (value < minInteger || value > maxInteger) throw new RangeError("This bigint value is too large to be represented as a 64-bit integer and passed as argument");
		return value;
	} else if (typeof value === "boolean") return value ? 1n : 0n;
	else if (value instanceof ArrayBuffer) return new Uint8Array(value);
	else if (value instanceof Uint8Array) return value;
	else if (value instanceof Date) return +value.valueOf();
	else if (typeof value === "object") return "" + value.toString();
	else throw new TypeError("Unsupported type of value");
}
const minInteger = -9223372036854775808n;
const maxInteger = 9223372036854775807n;
function valueFromProto(value, intMode) {
	if (value === null) return null;
	else if (typeof value === "number") return value;
	else if (typeof value === "string") return value;
	else if (typeof value === "bigint") if (intMode === "number") {
		const num = Number(value);
		if (!Number.isSafeInteger(num)) throw new RangeError("Received integer which is too large to be safely represented as a JavaScript number");
		return num;
	} else if (intMode === "bigint") return value;
	else if (intMode === "string") return "" + value;
	else throw new MisuseError("Invalid value for IntMode");
	else if (value instanceof Uint8Array) return value.slice().buffer;
	else if (value === void 0) throw new ProtoError("Received unrecognized type of Value");
	else throw impossible(value, "Impossible type of Value");
}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/result.js
function stmtResultFromProto(result) {
	return {
		affectedRowCount: result.affectedRowCount,
		lastInsertRowid: result.lastInsertRowid,
		columnNames: result.cols.map((col) => col.name),
		columnDecltypes: result.cols.map((col) => col.decltype)
	};
}
function rowsResultFromProto(result, intMode) {
	const stmtResult = stmtResultFromProto(result);
	const rows = result.rows.map((row) => rowFromProto(stmtResult.columnNames, row, intMode));
	return {
		...stmtResult,
		rows
	};
}
function rowResultFromProto(result, intMode) {
	const stmtResult = stmtResultFromProto(result);
	let row;
	if (result.rows.length > 0) row = rowFromProto(stmtResult.columnNames, result.rows[0], intMode);
	return {
		...stmtResult,
		row
	};
}
function valueResultFromProto(result, intMode) {
	const stmtResult = stmtResultFromProto(result);
	let value;
	if (result.rows.length > 0 && stmtResult.columnNames.length > 0) value = valueFromProto(result.rows[0][0], intMode);
	return {
		...stmtResult,
		value
	};
}
function rowFromProto(colNames, values, intMode) {
	const row = {};
	Object.defineProperty(row, "length", { value: values.length });
	for (let i = 0; i < values.length; ++i) {
		const value = valueFromProto(values[i], intMode);
		Object.defineProperty(row, i, { value });
		const colName = colNames[i];
		if (colName !== void 0 && !Object.hasOwn(row, colName)) Object.defineProperty(row, colName, {
			value,
			enumerable: true,
			configurable: true,
			writable: true
		});
	}
	return row;
}
function errorFromProto(error) {
	return new ResponseError(error.message, error);
}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/sql.js
/** Text of an SQL statement cached on the server. */
var Sql = class {
	#owner;
	#sqlId;
	#closed;
	/** @private */
	constructor(owner, sqlId) {
		this.#owner = owner;
		this.#sqlId = sqlId;
		this.#closed = void 0;
	}
	/** @private */
	_getSqlId(owner) {
		if (this.#owner !== owner) throw new MisuseError("Attempted to use SQL text opened with other object");
		else if (this.#closed !== void 0) throw new ClosedError("SQL text is closed", this.#closed);
		return this.#sqlId;
	}
	/** Remove the SQL text from the server, releasing resouces. */
	close() {
		this._setClosed(new ClientError("SQL text was manually closed"));
	}
	/** @private */
	_setClosed(error) {
		if (this.#closed === void 0) {
			this.#closed = error;
			this.#owner._closeSql(this.#sqlId);
		}
	}
	/** True if the SQL text is closed (removed from the server). */
	get closed() {
		return this.#closed !== void 0;
	}
};
function sqlToProto(owner, sql) {
	if (sql instanceof Sql) return { sqlId: sql._getSqlId(owner) };
	else return { sql: "" + sql };
}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/queue.js
var Queue = class {
	#pushStack;
	#shiftStack;
	constructor() {
		this.#pushStack = [];
		this.#shiftStack = [];
	}
	get length() {
		return this.#pushStack.length + this.#shiftStack.length;
	}
	push(elem) {
		this.#pushStack.push(elem);
	}
	shift() {
		if (this.#shiftStack.length === 0 && this.#pushStack.length > 0) {
			this.#shiftStack = this.#pushStack.reverse();
			this.#pushStack = [];
		}
		return this.#shiftStack.pop();
	}
	first() {
		return this.#shiftStack.length !== 0 ? this.#shiftStack[this.#shiftStack.length - 1] : this.#pushStack[0];
	}
};

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/stmt.js
/** A statement that can be evaluated by the database. Besides the SQL text, it also contains the positional
* and named arguments. */
var Stmt$2 = class {
	static {
		__name(this, "Stmt");
	}
	/** The SQL statement text. */
	sql;
	/** @private */
	_args;
	/** @private */
	_namedArgs;
	/** Initialize the statement with given SQL text. */
	constructor(sql) {
		this.sql = sql;
		this._args = [];
		this._namedArgs = /* @__PURE__ */ new Map();
	}
	/** Binds positional parameters from the given `values`. All previous positional bindings are cleared. */
	bindIndexes(values) {
		this._args.length = 0;
		for (const value of values) this._args.push(valueToProto(value));
		return this;
	}
	/** Binds a parameter by a 1-based index. */
	bindIndex(index, value) {
		if (index !== (index | 0) || index <= 0) throw new RangeError("Index of a positional argument must be positive integer");
		while (this._args.length < index) this._args.push(null);
		this._args[index - 1] = valueToProto(value);
		return this;
	}
	/** Binds a parameter by name. */
	bindName(name, value) {
		this._namedArgs.set(name, valueToProto(value));
		return this;
	}
	/** Clears all bindings. */
	unbindAll() {
		this._args.length = 0;
		this._namedArgs.clear();
		return this;
	}
};
function stmtToProto(sqlOwner, stmt, wantRows) {
	let inSql;
	let args = [];
	let namedArgs = [];
	if (stmt instanceof Stmt$2) {
		inSql = stmt.sql;
		args = stmt._args;
		for (const [name, value] of stmt._namedArgs.entries()) namedArgs.push({
			name,
			value
		});
	} else if (Array.isArray(stmt)) {
		inSql = stmt[0];
		if (Array.isArray(stmt[1])) args = stmt[1].map((arg) => valueToProto(arg));
		else namedArgs = Object.entries(stmt[1]).map(([name, value]) => {
			return {
				name,
				value: valueToProto(value)
			};
		});
	} else inSql = stmt;
	const { sql, sqlId } = sqlToProto(sqlOwner, inSql);
	return {
		sql,
		sqlId,
		args,
		namedArgs,
		wantRows
	};
}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/batch.js
/** A builder for creating a batch and executing it on the server. */
var Batch$2 = class {
	static {
		__name(this, "Batch");
	}
	/** @private */
	_stream;
	#useCursor;
	/** @private */
	_steps;
	#executed;
	/** @private */
	constructor(stream, useCursor) {
		this._stream = stream;
		this.#useCursor = useCursor;
		this._steps = [];
		this.#executed = false;
	}
	/** Return a builder for adding a step to the batch. */
	step() {
		return new BatchStep$2(this);
	}
	/** Execute the batch. */
	execute() {
		if (this.#executed) throw new MisuseError("This batch has already been executed");
		this.#executed = true;
		const batch$1 = { steps: this._steps.map((step) => step.proto) };
		if (this.#useCursor) return executeCursor(this._stream, this._steps, batch$1);
		else return executeRegular(this._stream, this._steps, batch$1);
	}
};
function executeRegular(stream, steps, batch$1) {
	return stream._batch(batch$1).then((result) => {
		for (let step = 0; step < steps.length; ++step) {
			const stepResult = result.stepResults.get(step);
			const stepError = result.stepErrors.get(step);
			steps[step].callback(stepResult, stepError);
		}
	});
}
async function executeCursor(stream, steps, batch$1) {
	const cursor = await stream._openCursor(batch$1);
	try {
		let nextStep = 0;
		let beginEntry = void 0;
		let rows = [];
		for (;;) {
			const entry = await cursor.next();
			if (entry === void 0) break;
			if (entry.type === "step_begin") {
				if (entry.step < nextStep || entry.step >= steps.length) throw new ProtoError("Server produced StepBeginEntry for unexpected step");
				else if (beginEntry !== void 0) throw new ProtoError("Server produced StepBeginEntry before terminating previous step");
				for (let step = nextStep; step < entry.step; ++step) steps[step].callback(void 0, void 0);
				nextStep = entry.step + 1;
				beginEntry = entry;
				rows = [];
			} else if (entry.type === "step_end") {
				if (beginEntry === void 0) throw new ProtoError("Server produced StepEndEntry but no step is active");
				const stmtResult = {
					cols: beginEntry.cols,
					rows,
					affectedRowCount: entry.affectedRowCount,
					lastInsertRowid: entry.lastInsertRowid
				};
				steps[beginEntry.step].callback(stmtResult, void 0);
				beginEntry = void 0;
				rows = [];
			} else if (entry.type === "step_error") {
				if (beginEntry === void 0) {
					if (entry.step >= steps.length) throw new ProtoError("Server produced StepErrorEntry for unexpected step");
					for (let step = nextStep; step < entry.step; ++step) steps[step].callback(void 0, void 0);
				} else {
					if (entry.step !== beginEntry.step) throw new ProtoError("Server produced StepErrorEntry for unexpected step");
					beginEntry = void 0;
					rows = [];
				}
				steps[entry.step].callback(void 0, entry.error);
				nextStep = entry.step + 1;
			} else if (entry.type === "row") {
				if (beginEntry === void 0) throw new ProtoError("Server produced RowEntry but no step is active");
				rows.push(entry.row);
			} else if (entry.type === "error") throw errorFromProto(entry.error);
			else if (entry.type === "none") throw new ProtoError("Server produced unrecognized CursorEntry");
			else throw impossible(entry, "Impossible CursorEntry");
		}
		if (beginEntry !== void 0) throw new ProtoError("Server closed Cursor before terminating active step");
		for (let step = nextStep; step < steps.length; ++step) steps[step].callback(void 0, void 0);
	} finally {
		cursor.close();
	}
}
/** A builder for adding a step to the batch. */
var BatchStep$2 = class {
	static {
		__name(this, "BatchStep");
	}
	/** @private */
	_batch;
	#conds;
	/** @private */
	_index;
	/** @private */
	constructor(batch$1) {
		this._batch = batch$1;
		this.#conds = [];
		this._index = void 0;
	}
	/** Add the condition that needs to be satisfied to execute the statement. If you use this method multiple
	* times, we join the conditions with a logical AND. */
	condition(cond) {
		this.#conds.push(cond._proto);
		return this;
	}
	/** Add a statement that returns rows. */
	query(stmt) {
		return this.#add(stmt, true, rowsResultFromProto);
	}
	/** Add a statement that returns at most a single row. */
	queryRow(stmt) {
		return this.#add(stmt, true, rowResultFromProto);
	}
	/** Add a statement that returns at most a single value. */
	queryValue(stmt) {
		return this.#add(stmt, true, valueResultFromProto);
	}
	/** Add a statement without returning rows. */
	run(stmt) {
		return this.#add(stmt, false, stmtResultFromProto);
	}
	#add(inStmt, wantRows, fromProto) {
		if (this._index !== void 0) throw new MisuseError("This BatchStep has already been added to the batch");
		const stmt = stmtToProto(this._batch._stream._sqlOwner(), inStmt, wantRows);
		let condition;
		if (this.#conds.length === 0) condition = void 0;
		else if (this.#conds.length === 1) condition = this.#conds[0];
		else condition = {
			type: "and",
			conds: this.#conds.slice()
		};
		const proto = {
			stmt,
			condition
		};
		return new Promise((outputCallback, errorCallback) => {
			const callback = (stepResult, stepError) => {
				if (stepResult !== void 0 && stepError !== void 0) errorCallback(new ProtoError("Server returned both result and error"));
				else if (stepError !== void 0) errorCallback(errorFromProto(stepError));
				else if (stepResult !== void 0) outputCallback(fromProto(stepResult, this._batch._stream.intMode));
				else outputCallback(void 0);
			};
			this._index = this._batch._steps.length;
			this._batch._steps.push({
				proto,
				callback
			});
		});
	}
};
var BatchCond$2 = class BatchCond$2 {
	static {
		__name(this, "BatchCond");
	}
	/** @private */
	_batch;
	/** @private */
	_proto;
	/** @private */
	constructor(batch$1, proto) {
		this._batch = batch$1;
		this._proto = proto;
	}
	/** Create a condition that evaluates to true when the given step executes successfully.
	*
	* If the given step fails error or is skipped because its condition evaluated to false, this
	* condition evaluates to false.
	*/
	static ok(step) {
		return new BatchCond$2(step._batch, {
			type: "ok",
			step: stepIndex(step)
		});
	}
	/** Create a condition that evaluates to true when the given step fails.
	*
	* If the given step succeeds or is skipped because its condition evaluated to false, this condition
	* evaluates to false.
	*/
	static error(step) {
		return new BatchCond$2(step._batch, {
			type: "error",
			step: stepIndex(step)
		});
	}
	/** Create a condition that is a logical negation of another condition.
	*/
	static not(cond) {
		return new BatchCond$2(cond._batch, {
			type: "not",
			cond: cond._proto
		});
	}
	/** Create a condition that is a logical AND of other conditions.
	*/
	static and(batch$1, conds) {
		for (const cond of conds) checkCondBatch(batch$1, cond);
		return new BatchCond$2(batch$1, {
			type: "and",
			conds: conds.map((e) => e._proto)
		});
	}
	/** Create a condition that is a logical OR of other conditions.
	*/
	static or(batch$1, conds) {
		for (const cond of conds) checkCondBatch(batch$1, cond);
		return new BatchCond$2(batch$1, {
			type: "or",
			conds: conds.map((e) => e._proto)
		});
	}
	/** Create a condition that evaluates to true when the SQL connection is in autocommit mode (not inside an
	* explicit transaction). This requires protocol version 3 or higher.
	*/
	static isAutocommit(batch$1) {
		batch$1._stream.client()._ensureVersion(3, "BatchCond.isAutocommit()");
		return new BatchCond$2(batch$1, { type: "is_autocommit" });
	}
};
function stepIndex(step) {
	if (step._index === void 0) throw new MisuseError("Cannot add a condition referencing a step that has not been added to the batch");
	return step._index;
}
function checkCondBatch(expectedBatch, cond) {
	if (cond._batch !== expectedBatch) throw new MisuseError("Cannot mix BatchCond objects for different Batch objects");
}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/describe.js
function describeResultFromProto(result) {
	return {
		paramNames: result.params.map((p) => p.name),
		columns: result.cols,
		isExplain: result.isExplain,
		isReadonly: result.isReadonly
	};
}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/stream.js
/** A stream for executing SQL statements (a "database connection"). */
var Stream = class {
	/** @private */
	constructor(intMode) {
		this.intMode = intMode;
	}
	/** Execute a statement and return rows. */
	query(stmt) {
		return this.#execute(stmt, true, rowsResultFromProto);
	}
	/** Execute a statement and return at most a single row. */
	queryRow(stmt) {
		return this.#execute(stmt, true, rowResultFromProto);
	}
	/** Execute a statement and return at most a single value. */
	queryValue(stmt) {
		return this.#execute(stmt, true, valueResultFromProto);
	}
	/** Execute a statement without returning rows. */
	run(stmt) {
		return this.#execute(stmt, false, stmtResultFromProto);
	}
	#execute(inStmt, wantRows, fromProto) {
		const stmt = stmtToProto(this._sqlOwner(), inStmt, wantRows);
		return this._execute(stmt).then((r) => fromProto(r, this.intMode));
	}
	/** Return a builder for creating and executing a batch.
	*
	* If `useCursor` is true, the batch will be executed using a Hrana cursor, which will stream results from
	* the server to the client, which consumes less memory on the server. This requires protocol version 3 or
	* higher.
	*/
	batch(useCursor = false) {
		return new Batch$2(this, useCursor);
	}
	/** Parse and analyze a statement. This requires protocol version 2 or higher. */
	describe(inSql) {
		const protoSql = sqlToProto(this._sqlOwner(), inSql);
		return this._describe(protoSql).then(describeResultFromProto);
	}
	/** Execute a sequence of statements separated by semicolons. This requires protocol version 2 or higher.
	* */
	sequence(inSql) {
		const protoSql = sqlToProto(this._sqlOwner(), inSql);
		return this._sequence(protoSql);
	}
	/** Representation of integers returned from the database. See {@link IntMode}.
	*
	* This value affects the results of all operations on this stream.
	*/
	intMode;
};

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/cursor.js
var Cursor = class {};

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/ws/cursor.js
const fetchChunkSize = 1e3;
const fetchQueueSize = 10;
var WsCursor = class extends Cursor {
	#client;
	#stream;
	#cursorId;
	#entryQueue;
	#fetchQueue;
	#closed;
	#done;
	/** @private */
	constructor(client, stream, cursorId) {
		super();
		this.#client = client;
		this.#stream = stream;
		this.#cursorId = cursorId;
		this.#entryQueue = new Queue();
		this.#fetchQueue = new Queue();
		this.#closed = void 0;
		this.#done = false;
	}
	/** Fetch the next entry from the cursor. */
	async next() {
		for (;;) {
			if (this.#closed !== void 0) throw new ClosedError("Cursor is closed", this.#closed);
			while (!this.#done && this.#fetchQueue.length < fetchQueueSize) this.#fetchQueue.push(this.#fetch());
			const entry = this.#entryQueue.shift();
			if (this.#done || entry !== void 0) return entry;
			await this.#fetchQueue.shift().then((response) => {
				if (response === void 0) return;
				for (const entry$1 of response.entries) this.#entryQueue.push(entry$1);
				this.#done ||= response.done;
			});
		}
	}
	#fetch() {
		return this.#stream._sendCursorRequest(this, {
			type: "fetch_cursor",
			cursorId: this.#cursorId,
			maxCount: fetchChunkSize
		}).then((resp) => resp, (error) => {
			this._setClosed(error);
		});
	}
	/** @private */
	_setClosed(error) {
		if (this.#closed !== void 0) return;
		this.#closed = error;
		this.#stream._sendCursorRequest(this, {
			type: "close_cursor",
			cursorId: this.#cursorId
		}).catch(() => void 0);
		this.#stream._cursorClosed(this);
	}
	/** Close the cursor. */
	close() {
		this._setClosed(new ClientError("Cursor was manually closed"));
	}
	/** True if the cursor is closed. */
	get closed() {
		return this.#closed !== void 0;
	}
};

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/ws/stream.js
var WsStream = class WsStream extends Stream {
	#client;
	#streamId;
	#queue;
	#cursor;
	#closing;
	#closed;
	/** @private */
	static open(client) {
		const streamId = client._streamIdAlloc.alloc();
		const stream = new WsStream(client, streamId);
		const responseCallback = () => void 0;
		const errorCallback = (e) => stream.#setClosed(e);
		const request = {
			type: "open_stream",
			streamId
		};
		client._sendRequest(request, {
			responseCallback,
			errorCallback
		});
		return stream;
	}
	/** @private */
	constructor(client, streamId) {
		super(client.intMode);
		this.#client = client;
		this.#streamId = streamId;
		this.#queue = new Queue();
		this.#cursor = void 0;
		this.#closing = false;
		this.#closed = void 0;
	}
	/** Get the {@link WsClient} object that this stream belongs to. */
	client() {
		return this.#client;
	}
	/** @private */
	_sqlOwner() {
		return this.#client;
	}
	/** @private */
	_execute(stmt) {
		return this.#sendStreamRequest({
			type: "execute",
			streamId: this.#streamId,
			stmt
		}).then((response) => {
			return response.result;
		});
	}
	/** @private */
	_batch(batch$1) {
		return this.#sendStreamRequest({
			type: "batch",
			streamId: this.#streamId,
			batch: batch$1
		}).then((response) => {
			return response.result;
		});
	}
	/** @private */
	_describe(protoSql) {
		this.#client._ensureVersion(2, "describe()");
		return this.#sendStreamRequest({
			type: "describe",
			streamId: this.#streamId,
			sql: protoSql.sql,
			sqlId: protoSql.sqlId
		}).then((response) => {
			return response.result;
		});
	}
	/** @private */
	_sequence(protoSql) {
		this.#client._ensureVersion(2, "sequence()");
		return this.#sendStreamRequest({
			type: "sequence",
			streamId: this.#streamId,
			sql: protoSql.sql,
			sqlId: protoSql.sqlId
		}).then((_response) => {});
	}
	/** Check whether the SQL connection underlying this stream is in autocommit state (i.e., outside of an
	* explicit transaction). This requires protocol version 3 or higher.
	*/
	getAutocommit() {
		this.#client._ensureVersion(3, "getAutocommit()");
		return this.#sendStreamRequest({
			type: "get_autocommit",
			streamId: this.#streamId
		}).then((response) => {
			return response.isAutocommit;
		});
	}
	#sendStreamRequest(request) {
		return new Promise((responseCallback, errorCallback) => {
			this.#pushToQueue({
				type: "request",
				request,
				responseCallback,
				errorCallback
			});
		});
	}
	/** @private */
	_openCursor(batch$1) {
		this.#client._ensureVersion(3, "cursor");
		return new Promise((cursorCallback, errorCallback) => {
			this.#pushToQueue({
				type: "cursor",
				batch: batch$1,
				cursorCallback,
				errorCallback
			});
		});
	}
	/** @private */
	_sendCursorRequest(cursor, request) {
		if (cursor !== this.#cursor) throw new InternalError("Cursor not associated with the stream attempted to execute a request");
		return new Promise((responseCallback, errorCallback) => {
			if (this.#closed !== void 0) errorCallback(new ClosedError("Stream is closed", this.#closed));
			else this.#client._sendRequest(request, {
				responseCallback,
				errorCallback
			});
		});
	}
	/** @private */
	_cursorClosed(cursor) {
		if (cursor !== this.#cursor) throw new InternalError("Cursor was closed, but it was not associated with the stream");
		this.#cursor = void 0;
		this.#flushQueue();
	}
	#pushToQueue(entry) {
		if (this.#closed !== void 0) entry.errorCallback(new ClosedError("Stream is closed", this.#closed));
		else if (this.#closing) entry.errorCallback(new ClosedError("Stream is closing", void 0));
		else {
			this.#queue.push(entry);
			this.#flushQueue();
		}
	}
	#flushQueue() {
		for (;;) {
			const entry = this.#queue.first();
			if (entry === void 0 && this.#cursor === void 0 && this.#closing) {
				this.#setClosed(new ClientError("Stream was gracefully closed"));
				break;
			} else if (entry?.type === "request" && this.#cursor === void 0) {
				const { request, responseCallback, errorCallback } = entry;
				this.#queue.shift();
				this.#client._sendRequest(request, {
					responseCallback,
					errorCallback
				});
			} else if (entry?.type === "cursor" && this.#cursor === void 0) {
				const { batch: batch$1, cursorCallback } = entry;
				this.#queue.shift();
				const cursorId = this.#client._cursorIdAlloc.alloc();
				const cursor = new WsCursor(this.#client, this, cursorId);
				const request = {
					type: "open_cursor",
					streamId: this.#streamId,
					cursorId,
					batch: batch$1
				};
				const responseCallback = () => void 0;
				const errorCallback = (e) => cursor._setClosed(e);
				this.#client._sendRequest(request, {
					responseCallback,
					errorCallback
				});
				this.#cursor = cursor;
				cursorCallback(cursor);
			} else break;
		}
	}
	#setClosed(error) {
		if (this.#closed !== void 0) return;
		this.#closed = error;
		if (this.#cursor !== void 0) this.#cursor._setClosed(error);
		for (;;) {
			const entry = this.#queue.shift();
			if (entry !== void 0) entry.errorCallback(error);
			else break;
		}
		const request = {
			type: "close_stream",
			streamId: this.#streamId
		};
		const responseCallback = () => this.#client._streamIdAlloc.free(this.#streamId);
		const errorCallback = () => void 0;
		this.#client._sendRequest(request, {
			responseCallback,
			errorCallback
		});
	}
	/** Immediately close the stream. */
	close() {
		this.#setClosed(new ClientError("Stream was manually closed"));
	}
	/** Gracefully close the stream. */
	closeGracefully() {
		this.#closing = true;
		this.#flushQueue();
	}
	/** True if the stream is closed or closing. */
	get closed() {
		return this.#closed !== void 0 || this.#closing;
	}
};

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/shared/json_encode.js
function Stmt$1(w, msg) {
	if (msg.sql !== void 0) w.string("sql", msg.sql);
	if (msg.sqlId !== void 0) w.number("sql_id", msg.sqlId);
	w.arrayObjects("args", msg.args, Value$3);
	w.arrayObjects("named_args", msg.namedArgs, NamedArg$1);
	w.boolean("want_rows", msg.wantRows);
}
__name(Stmt$1, "Stmt");
function NamedArg$1(w, msg) {
	w.string("name", msg.name);
	w.object("value", msg.value, Value$3);
}
__name(NamedArg$1, "NamedArg");
function Batch$1(w, msg) {
	w.arrayObjects("steps", msg.steps, BatchStep$1);
}
__name(Batch$1, "Batch");
function BatchStep$1(w, msg) {
	if (msg.condition !== void 0) w.object("condition", msg.condition, BatchCond$1);
	w.object("stmt", msg.stmt, Stmt$1);
}
__name(BatchStep$1, "BatchStep");
function BatchCond$1(w, msg) {
	w.stringRaw("type", msg.type);
	if (msg.type === "ok" || msg.type === "error") w.number("step", msg.step);
	else if (msg.type === "not") w.object("cond", msg.cond, BatchCond$1);
	else if (msg.type === "and" || msg.type === "or") w.arrayObjects("conds", msg.conds, BatchCond$1);
	else if (msg.type === "is_autocommit") {} else throw impossible(msg, "Impossible type of BatchCond");
}
__name(BatchCond$1, "BatchCond");
function Value$3(w, msg) {
	if (msg === null) w.stringRaw("type", "null");
	else if (typeof msg === "bigint") {
		w.stringRaw("type", "integer");
		w.stringRaw("value", "" + msg);
	} else if (typeof msg === "number") {
		w.stringRaw("type", "float");
		w.number("value", msg);
	} else if (typeof msg === "string") {
		w.stringRaw("type", "text");
		w.string("value", msg);
	} else if (msg instanceof Uint8Array) {
		w.stringRaw("type", "blob");
		w.stringRaw("base64", gBase64.fromUint8Array(msg));
	} else if (msg === void 0) {} else throw impossible(msg, "Impossible type of Value");
}
__name(Value$3, "Value");

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/ws/json_encode.js
function ClientMsg$1(w, msg) {
	w.stringRaw("type", msg.type);
	if (msg.type === "hello") {
		if (msg.jwt !== void 0) w.string("jwt", msg.jwt);
	} else if (msg.type === "request") {
		w.number("request_id", msg.requestId);
		w.object("request", msg.request, Request$1);
	} else throw impossible(msg, "Impossible type of ClientMsg");
}
__name(ClientMsg$1, "ClientMsg");
function Request$1(w, msg) {
	w.stringRaw("type", msg.type);
	if (msg.type === "open_stream") w.number("stream_id", msg.streamId);
	else if (msg.type === "close_stream") w.number("stream_id", msg.streamId);
	else if (msg.type === "execute") {
		w.number("stream_id", msg.streamId);
		w.object("stmt", msg.stmt, Stmt$1);
	} else if (msg.type === "batch") {
		w.number("stream_id", msg.streamId);
		w.object("batch", msg.batch, Batch$1);
	} else if (msg.type === "open_cursor") {
		w.number("stream_id", msg.streamId);
		w.number("cursor_id", msg.cursorId);
		w.object("batch", msg.batch, Batch$1);
	} else if (msg.type === "close_cursor") w.number("cursor_id", msg.cursorId);
	else if (msg.type === "fetch_cursor") {
		w.number("cursor_id", msg.cursorId);
		w.number("max_count", msg.maxCount);
	} else if (msg.type === "sequence") {
		w.number("stream_id", msg.streamId);
		if (msg.sql !== void 0) w.string("sql", msg.sql);
		if (msg.sqlId !== void 0) w.number("sql_id", msg.sqlId);
	} else if (msg.type === "describe") {
		w.number("stream_id", msg.streamId);
		if (msg.sql !== void 0) w.string("sql", msg.sql);
		if (msg.sqlId !== void 0) w.number("sql_id", msg.sqlId);
	} else if (msg.type === "store_sql") {
		w.number("sql_id", msg.sqlId);
		w.string("sql", msg.sql);
	} else if (msg.type === "close_sql") w.number("sql_id", msg.sqlId);
	else if (msg.type === "get_autocommit") w.number("stream_id", msg.streamId);
	else throw impossible(msg, "Impossible type of Request");
}
__name(Request$1, "Request");

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/shared/protobuf_encode.js
function Stmt(w, msg) {
	if (msg.sql !== void 0) w.string(1, msg.sql);
	if (msg.sqlId !== void 0) w.int32(2, msg.sqlId);
	for (const arg of msg.args) w.message(3, arg, Value$2);
	for (const arg of msg.namedArgs) w.message(4, arg, NamedArg);
	w.bool(5, msg.wantRows);
}
function NamedArg(w, msg) {
	w.string(1, msg.name);
	w.message(2, msg.value, Value$2);
}
function Batch(w, msg) {
	for (const step of msg.steps) w.message(1, step, BatchStep);
}
function BatchStep(w, msg) {
	if (msg.condition !== void 0) w.message(1, msg.condition, BatchCond);
	w.message(2, msg.stmt, Stmt);
}
function BatchCond(w, msg) {
	if (msg.type === "ok") w.uint32(1, msg.step);
	else if (msg.type === "error") w.uint32(2, msg.step);
	else if (msg.type === "not") w.message(3, msg.cond, BatchCond);
	else if (msg.type === "and") w.message(4, msg.conds, BatchCondList);
	else if (msg.type === "or") w.message(5, msg.conds, BatchCondList);
	else if (msg.type === "is_autocommit") w.message(6, void 0, Empty);
	else throw impossible(msg, "Impossible type of BatchCond");
}
function BatchCondList(w, msg) {
	for (const cond of msg) w.message(1, cond, BatchCond);
}
function Value$2(w, msg) {
	if (msg === null) w.message(1, void 0, Empty);
	else if (typeof msg === "bigint") w.sint64(2, msg);
	else if (typeof msg === "number") w.double(3, msg);
	else if (typeof msg === "string") w.string(4, msg);
	else if (msg instanceof Uint8Array) w.bytes(5, msg);
	else if (msg === void 0) {} else throw impossible(msg, "Impossible type of Value");
}
__name(Value$2, "Value");
function Empty(_w, _msg) {}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/ws/protobuf_encode.js
function ClientMsg(w, msg) {
	if (msg.type === "hello") w.message(1, msg, HelloMsg);
	else if (msg.type === "request") w.message(2, msg, RequestMsg);
	else throw impossible(msg, "Impossible type of ClientMsg");
}
function HelloMsg(w, msg) {
	if (msg.jwt !== void 0) w.string(1, msg.jwt);
}
function RequestMsg(w, msg) {
	w.int32(1, msg.requestId);
	const request = msg.request;
	if (request.type === "open_stream") w.message(2, request, OpenStreamReq);
	else if (request.type === "close_stream") w.message(3, request, CloseStreamReq$1);
	else if (request.type === "execute") w.message(4, request, ExecuteReq);
	else if (request.type === "batch") w.message(5, request, BatchReq);
	else if (request.type === "open_cursor") w.message(6, request, OpenCursorReq);
	else if (request.type === "close_cursor") w.message(7, request, CloseCursorReq);
	else if (request.type === "fetch_cursor") w.message(8, request, FetchCursorReq);
	else if (request.type === "sequence") w.message(9, request, SequenceReq);
	else if (request.type === "describe") w.message(10, request, DescribeReq);
	else if (request.type === "store_sql") w.message(11, request, StoreSqlReq);
	else if (request.type === "close_sql") w.message(12, request, CloseSqlReq);
	else if (request.type === "get_autocommit") w.message(13, request, GetAutocommitReq);
	else throw impossible(request, "Impossible type of Request");
}
function OpenStreamReq(w, msg) {
	w.int32(1, msg.streamId);
}
function CloseStreamReq$1(w, msg) {
	w.int32(1, msg.streamId);
}
__name(CloseStreamReq$1, "CloseStreamReq");
function ExecuteReq(w, msg) {
	w.int32(1, msg.streamId);
	w.message(2, msg.stmt, Stmt);
}
function BatchReq(w, msg) {
	w.int32(1, msg.streamId);
	w.message(2, msg.batch, Batch);
}
function OpenCursorReq(w, msg) {
	w.int32(1, msg.streamId);
	w.int32(2, msg.cursorId);
	w.message(3, msg.batch, Batch);
}
function CloseCursorReq(w, msg) {
	w.int32(1, msg.cursorId);
}
function FetchCursorReq(w, msg) {
	w.int32(1, msg.cursorId);
	w.uint32(2, msg.maxCount);
}
function SequenceReq(w, msg) {
	w.int32(1, msg.streamId);
	if (msg.sql !== void 0) w.string(2, msg.sql);
	if (msg.sqlId !== void 0) w.int32(3, msg.sqlId);
}
function DescribeReq(w, msg) {
	w.int32(1, msg.streamId);
	if (msg.sql !== void 0) w.string(2, msg.sql);
	if (msg.sqlId !== void 0) w.int32(3, msg.sqlId);
}
function StoreSqlReq(w, msg) {
	w.int32(1, msg.sqlId);
	w.string(2, msg.sql);
}
function CloseSqlReq(w, msg) {
	w.int32(1, msg.sqlId);
}
function GetAutocommitReq(w, msg) {
	w.int32(1, msg.streamId);
}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/shared/json_decode.js
function Error$2(obj) {
	return {
		message: string(obj["message"]),
		code: stringOpt(obj["code"])
	};
}
__name(Error$2, "Error");
function StmtResult$1(obj) {
	const cols = arrayObjectsMap(obj["cols"], Col$1);
	const rows = array(obj["rows"]).map((rowObj) => arrayObjectsMap(rowObj, Value$1));
	const affectedRowCount = number(obj["affected_row_count"]);
	const lastInsertRowidStr = stringOpt(obj["last_insert_rowid"]);
	return {
		cols,
		rows,
		affectedRowCount,
		lastInsertRowid: lastInsertRowidStr !== void 0 ? BigInt(lastInsertRowidStr) : void 0
	};
}
__name(StmtResult$1, "StmtResult");
function Col$1(obj) {
	return {
		name: stringOpt(obj["name"]),
		decltype: stringOpt(obj["decltype"])
	};
}
__name(Col$1, "Col");
function BatchResult$1(obj) {
	const stepResults = /* @__PURE__ */ new Map();
	array(obj["step_results"]).forEach((value, i) => {
		if (value !== null) stepResults.set(i, StmtResult$1(object(value)));
	});
	const stepErrors = /* @__PURE__ */ new Map();
	array(obj["step_errors"]).forEach((value, i) => {
		if (value !== null) stepErrors.set(i, Error$2(object(value)));
	});
	return {
		stepResults,
		stepErrors
	};
}
__name(BatchResult$1, "BatchResult");
function CursorEntry$1(obj) {
	const type = string(obj["type"]);
	if (type === "step_begin") return {
		type: "step_begin",
		step: number(obj["step"]),
		cols: arrayObjectsMap(obj["cols"], Col$1)
	};
	else if (type === "step_end") {
		const affectedRowCount = number(obj["affected_row_count"]);
		const lastInsertRowidStr = stringOpt(obj["last_insert_rowid"]);
		return {
			type: "step_end",
			affectedRowCount,
			lastInsertRowid: lastInsertRowidStr !== void 0 ? BigInt(lastInsertRowidStr) : void 0
		};
	} else if (type === "step_error") return {
		type: "step_error",
		step: number(obj["step"]),
		error: Error$2(object(obj["error"]))
	};
	else if (type === "row") return {
		type: "row",
		row: arrayObjectsMap(obj["row"], Value$1)
	};
	else if (type === "error") return {
		type: "error",
		error: Error$2(object(obj["error"]))
	};
	else throw new ProtoError("Unexpected type of CursorEntry");
}
__name(CursorEntry$1, "CursorEntry");
function DescribeResult$1(obj) {
	return {
		params: arrayObjectsMap(obj["params"], DescribeParam$1),
		cols: arrayObjectsMap(obj["cols"], DescribeCol$1),
		isExplain: boolean(obj["is_explain"]),
		isReadonly: boolean(obj["is_readonly"])
	};
}
__name(DescribeResult$1, "DescribeResult");
function DescribeParam$1(obj) {
	return { name: stringOpt(obj["name"]) };
}
__name(DescribeParam$1, "DescribeParam");
function DescribeCol$1(obj) {
	return {
		name: string(obj["name"]),
		decltype: stringOpt(obj["decltype"])
	};
}
__name(DescribeCol$1, "DescribeCol");
function Value$1(obj) {
	const type = string(obj["type"]);
	if (type === "null") return null;
	else if (type === "integer") {
		const value = string(obj["value"]);
		return BigInt(value);
	} else if (type === "float") return number(obj["value"]);
	else if (type === "text") return string(obj["value"]);
	else if (type === "blob") return gBase64.toUint8Array(string(obj["base64"]));
	else throw new ProtoError("Unexpected type of Value");
}
__name(Value$1, "Value");

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/ws/json_decode.js
function ServerMsg$1(obj) {
	const type = string(obj["type"]);
	if (type === "hello_ok") return { type: "hello_ok" };
	else if (type === "hello_error") return {
		type: "hello_error",
		error: Error$2(object(obj["error"]))
	};
	else if (type === "response_ok") return {
		type: "response_ok",
		requestId: number(obj["request_id"]),
		response: Response(object(obj["response"]))
	};
	else if (type === "response_error") return {
		type: "response_error",
		requestId: number(obj["request_id"]),
		error: Error$2(object(obj["error"]))
	};
	else throw new ProtoError("Unexpected type of ServerMsg");
}
__name(ServerMsg$1, "ServerMsg");
function Response(obj) {
	const type = string(obj["type"]);
	if (type === "open_stream") return { type: "open_stream" };
	else if (type === "close_stream") return { type: "close_stream" };
	else if (type === "execute") return {
		type: "execute",
		result: StmtResult$1(object(obj["result"]))
	};
	else if (type === "batch") return {
		type: "batch",
		result: BatchResult$1(object(obj["result"]))
	};
	else if (type === "open_cursor") return { type: "open_cursor" };
	else if (type === "close_cursor") return { type: "close_cursor" };
	else if (type === "fetch_cursor") return {
		type: "fetch_cursor",
		entries: arrayObjectsMap(obj["entries"], CursorEntry$1),
		done: boolean(obj["done"])
	};
	else if (type === "sequence") return { type: "sequence" };
	else if (type === "describe") return {
		type: "describe",
		result: DescribeResult$1(object(obj["result"]))
	};
	else if (type === "store_sql") return { type: "store_sql" };
	else if (type === "close_sql") return { type: "close_sql" };
	else if (type === "get_autocommit") return {
		type: "get_autocommit",
		isAutocommit: boolean(obj["is_autocommit"])
	};
	else throw new ProtoError("Unexpected type of Response");
}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/shared/protobuf_decode.js
const Error$1 = {
	default() {
		return {
			message: "",
			code: void 0
		};
	},
	1(r, msg) {
		msg.message = r.string();
	},
	2(r, msg) {
		msg.code = r.string();
	}
};
const StmtResult = {
	default() {
		return {
			cols: [],
			rows: [],
			affectedRowCount: 0,
			lastInsertRowid: void 0
		};
	},
	1(r, msg) {
		msg.cols.push(r.message(Col));
	},
	2(r, msg) {
		msg.rows.push(r.message(Row));
	},
	3(r, msg) {
		msg.affectedRowCount = Number(r.uint64());
	},
	4(r, msg) {
		msg.lastInsertRowid = r.sint64();
	}
};
const Col = {
	default() {
		return {
			name: void 0,
			decltype: void 0
		};
	},
	1(r, msg) {
		msg.name = r.string();
	},
	2(r, msg) {
		msg.decltype = r.string();
	}
};
const Row = {
	default() {
		return [];
	},
	1(r, msg) {
		msg.push(r.message(Value));
	}
};
const BatchResult = {
	default() {
		return {
			stepResults: /* @__PURE__ */ new Map(),
			stepErrors: /* @__PURE__ */ new Map()
		};
	},
	1(r, msg) {
		const [key, value] = r.message(BatchResultStepResult);
		msg.stepResults.set(key, value);
	},
	2(r, msg) {
		const [key, value] = r.message(BatchResultStepError);
		msg.stepErrors.set(key, value);
	}
};
const BatchResultStepResult = {
	default() {
		return [0, StmtResult.default()];
	},
	1(r, msg) {
		msg[0] = r.uint32();
	},
	2(r, msg) {
		msg[1] = r.message(StmtResult);
	}
};
const BatchResultStepError = {
	default() {
		return [0, Error$1.default()];
	},
	1(r, msg) {
		msg[0] = r.uint32();
	},
	2(r, msg) {
		msg[1] = r.message(Error$1);
	}
};
const CursorEntry = {
	default() {
		return { type: "none" };
	},
	1(r) {
		return r.message(StepBeginEntry);
	},
	2(r) {
		return r.message(StepEndEntry);
	},
	3(r) {
		return r.message(StepErrorEntry);
	},
	4(r) {
		return {
			type: "row",
			row: r.message(Row)
		};
	},
	5(r) {
		return {
			type: "error",
			error: r.message(Error$1)
		};
	}
};
const StepBeginEntry = {
	default() {
		return {
			type: "step_begin",
			step: 0,
			cols: []
		};
	},
	1(r, msg) {
		msg.step = r.uint32();
	},
	2(r, msg) {
		msg.cols.push(r.message(Col));
	}
};
const StepEndEntry = {
	default() {
		return {
			type: "step_end",
			affectedRowCount: 0,
			lastInsertRowid: void 0
		};
	},
	1(r, msg) {
		msg.affectedRowCount = r.uint32();
	},
	2(r, msg) {
		msg.lastInsertRowid = r.uint64();
	}
};
const StepErrorEntry = {
	default() {
		return {
			type: "step_error",
			step: 0,
			error: Error$1.default()
		};
	},
	1(r, msg) {
		msg.step = r.uint32();
	},
	2(r, msg) {
		msg.error = r.message(Error$1);
	}
};
const DescribeResult = {
	default() {
		return {
			params: [],
			cols: [],
			isExplain: false,
			isReadonly: false
		};
	},
	1(r, msg) {
		msg.params.push(r.message(DescribeParam));
	},
	2(r, msg) {
		msg.cols.push(r.message(DescribeCol));
	},
	3(r, msg) {
		msg.isExplain = r.bool();
	},
	4(r, msg) {
		msg.isReadonly = r.bool();
	}
};
const DescribeParam = {
	default() {
		return { name: void 0 };
	},
	1(r, msg) {
		msg.name = r.string();
	}
};
const DescribeCol = {
	default() {
		return {
			name: "",
			decltype: void 0
		};
	},
	1(r, msg) {
		msg.name = r.string();
	},
	2(r, msg) {
		msg.decltype = r.string();
	}
};
const Value = {
	default() {},
	1(r) {
		return null;
	},
	2(r) {
		return r.sint64();
	},
	3(r) {
		return r.double();
	},
	4(r) {
		return r.string();
	},
	5(r) {
		return r.bytes();
	}
};

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/ws/protobuf_decode.js
const ServerMsg = {
	default() {
		return { type: "none" };
	},
	1(r) {
		return { type: "hello_ok" };
	},
	2(r) {
		return r.message(HelloErrorMsg);
	},
	3(r) {
		return r.message(ResponseOkMsg);
	},
	4(r) {
		return r.message(ResponseErrorMsg);
	}
};
const HelloErrorMsg = {
	default() {
		return {
			type: "hello_error",
			error: Error$1.default()
		};
	},
	1(r, msg) {
		msg.error = r.message(Error$1);
	}
};
const ResponseErrorMsg = {
	default() {
		return {
			type: "response_error",
			requestId: 0,
			error: Error$1.default()
		};
	},
	1(r, msg) {
		msg.requestId = r.int32();
	},
	2(r, msg) {
		msg.error = r.message(Error$1);
	}
};
const ResponseOkMsg = {
	default() {
		return {
			type: "response_ok",
			requestId: 0,
			response: { type: "none" }
		};
	},
	1(r, msg) {
		msg.requestId = r.int32();
	},
	2(r, msg) {
		msg.response = { type: "open_stream" };
	},
	3(r, msg) {
		msg.response = { type: "close_stream" };
	},
	4(r, msg) {
		msg.response = r.message(ExecuteResp);
	},
	5(r, msg) {
		msg.response = r.message(BatchResp);
	},
	6(r, msg) {
		msg.response = { type: "open_cursor" };
	},
	7(r, msg) {
		msg.response = { type: "close_cursor" };
	},
	8(r, msg) {
		msg.response = r.message(FetchCursorResp);
	},
	9(r, msg) {
		msg.response = { type: "sequence" };
	},
	10(r, msg) {
		msg.response = r.message(DescribeResp);
	},
	11(r, msg) {
		msg.response = { type: "store_sql" };
	},
	12(r, msg) {
		msg.response = { type: "close_sql" };
	},
	13(r, msg) {
		msg.response = r.message(GetAutocommitResp);
	}
};
const ExecuteResp = {
	default() {
		return {
			type: "execute",
			result: StmtResult.default()
		};
	},
	1(r, msg) {
		msg.result = r.message(StmtResult);
	}
};
const BatchResp = {
	default() {
		return {
			type: "batch",
			result: BatchResult.default()
		};
	},
	1(r, msg) {
		msg.result = r.message(BatchResult);
	}
};
const FetchCursorResp = {
	default() {
		return {
			type: "fetch_cursor",
			entries: [],
			done: false
		};
	},
	1(r, msg) {
		msg.entries.push(r.message(CursorEntry));
	},
	2(r, msg) {
		msg.done = r.bool();
	}
};
const DescribeResp = {
	default() {
		return {
			type: "describe",
			result: DescribeResult.default()
		};
	},
	1(r, msg) {
		msg.result = r.message(DescribeResult);
	}
};
const GetAutocommitResp = {
	default() {
		return {
			type: "get_autocommit",
			isAutocommit: false
		};
	},
	1(r, msg) {
		msg.isAutocommit = r.bool();
	}
};

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/ws/client.js
const subprotocolsV2 = new Map([["hrana2", {
	version: 2,
	encoding: "json"
}], ["hrana1", {
	version: 1,
	encoding: "json"
}]]);
const subprotocolsV3 = new Map([
	["hrana3-protobuf", {
		version: 3,
		encoding: "protobuf"
	}],
	["hrana3", {
		version: 3,
		encoding: "json"
	}],
	["hrana2", {
		version: 2,
		encoding: "json"
	}],
	["hrana1", {
		version: 1,
		encoding: "json"
	}]
]);
/** A client for the Hrana protocol over a WebSocket. */
var WsClient$1 = class extends Client {
	static {
		__name(this, "WsClient");
	}
	#socket;
	#openCallbacks;
	#opened;
	#closed;
	#recvdHello;
	#subprotocol;
	#getVersionCalled;
	#responseMap;
	#requestIdAlloc;
	/** @private */
	_streamIdAlloc;
	/** @private */
	_cursorIdAlloc;
	#sqlIdAlloc;
	/** @private */
	constructor(socket, jwt) {
		super();
		this.#socket = socket;
		this.#openCallbacks = [];
		this.#opened = false;
		this.#closed = void 0;
		this.#recvdHello = false;
		this.#subprotocol = void 0;
		this.#getVersionCalled = false;
		this.#responseMap = /* @__PURE__ */ new Map();
		this.#requestIdAlloc = new IdAlloc();
		this._streamIdAlloc = new IdAlloc();
		this._cursorIdAlloc = new IdAlloc();
		this.#sqlIdAlloc = new IdAlloc();
		this.#socket.binaryType = "arraybuffer";
		this.#socket.addEventListener("open", () => this.#onSocketOpen());
		this.#socket.addEventListener("close", (event) => this.#onSocketClose(event));
		this.#socket.addEventListener("error", (event) => this.#onSocketError(event));
		this.#socket.addEventListener("message", (event) => this.#onSocketMessage(event));
		this.#send({
			type: "hello",
			jwt
		});
	}
	#send(msg) {
		if (this.#closed !== void 0) throw new InternalError("Trying to send a message on a closed client");
		if (this.#opened) this.#sendToSocket(msg);
		else {
			const openCallback = () => this.#sendToSocket(msg);
			const errorCallback = () => void 0;
			this.#openCallbacks.push({
				openCallback,
				errorCallback
			});
		}
	}
	#onSocketOpen() {
		const protocol = this.#socket.protocol;
		if (protocol === void 0) {
			this.#setClosed(new ClientError("The `WebSocket.protocol` property is undefined. This most likely means that the WebSocket implementation provided by the environment is broken. If you are using Miniflare 2, please update to Miniflare 3, which fixes this problem."));
			return;
		} else if (protocol === "") this.#subprotocol = {
			version: 1,
			encoding: "json"
		};
		else {
			this.#subprotocol = subprotocolsV3.get(protocol);
			if (this.#subprotocol === void 0) {
				this.#setClosed(new ProtoError(`Unrecognized WebSocket subprotocol: ${JSON.stringify(protocol)}`));
				return;
			}
		}
		for (const callbacks of this.#openCallbacks) callbacks.openCallback();
		this.#openCallbacks.length = 0;
		this.#opened = true;
	}
	#sendToSocket(msg) {
		const encoding = this.#subprotocol.encoding;
		if (encoding === "json") {
			const jsonMsg = writeJsonObject(msg, ClientMsg$1);
			this.#socket.send(jsonMsg);
		} else if (encoding === "protobuf") {
			const protobufMsg = writeProtobufMessage(msg, ClientMsg);
			this.#socket.send(protobufMsg);
		} else throw impossible(encoding, "Impossible encoding");
	}
	/** Get the protocol version negotiated with the server, possibly waiting until the socket is open. */
	getVersion() {
		return new Promise((versionCallback, errorCallback) => {
			this.#getVersionCalled = true;
			if (this.#closed !== void 0) errorCallback(this.#closed);
			else if (!this.#opened) {
				const openCallback = () => versionCallback(this.#subprotocol.version);
				this.#openCallbacks.push({
					openCallback,
					errorCallback
				});
			} else versionCallback(this.#subprotocol.version);
		});
	}
	/** @private */
	_ensureVersion(minVersion, feature) {
		if (this.#subprotocol === void 0 || !this.#getVersionCalled) throw new ProtocolVersionError(`${feature} is supported only on protocol version ${minVersion} and higher, but the version supported by the WebSocket server is not yet known. Use Client.getVersion() to wait until the version is available.`);
		else if (this.#subprotocol.version < minVersion) throw new ProtocolVersionError(`${feature} is supported on protocol version ${minVersion} and higher, but the WebSocket server only supports version ${this.#subprotocol.version}`);
	}
	/** @private */
	_sendRequest(request, callbacks) {
		if (this.#closed !== void 0) {
			callbacks.errorCallback(new ClosedError("Client is closed", this.#closed));
			return;
		}
		const requestId = this.#requestIdAlloc.alloc();
		this.#responseMap.set(requestId, {
			...callbacks,
			type: request.type
		});
		this.#send({
			type: "request",
			requestId,
			request
		});
	}
	#onSocketError(event) {
		const message = event.message ?? "WebSocket was closed due to an error";
		this.#setClosed(new WebSocketError(message));
	}
	#onSocketClose(event) {
		let message = `WebSocket was closed with code ${event.code}`;
		if (event.reason) message += `: ${event.reason}`;
		this.#setClosed(new WebSocketError(message));
	}
	#setClosed(error) {
		if (this.#closed !== void 0) return;
		this.#closed = error;
		for (const callbacks of this.#openCallbacks) callbacks.errorCallback(error);
		this.#openCallbacks.length = 0;
		for (const [requestId, responseState] of this.#responseMap.entries()) {
			responseState.errorCallback(error);
			this.#requestIdAlloc.free(requestId);
		}
		this.#responseMap.clear();
		this.#socket.close();
	}
	#onSocketMessage(event) {
		if (this.#closed !== void 0) return;
		try {
			let msg;
			const encoding = this.#subprotocol.encoding;
			if (encoding === "json") {
				if (typeof event.data !== "string") {
					this.#socket.close(3003, "Only text messages are accepted with JSON encoding");
					this.#setClosed(new ProtoError("Received non-text message from server with JSON encoding"));
					return;
				}
				msg = readJsonObject(JSON.parse(event.data), ServerMsg$1);
			} else if (encoding === "protobuf") {
				if (!(event.data instanceof ArrayBuffer)) {
					this.#socket.close(3003, "Only binary messages are accepted with Protobuf encoding");
					this.#setClosed(new ProtoError("Received non-binary message from server with Protobuf encoding"));
					return;
				}
				msg = readProtobufMessage(new Uint8Array(event.data), ServerMsg);
			} else throw impossible(encoding, "Impossible encoding");
			this.#handleMsg(msg);
		} catch (e) {
			this.#socket.close(3007, "Could not handle message");
			this.#setClosed(e);
		}
	}
	#handleMsg(msg) {
		if (msg.type === "none") throw new ProtoError("Received an unrecognized ServerMsg");
		else if (msg.type === "hello_ok" || msg.type === "hello_error") {
			if (this.#recvdHello) throw new ProtoError("Received a duplicated hello response");
			this.#recvdHello = true;
			if (msg.type === "hello_error") throw errorFromProto(msg.error);
			return;
		} else if (!this.#recvdHello) throw new ProtoError("Received a non-hello message before a hello response");
		if (msg.type === "response_ok") {
			const requestId = msg.requestId;
			const responseState = this.#responseMap.get(requestId);
			this.#responseMap.delete(requestId);
			if (responseState === void 0) throw new ProtoError("Received unexpected OK response");
			this.#requestIdAlloc.free(requestId);
			try {
				if (responseState.type !== msg.response.type) {
					console.dir({
						responseState,
						msg
					});
					throw new ProtoError("Received unexpected type of response");
				}
				responseState.responseCallback(msg.response);
			} catch (e) {
				responseState.errorCallback(e);
				throw e;
			}
		} else if (msg.type === "response_error") {
			const requestId = msg.requestId;
			const responseState = this.#responseMap.get(requestId);
			this.#responseMap.delete(requestId);
			if (responseState === void 0) throw new ProtoError("Received unexpected error response");
			this.#requestIdAlloc.free(requestId);
			responseState.errorCallback(errorFromProto(msg.error));
		} else throw impossible(msg, "Impossible ServerMsg type");
	}
	/** Open a {@link WsStream}, a stream for executing SQL statements. */
	openStream() {
		return WsStream.open(this);
	}
	/** Cache a SQL text on the server. This requires protocol version 2 or higher. */
	storeSql(sql) {
		this._ensureVersion(2, "storeSql()");
		const sqlId = this.#sqlIdAlloc.alloc();
		const sqlObj = new Sql(this, sqlId);
		const responseCallback = () => void 0;
		const errorCallback = (e) => sqlObj._setClosed(e);
		const request = {
			type: "store_sql",
			sqlId,
			sql
		};
		this._sendRequest(request, {
			responseCallback,
			errorCallback
		});
		return sqlObj;
	}
	/** @private */
	_closeSql(sqlId) {
		if (this.#closed !== void 0) return;
		const responseCallback = () => this.#sqlIdAlloc.free(sqlId);
		const errorCallback = (e) => this.#setClosed(e);
		const request = {
			type: "close_sql",
			sqlId
		};
		this._sendRequest(request, {
			responseCallback,
			errorCallback
		});
	}
	/** Close the client and the WebSocket. */
	close() {
		this.#setClosed(new ClientError("Client was manually closed"));
	}
	/** True if the client is closed. */
	get closed() {
		return this.#closed !== void 0;
	}
};

//#endregion
//#region node_modules/@libsql/isomorphic-fetch/web.js
const _fetch = fetch;
const _Request = Request;
const _Headers = Headers;

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/queue_microtask.js
let _queueMicrotask;
if (typeof queueMicrotask !== "undefined") _queueMicrotask = queueMicrotask;
else {
	const resolved = Promise.resolve();
	_queueMicrotask = (callback) => {
		resolved.then(callback);
	};
}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/byte_queue.js
var ByteQueue = class {
	#array;
	#shiftPos;
	#pushPos;
	constructor(initialCap) {
		this.#array = new Uint8Array(new ArrayBuffer(initialCap));
		this.#shiftPos = 0;
		this.#pushPos = 0;
	}
	get length() {
		return this.#pushPos - this.#shiftPos;
	}
	data() {
		return this.#array.slice(this.#shiftPos, this.#pushPos);
	}
	push(chunk) {
		this.#ensurePush(chunk.byteLength);
		this.#array.set(chunk, this.#pushPos);
		this.#pushPos += chunk.byteLength;
	}
	#ensurePush(pushLength) {
		if (this.#pushPos + pushLength <= this.#array.byteLength) return;
		const filledLength = this.#pushPos - this.#shiftPos;
		if (filledLength + pushLength <= this.#array.byteLength && 2 * this.#pushPos >= this.#array.byteLength) this.#array.copyWithin(0, this.#shiftPos, this.#pushPos);
		else {
			let newCap = this.#array.byteLength;
			do
				newCap *= 2;
			while (filledLength + pushLength > newCap);
			const newArray = new Uint8Array(new ArrayBuffer(newCap));
			newArray.set(this.#array.slice(this.#shiftPos, this.#pushPos), 0);
			this.#array = newArray;
		}
		this.#pushPos = filledLength;
		this.#shiftPos = 0;
	}
	shift(length) {
		this.#shiftPos += length;
	}
};

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/http/json_decode.js
function PipelineRespBody$1(obj) {
	return {
		baton: stringOpt(obj["baton"]),
		baseUrl: stringOpt(obj["base_url"]),
		results: arrayObjectsMap(obj["results"], StreamResult$1)
	};
}
__name(PipelineRespBody$1, "PipelineRespBody");
function StreamResult$1(obj) {
	const type = string(obj["type"]);
	if (type === "ok") return {
		type: "ok",
		response: StreamResponse$1(object(obj["response"]))
	};
	else if (type === "error") return {
		type: "error",
		error: Error$2(object(obj["error"]))
	};
	else throw new ProtoError("Unexpected type of StreamResult");
}
__name(StreamResult$1, "StreamResult");
function StreamResponse$1(obj) {
	const type = string(obj["type"]);
	if (type === "close") return { type: "close" };
	else if (type === "execute") return {
		type: "execute",
		result: StmtResult$1(object(obj["result"]))
	};
	else if (type === "batch") return {
		type: "batch",
		result: BatchResult$1(object(obj["result"]))
	};
	else if (type === "sequence") return { type: "sequence" };
	else if (type === "describe") return {
		type: "describe",
		result: DescribeResult$1(object(obj["result"]))
	};
	else if (type === "store_sql") return { type: "store_sql" };
	else if (type === "close_sql") return { type: "close_sql" };
	else if (type === "get_autocommit") return {
		type: "get_autocommit",
		isAutocommit: boolean(obj["is_autocommit"])
	};
	else throw new ProtoError("Unexpected type of StreamResponse");
}
__name(StreamResponse$1, "StreamResponse");
function CursorRespBody$1(obj) {
	return {
		baton: stringOpt(obj["baton"]),
		baseUrl: stringOpt(obj["base_url"])
	};
}
__name(CursorRespBody$1, "CursorRespBody");

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/http/protobuf_decode.js
const PipelineRespBody = {
	default() {
		return {
			baton: void 0,
			baseUrl: void 0,
			results: []
		};
	},
	1(r, msg) {
		msg.baton = r.string();
	},
	2(r, msg) {
		msg.baseUrl = r.string();
	},
	3(r, msg) {
		msg.results.push(r.message(StreamResult));
	}
};
const StreamResult = {
	default() {
		return { type: "none" };
	},
	1(r) {
		return {
			type: "ok",
			response: r.message(StreamResponse)
		};
	},
	2(r) {
		return {
			type: "error",
			error: r.message(Error$1)
		};
	}
};
const StreamResponse = {
	default() {
		return { type: "none" };
	},
	1(r) {
		return { type: "close" };
	},
	2(r) {
		return r.message(ExecuteStreamResp);
	},
	3(r) {
		return r.message(BatchStreamResp);
	},
	4(r) {
		return { type: "sequence" };
	},
	5(r) {
		return r.message(DescribeStreamResp);
	},
	6(r) {
		return { type: "store_sql" };
	},
	7(r) {
		return { type: "close_sql" };
	},
	8(r) {
		return r.message(GetAutocommitStreamResp);
	}
};
const ExecuteStreamResp = {
	default() {
		return {
			type: "execute",
			result: StmtResult.default()
		};
	},
	1(r, msg) {
		msg.result = r.message(StmtResult);
	}
};
const BatchStreamResp = {
	default() {
		return {
			type: "batch",
			result: BatchResult.default()
		};
	},
	1(r, msg) {
		msg.result = r.message(BatchResult);
	}
};
const DescribeStreamResp = {
	default() {
		return {
			type: "describe",
			result: DescribeResult.default()
		};
	},
	1(r, msg) {
		msg.result = r.message(DescribeResult);
	}
};
const GetAutocommitStreamResp = {
	default() {
		return {
			type: "get_autocommit",
			isAutocommit: false
		};
	},
	1(r, msg) {
		msg.isAutocommit = r.bool();
	}
};
const CursorRespBody = {
	default() {
		return {
			baton: void 0,
			baseUrl: void 0
		};
	},
	1(r, msg) {
		msg.baton = r.string();
	},
	2(r, msg) {
		msg.baseUrl = r.string();
	}
};

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/http/cursor.js
var HttpCursor = class extends Cursor {
	#stream;
	#encoding;
	#reader;
	#queue;
	#closed;
	#done;
	/** @private */
	constructor(stream, encoding) {
		super();
		this.#stream = stream;
		this.#encoding = encoding;
		this.#reader = void 0;
		this.#queue = new ByteQueue(16 * 1024);
		this.#closed = void 0;
		this.#done = false;
	}
	async open(response) {
		if (response.body === null) throw new ProtoError("No response body for cursor request");
		this.#reader = response.body.getReader();
		const respBody = await this.#nextItem(CursorRespBody$1, CursorRespBody);
		if (respBody === void 0) throw new ProtoError("Empty response to cursor request");
		return respBody;
	}
	/** Fetch the next entry from the cursor. */
	next() {
		return this.#nextItem(CursorEntry$1, CursorEntry);
	}
	/** Close the cursor. */
	close() {
		this._setClosed(new ClientError("Cursor was manually closed"));
	}
	/** @private */
	_setClosed(error) {
		if (this.#closed !== void 0) return;
		this.#closed = error;
		this.#stream._cursorClosed(this);
		if (this.#reader !== void 0) this.#reader.cancel();
	}
	/** True if the cursor is closed. */
	get closed() {
		return this.#closed !== void 0;
	}
	async #nextItem(jsonFun, protobufDef) {
		for (;;) {
			if (this.#done) return;
			else if (this.#closed !== void 0) throw new ClosedError("Cursor is closed", this.#closed);
			if (this.#encoding === "json") {
				const jsonData = this.#parseItemJson();
				if (jsonData !== void 0) {
					const jsonText = new TextDecoder().decode(jsonData);
					const jsonValue = JSON.parse(jsonText);
					return readJsonObject(jsonValue, jsonFun);
				}
			} else if (this.#encoding === "protobuf") {
				const protobufData = this.#parseItemProtobuf();
				if (protobufData !== void 0) return readProtobufMessage(protobufData, protobufDef);
			} else throw impossible(this.#encoding, "Impossible encoding");
			if (this.#reader === void 0) throw new InternalError("Attempted to read from HTTP cursor before it was opened");
			const { value, done } = await this.#reader.read();
			if (done && this.#queue.length === 0) this.#done = true;
			else if (done) throw new ProtoError("Unexpected end of cursor stream");
			else this.#queue.push(value);
		}
	}
	#parseItemJson() {
		const data = this.#queue.data();
		const newlinePos = data.indexOf(10);
		if (newlinePos < 0) return;
		const jsonData = data.slice(0, newlinePos);
		this.#queue.shift(newlinePos + 1);
		return jsonData;
	}
	#parseItemProtobuf() {
		const data = this.#queue.data();
		let varintValue = 0;
		let varintLength = 0;
		for (;;) {
			if (varintLength >= data.byteLength) return;
			const byte = data[varintLength];
			varintValue |= (byte & 127) << 7 * varintLength;
			varintLength += 1;
			if (!(byte & 128)) break;
		}
		if (data.byteLength < varintLength + varintValue) return;
		const protobufData = data.slice(varintLength, varintLength + varintValue);
		this.#queue.shift(varintLength + varintValue);
		return protobufData;
	}
};

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/http/json_encode.js
function PipelineReqBody$1(w, msg) {
	if (msg.baton !== void 0) w.string("baton", msg.baton);
	w.arrayObjects("requests", msg.requests, StreamRequest$1);
}
__name(PipelineReqBody$1, "PipelineReqBody");
function StreamRequest$1(w, msg) {
	w.stringRaw("type", msg.type);
	if (msg.type === "close") {} else if (msg.type === "execute") w.object("stmt", msg.stmt, Stmt$1);
	else if (msg.type === "batch") w.object("batch", msg.batch, Batch$1);
	else if (msg.type === "sequence") {
		if (msg.sql !== void 0) w.string("sql", msg.sql);
		if (msg.sqlId !== void 0) w.number("sql_id", msg.sqlId);
	} else if (msg.type === "describe") {
		if (msg.sql !== void 0) w.string("sql", msg.sql);
		if (msg.sqlId !== void 0) w.number("sql_id", msg.sqlId);
	} else if (msg.type === "store_sql") {
		w.number("sql_id", msg.sqlId);
		w.string("sql", msg.sql);
	} else if (msg.type === "close_sql") w.number("sql_id", msg.sqlId);
	else if (msg.type === "get_autocommit") {} else throw impossible(msg, "Impossible type of StreamRequest");
}
__name(StreamRequest$1, "StreamRequest");
function CursorReqBody$1(w, msg) {
	if (msg.baton !== void 0) w.string("baton", msg.baton);
	w.object("batch", msg.batch, Batch$1);
}
__name(CursorReqBody$1, "CursorReqBody");

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/http/protobuf_encode.js
function PipelineReqBody(w, msg) {
	if (msg.baton !== void 0) w.string(1, msg.baton);
	for (const req of msg.requests) w.message(2, req, StreamRequest);
}
function StreamRequest(w, msg) {
	if (msg.type === "close") w.message(1, msg, CloseStreamReq);
	else if (msg.type === "execute") w.message(2, msg, ExecuteStreamReq);
	else if (msg.type === "batch") w.message(3, msg, BatchStreamReq);
	else if (msg.type === "sequence") w.message(4, msg, SequenceStreamReq);
	else if (msg.type === "describe") w.message(5, msg, DescribeStreamReq);
	else if (msg.type === "store_sql") w.message(6, msg, StoreSqlStreamReq);
	else if (msg.type === "close_sql") w.message(7, msg, CloseSqlStreamReq);
	else if (msg.type === "get_autocommit") w.message(8, msg, GetAutocommitStreamReq);
	else throw impossible(msg, "Impossible type of StreamRequest");
}
function CloseStreamReq(_w, _msg) {}
function ExecuteStreamReq(w, msg) {
	w.message(1, msg.stmt, Stmt);
}
function BatchStreamReq(w, msg) {
	w.message(1, msg.batch, Batch);
}
function SequenceStreamReq(w, msg) {
	if (msg.sql !== void 0) w.string(1, msg.sql);
	if (msg.sqlId !== void 0) w.int32(2, msg.sqlId);
}
function DescribeStreamReq(w, msg) {
	if (msg.sql !== void 0) w.string(1, msg.sql);
	if (msg.sqlId !== void 0) w.int32(2, msg.sqlId);
}
function StoreSqlStreamReq(w, msg) {
	w.int32(1, msg.sqlId);
	w.string(2, msg.sql);
}
function CloseSqlStreamReq(w, msg) {
	w.int32(1, msg.sqlId);
}
function GetAutocommitStreamReq(_w, _msg) {}
function CursorReqBody(w, msg) {
	if (msg.baton !== void 0) w.string(1, msg.baton);
	w.message(2, msg.batch, Batch);
}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/http/stream.js
var HttpStream = class extends Stream {
	#client;
	#baseUrl;
	#jwt;
	#fetch;
	#baton;
	#queue;
	#flushing;
	#cursor;
	#closing;
	#closeQueued;
	#closed;
	#sqlIdAlloc;
	/** @private */
	constructor(client, baseUrl, jwt, customFetch) {
		super(client.intMode);
		this.#client = client;
		this.#baseUrl = baseUrl.toString();
		this.#jwt = jwt;
		this.#fetch = customFetch;
		this.#baton = void 0;
		this.#queue = new Queue();
		this.#flushing = false;
		this.#closing = false;
		this.#closeQueued = false;
		this.#closed = void 0;
		this.#sqlIdAlloc = new IdAlloc();
	}
	/** Get the {@link HttpClient} object that this stream belongs to. */
	client() {
		return this.#client;
	}
	/** @private */
	_sqlOwner() {
		return this;
	}
	/** Cache a SQL text on the server. */
	storeSql(sql) {
		const sqlId = this.#sqlIdAlloc.alloc();
		this.#sendStreamRequest({
			type: "store_sql",
			sqlId,
			sql
		}).then(() => void 0, (error) => this._setClosed(error));
		return new Sql(this, sqlId);
	}
	/** @private */
	_closeSql(sqlId) {
		if (this.#closed !== void 0) return;
		this.#sendStreamRequest({
			type: "close_sql",
			sqlId
		}).then(() => this.#sqlIdAlloc.free(sqlId), (error) => this._setClosed(error));
	}
	/** @private */
	_execute(stmt) {
		return this.#sendStreamRequest({
			type: "execute",
			stmt
		}).then((response) => {
			return response.result;
		});
	}
	/** @private */
	_batch(batch$1) {
		return this.#sendStreamRequest({
			type: "batch",
			batch: batch$1
		}).then((response) => {
			return response.result;
		});
	}
	/** @private */
	_describe(protoSql) {
		return this.#sendStreamRequest({
			type: "describe",
			sql: protoSql.sql,
			sqlId: protoSql.sqlId
		}).then((response) => {
			return response.result;
		});
	}
	/** @private */
	_sequence(protoSql) {
		return this.#sendStreamRequest({
			type: "sequence",
			sql: protoSql.sql,
			sqlId: protoSql.sqlId
		}).then((_response) => {});
	}
	/** Check whether the SQL connection underlying this stream is in autocommit state (i.e., outside of an
	* explicit transaction). This requires protocol version 3 or higher.
	*/
	getAutocommit() {
		this.#client._ensureVersion(3, "getAutocommit()");
		return this.#sendStreamRequest({ type: "get_autocommit" }).then((response) => {
			return response.isAutocommit;
		});
	}
	#sendStreamRequest(request) {
		return new Promise((responseCallback, errorCallback) => {
			this.#pushToQueue({
				type: "pipeline",
				request,
				responseCallback,
				errorCallback
			});
		});
	}
	/** @private */
	_openCursor(batch$1) {
		return new Promise((cursorCallback, errorCallback) => {
			this.#pushToQueue({
				type: "cursor",
				batch: batch$1,
				cursorCallback,
				errorCallback
			});
		});
	}
	/** @private */
	_cursorClosed(cursor) {
		if (cursor !== this.#cursor) throw new InternalError("Cursor was closed, but it was not associated with the stream");
		this.#cursor = void 0;
		_queueMicrotask(() => this.#flushQueue());
	}
	/** Immediately close the stream. */
	close() {
		this._setClosed(new ClientError("Stream was manually closed"));
	}
	/** Gracefully close the stream. */
	closeGracefully() {
		this.#closing = true;
		_queueMicrotask(() => this.#flushQueue());
	}
	/** True if the stream is closed. */
	get closed() {
		return this.#closed !== void 0 || this.#closing;
	}
	/** @private */
	_setClosed(error) {
		if (this.#closed !== void 0) return;
		this.#closed = error;
		if (this.#cursor !== void 0) this.#cursor._setClosed(error);
		this.#client._streamClosed(this);
		for (;;) {
			const entry = this.#queue.shift();
			if (entry !== void 0) entry.errorCallback(error);
			else break;
		}
		if ((this.#baton !== void 0 || this.#flushing) && !this.#closeQueued) {
			this.#queue.push({
				type: "pipeline",
				request: { type: "close" },
				responseCallback: () => void 0,
				errorCallback: () => void 0
			});
			this.#closeQueued = true;
			_queueMicrotask(() => this.#flushQueue());
		}
	}
	#pushToQueue(entry) {
		if (this.#closed !== void 0) throw new ClosedError("Stream is closed", this.#closed);
		else if (this.#closing) throw new ClosedError("Stream is closing", void 0);
		else {
			this.#queue.push(entry);
			_queueMicrotask(() => this.#flushQueue());
		}
	}
	#flushQueue() {
		if (this.#flushing || this.#cursor !== void 0) return;
		if (this.#closing && this.#queue.length === 0) {
			this._setClosed(new ClientError("Stream was gracefully closed"));
			return;
		}
		const endpoint = this.#client._endpoint;
		if (endpoint === void 0) {
			this.#client._endpointPromise.then(() => this.#flushQueue(), (error) => this._setClosed(error));
			return;
		}
		const firstEntry = this.#queue.shift();
		if (firstEntry === void 0) return;
		else if (firstEntry.type === "pipeline") {
			const pipeline = [firstEntry];
			for (;;) {
				const entry = this.#queue.first();
				if (entry !== void 0 && entry.type === "pipeline") {
					pipeline.push(entry);
					this.#queue.shift();
				} else if (entry === void 0 && this.#closing && !this.#closeQueued) {
					pipeline.push({
						type: "pipeline",
						request: { type: "close" },
						responseCallback: () => void 0,
						errorCallback: () => void 0
					});
					this.#closeQueued = true;
					break;
				} else break;
			}
			this.#flushPipeline(endpoint, pipeline);
		} else if (firstEntry.type === "cursor") this.#flushCursor(endpoint, firstEntry);
		else throw impossible(firstEntry, "Impossible type of QueueEntry");
	}
	#flushPipeline(endpoint, pipeline) {
		this.#flush(() => this.#createPipelineRequest(pipeline, endpoint), (resp) => decodePipelineResponse(resp, endpoint.encoding), (respBody) => respBody.baton, (respBody) => respBody.baseUrl, (respBody) => handlePipelineResponse(pipeline, respBody), (error) => pipeline.forEach((entry) => entry.errorCallback(error)));
	}
	#flushCursor(endpoint, entry) {
		const cursor = new HttpCursor(this, endpoint.encoding);
		this.#cursor = cursor;
		this.#flush(() => this.#createCursorRequest(entry, endpoint), (resp) => cursor.open(resp), (respBody) => respBody.baton, (respBody) => respBody.baseUrl, (_respBody) => entry.cursorCallback(cursor), (error) => entry.errorCallback(error));
	}
	#flush(createRequest, decodeResponse, getBaton, getBaseUrl, handleResponse, handleError) {
		let promise;
		try {
			const request = createRequest();
			const fetch$1 = this.#fetch;
			promise = fetch$1(request);
		} catch (error) {
			promise = Promise.reject(error);
		}
		this.#flushing = true;
		promise.then((resp) => {
			if (!resp.ok) return errorFromResponse(resp).then((error) => {
				throw error;
			});
			return decodeResponse(resp);
		}).then((r) => {
			this.#baton = getBaton(r);
			this.#baseUrl = getBaseUrl(r) ?? this.#baseUrl;
			handleResponse(r);
		}).catch((error) => {
			this._setClosed(error);
			handleError(error);
		}).finally(() => {
			this.#flushing = false;
			this.#flushQueue();
		});
	}
	#createPipelineRequest(pipeline, endpoint) {
		return this.#createRequest(new URL(endpoint.pipelinePath, this.#baseUrl), {
			baton: this.#baton,
			requests: pipeline.map((entry) => entry.request)
		}, endpoint.encoding, PipelineReqBody$1, PipelineReqBody);
	}
	#createCursorRequest(entry, endpoint) {
		if (endpoint.cursorPath === void 0) throw new ProtocolVersionError(`Cursors are supported only on protocol version 3 and higher, but the HTTP server only supports version ${endpoint.version}.`);
		return this.#createRequest(new URL(endpoint.cursorPath, this.#baseUrl), {
			baton: this.#baton,
			batch: entry.batch
		}, endpoint.encoding, CursorReqBody$1, CursorReqBody);
	}
	#createRequest(url, reqBody, encoding, jsonFun, protobufFun) {
		let bodyData;
		let contentType;
		if (encoding === "json") {
			bodyData = writeJsonObject(reqBody, jsonFun);
			contentType = "application/json";
		} else if (encoding === "protobuf") {
			bodyData = writeProtobufMessage(reqBody, protobufFun);
			contentType = "application/x-protobuf";
		} else throw impossible(encoding, "Impossible encoding");
		const headers = new _Headers();
		headers.set("content-type", contentType);
		if (this.#jwt !== void 0) headers.set("authorization", `Bearer ${this.#jwt}`);
		return new _Request(url.toString(), {
			method: "POST",
			headers,
			body: bodyData
		});
	}
};
function handlePipelineResponse(pipeline, respBody) {
	if (respBody.results.length !== pipeline.length) throw new ProtoError("Server returned unexpected number of pipeline results");
	for (let i = 0; i < pipeline.length; ++i) {
		const result = respBody.results[i];
		const entry = pipeline[i];
		if (result.type === "ok") {
			if (result.response.type !== entry.request.type) throw new ProtoError("Received unexpected type of response");
			entry.responseCallback(result.response);
		} else if (result.type === "error") entry.errorCallback(errorFromProto(result.error));
		else if (result.type === "none") throw new ProtoError("Received unrecognized type of StreamResult");
		else throw impossible(result, "Received impossible type of StreamResult");
	}
}
async function decodePipelineResponse(resp, encoding) {
	if (encoding === "json") return readJsonObject(await resp.json(), PipelineRespBody$1);
	if (encoding === "protobuf") {
		const respData = await resp.arrayBuffer();
		return readProtobufMessage(new Uint8Array(respData), PipelineRespBody);
	}
	await resp.body?.cancel();
	throw impossible(encoding, "Impossible encoding");
}
async function errorFromResponse(resp) {
	const respType = resp.headers.get("content-type") ?? "text/plain";
	let message = `Server returned HTTP status ${resp.status}`;
	if (respType === "application/json") {
		const respBody = await resp.json();
		if ("message" in respBody) return errorFromProto(respBody);
		return new HttpServerError(message, resp.status);
	}
	if (respType === "text/plain") {
		const respBody = (await resp.text()).trim();
		if (respBody !== "") message += `: ${respBody}`;
		return new HttpServerError(message, resp.status);
	}
	await resp.body?.cancel();
	return new HttpServerError(message, resp.status);
}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/http/client.js
const checkEndpoints = [{
	versionPath: "v3-protobuf",
	pipelinePath: "v3-protobuf/pipeline",
	cursorPath: "v3-protobuf/cursor",
	version: 3,
	encoding: "protobuf"
}];
const fallbackEndpoint = {
	versionPath: "v2",
	pipelinePath: "v2/pipeline",
	cursorPath: void 0,
	version: 2,
	encoding: "json"
};
/** A client for the Hrana protocol over HTTP. */
var HttpClient$1 = class extends Client {
	static {
		__name(this, "HttpClient");
	}
	#url;
	#jwt;
	#fetch;
	#closed;
	#streams;
	/** @private */
	_endpointPromise;
	/** @private */
	_endpoint;
	/** @private */
	constructor(url, jwt, customFetch, protocolVersion = 2) {
		super();
		this.#url = url;
		this.#jwt = jwt;
		this.#fetch = customFetch ?? _fetch;
		this.#closed = void 0;
		this.#streams = /* @__PURE__ */ new Set();
		if (protocolVersion == 3) {
			this._endpointPromise = findEndpoint(this.#fetch, this.#url);
			this._endpointPromise.then((endpoint) => this._endpoint = endpoint, (error) => this.#setClosed(error));
		} else {
			this._endpointPromise = Promise.resolve(fallbackEndpoint);
			this._endpointPromise.then((endpoint) => this._endpoint = endpoint, (error) => this.#setClosed(error));
		}
	}
	/** Get the protocol version supported by the server. */
	async getVersion() {
		if (this._endpoint !== void 0) return this._endpoint.version;
		return (await this._endpointPromise).version;
	}
	/** @private */
	_ensureVersion(minVersion, feature) {
		if (minVersion <= fallbackEndpoint.version) return;
		else if (this._endpoint === void 0) throw new ProtocolVersionError(`${feature} is supported only on protocol version ${minVersion} and higher, but the version supported by the HTTP server is not yet known. Use Client.getVersion() to wait until the version is available.`);
		else if (this._endpoint.version < minVersion) throw new ProtocolVersionError(`${feature} is supported only on protocol version ${minVersion} and higher, but the HTTP server only supports version ${this._endpoint.version}.`);
	}
	/** Open a {@link HttpStream}, a stream for executing SQL statements. */
	openStream() {
		if (this.#closed !== void 0) throw new ClosedError("Client is closed", this.#closed);
		const stream = new HttpStream(this, this.#url, this.#jwt, this.#fetch);
		this.#streams.add(stream);
		return stream;
	}
	/** @private */
	_streamClosed(stream) {
		this.#streams.delete(stream);
	}
	/** Close the client and all its streams. */
	close() {
		this.#setClosed(new ClientError("Client was manually closed"));
	}
	/** True if the client is closed. */
	get closed() {
		return this.#closed !== void 0;
	}
	#setClosed(error) {
		if (this.#closed !== void 0) return;
		this.#closed = error;
		for (const stream of Array.from(this.#streams)) stream._setClosed(new ClosedError("Client was closed", error));
	}
};
async function findEndpoint(customFetch, clientUrl) {
	const fetch$1 = customFetch;
	for (const endpoint of checkEndpoints) {
		const response = await fetch$1(new _Request(new URL(endpoint.versionPath, clientUrl).toString(), { method: "GET" }));
		await response.arrayBuffer();
		if (response.ok) return endpoint;
	}
	return fallbackEndpoint;
}

//#endregion
//#region node_modules/@libsql/hrana-client/lib-esm/index.js
/** Open a Hrana client over WebSocket connected to the given `url`. */
function openWs(url, jwt, protocolVersion = 2) {
	if (typeof _WebSocket === "undefined") throw new WebSocketUnsupportedError("WebSockets are not supported in this environment");
	var subprotocols = void 0;
	if (protocolVersion == 3) subprotocols = Array.from(subprotocolsV3.keys());
	else subprotocols = Array.from(subprotocolsV2.keys());
	return new WsClient$1(new _WebSocket(url, subprotocols), jwt);
}
/** Open a Hrana client over HTTP connected to the given `url`.
*
* If the `customFetch` argument is passed and not `undefined`, it is used in place of the `fetch` function
* from `@libsql/isomorphic-fetch`. This function is always called with a `Request` object from
* `@libsql/isomorphic-fetch`.
*/
function openHttp(url, jwt, customFetch, protocolVersion = 2) {
	return new HttpClient$1(url instanceof URL ? url : new URL(url), jwt, customFetch, protocolVersion);
}

//#endregion
//#region node_modules/@libsql/client/lib-esm/hrana.js
var HranaTransaction = class {
	#mode;
	#version;
	#started;
	/** @private */
	constructor(mode, version$1) {
		this.#mode = mode;
		this.#version = version$1;
		this.#started = void 0;
	}
	execute(stmt) {
		return this.batch([stmt]).then((results) => results[0]);
	}
	async batch(stmts) {
		const stream = this._getStream();
		if (stream.closed) throw new LibsqlError("Cannot execute statements because the transaction is closed", "TRANSACTION_CLOSED");
		try {
			const hranaStmts = stmts.map(stmtToHrana);
			let rowsPromises;
			if (this.#started === void 0) {
				this._getSqlCache().apply(hranaStmts);
				const batch$1 = stream.batch(this.#version >= 3);
				const beginStep = batch$1.step();
				const beginPromise = beginStep.run(transactionModeToBegin(this.#mode));
				let lastStep = beginStep;
				rowsPromises = hranaStmts.map((hranaStmt) => {
					const stmtStep = batch$1.step().condition(BatchCond$2.ok(lastStep));
					if (this.#version >= 3) stmtStep.condition(BatchCond$2.not(BatchCond$2.isAutocommit(batch$1)));
					const rowsPromise = stmtStep.query(hranaStmt);
					rowsPromise.catch(() => void 0);
					lastStep = stmtStep;
					return rowsPromise;
				});
				this.#started = batch$1.execute().then(() => beginPromise).then(() => void 0);
				try {
					await this.#started;
				} catch (e) {
					this.close();
					throw e;
				}
			} else {
				if (this.#version < 3) await this.#started;
				this._getSqlCache().apply(hranaStmts);
				const batch$1 = stream.batch(this.#version >= 3);
				let lastStep = void 0;
				rowsPromises = hranaStmts.map((hranaStmt) => {
					const stmtStep = batch$1.step();
					if (lastStep !== void 0) stmtStep.condition(BatchCond$2.ok(lastStep));
					if (this.#version >= 3) stmtStep.condition(BatchCond$2.not(BatchCond$2.isAutocommit(batch$1)));
					const rowsPromise = stmtStep.query(hranaStmt);
					rowsPromise.catch(() => void 0);
					lastStep = stmtStep;
					return rowsPromise;
				});
				await batch$1.execute();
			}
			const resultSets = [];
			for (const rowsPromise of rowsPromises) {
				const rows = await rowsPromise;
				if (rows === void 0) throw new LibsqlError("Statement in a transaction was not executed, probably because the transaction has been rolled back", "TRANSACTION_CLOSED");
				resultSets.push(resultSetFromHrana(rows));
			}
			return resultSets;
		} catch (e) {
			throw mapHranaError(e);
		}
	}
	async executeMultiple(sql) {
		const stream = this._getStream();
		if (stream.closed) throw new LibsqlError("Cannot execute statements because the transaction is closed", "TRANSACTION_CLOSED");
		try {
			if (this.#started === void 0) {
				this.#started = stream.run(transactionModeToBegin(this.#mode)).then(() => void 0);
				try {
					await this.#started;
				} catch (e) {
					this.close();
					throw e;
				}
			} else await this.#started;
			await stream.sequence(sql);
		} catch (e) {
			throw mapHranaError(e);
		}
	}
	async rollback() {
		try {
			const stream = this._getStream();
			if (stream.closed) return;
			if (this.#started !== void 0) {} else return;
			const promise = stream.run("ROLLBACK").catch((e) => {
				throw mapHranaError(e);
			});
			stream.closeGracefully();
			await promise;
		} catch (e) {
			throw mapHranaError(e);
		} finally {
			this.close();
		}
	}
	async commit() {
		try {
			const stream = this._getStream();
			if (stream.closed) throw new LibsqlError("Cannot commit the transaction because it is already closed", "TRANSACTION_CLOSED");
			if (this.#started !== void 0) await this.#started;
			else return;
			const promise = stream.run("COMMIT").catch((e) => {
				throw mapHranaError(e);
			});
			stream.closeGracefully();
			await promise;
		} catch (e) {
			throw mapHranaError(e);
		} finally {
			this.close();
		}
	}
};
async function executeHranaBatch(mode, version$1, batch$1, hranaStmts, disableForeignKeys = false) {
	if (disableForeignKeys) batch$1.step().run("PRAGMA foreign_keys=off");
	const beginStep = batch$1.step();
	const beginPromise = beginStep.run(transactionModeToBegin(mode));
	let lastStep = beginStep;
	const stmtPromises = hranaStmts.map((hranaStmt) => {
		const stmtStep = batch$1.step().condition(BatchCond$2.ok(lastStep));
		if (version$1 >= 3) stmtStep.condition(BatchCond$2.not(BatchCond$2.isAutocommit(batch$1)));
		const stmtPromise = stmtStep.query(hranaStmt);
		lastStep = stmtStep;
		return stmtPromise;
	});
	const commitStep = batch$1.step().condition(BatchCond$2.ok(lastStep));
	if (version$1 >= 3) commitStep.condition(BatchCond$2.not(BatchCond$2.isAutocommit(batch$1)));
	const commitPromise = commitStep.run("COMMIT");
	batch$1.step().condition(BatchCond$2.not(BatchCond$2.ok(commitStep))).run("ROLLBACK").catch((_) => void 0);
	if (disableForeignKeys) batch$1.step().run("PRAGMA foreign_keys=on");
	await batch$1.execute();
	const resultSets = [];
	await beginPromise;
	for (const stmtPromise of stmtPromises) {
		const hranaRows = await stmtPromise;
		if (hranaRows === void 0) throw new LibsqlError("Statement in a batch was not executed, probably because the transaction has been rolled back", "TRANSACTION_CLOSED");
		resultSets.push(resultSetFromHrana(hranaRows));
	}
	await commitPromise;
	return resultSets;
}
function stmtToHrana(stmt) {
	let sql;
	let args;
	if (Array.isArray(stmt)) [sql, args] = stmt;
	else if (typeof stmt === "string") sql = stmt;
	else {
		sql = stmt.sql;
		args = stmt.args;
	}
	const hranaStmt = new Stmt$2(sql);
	if (args) if (Array.isArray(args)) hranaStmt.bindIndexes(args);
	else for (const [key, value] of Object.entries(args)) hranaStmt.bindName(key, value);
	return hranaStmt;
}
function resultSetFromHrana(hranaRows) {
	const columns = hranaRows.columnNames.map((c) => c ?? "");
	const columnTypes = hranaRows.columnDecltypes.map((c) => c ?? "");
	const rows = hranaRows.rows;
	const rowsAffected = hranaRows.affectedRowCount;
	return new ResultSetImpl(columns, columnTypes, rows, rowsAffected, hranaRows.lastInsertRowid !== void 0 ? hranaRows.lastInsertRowid : void 0);
}
function mapHranaError(e) {
	if (e instanceof ClientError) {
		const code = mapHranaErrorCode(e);
		return new LibsqlError(e.message, code, void 0, e);
	}
	return e;
}
function mapHranaErrorCode(e) {
	if (e instanceof ResponseError && e.code !== void 0) return e.code;
	else if (e instanceof ProtoError) return "HRANA_PROTO_ERROR";
	else if (e instanceof ClosedError) return e.cause instanceof ClientError ? mapHranaErrorCode(e.cause) : "HRANA_CLOSED_ERROR";
	else if (e instanceof WebSocketError) return "HRANA_WEBSOCKET_ERROR";
	else if (e instanceof HttpServerError) return "SERVER_ERROR";
	else if (e instanceof ProtocolVersionError) return "PROTOCOL_VERSION_ERROR";
	else if (e instanceof InternalError) return "INTERNAL_ERROR";
	else return "UNKNOWN";
}

//#endregion
//#region node_modules/@libsql/client/lib-esm/sql_cache.js
var SqlCache = class {
	#owner;
	#sqls;
	capacity;
	constructor(owner, capacity) {
		this.#owner = owner;
		this.#sqls = new Lru();
		this.capacity = capacity;
	}
	apply(hranaStmts) {
		if (this.capacity <= 0) return;
		const usedSqlObjs = /* @__PURE__ */ new Set();
		for (const hranaStmt of hranaStmts) {
			if (typeof hranaStmt.sql !== "string") continue;
			const sqlText = hranaStmt.sql;
			if (sqlText.length >= 5e3) continue;
			let sqlObj = this.#sqls.get(sqlText);
			if (sqlObj === void 0) {
				while (this.#sqls.size + 1 > this.capacity) {
					const [evictSqlText, evictSqlObj] = this.#sqls.peekLru();
					if (usedSqlObjs.has(evictSqlObj)) break;
					evictSqlObj.close();
					this.#sqls.delete(evictSqlText);
				}
				if (this.#sqls.size + 1 <= this.capacity) {
					sqlObj = this.#owner.storeSql(sqlText);
					this.#sqls.set(sqlText, sqlObj);
				}
			}
			if (sqlObj !== void 0) {
				hranaStmt.sql = sqlObj;
				usedSqlObjs.add(sqlObj);
			}
		}
	}
};
var Lru = class {
	#cache;
	constructor() {
		this.#cache = /* @__PURE__ */ new Map();
	}
	get(key) {
		const value = this.#cache.get(key);
		if (value !== void 0) {
			this.#cache.delete(key);
			this.#cache.set(key, value);
		}
		return value;
	}
	set(key, value) {
		this.#cache.set(key, value);
	}
	peekLru() {
		for (const entry of this.#cache.entries()) return entry;
	}
	delete(key) {
		this.#cache.delete(key);
	}
	get size() {
		return this.#cache.size;
	}
};

//#endregion
//#region node_modules/promise-limit/index.js
var require_promise_limit = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function limiter(count) {
		var outstanding = 0;
		var jobs = [];
		function remove$1() {
			outstanding--;
			if (outstanding < count) dequeue();
		}
		__name(remove$1, "remove");
		function dequeue() {
			var job = jobs.shift();
			semaphore.queue = jobs.length;
			if (job) run(job.fn).then(job.resolve).catch(job.reject);
		}
		function queue(fn) {
			return new Promise(function(resolve, reject) {
				jobs.push({
					fn,
					resolve,
					reject
				});
				semaphore.queue = jobs.length;
			});
		}
		function run(fn) {
			outstanding++;
			try {
				return Promise.resolve(fn()).then(function(result) {
					remove$1();
					return result;
				}, function(error) {
					remove$1();
					throw error;
				});
			} catch (err) {
				remove$1();
				return Promise.reject(err);
			}
		}
		var semaphore = function(fn) {
			if (outstanding >= count) return queue(fn);
			else return run(fn);
		};
		return semaphore;
	}
	function map(items, mapper) {
		var failed = false;
		var limit = this;
		return Promise.all(items.map(function() {
			var args = arguments;
			return limit(function() {
				if (!failed) return mapper.apply(void 0, args).catch(function(e) {
					failed = true;
					throw e;
				});
			});
		}));
	}
	function addExtras(fn) {
		fn.queue = 0;
		fn.map = map;
		return fn;
	}
	module.exports = function(count) {
		if (count) return addExtras(limiter(count));
		else return addExtras(function(fn) {
			return fn();
		});
	};
}));

//#endregion
//#region node_modules/@libsql/client/lib-esm/ws.js
var import_promise_limit = /* @__PURE__ */ __toESM(require_promise_limit(), 1);
/** @private */
function _createClient$2(config) {
	if (config.scheme !== "wss" && config.scheme !== "ws") throw new LibsqlError(`The WebSocket client supports only "libsql:", "wss:" and "ws:" URLs, got ${JSON.stringify(config.scheme + ":")}. For more information, please read ${supportedUrlLink}`, "URL_SCHEME_NOT_SUPPORTED");
	if (config.encryptionKey !== void 0) throw new LibsqlError("Encryption key is not supported by the remote client.", "ENCRYPTION_KEY_NOT_SUPPORTED");
	if (config.scheme === "ws" && config.tls) throw new LibsqlError(`A "ws:" URL cannot opt into TLS by using ?tls=1`, "URL_INVALID");
	else if (config.scheme === "wss" && !config.tls) throw new LibsqlError(`A "wss:" URL cannot opt out of TLS by using ?tls=0`, "URL_INVALID");
	const url = encodeBaseUrl(config.scheme, config.authority, config.path);
	let client;
	try {
		client = openWs(url, config.authToken);
	} catch (e) {
		if (e instanceof WebSocketUnsupportedError) {
			const suggestedScheme = config.scheme === "wss" ? "https" : "http";
			const suggestedUrl = encodeBaseUrl(suggestedScheme, config.authority, config.path);
			throw new LibsqlError(`This environment does not support WebSockets, please switch to the HTTP client by using a "${suggestedScheme}:" URL (${JSON.stringify(suggestedUrl)}). For more information, please read ${supportedUrlLink}`, "WEBSOCKETS_NOT_SUPPORTED");
		}
		throw mapHranaError(e);
	}
	return new WsClient(client, url, config.authToken, config.intMode, config.concurrency);
}
__name(_createClient$2, "_createClient");
const maxConnAgeMillis = 60 * 1e3;
const sqlCacheCapacity$1 = 100;
var WsClient = class {
	#url;
	#authToken;
	#intMode;
	#connState;
	#futureConnState;
	closed;
	protocol;
	#isSchemaDatabase;
	#promiseLimitFunction;
	/** @private */
	constructor(client, url, authToken, intMode, concurrency) {
		this.#url = url;
		this.#authToken = authToken;
		this.#intMode = intMode;
		this.#connState = this.#openConn(client);
		this.#futureConnState = void 0;
		this.closed = false;
		this.protocol = "ws";
		this.#promiseLimitFunction = (0, import_promise_limit.default)(concurrency);
	}
	async limit(fn) {
		return this.#promiseLimitFunction(fn);
	}
	async execute(stmtOrSql, args) {
		let stmt;
		if (typeof stmtOrSql === "string") stmt = {
			sql: stmtOrSql,
			args: args || []
		};
		else stmt = stmtOrSql;
		return this.limit(async () => {
			const streamState = await this.#openStream();
			try {
				const hranaStmt = stmtToHrana(stmt);
				streamState.conn.sqlCache.apply([hranaStmt]);
				const hranaRowsPromise = streamState.stream.query(hranaStmt);
				streamState.stream.closeGracefully();
				return resultSetFromHrana(await hranaRowsPromise);
			} catch (e) {
				throw mapHranaError(e);
			} finally {
				this._closeStream(streamState);
			}
		});
	}
	async batch(stmts, mode = "deferred") {
		return this.limit(async () => {
			const streamState = await this.#openStream();
			try {
				const hranaStmts = stmts.map((stmt) => {
					if (Array.isArray(stmt)) return {
						sql: stmt[0],
						args: stmt[1] || []
					};
					return stmt;
				}).map(stmtToHrana);
				const version$1 = await streamState.conn.client.getVersion();
				streamState.conn.sqlCache.apply(hranaStmts);
				return await executeHranaBatch(mode, version$1, streamState.stream.batch(version$1 >= 3), hranaStmts);
			} catch (e) {
				throw mapHranaError(e);
			} finally {
				this._closeStream(streamState);
			}
		});
	}
	async migrate(stmts) {
		return this.limit(async () => {
			const streamState = await this.#openStream();
			try {
				const hranaStmts = stmts.map(stmtToHrana);
				const version$1 = await streamState.conn.client.getVersion();
				return await executeHranaBatch("deferred", version$1, streamState.stream.batch(version$1 >= 3), hranaStmts, true);
			} catch (e) {
				throw mapHranaError(e);
			} finally {
				this._closeStream(streamState);
			}
		});
	}
	async transaction(mode = "write") {
		return this.limit(async () => {
			const streamState = await this.#openStream();
			try {
				const version$1 = await streamState.conn.client.getVersion();
				return new WsTransaction(this, streamState, mode, version$1);
			} catch (e) {
				this._closeStream(streamState);
				throw mapHranaError(e);
			}
		});
	}
	async executeMultiple(sql) {
		return this.limit(async () => {
			const streamState = await this.#openStream();
			try {
				const promise = streamState.stream.sequence(sql);
				streamState.stream.closeGracefully();
				await promise;
			} catch (e) {
				throw mapHranaError(e);
			} finally {
				this._closeStream(streamState);
			}
		});
	}
	sync() {
		throw new LibsqlError("sync not supported in ws mode", "SYNC_NOT_SUPPORTED");
	}
	async #openStream() {
		if (this.closed) throw new LibsqlError("The client is closed", "CLIENT_CLOSED");
		if ((/* @__PURE__ */ new Date()).valueOf() - this.#connState.openTime.valueOf() > maxConnAgeMillis && this.#futureConnState === void 0) {
			const futureConnState = this.#openConn();
			this.#futureConnState = futureConnState;
			futureConnState.client.getVersion().then((_version) => {
				if (this.#connState !== futureConnState) {
					if (this.#connState.streamStates.size === 0) this.#connState.client.close();
				}
				this.#connState = futureConnState;
				this.#futureConnState = void 0;
			}, (_e) => {
				this.#futureConnState = void 0;
			});
		}
		if (this.#connState.client.closed) try {
			if (this.#futureConnState !== void 0) this.#connState = this.#futureConnState;
			else this.#connState = this.#openConn();
		} catch (e) {
			throw mapHranaError(e);
		}
		const connState = this.#connState;
		try {
			if (connState.useSqlCache === void 0) {
				connState.useSqlCache = await connState.client.getVersion() >= 2;
				if (connState.useSqlCache) connState.sqlCache.capacity = sqlCacheCapacity$1;
			}
			const stream = connState.client.openStream();
			stream.intMode = this.#intMode;
			const streamState = {
				conn: connState,
				stream
			};
			connState.streamStates.add(streamState);
			return streamState;
		} catch (e) {
			throw mapHranaError(e);
		}
	}
	#openConn(client) {
		try {
			client ??= openWs(this.#url, this.#authToken);
			return {
				client,
				useSqlCache: void 0,
				sqlCache: new SqlCache(client, 0),
				openTime: /* @__PURE__ */ new Date(),
				streamStates: /* @__PURE__ */ new Set()
			};
		} catch (e) {
			throw mapHranaError(e);
		}
	}
	async reconnect() {
		try {
			for (const st of Array.from(this.#connState.streamStates)) try {
				st.stream.close();
			} catch {}
			this.#connState.client.close();
		} catch {}
		if (this.#futureConnState) {
			try {
				this.#futureConnState.client.close();
			} catch {}
			this.#futureConnState = void 0;
		}
		const next = this.#openConn();
		next.useSqlCache = await next.client.getVersion() >= 2;
		if (next.useSqlCache) next.sqlCache.capacity = sqlCacheCapacity$1;
		this.#connState = next;
		this.closed = false;
	}
	_closeStream(streamState) {
		streamState.stream.close();
		const connState = streamState.conn;
		connState.streamStates.delete(streamState);
		if (connState.streamStates.size === 0 && connState !== this.#connState) connState.client.close();
	}
	close() {
		this.#connState.client.close();
		this.closed = true;
		if (this.#futureConnState) {
			try {
				this.#futureConnState.client.close();
			} catch {}
			this.#futureConnState = void 0;
		}
		this.closed = true;
	}
};
var WsTransaction = class extends HranaTransaction {
	#client;
	#streamState;
	/** @private */
	constructor(client, state, mode, version$1) {
		super(mode, version$1);
		this.#client = client;
		this.#streamState = state;
	}
	/** @private */
	_getStream() {
		return this.#streamState.stream;
	}
	/** @private */
	_getSqlCache() {
		return this.#streamState.conn.sqlCache;
	}
	close() {
		this.#client._closeStream(this.#streamState);
	}
	get closed() {
		return this.#streamState.stream.closed;
	}
};

//#endregion
//#region node_modules/@libsql/client/lib-esm/http.js
/** @private */
function _createClient$1(config) {
	if (config.scheme !== "https" && config.scheme !== "http") throw new LibsqlError(`The HTTP client supports only "libsql:", "https:" and "http:" URLs, got ${JSON.stringify(config.scheme + ":")}. For more information, please read ${supportedUrlLink}`, "URL_SCHEME_NOT_SUPPORTED");
	if (config.encryptionKey !== void 0) throw new LibsqlError("Encryption key is not supported by the remote client.", "ENCRYPTION_KEY_NOT_SUPPORTED");
	if (config.scheme === "http" && config.tls) throw new LibsqlError(`A "http:" URL cannot opt into TLS by using ?tls=1`, "URL_INVALID");
	else if (config.scheme === "https" && !config.tls) throw new LibsqlError(`A "https:" URL cannot opt out of TLS by using ?tls=0`, "URL_INVALID");
	return new HttpClient(encodeBaseUrl(config.scheme, config.authority, config.path), config.authToken, config.intMode, config.fetch, config.concurrency);
}
__name(_createClient$1, "_createClient");
const sqlCacheCapacity = 30;
var HttpClient = class {
	#client;
	protocol;
	#url;
	#intMode;
	#customFetch;
	#concurrency;
	#authToken;
	#promiseLimitFunction;
	/** @private */
	constructor(url, authToken, intMode, customFetch, concurrency) {
		this.#url = url;
		this.#authToken = authToken;
		this.#intMode = intMode;
		this.#customFetch = customFetch;
		this.#concurrency = concurrency;
		this.#client = openHttp(this.#url, this.#authToken, this.#customFetch);
		this.#client.intMode = this.#intMode;
		this.protocol = "http";
		this.#promiseLimitFunction = (0, import_promise_limit.default)(this.#concurrency);
	}
	async limit(fn) {
		return this.#promiseLimitFunction(fn);
	}
	async execute(stmtOrSql, args) {
		let stmt;
		if (typeof stmtOrSql === "string") stmt = {
			sql: stmtOrSql,
			args: args || []
		};
		else stmt = stmtOrSql;
		return this.limit(async () => {
			try {
				const hranaStmt = stmtToHrana(stmt);
				let rowsPromise;
				const stream = this.#client.openStream();
				try {
					rowsPromise = stream.query(hranaStmt);
				} finally {
					stream.closeGracefully();
				}
				return resultSetFromHrana(await rowsPromise);
			} catch (e) {
				throw mapHranaError(e);
			}
		});
	}
	async batch(stmts, mode = "deferred") {
		return this.limit(async () => {
			try {
				const hranaStmts = stmts.map((stmt) => {
					if (Array.isArray(stmt)) return {
						sql: stmt[0],
						args: stmt[1] || []
					};
					return stmt;
				}).map(stmtToHrana);
				const version$1 = await this.#client.getVersion();
				let resultsPromise;
				const stream = this.#client.openStream();
				try {
					new SqlCache(stream, sqlCacheCapacity).apply(hranaStmts);
					resultsPromise = executeHranaBatch(mode, version$1, stream.batch(false), hranaStmts);
				} finally {
					stream.closeGracefully();
				}
				return await resultsPromise;
			} catch (e) {
				throw mapHranaError(e);
			}
		});
	}
	async migrate(stmts) {
		return this.limit(async () => {
			try {
				const hranaStmts = stmts.map(stmtToHrana);
				const version$1 = await this.#client.getVersion();
				let resultsPromise;
				const stream = this.#client.openStream();
				try {
					resultsPromise = executeHranaBatch("deferred", version$1, stream.batch(false), hranaStmts, true);
				} finally {
					stream.closeGracefully();
				}
				return await resultsPromise;
			} catch (e) {
				throw mapHranaError(e);
			}
		});
	}
	async transaction(mode = "write") {
		return this.limit(async () => {
			try {
				const version$1 = await this.#client.getVersion();
				return new HttpTransaction(this.#client.openStream(), mode, version$1);
			} catch (e) {
				throw mapHranaError(e);
			}
		});
	}
	async executeMultiple(sql) {
		return this.limit(async () => {
			try {
				let promise;
				const stream = this.#client.openStream();
				try {
					promise = stream.sequence(sql);
				} finally {
					stream.closeGracefully();
				}
				await promise;
			} catch (e) {
				throw mapHranaError(e);
			}
		});
	}
	sync() {
		throw new LibsqlError("sync not supported in http mode", "SYNC_NOT_SUPPORTED");
	}
	close() {
		this.#client.close();
	}
	async reconnect() {
		try {
			if (!this.closed) this.#client.close();
		} finally {
			this.#client = openHttp(this.#url, this.#authToken, this.#customFetch);
			this.#client.intMode = this.#intMode;
		}
	}
	get closed() {
		return this.#client.closed;
	}
};
var HttpTransaction = class extends HranaTransaction {
	#stream;
	#sqlCache;
	/** @private */
	constructor(stream, mode, version$1) {
		super(mode, version$1);
		this.#stream = stream;
		this.#sqlCache = new SqlCache(stream, sqlCacheCapacity);
	}
	/** @private */
	_getStream() {
		return this.#stream;
	}
	/** @private */
	_getSqlCache() {
		return this.#sqlCache;
	}
	close() {
		this.#stream.close();
	}
	get closed() {
		return this.#stream.closed;
	}
};

//#endregion
//#region node_modules/@libsql/client/lib-esm/web.js
function createClient(config) {
	return _createClient(expandConfig(config, true));
}
/** @private */
function _createClient(config) {
	if (config.scheme === "ws" || config.scheme === "wss") return _createClient$2(config);
	else if (config.scheme === "http" || config.scheme === "https") return _createClient$1(config);
	else throw new LibsqlError(`The client that uses Web standard APIs supports only "libsql:", "wss:", "ws:", "https:" and "http:" URLs, got ${JSON.stringify(config.scheme + ":")}. For more information, please read ${supportedUrlLink}`, "URL_SCHEME_NOT_SUPPORTED");
}

//#endregion
//#region node_modules/@vue/shared/dist/shared.esm-bundler.js
/**
* @vue/shared v3.5.26
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
/* @__NO_SIDE_EFFECTS__ */
function makeMap(str) {
	const map = /* @__PURE__ */ Object.create(null);
	for (const key of str.split(",")) map[key] = 1;
	return (val) => val in map;
}
const EMPTY_OBJ = Object.freeze({});
const EMPTY_ARR = Object.freeze([]);
const NOOP = () => {};
const extend = Object.assign;
const remove = (arr, el) => {
	const i = arr.indexOf(el);
	if (i > -1) arr.splice(i, 1);
};
const hasOwnProperty$1 = Object.prototype.hasOwnProperty;
const hasOwn = (val, key) => hasOwnProperty$1.call(val, key);
const isArray = Array.isArray;
const isMap = (val) => toTypeString(val) === "[object Map]";
const isSet = (val) => toTypeString(val) === "[object Set]";
const isFunction = (val) => typeof val === "function";
const isString = (val) => typeof val === "string";
const isSymbol = (val) => typeof val === "symbol";
const isObject = (val) => val !== null && typeof val === "object";
const objectToString = Object.prototype.toString;
const toTypeString = (value) => objectToString.call(value);
const toRawType = (value) => {
	return toTypeString(value).slice(8, -1);
};
const isPlainObject = (val) => toTypeString(val) === "[object Object]";
const isIntegerKey = (key) => isString(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;
const cacheStringFunction = (fn) => {
	const cache = /* @__PURE__ */ Object.create(null);
	return ((str) => {
		return cache[str] || (cache[str] = fn(str));
	});
};
const camelizeRE = /-\w/g;
const camelize = cacheStringFunction((str) => {
	return str.replace(camelizeRE, (c) => c.slice(1).toUpperCase());
});
const hyphenateRE = /\B([A-Z])/g;
const hyphenate = cacheStringFunction((str) => str.replace(hyphenateRE, "-$1").toLowerCase());
const capitalize = cacheStringFunction((str) => {
	return str.charAt(0).toUpperCase() + str.slice(1);
});
const toHandlerKey = cacheStringFunction((str) => {
	return str ? `on${capitalize(str)}` : ``;
});
const hasChanged = (value, oldValue) => !Object.is(value, oldValue);
const specialBooleanAttrs = `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly`;
const isBooleanAttr = /* @__PURE__ */ makeMap(specialBooleanAttrs + `,async,autofocus,autoplay,controls,default,defer,disabled,hidden,inert,loop,open,required,reversed,scoped,seamless,checked,muted,multiple,selected`);

//#endregion
//#region node_modules/@vue/reactivity/dist/reactivity.esm-bundler.js
/**
* @vue/reactivity v3.5.26
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
function warn(msg, ...args) {
	console.warn(`[Vue warn] ${msg}`, ...args);
}
let activeEffectScope;
function getCurrentScope() {
	return activeEffectScope;
}
let activeSub;
const pausedQueueEffects = /* @__PURE__ */ new WeakSet();
var ReactiveEffect = class {
	constructor(fn) {
		this.fn = fn;
		/**
		* @internal
		*/
		this.deps = void 0;
		/**
		* @internal
		*/
		this.depsTail = void 0;
		/**
		* @internal
		*/
		this.flags = 5;
		/**
		* @internal
		*/
		this.next = void 0;
		/**
		* @internal
		*/
		this.cleanup = void 0;
		this.scheduler = void 0;
		if (activeEffectScope && activeEffectScope.active) activeEffectScope.effects.push(this);
	}
	pause() {
		this.flags |= 64;
	}
	resume() {
		if (this.flags & 64) {
			this.flags &= -65;
			if (pausedQueueEffects.has(this)) {
				pausedQueueEffects.delete(this);
				this.trigger();
			}
		}
	}
	/**
	* @internal
	*/
	notify() {
		if (this.flags & 2 && !(this.flags & 32)) return;
		if (!(this.flags & 8)) batch(this);
	}
	run() {
		if (!(this.flags & 1)) return this.fn();
		this.flags |= 2;
		cleanupEffect(this);
		prepareDeps(this);
		const prevEffect = activeSub;
		const prevShouldTrack = shouldTrack;
		activeSub = this;
		shouldTrack = true;
		try {
			return this.fn();
		} finally {
			if (activeSub !== this) warn("Active effect was not restored correctly - this is likely a Vue internal bug.");
			cleanupDeps(this);
			activeSub = prevEffect;
			shouldTrack = prevShouldTrack;
			this.flags &= -3;
		}
	}
	stop() {
		if (this.flags & 1) {
			for (let link = this.deps; link; link = link.nextDep) removeSub(link);
			this.deps = this.depsTail = void 0;
			cleanupEffect(this);
			this.onStop && this.onStop();
			this.flags &= -2;
		}
	}
	trigger() {
		if (this.flags & 64) pausedQueueEffects.add(this);
		else if (this.scheduler) this.scheduler();
		else this.runIfDirty();
	}
	/**
	* @internal
	*/
	runIfDirty() {
		if (isDirty(this)) this.run();
	}
	get dirty() {
		return isDirty(this);
	}
};
let batchDepth = 0;
let batchedSub;
let batchedComputed;
function batch(sub, isComputed = false) {
	sub.flags |= 8;
	if (isComputed) {
		sub.next = batchedComputed;
		batchedComputed = sub;
		return;
	}
	sub.next = batchedSub;
	batchedSub = sub;
}
function startBatch() {
	batchDepth++;
}
function endBatch() {
	if (--batchDepth > 0) return;
	if (batchedComputed) {
		let e = batchedComputed;
		batchedComputed = void 0;
		while (e) {
			const next = e.next;
			e.next = void 0;
			e.flags &= -9;
			e = next;
		}
	}
	let error;
	while (batchedSub) {
		let e = batchedSub;
		batchedSub = void 0;
		while (e) {
			const next = e.next;
			e.next = void 0;
			e.flags &= -9;
			if (e.flags & 1) try {
				e.trigger();
			} catch (err) {
				if (!error) error = err;
			}
			e = next;
		}
	}
	if (error) throw error;
}
function prepareDeps(sub) {
	for (let link = sub.deps; link; link = link.nextDep) {
		link.version = -1;
		link.prevActiveLink = link.dep.activeLink;
		link.dep.activeLink = link;
	}
}
function cleanupDeps(sub) {
	let head;
	let tail = sub.depsTail;
	let link = tail;
	while (link) {
		const prev = link.prevDep;
		if (link.version === -1) {
			if (link === tail) tail = prev;
			removeSub(link);
			removeDep(link);
		} else head = link;
		link.dep.activeLink = link.prevActiveLink;
		link.prevActiveLink = void 0;
		link = prev;
	}
	sub.deps = head;
	sub.depsTail = tail;
}
function isDirty(sub) {
	for (let link = sub.deps; link; link = link.nextDep) if (link.dep.version !== link.version || link.dep.computed && (refreshComputed(link.dep.computed) || link.dep.version !== link.version)) return true;
	if (sub._dirty) return true;
	return false;
}
function refreshComputed(computed$1) {
	if (computed$1.flags & 4 && !(computed$1.flags & 16)) return;
	computed$1.flags &= -17;
	if (computed$1.globalVersion === globalVersion) return;
	computed$1.globalVersion = globalVersion;
	if (!computed$1.isSSR && computed$1.flags & 128 && (!computed$1.deps && !computed$1._dirty || !isDirty(computed$1))) return;
	computed$1.flags |= 2;
	const dep = computed$1.dep;
	const prevSub = activeSub;
	const prevShouldTrack = shouldTrack;
	activeSub = computed$1;
	shouldTrack = true;
	try {
		prepareDeps(computed$1);
		const value = computed$1.fn(computed$1._value);
		if (dep.version === 0 || hasChanged(value, computed$1._value)) {
			computed$1.flags |= 128;
			computed$1._value = value;
			dep.version++;
		}
	} catch (err) {
		dep.version++;
		throw err;
	} finally {
		activeSub = prevSub;
		shouldTrack = prevShouldTrack;
		cleanupDeps(computed$1);
		computed$1.flags &= -3;
	}
}
function removeSub(link, soft = false) {
	const { dep, prevSub, nextSub } = link;
	if (prevSub) {
		prevSub.nextSub = nextSub;
		link.prevSub = void 0;
	}
	if (nextSub) {
		nextSub.prevSub = prevSub;
		link.nextSub = void 0;
	}
	if (dep.subsHead === link) dep.subsHead = nextSub;
	if (dep.subs === link) {
		dep.subs = prevSub;
		if (!prevSub && dep.computed) {
			dep.computed.flags &= -5;
			for (let l = dep.computed.deps; l; l = l.nextDep) removeSub(l, true);
		}
	}
	if (!soft && !--dep.sc && dep.map) dep.map.delete(dep.key);
}
function removeDep(link) {
	const { prevDep, nextDep } = link;
	if (prevDep) {
		prevDep.nextDep = nextDep;
		link.prevDep = void 0;
	}
	if (nextDep) {
		nextDep.prevDep = prevDep;
		link.nextDep = void 0;
	}
}
function effect(fn, options) {
	if (fn.effect instanceof ReactiveEffect) fn = fn.effect.fn;
	const e = new ReactiveEffect(fn);
	if (options) extend(e, options);
	try {
		e.run();
	} catch (err) {
		e.stop();
		throw err;
	}
	const runner = e.run.bind(e);
	runner.effect = e;
	return runner;
}
function stop(runner) {
	runner.effect.stop();
}
let shouldTrack = true;
const trackStack = [];
function pauseTracking() {
	trackStack.push(shouldTrack);
	shouldTrack = false;
}
function resetTracking() {
	const last = trackStack.pop();
	shouldTrack = last === void 0 ? true : last;
}
function cleanupEffect(e) {
	const { cleanup } = e;
	e.cleanup = void 0;
	if (cleanup) {
		const prevSub = activeSub;
		activeSub = void 0;
		try {
			cleanup();
		} finally {
			activeSub = prevSub;
		}
	}
}
let globalVersion = 0;
var Link = class {
	constructor(sub, dep) {
		this.sub = sub;
		this.dep = dep;
		this.version = dep.version;
		this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
	}
};
var Dep = class {
	constructor(computed$1) {
		this.computed = computed$1;
		this.version = 0;
		/**
		* Link between this dep and the current active effect
		*/
		this.activeLink = void 0;
		/**
		* Doubly linked list representing the subscribing effects (tail)
		*/
		this.subs = void 0;
		/**
		* For object property deps cleanup
		*/
		this.map = void 0;
		this.key = void 0;
		/**
		* Subscriber counter
		*/
		this.sc = 0;
		/**
		* @internal
		*/
		this.__v_skip = true;
		this.subsHead = void 0;
	}
	track(debugInfo) {
		if (!activeSub || !shouldTrack || activeSub === this.computed) return;
		let link = this.activeLink;
		if (link === void 0 || link.sub !== activeSub) {
			link = this.activeLink = new Link(activeSub, this);
			if (!activeSub.deps) activeSub.deps = activeSub.depsTail = link;
			else {
				link.prevDep = activeSub.depsTail;
				activeSub.depsTail.nextDep = link;
				activeSub.depsTail = link;
			}
			addSub(link);
		} else if (link.version === -1) {
			link.version = this.version;
			if (link.nextDep) {
				const next = link.nextDep;
				next.prevDep = link.prevDep;
				if (link.prevDep) link.prevDep.nextDep = next;
				link.prevDep = activeSub.depsTail;
				link.nextDep = void 0;
				activeSub.depsTail.nextDep = link;
				activeSub.depsTail = link;
				if (activeSub.deps === link) activeSub.deps = next;
			}
		}
		if (activeSub.onTrack) activeSub.onTrack(extend({ effect: activeSub }, debugInfo));
		return link;
	}
	trigger(debugInfo) {
		this.version++;
		globalVersion++;
		this.notify(debugInfo);
	}
	notify(debugInfo) {
		startBatch();
		try {
			for (let head = this.subsHead; head; head = head.nextSub) if (head.sub.onTrigger && !(head.sub.flags & 8)) head.sub.onTrigger(extend({ effect: head.sub }, debugInfo));
			for (let link = this.subs; link; link = link.prevSub) if (link.sub.notify()) link.sub.dep.notify();
		} finally {
			endBatch();
		}
	}
};
function addSub(link) {
	link.dep.sc++;
	if (link.sub.flags & 4) {
		const computed$1 = link.dep.computed;
		if (computed$1 && !link.dep.subs) {
			computed$1.flags |= 20;
			for (let l = computed$1.deps; l; l = l.nextDep) addSub(l);
		}
		const currentTail = link.dep.subs;
		if (currentTail !== link) {
			link.prevSub = currentTail;
			if (currentTail) currentTail.nextSub = link;
		}
		if (link.dep.subsHead === void 0) link.dep.subsHead = link;
		link.dep.subs = link;
	}
}
const targetMap = /* @__PURE__ */ new WeakMap();
const ITERATE_KEY = /* @__PURE__ */ Symbol("Object iterate");
const MAP_KEY_ITERATE_KEY = /* @__PURE__ */ Symbol("Map keys iterate");
const ARRAY_ITERATE_KEY = /* @__PURE__ */ Symbol("Array iterate");
function track(target, type, key) {
	if (shouldTrack && activeSub) {
		let depsMap = targetMap.get(target);
		if (!depsMap) targetMap.set(target, depsMap = /* @__PURE__ */ new Map());
		let dep = depsMap.get(key);
		if (!dep) {
			depsMap.set(key, dep = new Dep());
			dep.map = depsMap;
			dep.key = key;
		}
		dep.track({
			target,
			type,
			key
		});
	}
}
function trigger(target, type, key, newValue, oldValue, oldTarget) {
	const depsMap = targetMap.get(target);
	if (!depsMap) {
		globalVersion++;
		return;
	}
	const run = (dep) => {
		if (dep) dep.trigger({
			target,
			type,
			key,
			newValue,
			oldValue,
			oldTarget
		});
	};
	startBatch();
	if (type === "clear") depsMap.forEach(run);
	else {
		const targetIsArray = isArray(target);
		const isArrayIndex = targetIsArray && isIntegerKey(key);
		if (targetIsArray && key === "length") {
			const newLength = Number(newValue);
			depsMap.forEach((dep, key2) => {
				if (key2 === "length" || key2 === ARRAY_ITERATE_KEY || !isSymbol(key2) && key2 >= newLength) run(dep);
			});
		} else {
			if (key !== void 0 || depsMap.has(void 0)) run(depsMap.get(key));
			if (isArrayIndex) run(depsMap.get(ARRAY_ITERATE_KEY));
			switch (type) {
				case "add":
					if (!targetIsArray) {
						run(depsMap.get(ITERATE_KEY));
						if (isMap(target)) run(depsMap.get(MAP_KEY_ITERATE_KEY));
					} else if (isArrayIndex) run(depsMap.get("length"));
					break;
				case "delete":
					if (!targetIsArray) {
						run(depsMap.get(ITERATE_KEY));
						if (isMap(target)) run(depsMap.get(MAP_KEY_ITERATE_KEY));
					}
					break;
				case "set":
					if (isMap(target)) run(depsMap.get(ITERATE_KEY));
					break;
			}
		}
	}
	endBatch();
}
function reactiveReadArray(array$1) {
	const raw = toRaw(array$1);
	if (raw === array$1) return raw;
	track(raw, "iterate", ARRAY_ITERATE_KEY);
	return isShallow(array$1) ? raw : raw.map(toReactive);
}
function shallowReadArray(arr) {
	track(arr = toRaw(arr), "iterate", ARRAY_ITERATE_KEY);
	return arr;
}
function toWrapped(target, item) {
	if (isReadonly(target)) return isReactive(target) ? toReadonly(toReactive(item)) : toReadonly(item);
	return toReactive(item);
}
const arrayInstrumentations = {
	__proto__: null,
	[Symbol.iterator]() {
		return iterator(this, Symbol.iterator, (item) => toWrapped(this, item));
	},
	concat(...args) {
		return reactiveReadArray(this).concat(...args.map((x) => isArray(x) ? reactiveReadArray(x) : x));
	},
	entries() {
		return iterator(this, "entries", (value) => {
			value[1] = toWrapped(this, value[1]);
			return value;
		});
	},
	every(fn, thisArg) {
		return apply(this, "every", fn, thisArg, void 0, arguments);
	},
	filter(fn, thisArg) {
		return apply(this, "filter", fn, thisArg, (v) => v.map((item) => toWrapped(this, item)), arguments);
	},
	find(fn, thisArg) {
		return apply(this, "find", fn, thisArg, (item) => toWrapped(this, item), arguments);
	},
	findIndex(fn, thisArg) {
		return apply(this, "findIndex", fn, thisArg, void 0, arguments);
	},
	findLast(fn, thisArg) {
		return apply(this, "findLast", fn, thisArg, (item) => toWrapped(this, item), arguments);
	},
	findLastIndex(fn, thisArg) {
		return apply(this, "findLastIndex", fn, thisArg, void 0, arguments);
	},
	forEach(fn, thisArg) {
		return apply(this, "forEach", fn, thisArg, void 0, arguments);
	},
	includes(...args) {
		return searchProxy(this, "includes", args);
	},
	indexOf(...args) {
		return searchProxy(this, "indexOf", args);
	},
	join(separator) {
		return reactiveReadArray(this).join(separator);
	},
	lastIndexOf(...args) {
		return searchProxy(this, "lastIndexOf", args);
	},
	map(fn, thisArg) {
		return apply(this, "map", fn, thisArg, void 0, arguments);
	},
	pop() {
		return noTracking(this, "pop");
	},
	push(...args) {
		return noTracking(this, "push", args);
	},
	reduce(fn, ...args) {
		return reduce(this, "reduce", fn, args);
	},
	reduceRight(fn, ...args) {
		return reduce(this, "reduceRight", fn, args);
	},
	shift() {
		return noTracking(this, "shift");
	},
	some(fn, thisArg) {
		return apply(this, "some", fn, thisArg, void 0, arguments);
	},
	splice(...args) {
		return noTracking(this, "splice", args);
	},
	toReversed() {
		return reactiveReadArray(this).toReversed();
	},
	toSorted(comparer) {
		return reactiveReadArray(this).toSorted(comparer);
	},
	toSpliced(...args) {
		return reactiveReadArray(this).toSpliced(...args);
	},
	unshift(...args) {
		return noTracking(this, "unshift", args);
	},
	values() {
		return iterator(this, "values", (item) => toWrapped(this, item));
	}
};
function iterator(self$1, method, wrapValue) {
	const arr = shallowReadArray(self$1);
	const iter = arr[method]();
	if (arr !== self$1 && !isShallow(self$1)) {
		iter._next = iter.next;
		iter.next = () => {
			const result = iter._next();
			if (!result.done) result.value = wrapValue(result.value);
			return result;
		};
	}
	return iter;
}
const arrayProto = Array.prototype;
function apply(self$1, method, fn, thisArg, wrappedRetFn, args) {
	const arr = shallowReadArray(self$1);
	const needsWrap = arr !== self$1 && !isShallow(self$1);
	const methodFn = arr[method];
	if (methodFn !== arrayProto[method]) {
		const result2 = methodFn.apply(self$1, args);
		return needsWrap ? toReactive(result2) : result2;
	}
	let wrappedFn = fn;
	if (arr !== self$1) {
		if (needsWrap) wrappedFn = function(item, index) {
			return fn.call(this, toWrapped(self$1, item), index, self$1);
		};
		else if (fn.length > 2) wrappedFn = function(item, index) {
			return fn.call(this, item, index, self$1);
		};
	}
	const result = methodFn.call(arr, wrappedFn, thisArg);
	return needsWrap && wrappedRetFn ? wrappedRetFn(result) : result;
}
function reduce(self$1, method, fn, args) {
	const arr = shallowReadArray(self$1);
	let wrappedFn = fn;
	if (arr !== self$1) {
		if (!isShallow(self$1)) wrappedFn = function(acc, item, index) {
			return fn.call(this, acc, toWrapped(self$1, item), index, self$1);
		};
		else if (fn.length > 3) wrappedFn = function(acc, item, index) {
			return fn.call(this, acc, item, index, self$1);
		};
	}
	return arr[method](wrappedFn, ...args);
}
function searchProxy(self$1, method, args) {
	const arr = toRaw(self$1);
	track(arr, "iterate", ARRAY_ITERATE_KEY);
	const res = arr[method](...args);
	if ((res === -1 || res === false) && isProxy(args[0])) {
		args[0] = toRaw(args[0]);
		return arr[method](...args);
	}
	return res;
}
function noTracking(self$1, method, args = []) {
	pauseTracking();
	startBatch();
	const res = toRaw(self$1)[method].apply(self$1, args);
	endBatch();
	resetTracking();
	return res;
}
const isNonTrackableKeys = /* @__PURE__ */ makeMap(`__proto__,__v_isRef,__isVue`);
const builtInSymbols = new Set(/* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((key) => key !== "arguments" && key !== "caller").map((key) => Symbol[key]).filter(isSymbol));
function hasOwnProperty(key) {
	if (!isSymbol(key)) key = String(key);
	const obj = toRaw(this);
	track(obj, "has", key);
	return obj.hasOwnProperty(key);
}
var BaseReactiveHandler = class {
	constructor(_isReadonly = false, _isShallow = false) {
		this._isReadonly = _isReadonly;
		this._isShallow = _isShallow;
	}
	get(target, key, receiver) {
		if (key === "__v_skip") return target["__v_skip"];
		const isReadonly2 = this._isReadonly;
		const isShallow2 = this._isShallow;
		if (key === "__v_isReactive") return !isReadonly2;
		else if (key === "__v_isReadonly") return isReadonly2;
		else if (key === "__v_isShallow") return isShallow2;
		else if (key === "__v_raw") {
			if (receiver === (isReadonly2 ? isShallow2 ? shallowReadonlyMap : readonlyMap : isShallow2 ? shallowReactiveMap : reactiveMap).get(target) || Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)) return target;
			return;
		}
		const targetIsArray = isArray(target);
		if (!isReadonly2) {
			let fn;
			if (targetIsArray && (fn = arrayInstrumentations[key])) return fn;
			if (key === "hasOwnProperty") return hasOwnProperty;
		}
		const res = Reflect.get(target, key, isRef(target) ? target : receiver);
		if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) return res;
		if (!isReadonly2) track(target, "get", key);
		if (isShallow2) return res;
		if (isRef(res)) {
			const value = targetIsArray && isIntegerKey(key) ? res : res.value;
			return isReadonly2 && isObject(value) ? readonly(value) : value;
		}
		if (isObject(res)) return isReadonly2 ? readonly(res) : reactive(res);
		return res;
	}
};
var MutableReactiveHandler = class extends BaseReactiveHandler {
	constructor(isShallow2 = false) {
		super(false, isShallow2);
	}
	set(target, key, value, receiver) {
		let oldValue = target[key];
		const isArrayWithIntegerKey = isArray(target) && isIntegerKey(key);
		if (!this._isShallow) {
			const isOldValueReadonly = isReadonly(oldValue);
			if (!isShallow(value) && !isReadonly(value)) {
				oldValue = toRaw(oldValue);
				value = toRaw(value);
			}
			if (!isArrayWithIntegerKey && isRef(oldValue) && !isRef(value)) if (isOldValueReadonly) {
				warn(`Set operation on key "${String(key)}" failed: target is readonly.`, target[key]);
				return true;
			} else {
				oldValue.value = value;
				return true;
			}
		}
		const hadKey = isArrayWithIntegerKey ? Number(key) < target.length : hasOwn(target, key);
		const result = Reflect.set(target, key, value, isRef(target) ? target : receiver);
		if (target === toRaw(receiver)) {
			if (!hadKey) trigger(target, "add", key, value);
			else if (hasChanged(value, oldValue)) trigger(target, "set", key, value, oldValue);
		}
		return result;
	}
	deleteProperty(target, key) {
		const hadKey = hasOwn(target, key);
		const oldValue = target[key];
		const result = Reflect.deleteProperty(target, key);
		if (result && hadKey) trigger(target, "delete", key, void 0, oldValue);
		return result;
	}
	has(target, key) {
		const result = Reflect.has(target, key);
		if (!isSymbol(key) || !builtInSymbols.has(key)) track(target, "has", key);
		return result;
	}
	ownKeys(target) {
		track(target, "iterate", isArray(target) ? "length" : ITERATE_KEY);
		return Reflect.ownKeys(target);
	}
};
var ReadonlyReactiveHandler = class extends BaseReactiveHandler {
	constructor(isShallow2 = false) {
		super(true, isShallow2);
	}
	set(target, key) {
		warn(`Set operation on key "${String(key)}" failed: target is readonly.`, target);
		return true;
	}
	deleteProperty(target, key) {
		warn(`Delete operation on key "${String(key)}" failed: target is readonly.`, target);
		return true;
	}
};
const mutableHandlers = /* @__PURE__ */ new MutableReactiveHandler();
const readonlyHandlers = /* @__PURE__ */ new ReadonlyReactiveHandler();
const shallowReactiveHandlers = /* @__PURE__ */ new MutableReactiveHandler(true);
const toShallow = (value) => value;
const getProto = (v) => Reflect.getPrototypeOf(v);
function createIterableMethod(method, isReadonly2, isShallow2) {
	return function(...args) {
		const target = this["__v_raw"];
		const rawTarget = toRaw(target);
		const targetIsMap = isMap(rawTarget);
		const isPair = method === "entries" || method === Symbol.iterator && targetIsMap;
		const isKeyOnly = method === "keys" && targetIsMap;
		const innerIterator = target[method](...args);
		const wrap = isShallow2 ? toShallow : isReadonly2 ? toReadonly : toReactive;
		!isReadonly2 && track(rawTarget, "iterate", isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY);
		return {
			next() {
				const { value, done } = innerIterator.next();
				return done ? {
					value,
					done
				} : {
					value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
					done
				};
			},
			[Symbol.iterator]() {
				return this;
			}
		};
	};
}
function createReadonlyMethod(type) {
	return function(...args) {
		{
			const key = args[0] ? `on key "${args[0]}" ` : ``;
			warn(`${capitalize(type)} operation ${key}failed: target is readonly.`, toRaw(this));
		}
		return type === "delete" ? false : type === "clear" ? void 0 : this;
	};
}
function createInstrumentations(readonly$1, shallow) {
	const instrumentations = {
		get(key) {
			const target = this["__v_raw"];
			const rawTarget = toRaw(target);
			const rawKey = toRaw(key);
			if (!readonly$1) {
				if (hasChanged(key, rawKey)) track(rawTarget, "get", key);
				track(rawTarget, "get", rawKey);
			}
			const { has } = getProto(rawTarget);
			const wrap = shallow ? toShallow : readonly$1 ? toReadonly : toReactive;
			if (has.call(rawTarget, key)) return wrap(target.get(key));
			else if (has.call(rawTarget, rawKey)) return wrap(target.get(rawKey));
			else if (target !== rawTarget) target.get(key);
		},
		get size() {
			const target = this["__v_raw"];
			!readonly$1 && track(toRaw(target), "iterate", ITERATE_KEY);
			return target.size;
		},
		has(key) {
			const target = this["__v_raw"];
			const rawTarget = toRaw(target);
			const rawKey = toRaw(key);
			if (!readonly$1) {
				if (hasChanged(key, rawKey)) track(rawTarget, "has", key);
				track(rawTarget, "has", rawKey);
			}
			return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey);
		},
		forEach(callback, thisArg) {
			const observed = this;
			const target = observed["__v_raw"];
			const rawTarget = toRaw(target);
			const wrap = shallow ? toShallow : readonly$1 ? toReadonly : toReactive;
			!readonly$1 && track(rawTarget, "iterate", ITERATE_KEY);
			return target.forEach((value, key) => {
				return callback.call(thisArg, wrap(value), wrap(key), observed);
			});
		}
	};
	extend(instrumentations, readonly$1 ? {
		add: createReadonlyMethod("add"),
		set: createReadonlyMethod("set"),
		delete: createReadonlyMethod("delete"),
		clear: createReadonlyMethod("clear")
	} : {
		add(value) {
			if (!shallow && !isShallow(value) && !isReadonly(value)) value = toRaw(value);
			const target = toRaw(this);
			if (!getProto(target).has.call(target, value)) {
				target.add(value);
				trigger(target, "add", value, value);
			}
			return this;
		},
		set(key, value) {
			if (!shallow && !isShallow(value) && !isReadonly(value)) value = toRaw(value);
			const target = toRaw(this);
			const { has, get } = getProto(target);
			let hadKey = has.call(target, key);
			if (!hadKey) {
				key = toRaw(key);
				hadKey = has.call(target, key);
			} else checkIdentityKeys(target, has, key);
			const oldValue = get.call(target, key);
			target.set(key, value);
			if (!hadKey) trigger(target, "add", key, value);
			else if (hasChanged(value, oldValue)) trigger(target, "set", key, value, oldValue);
			return this;
		},
		delete(key) {
			const target = toRaw(this);
			const { has, get } = getProto(target);
			let hadKey = has.call(target, key);
			if (!hadKey) {
				key = toRaw(key);
				hadKey = has.call(target, key);
			} else checkIdentityKeys(target, has, key);
			const oldValue = get ? get.call(target, key) : void 0;
			const result = target.delete(key);
			if (hadKey) trigger(target, "delete", key, void 0, oldValue);
			return result;
		},
		clear() {
			const target = toRaw(this);
			const hadItems = target.size !== 0;
			const oldTarget = isMap(target) ? new Map(target) : new Set(target);
			const result = target.clear();
			if (hadItems) trigger(target, "clear", void 0, void 0, oldTarget);
			return result;
		}
	});
	[
		"keys",
		"values",
		"entries",
		Symbol.iterator
	].forEach((method) => {
		instrumentations[method] = createIterableMethod(method, readonly$1, shallow);
	});
	return instrumentations;
}
function createInstrumentationGetter(isReadonly2, shallow) {
	const instrumentations = createInstrumentations(isReadonly2, shallow);
	return (target, key, receiver) => {
		if (key === "__v_isReactive") return !isReadonly2;
		else if (key === "__v_isReadonly") return isReadonly2;
		else if (key === "__v_raw") return target;
		return Reflect.get(hasOwn(instrumentations, key) && key in target ? instrumentations : target, key, receiver);
	};
}
const mutableCollectionHandlers = { get: /* @__PURE__ */ createInstrumentationGetter(false, false) };
const shallowCollectionHandlers = { get: /* @__PURE__ */ createInstrumentationGetter(false, true) };
const readonlyCollectionHandlers = { get: /* @__PURE__ */ createInstrumentationGetter(true, false) };
function checkIdentityKeys(target, has, key) {
	const rawKey = toRaw(key);
	if (rawKey !== key && has.call(target, rawKey)) {
		const type = toRawType(target);
		warn(`Reactive ${type} contains both the raw and reactive versions of the same object${type === `Map` ? ` as keys` : ``}, which can lead to inconsistencies. Avoid differentiating between the raw and reactive versions of an object and only use the reactive version if possible.`);
	}
}
const reactiveMap = /* @__PURE__ */ new WeakMap();
const shallowReactiveMap = /* @__PURE__ */ new WeakMap();
const readonlyMap = /* @__PURE__ */ new WeakMap();
const shallowReadonlyMap = /* @__PURE__ */ new WeakMap();
function targetTypeMap(rawType) {
	switch (rawType) {
		case "Object":
		case "Array": return 1;
		case "Map":
		case "Set":
		case "WeakMap":
		case "WeakSet": return 2;
		default: return 0;
	}
}
function getTargetType(value) {
	return value["__v_skip"] || !Object.isExtensible(value) ? 0 : targetTypeMap(toRawType(value));
}
function reactive(target) {
	if (isReadonly(target)) return target;
	return createReactiveObject(target, false, mutableHandlers, mutableCollectionHandlers, reactiveMap);
}
function shallowReactive(target) {
	return createReactiveObject(target, false, shallowReactiveHandlers, shallowCollectionHandlers, shallowReactiveMap);
}
function readonly(target) {
	return createReactiveObject(target, true, readonlyHandlers, readonlyCollectionHandlers, readonlyMap);
}
function createReactiveObject(target, isReadonly2, baseHandlers, collectionHandlers, proxyMap) {
	if (!isObject(target)) {
		warn(`value cannot be made ${isReadonly2 ? "readonly" : "reactive"}: ${String(target)}`);
		return target;
	}
	if (target["__v_raw"] && !(isReadonly2 && target["__v_isReactive"])) return target;
	const targetType = getTargetType(target);
	if (targetType === 0) return target;
	const existingProxy = proxyMap.get(target);
	if (existingProxy) return existingProxy;
	const proxy = new Proxy(target, targetType === 2 ? collectionHandlers : baseHandlers);
	proxyMap.set(target, proxy);
	return proxy;
}
function isReactive(value) {
	if (isReadonly(value)) return isReactive(value["__v_raw"]);
	return !!(value && value["__v_isReactive"]);
}
function isReadonly(value) {
	return !!(value && value["__v_isReadonly"]);
}
function isShallow(value) {
	return !!(value && value["__v_isShallow"]);
}
function isProxy(value) {
	return value ? !!value["__v_raw"] : false;
}
function toRaw(observed) {
	const raw = observed && observed["__v_raw"];
	return raw ? toRaw(raw) : observed;
}
const toReactive = (value) => isObject(value) ? reactive(value) : value;
const toReadonly = (value) => isObject(value) ? readonly(value) : value;
function isRef(r) {
	return r ? r["__v_isRef"] === true : false;
}
function ref(value) {
	return createRef(value, false);
}
function shallowRef(value) {
	return createRef(value, true);
}
function createRef(rawValue, shallow) {
	if (isRef(rawValue)) return rawValue;
	return new RefImpl(rawValue, shallow);
}
var RefImpl = class {
	constructor(value, isShallow2) {
		this.dep = new Dep();
		this["__v_isRef"] = true;
		this["__v_isShallow"] = false;
		this._rawValue = isShallow2 ? value : toRaw(value);
		this._value = isShallow2 ? value : toReactive(value);
		this["__v_isShallow"] = isShallow2;
	}
	get value() {
		this.dep.track({
			target: this,
			type: "get",
			key: "value"
		});
		return this._value;
	}
	set value(newValue) {
		const oldValue = this._rawValue;
		const useDirectValue = this["__v_isShallow"] || isShallow(newValue) || isReadonly(newValue);
		newValue = useDirectValue ? newValue : toRaw(newValue);
		if (hasChanged(newValue, oldValue)) {
			this._rawValue = newValue;
			this._value = useDirectValue ? newValue : toReactive(newValue);
			this.dep.trigger({
				target: this,
				type: "set",
				key: "value",
				newValue,
				oldValue
			});
		}
	}
};
var ComputedRefImpl = class {
	constructor(fn, setter, isSSR) {
		this.fn = fn;
		this.setter = setter;
		/**
		* @internal
		*/
		this._value = void 0;
		/**
		* @internal
		*/
		this.dep = new Dep(this);
		/**
		* @internal
		*/
		this.__v_isRef = true;
		/**
		* @internal
		*/
		this.deps = void 0;
		/**
		* @internal
		*/
		this.depsTail = void 0;
		/**
		* @internal
		*/
		this.flags = 16;
		/**
		* @internal
		*/
		this.globalVersion = globalVersion - 1;
		/**
		* @internal
		*/
		this.next = void 0;
		this.effect = this;
		this["__v_isReadonly"] = !setter;
		this.isSSR = isSSR;
	}
	/**
	* @internal
	*/
	notify() {
		this.flags |= 16;
		if (!(this.flags & 8) && activeSub !== this) {
			batch(this, true);
			return true;
		}
	}
	get value() {
		const link = this.dep.track({
			target: this,
			type: "get",
			key: "value"
		});
		refreshComputed(this);
		if (link) link.version = this.dep.version;
		return this._value;
	}
	set value(newValue) {
		if (this.setter) this.setter(newValue);
		else warn("Write operation failed: computed value is readonly");
	}
};
function computed(getterOrOptions, debugOptions, isSSR = false) {
	let getter;
	let setter;
	if (isFunction(getterOrOptions)) getter = getterOrOptions;
	else {
		getter = getterOrOptions.get;
		setter = getterOrOptions.set;
	}
	const cRef = new ComputedRefImpl(getter, setter, isSSR);
	if (debugOptions && !isSSR) {
		cRef.onTrack = debugOptions.onTrack;
		cRef.onTrigger = debugOptions.onTrigger;
	}
	return cRef;
}
const INITIAL_WATCHER_VALUE = {};
const cleanupMap = /* @__PURE__ */ new WeakMap();
let activeWatcher = void 0;
function onWatcherCleanup(cleanupFn, failSilently = false, owner = activeWatcher) {
	if (owner) {
		let cleanups = cleanupMap.get(owner);
		if (!cleanups) cleanupMap.set(owner, cleanups = []);
		cleanups.push(cleanupFn);
	} else if (!failSilently) warn(`onWatcherCleanup() was called when there was no active watcher to associate with.`);
}
function watch(source, cb, options = EMPTY_OBJ) {
	const { immediate, deep, once, scheduler, augmentJob, call } = options;
	const warnInvalidSource = (s) => {
		(options.onWarn || warn)(`Invalid watch source: `, s, `A watch source can only be a getter/effect function, a ref, a reactive object, or an array of these types.`);
	};
	const reactiveGetter = (source2) => {
		if (deep) return source2;
		if (isShallow(source2) || deep === false || deep === 0) return traverse(source2, 1);
		return traverse(source2);
	};
	let effect$1;
	let getter;
	let cleanup;
	let boundCleanup;
	let forceTrigger = false;
	let isMultiSource = false;
	if (isRef(source)) {
		getter = () => source.value;
		forceTrigger = isShallow(source);
	} else if (isReactive(source)) {
		getter = () => reactiveGetter(source);
		forceTrigger = true;
	} else if (isArray(source)) {
		isMultiSource = true;
		forceTrigger = source.some((s) => isReactive(s) || isShallow(s));
		getter = () => source.map((s) => {
			if (isRef(s)) return s.value;
			else if (isReactive(s)) return reactiveGetter(s);
			else if (isFunction(s)) return call ? call(s, 2) : s();
			else warnInvalidSource(s);
		});
	} else if (isFunction(source)) if (cb) getter = call ? () => call(source, 2) : source;
	else getter = () => {
		if (cleanup) {
			pauseTracking();
			try {
				cleanup();
			} finally {
				resetTracking();
			}
		}
		const currentEffect = activeWatcher;
		activeWatcher = effect$1;
		try {
			return call ? call(source, 3, [boundCleanup]) : source(boundCleanup);
		} finally {
			activeWatcher = currentEffect;
		}
	};
	else {
		getter = NOOP;
		warnInvalidSource(source);
	}
	if (cb && deep) {
		const baseGetter = getter;
		const depth = deep === true ? Infinity : deep;
		getter = () => traverse(baseGetter(), depth);
	}
	const scope = getCurrentScope();
	const watchHandle = () => {
		effect$1.stop();
		if (scope && scope.active) remove(scope.effects, effect$1);
	};
	if (once && cb) {
		const _cb = cb;
		cb = (...args) => {
			_cb(...args);
			watchHandle();
		};
	}
	let oldValue = isMultiSource ? new Array(source.length).fill(INITIAL_WATCHER_VALUE) : INITIAL_WATCHER_VALUE;
	const job = (immediateFirstRun) => {
		if (!(effect$1.flags & 1) || !effect$1.dirty && !immediateFirstRun) return;
		if (cb) {
			const newValue = effect$1.run();
			if (deep || forceTrigger || (isMultiSource ? newValue.some((v, i) => hasChanged(v, oldValue[i])) : hasChanged(newValue, oldValue))) {
				if (cleanup) cleanup();
				const currentWatcher = activeWatcher;
				activeWatcher = effect$1;
				try {
					const args = [
						newValue,
						oldValue === INITIAL_WATCHER_VALUE ? void 0 : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE ? [] : oldValue,
						boundCleanup
					];
					oldValue = newValue;
					call ? call(cb, 3, args) : cb(...args);
				} finally {
					activeWatcher = currentWatcher;
				}
			}
		} else effect$1.run();
	};
	if (augmentJob) augmentJob(job);
	effect$1 = new ReactiveEffect(getter);
	effect$1.scheduler = scheduler ? () => scheduler(job, false) : job;
	boundCleanup = (fn) => onWatcherCleanup(fn, false, effect$1);
	cleanup = effect$1.onStop = () => {
		const cleanups = cleanupMap.get(effect$1);
		if (cleanups) {
			if (call) call(cleanups, 4);
			else for (const cleanup2 of cleanups) cleanup2();
			cleanupMap.delete(effect$1);
		}
	};
	effect$1.onTrack = options.onTrack;
	effect$1.onTrigger = options.onTrigger;
	if (cb) if (immediate) job(true);
	else oldValue = effect$1.run();
	else if (scheduler) scheduler(job.bind(null, true), true);
	else effect$1.run();
	watchHandle.pause = effect$1.pause.bind(effect$1);
	watchHandle.resume = effect$1.resume.bind(effect$1);
	watchHandle.stop = watchHandle;
	return watchHandle;
}
function traverse(value, depth = Infinity, seen) {
	if (depth <= 0 || !isObject(value) || value["__v_skip"]) return value;
	seen = seen || /* @__PURE__ */ new Map();
	if ((seen.get(value) || 0) >= depth) return value;
	seen.set(value, depth);
	depth--;
	if (isRef(value)) traverse(value.value, depth, seen);
	else if (isArray(value)) for (let i = 0; i < value.length; i++) traverse(value[i], depth, seen);
	else if (isSet(value) || isMap(value)) value.forEach((v) => {
		traverse(v, depth, seen);
	});
	else if (isPlainObject(value)) {
		for (const key in value) traverse(value[key], depth, seen);
		for (const key of Object.getOwnPropertySymbols(value)) if (Object.prototype.propertyIsEnumerable.call(value, key)) traverse(value[key], depth, seen);
	}
	return value;
}

//#endregion
export { computed, createClient, effect, isShallow, reactive, readonly, ref, shallowReactive, shallowRef, stop, watch };
//# sourceMappingURL=bundle01.js.map