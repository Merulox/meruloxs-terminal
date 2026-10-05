type JsonObject = Record<string, unknown>;

type NavigatorExtras = Navigator & {
	buildID?: string;
	deviceMemory?: number;
	globalPrivacyControl?: boolean;
	gpu?: unknown;
	javaEnabled?: () => boolean;
	oscpu?: string;
	pdfViewerEnabled?: boolean;
	userAgentData?: {
		brands?: { brand: string; version: string }[];
		mobile?: boolean;
		platform?: string;
		getHighEntropyValues?: (hints: string[]) => Promise<JsonObject>;
	};
	vendorSub?: string;
	connection?: JsonObject;
	mozConnection?: JsonObject;
	webkitConnection?: JsonObject;
	getBattery?: () => Promise<JsonObject>;
};

type WindowExtras = Window & typeof globalThis & {
	OfflineAudioContext?: typeof OfflineAudioContext;
	webkitOfflineAudioContext?: typeof OfflineAudioContext;
};

const nav = navigator as NavigatorExtras;
const win = window as WindowExtras;

async function capture(name: string, errors: Record<string, string>, collect: () => unknown | Promise<unknown>) {
	let timer = 0;
	try {
		const timeout = new Promise<never>((_, reject) => {
			timer = window.setTimeout(() => reject(new Error("collector timed out after 2500ms")), 2_500);
		});
		return await Promise.race([Promise.resolve().then(collect), timeout]);
	} catch (error) {
		errors[name] = error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160);
		return null;
	} finally {
		clearTimeout(timer);
	}
}

function storageAvailable(name: "localStorage" | "sessionStorage") {
	const key = "__mx_fp_test__";
	try {
		const storage = window[name];
		storage.setItem(key, key);
		storage.removeItem(key);
		return true;
	} catch {
		return false;
	}
}

function plugins() {
	return Array.from(nav.plugins ?? [], (plugin) => ({
		name: plugin.name,
		filename: plugin.filename,
		description: plugin.description,
		mimeTypes: Array.from(plugin, (mime) => mime.type),
	}));
}

function mimeTypes() {
	return Array.from(nav.mimeTypes ?? [], (mime) => ({
		type: mime.type,
		suffixes: mime.suffixes,
		description: mime.description,
	}));
}

async function userAgentData() {
	const data = nav.userAgentData;
	if (!data) return null;
	const base: JsonObject = { brands: data.brands ?? [], mobile: data.mobile ?? null, platform: data.platform ?? null };
	if (!data.getHighEntropyValues) return base;
	return {
		...base,
		...(await data.getHighEntropyValues([
			"architecture",
			"bitness",
			"formFactors",
			"fullVersionList",
			"model",
			"platformVersion",
			"uaFullVersion",
			"wow64",
		])),
	};
}

function browserInfo() {
	return {
		userAgent: nav.userAgent,
		appCodeName: nav.appCodeName,
		appName: nav.appName,
		appVersion: nav.appVersion,
		buildID: nav.buildID ?? null,
		product: nav.product,
		productSub: nav.productSub,
		vendor: nav.vendor,
		vendorSub: nav.vendorSub ?? null,
		platform: nav.platform,
		oscpu: nav.oscpu ?? null,
		language: nav.language,
		languages: Array.from(nav.languages ?? []),
		cookieEnabled: nav.cookieEnabled,
		doNotTrack: nav.doNotTrack,
		globalPrivacyControl: nav.globalPrivacyControl ?? null,
		webdriver: nav.webdriver,
		pdfViewerEnabled: nav.pdfViewerEnabled ?? null,
		javaEnabled: nav.javaEnabled?.() ?? null,
		hardwareConcurrency: nav.hardwareConcurrency ?? null,
		deviceMemory: nav.deviceMemory ?? null,
		maxTouchPoints: nav.maxTouchPoints ?? null,
		plugins: plugins(),
		mimeTypes: mimeTypes(),
	};
}

function screenInfo() {
	return {
		screen: {
			width: screen.width,
			height: screen.height,
			availWidth: screen.availWidth,
			availHeight: screen.availHeight,
			availLeft: screen.availLeft,
			availTop: screen.availTop,
			colorDepth: screen.colorDepth,
			pixelDepth: screen.pixelDepth,
			orientation: screen.orientation
				? { type: screen.orientation.type, angle: screen.orientation.angle }
				: null,
		},
		viewport: {
			innerWidth,
			innerHeight,
			outerWidth,
			outerHeight,
			devicePixelRatio,
			visualViewport: window.visualViewport
				? {
					width: window.visualViewport.width,
					height: window.visualViewport.height,
					scale: window.visualViewport.scale,
					offsetLeft: window.visualViewport.offsetLeft,
					offsetTop: window.visualViewport.offsetTop,
				}
				: null,
		},
		bars: {
			location: window.locationbar?.visible ?? null,
			menu: window.menubar?.visible ?? null,
			personal: window.personalbar?.visible ?? null,
			status: window.statusbar?.visible ?? null,
			toolbar: window.toolbar?.visible ?? null,
		},
	};
}

function localeInfo() {
	const date = new Intl.DateTimeFormat().resolvedOptions();
	const number = new Intl.NumberFormat().resolvedOptions();
	return {
		timeZone: date.timeZone,
		timeZoneOffsetMinutes: new Date().getTimezoneOffset(),
		locale: date.locale,
		calendar: date.calendar,
		numberingSystem: date.numberingSystem,
		hourCycle: date.hourCycle ?? null,
		numberLocale: number.locale,
		numbering: number.numberingSystem,
	};
}

function mediaQueries() {
	const queries = [
		"(prefers-color-scheme: dark)",
		"(prefers-color-scheme: light)",
		"(prefers-reduced-motion: reduce)",
		"(prefers-contrast: more)",
		"(forced-colors: active)",
		"(inverted-colors: inverted)",
		"(hover: hover)",
		"(any-hover: hover)",
		"(pointer: coarse)",
		"(pointer: fine)",
		"(any-pointer: coarse)",
		"(any-pointer: fine)",
		"(color-gamut: srgb)",
		"(color-gamut: p3)",
		"(color-gamut: rec2020)",
	];
	return Object.fromEntries(queries.map((query) => [query, matchMedia(query).matches]));
}

function adBlockLikely() {
	const bait = document.createElement("div");
	bait.className = "adsbox ad-banner ad-unit advertisement";
	bait.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px";
	document.body.append(bait);
	const blocked = bait.offsetHeight === 0 || getComputedStyle(bait).display === "none";
	bait.remove();
	return blocked;
}

function featureInfo() {
	return {
		localStorage: storageAvailable("localStorage"),
		sessionStorage: storageAvailable("sessionStorage"),
		indexedDB: typeof indexedDB !== "undefined",
		webAssembly: typeof WebAssembly !== "undefined",
		serviceWorker: "serviceWorker" in nav,
		webRTC: typeof RTCPeerConnection !== "undefined",
		webGL: typeof WebGLRenderingContext !== "undefined",
		webGL2: typeof WebGL2RenderingContext !== "undefined",
		webGPU: Boolean(nav.gpu),
		bluetooth: "bluetooth" in nav,
		usb: "usb" in nav,
		serial: "serial" in nav,
		hid: "hid" in nav,
		mediaDevices: Boolean(nav.mediaDevices),
		sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
		touchEvent: "ontouchstart" in window,
		adBlockLikely: adBlockLikely(),
		mediaQueries: mediaQueries(),
	};
}

function webglInfo() {
	const canvas = document.createElement("canvas");
	const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
	if (!gl) return null;
	const debug = gl.getExtension("WEBGL_debug_renderer_info");
	const parameter = (value: number) => {
		const result = gl.getParameter(value);
		return ArrayBuffer.isView(result) ? Array.from(result as unknown as ArrayLike<number>) : result;
	};
	return {
		version: parameter(gl.VERSION),
		shadingLanguageVersion: parameter(gl.SHADING_LANGUAGE_VERSION),
		vendor: debug ? parameter(debug.UNMASKED_VENDOR_WEBGL) : parameter(gl.VENDOR),
		renderer: debug ? parameter(debug.UNMASKED_RENDERER_WEBGL) : parameter(gl.RENDERER),
		aliasedLineWidthRange: parameter(gl.ALIASED_LINE_WIDTH_RANGE),
		aliasedPointSizeRange: parameter(gl.ALIASED_POINT_SIZE_RANGE),
		maxCombinedTextureImageUnits: parameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
		maxCubeMapTextureSize: parameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
		maxFragmentUniformVectors: parameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
		maxRenderbufferSize: parameter(gl.MAX_RENDERBUFFER_SIZE),
		maxTextureImageUnits: parameter(gl.MAX_TEXTURE_IMAGE_UNITS),
		maxTextureSize: parameter(gl.MAX_TEXTURE_SIZE),
		maxVaryingVectors: parameter(gl.MAX_VARYING_VECTORS),
		maxVertexAttribs: parameter(gl.MAX_VERTEX_ATTRIBS),
		maxVertexTextureImageUnits: parameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
		maxVertexUniformVectors: parameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
		maxViewportDims: parameter(gl.MAX_VIEWPORT_DIMS),
		redBits: parameter(gl.RED_BITS),
		greenBits: parameter(gl.GREEN_BITS),
		blueBits: parameter(gl.BLUE_BITS),
		alphaBits: parameter(gl.ALPHA_BITS),
		depthBits: parameter(gl.DEPTH_BITS),
		stencilBits: parameter(gl.STENCIL_BITS),
		extensions: gl.getSupportedExtensions() ?? [],
	};
}

async function sha256(value: string) {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function canvasInfo() {
	const canvas = document.createElement("canvas");
	canvas.width = 320;
	canvas.height = 80;
	const context = canvas.getContext("2d");
	if (!context) return null;
	context.textBaseline = "alphabetic";
	context.fillStyle = "#f60";
	context.fillRect(12, 10, 180, 36);
	context.fillStyle = "#069";
	context.font = "18px Arial";
	context.fillText("MERULOX 🜁 browser fingerprint", 4, 32);
	context.globalCompositeOperation = "multiply";
	context.fillStyle = "rgba(102, 204, 0, 0.65)";
	context.beginPath();
	context.arc(210, 34, 24, 0, Math.PI * 2);
	context.fill();
	context.fillStyle = "rgba(255, 0, 102, 0.65)";
	context.beginPath();
	context.arc(238, 34, 24, 0, Math.PI * 2);
	context.fill();
	const data = canvas.toDataURL();
	return { hash: await sha256(data), length: data.length, winding: context.isPointInPath(5, 5, "evenodd") };
}

async function audioInfo() {
	const Audio = win.OfflineAudioContext ?? win.webkitOfflineAudioContext;
	if (!Audio) return null;
	const context = new Audio(1, 44_100, 44_100);
	const oscillator = context.createOscillator();
	const compressor = context.createDynamicsCompressor();
	oscillator.type = "triangle";
	oscillator.frequency.value = 10_000;
	compressor.threshold.value = -50;
	compressor.knee.value = 40;
	compressor.ratio.value = 12;
	compressor.attack.value = 0;
	compressor.release.value = 0.25;
	oscillator.connect(compressor);
	compressor.connect(context.destination);
	oscillator.start(0);
	const rendered = await context.startRendering();
	const samples = rendered.getChannelData(0).slice(4_500, 5_500);
	let sum = 0;
	for (const sample of samples) sum += Math.abs(sample);
	return {
		hash: await sha256(Array.from(samples, (sample) => sample.toFixed(8)).join(",")),
		sampleRate: rendered.sampleRate,
		length: rendered.length,
		sum: Number(sum.toFixed(8)),
	};
}

function fontInfo() {
	const candidates = [
		"Arial", "Arial Black", "Calibri", "Cambria", "Comic Sans MS", "Consolas", "Courier New",
		"DejaVu Sans", "Georgia", "Helvetica", "Impact", "Liberation Sans", "Lucida Console", "Menlo",
		"Monaco", "Noto Sans", "Roboto", "Segoe UI", "SFMono-Regular", "Tahoma", "Times New Roman",
		"Trebuchet MS", "Ubuntu", "Verdana",
	];
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");
	if (!context) return [];
	const sample = "mmmmmmmmmmlliWWMM0123456789";
	const fallbacks = ["monospace", "sans-serif", "serif"];
	const baselines = Object.fromEntries(fallbacks.map((fallback) => {
		context.font = `72px ${fallback}`;
		return [fallback, context.measureText(sample).width];
	}));
	return candidates.filter((font) => fallbacks.some((fallback) => {
		context.font = `72px "${font}", ${fallback}`;
		return Math.abs(context.measureText(sample).width - baselines[fallback]) > 0.01;
	}));
}

function formatSupport() {
	const audio = document.createElement("audio");
	const video = document.createElement("video");
	const audioFormats = [
		"audio/aac", "audio/flac", "audio/mpeg", "audio/ogg; codecs=flac", "audio/ogg; codecs=vorbis",
		"audio/ogg; codecs=opus", "audio/wav; codecs=1", "audio/webm; codecs=vorbis", "audio/webm; codecs=opus",
		"audio/mp4; codecs=mp4a.40.2",
	];
	const videoFormats = [
		"video/mp4; codecs=avc1.42E01E", "video/mp4; codecs=hev1", "video/ogg; codecs=theora",
		"video/webm; codecs=vp8,vorbis", "video/webm; codecs=vp9,opus", "video/webm; codecs=av01.0.05M.08",
	];
	return {
		audio: Object.fromEntries(audioFormats.map((format) => [format, audio.canPlayType(format) || "no"])),
		video: Object.fromEntries(videoFormats.map((format) => [format, video.canPlayType(format) || "no"])),
	};
}

async function mediaInfo() {
	let devices: JsonObject | null = null;
	if (nav.mediaDevices?.enumerateDevices) {
		const rows = await nav.mediaDevices.enumerateDevices();
		devices = {
			audioinput: rows.filter((item) => item.kind === "audioinput").length,
			audiooutput: rows.filter((item) => item.kind === "audiooutput").length,
			videoinput: rows.filter((item) => item.kind === "videoinput").length,
		};
	}
	return { formats: formatSupport(), devices };
}

async function permissionInfo() {
	if (!nav.permissions?.query) return null;
	const names = [
		"accelerometer", "background-sync", "camera", "clipboard-read", "clipboard-write", "geolocation",
		"gyroscope", "magnetometer", "microphone", "midi", "notifications", "payment-handler", "persistent-storage",
	];
	const entries = await Promise.all(names.map(async (name) => {
		try {
			const status = await nav.permissions.query({ name } as PermissionDescriptor);
			return [name, status.state];
		} catch {
			return [name, "unsupported"];
		}
	}));
	return Object.fromEntries(entries);
}

async function storageInfo() {
	const estimate = await nav.storage?.estimate?.();
	const persisted = await nav.storage?.persisted?.();
	return {
		quota: estimate?.quota ?? null,
		usage: estimate?.usage ?? null,
		persisted: persisted ?? null,
	};
}

async function batteryInfo() {
	if (!nav.getBattery) return null;
	const battery = await nav.getBattery();
	return {
		charging: battery.charging ?? null,
		chargingTime: battery.chargingTime ?? null,
		dischargingTime: battery.dischargingTime ?? null,
		level: battery.level ?? null,
	};
}

function connectionInfo() {
	const connection = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
	if (!connection) return null;
	return {
		effectiveType: connection.effectiveType ?? null,
		type: connection.type ?? null,
		downlink: connection.downlink ?? null,
		rtt: connection.rtt ?? null,
		saveData: connection.saveData ?? null,
	};
}

async function voiceInfo() {
	if (!("speechSynthesis" in window)) return null;
	let voices = speechSynthesis.getVoices();
	if (!voices.length) {
		await new Promise<void>((resolve) => {
			const timer = window.setTimeout(resolve, 250);
			speechSynthesis.addEventListener("voiceschanged", () => {
				clearTimeout(timer);
				resolve();
			}, { once: true });
		});
		voices = speechSynthesis.getVoices();
	}
	return voices.map((voice) => ({ name: voice.name, lang: voice.lang, local: voice.localService, default: voice.default }));
}

function mathInfo() {
	return {
		acos: Math.acos(0.123).toPrecision(17),
		acosh: Math.acosh(1e8).toPrecision(17),
		asinh: Math.asinh(1).toPrecision(17),
		atanh: Math.atanh(0.5).toPrecision(17),
		cbrt: Math.cbrt(100).toPrecision(17),
		cos: Math.cos(1e8).toPrecision(17),
		expm1: Math.expm1(1).toPrecision(17),
		log1p: Math.log1p(10).toPrecision(17),
		sin: Math.sin(1e8).toPrecision(17),
		sinh: Math.sinh(1).toPrecision(17),
		tan: Math.tan(-1e300).toPrecision(17),
		tanh: Math.tanh(1).toPrecision(17),
	};
}

function canonical(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	return `{${Object.entries(value as JsonObject)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
		.join(",")}}`;
}

export async function collectBrowserFingerprint() {
	const errors: Record<string, string> = {};
	const [uaData, webgl, canvas, audio, media, permissions, storage, battery, voices] = await Promise.all([
		capture("userAgentData", errors, userAgentData),
		capture("webgl", errors, webglInfo),
		capture("canvas", errors, canvasInfo),
		capture("audio", errors, audioInfo),
		capture("media", errors, mediaInfo),
		capture("permissions", errors, permissionInfo),
		capture("storage", errors, storageInfo),
		capture("battery", errors, batteryInfo),
		capture("voices", errors, voiceInfo),
	]);
	const attributes = {
		version: 1,
		browser: { ...browserInfo(), userAgentData: uaData },
		screen: screenInfo(),
		locale: localeInfo(),
		features: featureInfo(),
		webgl,
		canvas,
		audio,
		fonts: fontInfo(),
		media,
		permissions,
		storage,
		battery,
		connection: connectionInfo(),
		voices,
		math: mathInfo(),
		errors,
	};
	const stable = {
		browser: attributes.browser,
		screen: attributes.screen.screen,
		locale: attributes.locale,
		features: attributes.features,
		webgl: attributes.webgl,
		canvas: attributes.canvas,
		audio: attributes.audio,
		fonts: attributes.fonts,
		media: attributes.media?.formats ?? null,
		voices: attributes.voices,
		math: attributes.math,
	};
	return { attributes, hash: await sha256(canonical(stable)) };
}
