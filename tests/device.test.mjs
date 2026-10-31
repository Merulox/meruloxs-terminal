import { test } from "node:test";
import assert from "node:assert/strict";
import { gpuName, inferDevice } from "../src/lib/device.js";

const fp = ({ ua, platform, uaData = null, w, h, dpr = 1, renderer = null, touch = 0, tz = "America/Toronto", webdriver = false, battery = null, avail = null, pointerCoarse = false }) => ({
	browser: { userAgent: ua, platform, userAgentData: uaData, maxTouchPoints: touch, hardwareConcurrency: 8, deviceMemory: null, language: "en-CA", webdriver },
	screen: { screen: { width: w, height: h, availWidth: avail?.[0] ?? w, availHeight: avail?.[1] ?? h - 40 }, viewport: { devicePixelRatio: dpr } },
	locale: { timeZone: tz },
	features: { mediaQueries: { "(pointer: coarse)": pointerCoarse, "(pointer: fine)": !pointerCoarse } },
	webgl: { renderer },
	battery,
});

const IOS_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.3 Mobile/15E148 Safari/604.1";

test("iPhone: candidate model family from CSS size + DPR, frozen OS token kept as reported", () => {
	const d = inferDevice(fp({ ua: IOS_SAFARI, platform: "iPhone", w: 390, h: 844, dpr: 3, renderer: "Apple GPU", touch: 5, avail: [390, 844], pointerCoarse: true }));
	assert.equal(d.kind, "phone");
	assert.equal(d.title, "iPhone");
	assert.match(d.candidates, /iPhone 12 .* 13 .* 14/);
	assert.equal(d.os, "iOS 18.7 (frozen UA token)");
	assert.equal(d.browser, "Safari 26.6.3");
	assert.equal(d.physical, "1170×2532 px");
	assert.deepEqual(d.flags, []);
	assert.equal(d.confidence, "medium", "a shared multi-model screen family is never high confidence");
});

test("in-app iPhone UA keeps the real OS version and names the app", () => {
	const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23G90 Twitter for iPhone/12.30";
	const d = inferDevice(fp({ ua, platform: "iPhone", w: 402, h: 874, dpr: 3, renderer: "Apple GPU", touch: 5, avail: [402, 874] }));
	assert.equal(d.os, "iOS 26.6.2");
	assert.match(d.browser, /^X \(Twitter\) app 12\.30/);
	assert.match(d.candidates, /16 Pro/);
});

test("Android Firefox: model hidden, SoC inferred from Adreno GPU", () => {
	const d = inferDevice(fp({ ua: "Mozilla/5.0 (Android 16; Mobile; rv:158.0) Gecko/158.0 Firefox/158.0", platform: "Linux armv81", w: 456, h: 978, dpr: 3.1578947368421053, renderer: "Adreno (TM) 650, or similar", touch: 5, avail: [456, 978] }));
	assert.equal(d.kind, "phone");
	assert.equal(d.title, "Android phone");
	assert.match(d.chip, /Snapdragon 865\/870/);
	assert.deepEqual(d.flags, []);
});

test("Android with model in UA resolves vendor", () => {
	const d = inferDevice(fp({ ua: "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", platform: "Linux aarch64", w: 360, h: 780, dpr: 3, renderer: "ANGLE (Samsung Xclipse 940) on Vulkan 1.3.0", touch: 5, avail: [360, 780] }));
	assert.equal(d.title, "Samsung SM-S921B");
	assert.match(d.chip, /Exynos/);
});

test("Windows: client hints upgrade to Windows 11 and GPU name is unwrapped", () => {
	const d = inferDevice(fp({
		ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
		platform: "Win32",
		uaData: { brands: [{ brand: "Google Chrome", version: "155" }], mobile: false, platform: "Windows", platformVersion: "19.0.0", architecture: "x86", bitness: "64", fullVersionList: [{ brand: "Google Chrome", version: "155.0.8059.85" }] },
		w: 1920, h: 1080, renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 (0x00002D05) Direct3D11 vs_5_0 ps_5_0, D3D11)",
		battery: { charging: true, level: 1 },
	}));
	assert.equal(d.kind, "desktop");
	assert.equal(d.title, "Windows PC");
	assert.equal(d.os, "Windows 11 · x86-64");
	assert.equal(d.gpu, "NVIDIA GeForce RTX 5060");
	assert.equal(d.power, null, "desktop always-charging battery stub is not shown");
});

test("Windows at 125% scaling is a likely laptop; discharging battery confirms", () => {
	const scaled = inferDevice(fp({ ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:157.0) Gecko/20100101 Firefox/157.0", platform: "Win32", w: 1536, h: 864, dpr: 1.25, renderer: "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)" }));
	assert.equal(scaled.kind, "laptop");
	assert.equal(scaled.physical, "1920×1080 px");
	const battery = inferDevice(fp({ ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/150.0.0.0 Safari/537.36", platform: "Win32", w: 1920, h: 1080, renderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)", battery: { charging: false, level: 0.62 } }));
	assert.equal(battery.kind, "laptop");
	assert.equal(battery.power, "62% on battery");
});

test("Mac: Apple chip from Metal renderer, MacBook family from display size", () => {
	const d = inferDevice(fp({
		ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
		platform: "MacIntel",
		uaData: { brands: [{ brand: "Google Chrome", version: "156" }], mobile: false, platform: "macOS", platformVersion: "26.6.2", architecture: "arm", bitness: "64" },
		w: 1710, h: 1112, dpr: 2, renderer: "ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)",
	}));
	assert.equal(d.kind, "laptop");
	assert.equal(d.title, "MacBook");
	assert.equal(d.candidates, "MacBook Air 15\"");
	assert.equal(d.chip, "Apple M4");
	assert.equal(d.os, "macOS 26.6.2 · ARM-64");
});

test("iPad in desktop mode is detected from Mac UA + touch points", () => {
	const d = inferDevice(fp({ ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15", platform: "MacIntel", w: 820, h: 1180, dpr: 2, renderer: "Apple GPU", touch: 5 }));
	assert.equal(d.kind, "tablet");
	assert.equal(d.title, "iPad");
	assert.match(d.candidates, /iPad Air/);
	assert.deepEqual(d.flags, []);
});

test("headless Chrome with SwiftShader is classified as an automated client", () => {
	const d = inferDevice(fp({
		ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36",
		platform: "Win32",
		uaData: { brands: [{ brand: "Chromium", version: "148" }], mobile: false, platform: "Linux" },
		w: 800, h: 600, tz: "UTC",
		renderer: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
	}));
	assert.equal(d.kind, "bot");
	assert.equal(d.claimedKind, "desktop");
	assert.match(d.title, /^Automated client \(claims Linux PC\)/);
	assert.ok(d.flags.includes("headless Chrome"));
	assert.ok(d.flags.some((f) => f.startsWith("UA says Linux, navigator.platform says Win32")));
	assert.equal(d.confidence, "low");
});

test("software GPU alone (VM / acceleration off) is flagged but not called automated", () => {
	const d = inferDevice(fp({
		ua: "Mozilla/5.0 (Linux; Android 10; HD1900 Build/QKQ1.190716.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/75.0.3770.156 Mobile Safari/537.36",
		platform: "Android",
		w: 393, h: 851, dpr: 2.75, touch: 5, avail: [393, 851],
		renderer: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
	}));
	assert.notEqual(d.kind, "bot");
	assert.equal(d.kind, "phone");
	assert.ok(d.flags.includes("software GPU (headless / VM)"));
	assert.doesNotMatch(d.title, /Automated/);
	const win = inferDevice(fp({ ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36", platform: "Win32", w: 1920, h: 1080, renderer: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)" }));
	assert.equal(win.kind, "desktop");
});

test("stacked environment signals without a headless UA still mark automation", () => {
	const d = inferDevice(fp({
		ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
		platform: "Linux x86_64",
		w: 800, h: 600, tz: "UTC",
		renderer: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
	}));
	assert.equal(d.kind, "bot");
});

test("2560×1440 at 100% with a desktop GPU stays a desktop PC", () => {
	const d = inferDevice(fp({ ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 OPR/137.0.0.0", platform: "Win32", w: 2560, h: 1440, renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 (0x00002F04) Direct3D11 vs_5_0 ps_5_0, D3D11)", battery: { charging: true, level: 1 } }));
	assert.equal(d.kind, "desktop");
	assert.equal(d.title, "Windows PC");
});

test("iPhone UA from a Chromium emulator is marked spoofed, not trusted", () => {
	const d = inferDevice(fp({ ua: IOS_SAFARI, platform: "iPhone", uaData: { brands: [], mobile: false, platform: "" }, w: 440, h: 956, dpr: 1, touch: 0 }));
	assert.equal(d.spoofed, true);
	assert.match(d.title, /^Spoofed \/ emulated \(claims iPhone/);
	assert.ok(d.flags.includes("userAgentData on iOS (real iOS WebKit has none)"));
});

test("tolerates empty or malformed attributes", () => {
	assert.equal(inferDevice({}).kind, "unknown");
	assert.equal(inferDevice(null).kind, "unknown");
	assert.equal(inferDevice({ error: "stored attributes are invalid JSON" }).title, "Unknown device");
});

test("gpuName unwraps ANGLE strings", () => {
	assert.equal(gpuName("ANGLE (AMD, AMD Radeon RX 580 2048SP (0x00006FDF) Direct3D11 vs_5_0 ps_5_0, D3D11)"), "AMD Radeon RX 580 2048SP");
	assert.equal(gpuName("ANGLE (NVIDIA, NVIDIA GeForce GTX 980 Direct3D11 vs_5_0 ps_5_0), or similar"), "NVIDIA GeForce GTX 980 (Firefox-generalized)");
	assert.equal(gpuName("Intel Iris OpenGL Engine"), "Intel Iris");
	assert.equal(gpuName(null), null);
});

const withMedia = (attrs, video, decoding) => ({ ...attrs, media: { formats: { video }, ...(decoding ? { decoding } : {}) } });
const AV1 = "video/webm; codecs=av01.0.05M.08";

test("AV1 support splits shared iPhone screen families", () => {
	const base = fp({ ua: IOS_SAFARI, platform: "iPhone", w: 430, h: 932, dpr: 3, renderer: "Apple GPU", touch: 5, avail: [430, 932] });
	const yes = inferDevice(withMedia(base, { [AV1]: "probably" }));
	assert.equal(yes.candidates, "iPhone 15 Pro Max / 16 Plus");
	assert.ok(yes.hints.some((h) => /A17 Pro or newer \(canPlayType\)/.test(h)));
	const no = inferDevice(withMedia(fp({ ua: IOS_SAFARI, platform: "iPhone", w: 390, h: 844, dpr: 3, renderer: "Apple GPU", touch: 5, avail: [390, 844] }), { [AV1]: "no" }));
	assert.equal(no.candidates, "iPhone 12 / 12 Pro / 13 / 13 Pro / 14");
	const e = inferDevice(withMedia(fp({ ua: IOS_SAFARI, platform: "iPhone", w: 390, h: 844, dpr: 3, renderer: "Apple GPU", touch: 5, avail: [390, 844] }), { [AV1]: "probably" }));
	assert.equal(e.candidates, "iPhone 16e");
	assert.equal(e.confidence, "medium", "canPlayType alone caps confidence");
	const pe = inferDevice(withMedia(fp({ ua: IOS_SAFARI, platform: "iPhone", w: 390, h: 844, dpr: 3, renderer: "Apple GPU", touch: 5, avail: [390, 844] }), { [AV1]: "no" }, { av1: { supported: true, smooth: true, powerEfficient: true } }));
	assert.equal(pe.candidates, "iPhone 16e", "powerEfficient beats canPlayType");
	assert.equal(pe.confidence, "high");
});

test("in-app hardware IDs give the exact iPhone model", () => {
	const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F79 [FBAN/FBIOS;FBAV/470.0.0.0;FBBV/1;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5]";
	const d = inferDevice(fp({ ua, platform: "iPhone", w: 390, h: 844, dpr: 3, renderer: "Apple GPU", touch: 5, avail: [390, 844] }));
	assert.equal(d.title, "iPhone 13");
	assert.equal(d.candidates, null);
	assert.equal(d.confidence, "high");
	const ig = inferDevice(fp({ ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23B85 Instagram 400.0.0 (iPhone17,1; iOS 26_1; en_CA; en; scale=3.00; 1206x2622; 123)", platform: "iPhone", w: 402, h: 874, dpr: 3, renderer: "Apple GPU", touch: 5, avail: [402, 874] }));
	assert.equal(ig.title, "iPhone 16 Pro");
});

test("Android without a model: physical panel + GPU narrows to a family", () => {
	const d = inferDevice(fp({ ua: "Mozilla/5.0 (Android 16; Mobile; rv:158.0) Gecko/158.0 Firefox/158.0", platform: "Linux armv81", w: 456, h: 978, dpr: 3.1578947368421053, renderer: "Adreno (TM) 650, or similar", touch: 5, avail: [456, 978] }));
	assert.equal(d.candidates, "Galaxy Note20 Ultra (Snapdragon)");
	const fb = inferDevice(fp({ ua: "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0;FBDV/SM-S928B;]", platform: "Linux aarch64", w: 384, h: 832, dpr: 3.75, touch: 5, renderer: "Adreno (TM) 750", avail: [384, 832] }));
	assert.equal(fb.title, "Samsung SM-S928B");
});
