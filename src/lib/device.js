// Best-effort device inference from one stored browser-fingerprint snapshot.
// Everything here is a guess built from self-reported browser values, so the
// result separates what was reported (os, browser, screen, gpu) from what was
// inferred (model candidates, form factor) and lists contradictions as flags.

const IPHONES = {
	"320x568@2": "iPhone SE (1st gen) / 5s",
	"375x667@2": "iPhone 6 / 6s / 7 / 8 / SE (2nd–3rd gen)",
	"414x736@3": "iPhone 6 Plus / 7 Plus / 8 Plus",
	"375x812@3": "iPhone X / XS / 11 Pro / 12 mini / 13 mini",
	"414x896@2": "iPhone XR / 11",
	"414x896@3": "iPhone XS Max / 11 Pro Max",
	"390x844@3": "iPhone 12 / 12 Pro / 13 / 13 Pro / 14 / 16e",
	"428x926@3": "iPhone 12 Pro Max / 13 Pro Max / 14 Plus",
	"393x852@3": "iPhone 14 Pro / 15 / 15 Pro / 16",
	"430x932@3": "iPhone 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus",
	"402x874@3": "iPhone 16 Pro / 17 / 17 Pro",
	"420x912@3": "iPhone Air",
	"440x956@3": "iPhone 16 Pro Max / 17 Pro Max",
};

const IPADS = {
	"768x1024@2": "iPad 9.7\" (5th–6th gen) / iPad mini 2–5 / iPad Air 1–2",
	"744x1133@2": "iPad mini (6th gen / A17 Pro)",
	"810x1080@2": "iPad 10.2\" (7th–9th gen)",
	"820x1180@2": "iPad Air (4th–5th gen) / iPad (10th gen) / iPad A16",
	"834x1112@2": "iPad Air (3rd gen) / iPad Pro 10.5\"",
	"834x1194@2": "iPad Pro 11\" (1st–4th gen) / iPad Air 11\" (M2–M3)",
	"834x1210@2": "iPad Pro 11\" (M4–M5)",
	"1024x1366@2": "iPad Pro 12.9\" / iPad Air 13\" (M2–M3)",
	"1032x1376@2": "iPad Pro 13\" (M4–M5)",
};

// Same-screen iPhone families split by AV1 decode. Safari only exposes AV1 on
// chips with a hardware AV1 decoder (A17 Pro and later), so "AV1 yes" means
// A17 Pro+ and "AV1 no" means older. Sizes whose members all agree are omitted.
const IPHONE_AV1_SPLIT = {
	"390x844@3": { yes: "iPhone 16e", no: "iPhone 12 / 12 Pro / 13 / 13 Pro / 14" },
	"393x852@3": { yes: "iPhone 15 Pro / 16", no: "iPhone 14 Pro / 15" },
	"430x932@3": { yes: "iPhone 15 Pro Max / 16 Plus", no: "iPhone 14 Pro Max / 15 Plus" },
};

// Exact hardware identifiers leaked by in-app browsers (Facebook "FBDV/iPhone14,5",
// Instagram "(iPhone14,5; iOS 17_5; …)").
const IPHONE_IDS = {
	"10,1": "iPhone 8", "10,4": "iPhone 8", "10,2": "iPhone 8 Plus", "10,5": "iPhone 8 Plus", "10,3": "iPhone X", "10,6": "iPhone X",
	"11,2": "iPhone XS", "11,4": "iPhone XS Max", "11,6": "iPhone XS Max", "11,8": "iPhone XR",
	"12,1": "iPhone 11", "12,3": "iPhone 11 Pro", "12,5": "iPhone 11 Pro Max", "12,8": "iPhone SE (2nd gen)",
	"13,1": "iPhone 12 mini", "13,2": "iPhone 12", "13,3": "iPhone 12 Pro", "13,4": "iPhone 12 Pro Max",
	"14,4": "iPhone 13 mini", "14,5": "iPhone 13", "14,2": "iPhone 13 Pro", "14,3": "iPhone 13 Pro Max", "14,6": "iPhone SE (3rd gen)",
	"14,7": "iPhone 14", "14,8": "iPhone 14 Plus", "15,2": "iPhone 14 Pro", "15,3": "iPhone 14 Pro Max",
	"15,4": "iPhone 15", "15,5": "iPhone 15 Plus", "16,1": "iPhone 15 Pro", "16,2": "iPhone 15 Pro Max",
	"17,3": "iPhone 16", "17,4": "iPhone 16 Plus", "17,1": "iPhone 16 Pro", "17,2": "iPhone 16 Pro Max", "17,5": "iPhone 16e",
	"18,1": "iPhone 17 Pro", "18,2": "iPhone 17 Pro Max", "18,3": "iPhone 17", "18,4": "iPhone Air",
};

// Android physical panel (short x long) + GPU → candidates, used only when the
// browser hides the model (Firefox, reduced UA). Generic panels like 1080x2400
// are only listed with distinctive GPUs because too many phones share them.
const ANDROID_PANEL_GPU = {
	"1440x3200|Adreno 650": "Galaxy S20 / S20+ / S20 Ultra (Snapdragon)",
	"1440x3088|Adreno 650": "Galaxy Note20 Ultra (Snapdragon)",
	"1080x2316|Adreno 650": "Galaxy Note20 Ultra (Snapdragon, FHD+ mode)",
	"1440x3200|Adreno 660": "Galaxy S21 Ultra (Snapdragon)",
	"1440x3088|Adreno 730": "Galaxy S22 Ultra (Snapdragon)",
	"1080x2316|Adreno 730": "Galaxy S22 Ultra (Snapdragon, FHD+ mode)",
	"1440x3088|Xclipse 920": "Galaxy S22 Ultra (Exynos)",
	"1440x3088|Adreno 740": "Galaxy S23 Ultra",
	"1080x2316|Adreno 740": "Galaxy S23 Ultra (FHD+ mode)",
	"1440x3120|Adreno 750": "Galaxy S24 Ultra",
	"1440x3120|Xclipse 940": "Galaxy S24+ (Exynos)",
	"1440x3120|Adreno 830": "Galaxy S25 Ultra",
	"1440x3120|Mali-G78": "Pixel 6 Pro",
	"1440x3120|Mali-G710": "Pixel 7 Pro",
	"1080x2400|Mali-G78": "Pixel 6",
	"1080x2400|Mali-G710": "Pixel 7",
	"1344x2992|Mali-G715": "Pixel 8 Pro / Pixel 9 Pro XL",
	"1080x2424|Mali-G715": "Pixel 9",
	"1280x2856|Mali-G715": "Pixel 9 Pro",
};

function gpuToken(renderer) {
	if (!renderer) return null;
	const m = renderer.match(/Adreno\D*(\d{3})|(Mali-G\d+)|(Immortalis-G\d+)|(Xclipse \d+)/i);
	if (!m) return null;
	if (m[1]) return `Adreno ${m[1]}`;
	// Tensor G3/G4 report Mali-G715 or Immortalis-G715 depending on driver.
	return (m[2] ?? m[3] ?? m[4]).replace(/^Immortalis-/i, "Mali-");
}

// AV1 decode evidence. When mediaCapabilities answered, only its unambiguous
// states count: supported+powerEfficient → hardware decoder; supported=false →
// none; supported-but-not-efficient → unknown (no split). canPlayType is used
// only for older snapshots that have no mediaCapabilities result.
function av1Support(attributes) {
	const media = obj(attributes.media);
	const decoding = obj(obj(media.decoding).av1);
	if (decoding.supported === true && decoding.powerEfficient === true) return { value: true, basis: "mediaCapabilities powerEfficient" };
	if (decoding.supported === false) return { value: false, basis: "mediaCapabilities unsupported" };
	if (typeof decoding.supported === "boolean") return null;
	const video = obj(obj(media.formats).video);
	const answer = video["video/webm; codecs=av01.0.05M.08"];
	if (typeof answer === "string") return { value: answer === "probably" || answer === "maybe", basis: "canPlayType" };
	return null;
}

const ADRENO = {
	"610": "Snapdragon 4xx/6xx-class",
	"612": "Snapdragon 675/678",
	"616": "Snapdragon 710/712",
	"618": "Snapdragon 720G/730G/732G",
	"619": "Snapdragon 480/690/695/750G",
	"620": "Snapdragon 765G",
	"630": "Snapdragon 845",
	"640": "Snapdragon 855/860",
	"642": "Snapdragon 778G/780G",
	"643": "Snapdragon 7 Gen 1",
	"644": "Snapdragon 7s Gen 2",
	"650": "Snapdragon 865/870",
	"660": "Snapdragon 888",
	"710": "Snapdragon 7 Gen 3",
	"720": "Snapdragon 7+ Gen 3",
	"725": "Snapdragon 7+ Gen 2",
	"730": "Snapdragon 8 Gen 1 / 8+ Gen 1",
	"732": "Snapdragon 8s Gen 3",
	"735": "Snapdragon 8s Gen 3",
	"740": "Snapdragon 8 Gen 2",
	"750": "Snapdragon 8 Gen 3",
	"830": "Snapdragon 8 Elite",
};

// Android model-number prefixes → vendor. Chrome's reduced UA hides the model
// ("Android 10; K"), but userAgentData.model or WebView/legacy UAs often keep it.
const ANDROID_VENDORS = [
	[/^SM-|^SCV|^SC-|^Galaxy/i, "Samsung"],
	[/^Pixel/i, "Google"],
	[/^moto|^XT\d/i, "Motorola"],
	[/^(HD|IN|KB|LE|NE|PH|CPH2[4-9])\d/i, "OnePlus"],
	[/^CPH|^OPPO/i, "OPPO"],
	[/^(Redmi|POCO|Mi |M\d{4}|2\d{3}[A-Z0-9]{4,})/i, "Xiaomi"],
	[/^(V\d{4}|vivo)/i, "vivo"],
	[/^(RMX|realme)/i, "realme"],
	[/^(ELE|VOG|ANA|LYA|NOH|HMA|MAR|JNY)-/i, "Huawei"],
	[/^(XQ-|SO-|G8\d{3})/i, "Sony"],
	[/^(LM-|LG)/i, "LG"],
	[/^(A\d{3}|Nokia|TA-)/i, "Nokia / HMD"],
	[/^Nothing|^A0(59|63|65)/i, "Nothing"],
	[/^ASUS|^AI2\d{3}/i, "ASUS"],
];

// Mac CSS screen sizes at 2x → built-in display candidates (macOS default
// "looks like" scaling). Users can pick other scalings, so these are families.
const MACS = {
	"1280x800@2": "MacBook Air 13\" / MacBook Pro 13\" (scaled)",
	"1440x900@2": "MacBook Air 13\" (Intel–M1) / MacBook Pro 13\"",
	"1470x956@2": "MacBook Air 13\" (M2–M4)",
	"1710x1112@2": "MacBook Air 15\"",
	"1512x982@2": "MacBook Pro 14\"",
	"1728x1117@2": "MacBook Pro 16\"",
	"1536x960@2": "MacBook Pro 15\" (2016–2019)",
	"1792x1120@2": "MacBook Pro 16\" (Intel)",
	"2240x1260@2": "iMac 24\"",
	"2560x1440@2": "iMac 27\" 5K / Studio Display",
	"3008x1692@2": "Pro Display XDR",
};
// Physical laptop panels at 100% scaling (CSS = physical).
const LAPTOP_PANELS_1X = new Set(["1366x768", "1280x800", "1440x900", "1600x900", "1280x720"]);
const HEADLESS_SCREENS = new Set(["800x600", "2000x2000", "1024x768", "780x580", "1x1", "0x0"]);
const CRAWLER = /bot\b|crawler|spider|crawl|slurp|BuiltWith|python-|curl\/|wget\/|Go-http|okhttp|axios|node-fetch|HeadlessChrome|PhantomJS|Lighthouse|Chrome-Lighthouse|GTmetrix|PageSpeed|facebookexternalhit|Twitterbot|Discordbot|Slackbot|TelegramBot|WhatsApp|LinkedInBot|Embedly|Applebot|Bytespider|GPTBot|ClaudeBot|PerplexityBot|meta-externalagent/i;

function obj(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function num(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value) {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function round(value, digits = 2) {
	const f = 10 ** digits;
	return Math.round(value * f) / f;
}

function dprKey(dpr) {
	return dpr === null ? "?" : String(Math.round(dpr));
}

/** Parse an unmasked WebGL renderer string into a short GPU name. */
export function gpuName(renderer) {
	let raw = str(renderer);
	if (!raw) return null;
	const similar = /, or similar$/.test(raw);
	raw = raw.replace(/, or similar$/, "");
	let name = raw;
	const angle = raw.match(/^ANGLE \((.*)\)$/);
	if (angle) {
		const parts = angle[1].split(/, (?![^()]*\))/);
		name = parts[1] ?? parts[0];
		const metal = name.match(/Metal Renderer: (.+)$/);
		if (metal) name = metal[1];
	}
	name = name
		.replace(/\s*\(0x[0-9a-f]+\)/gi, "")
		.replace(/\s+Direct3D\d+.*$/i, "")
		.replace(/\s+vs_\d.*$/i, "")
		.replace(/\s+OpenGL Engine$/i, "")
		.replace(/\(R\)|\(TM\)/g, "")
		.replace(/\s{2,}/g, " ")
		.trim();
	if (/SwiftShader/i.test(raw)) name = "SwiftShader (software)";
	else if (/llvmpipe|softpipe|Microsoft Basic Render/i.test(raw)) name = `${name} (software)`;
	return similar ? `${name} (Firefox-generalized)` : name;
}

function parseUa(ua) {
	const out = { os: null, osVersion: null, browser: null, browserVersion: null, model: null, iphone: false, ipad: false, mac: false, android: false, windows: false, linux: false, chromeos: false, mobileToken: /Mobile/.test(ua), app: null };
	let m;
	if ((m = ua.match(/iPhone; CPU iPhone OS (\d+)[_.](\d+)(?:[_.](\d+))?/))) {
		Object.assign(out, { os: "iOS", osVersion: [m[1], m[2], m[3]].filter(Boolean).join("."), iphone: true });
	} else if ((m = ua.match(/iPad; CPU OS (\d+)[_.](\d+)(?:[_.](\d+))?/))) {
		Object.assign(out, { os: "iPadOS", osVersion: [m[1], m[2], m[3]].filter(Boolean).join("."), ipad: true });
	} else if ((m = ua.match(/Android (\d+(?:\.\d+)*)(?:; ([^;)]+))?/)) || /Android/.test(ua)) {
		out.os = "Android";
		out.android = true;
		out.osVersion = m?.[1] ?? null;
		const model = (ua.match(/Android [\d.]+; (?:[a-z]{2}[-_][a-z]{2}; )?([^;)]+?)(?: Build\/[^;)]*)?(?:;|\))/i) ?? [])[1];
		if (model && !/^(K|wv|Mobile|Tablet|U)$/i.test(model.trim())) out.model = model.trim();
	} else if ((m = ua.match(/Windows NT (\d+\.\d+)/))) {
		out.os = "Windows";
		out.windows = true;
		out.osVersion = { "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7", "6.0": "Vista", "5.1": "XP" }[m[1]] ?? m[1];
	} else if ((m = ua.match(/Mac OS X (\d+)[_.](\d+)(?:[_.](\d+))?/))) {
		out.os = "macOS";
		out.mac = true;
		out.osVersion = [m[1], m[2], m[3]].filter(Boolean).join(".");
	} else if (/CrOS/.test(ua)) {
		out.os = "ChromeOS";
		out.chromeos = true;
	} else if (/Linux|X11/.test(ua)) {
		out.os = "Linux";
		out.linux = true;
	}

	const apps = [
		[/Twitter for iPhone\/([\d.]+)/, "X (Twitter) app"],
		[/TwitterAndroid/, "X (Twitter) app"],
		[/Instagram ([\d.]+)/, "Instagram app"],
		[/FBAN|FBAV\/([\d.]+)/, "Facebook app"],
		[/LinkedInApp/, "LinkedIn app"],
		[/musical_ly|aweme|BytedanceWebview/, "TikTok / Douyin app"],
		[/Snapchat/, "Snapchat app"],
		[/Discord/, "Discord"],
		[/Telegram/, "Telegram"],
		[/; wv\)/, "Android WebView"],
	];
	for (const [re, name] of apps) {
		if ((m = ua.match(re))) {
			out.app = m[1] ? `${name} ${m[1]}` : name;
			break;
		}
	}

	const browsers = [
		[/HeadlessChrome\/([\d.]+)/, "Headless Chrome"],
		[/Edg(?:A|iOS)?\/([\d.]+)/, "Edge"],
		[/OPR\/([\d.]+)/, "Opera"],
		[/SamsungBrowser\/([\d.]+)/, "Samsung Internet"],
		[/YaBrowser\/([\d.]+)/, "Yandex"],
		[/Vivaldi\/([\d.]+)/, "Vivaldi"],
		[/FxiOS\/([\d.]+)/, "Firefox (iOS)"],
		[/CriOS\/([\d.]+)/, "Chrome (iOS)"],
		[/Firefox\/([\d.]+)/, "Firefox"],
		[/Chrome\/([\d.]+)/, "Chrome"],
		[/Version\/([\d.]+).*Safari/, "Safari"],
	];
	for (const [re, name] of browsers) {
		if ((m = ua.match(re))) {
			out.browser = name;
			out.browserVersion = m[1].replace(/(\.0)+$/, "");
			break;
		}
	}
	return out;
}

function brandBrowser(uaData) {
	const brands = Array.isArray(uaData.fullVersionList) && uaData.fullVersionList.length ? uaData.fullVersionList : uaData.brands;
	if (!Array.isArray(brands)) return null;
	const real = brands.filter((b) => b && typeof b.brand === "string" && !/Not.?A.?Brand/i.test(b.brand));
	const pick = real.find((b) => b.brand !== "Chromium") ?? real[0];
	if (!pick) return null;
	const name = pick.brand === "Google Chrome" ? "Chrome" : pick.brand === "Microsoft Edge" ? "Edge" : pick.brand;
	return { name, version: String(pick.version).replace(/(\.0)+$/, "") };
}

function androidVendor(model) {
	if (!model) return null;
	for (const [re, vendor] of ANDROID_VENDORS) if (re.test(model)) return vendor;
	return null;
}

function windowsVersion(platformVersion) {
	const major = Number(String(platformVersion).split(".")[0]);
	if (!Number.isFinite(major)) return null;
	if (major >= 13) return "11";
	if (major > 0) return "10";
	return "7/8/8.1";
}

function platformOs(platform) {
	if (!platform) return null;
	if (/^Win/i.test(platform)) return "Windows";
	if (/^Mac/i.test(platform)) return "macOS";
	if (/^iPhone|^iPod/i.test(platform)) return "iOS";
	if (/^iPad/i.test(platform)) return "iPadOS";
	if (/Android/i.test(platform)) return "Android";
	if (/Linux|X11/i.test(platform)) return "Linux";
	if (/CrOS/i.test(platform)) return "ChromeOS";
	return null;
}

/**
 * @param {Record<string, any>} attributes stored fingerprint attributes
 * @returns {{kind: "phone"|"tablet"|"laptop"|"desktop"|"bot"|"unknown", claimedKind: string, spoofed: boolean, title: string, candidates: string|null, os: string|null, browser: string|null, screen: string|null, physical: string|null, gpu: string|null, chip: string|null, cpu: string|null, memory: string|null, input: string|null, locale: string|null, network: string|null, power: string|null, flags: string[], hints: string[], confidence: "high"|"medium"|"low"}}
 */
export function inferDevice(attributes) {
	const a = obj(attributes);
	const b = obj(a.browser);
	const uaData = obj(b.userAgentData);
	const hasUaData = Boolean(b.userAgentData && typeof b.userAgentData === "object");
	const scr = obj(obj(a.screen).screen);
	const vp = obj(obj(a.screen).viewport);
	const loc = obj(a.locale);
	const feat = obj(a.features);
	const mq = obj(feat.mediaQueries);
	const battery = a.battery && typeof a.battery === "object" ? a.battery : null;
	const conn = a.connection && typeof a.connection === "object" ? a.connection : null;
	const webgl = obj(a.webgl);

	const ua = str(b.userAgent) ?? "";
	const p = parseUa(ua);
	const platform = str(b.platform);
	const touch = num(b.maxTouchPoints) ?? 0;
	const dpr = num(vp.devicePixelRatio);
	const w = num(scr.width);
	const h = num(scr.height);
	const short = w !== null && h !== null ? Math.min(w, h) : null;
	const long = w !== null && h !== null ? Math.max(w, h) : null;
	const renderer = str(webgl.renderer);
	const gpu = gpuName(renderer);
	const flags = [];
	const hints = [];

	// ── form factor ─────────────────────────────────────────────────────────
	const ipadDesktopMode = p.mac && touch > 1;
	let kind = "unknown";
	if (p.iphone) kind = "phone";
	else if (p.ipad || ipadDesktopMode) kind = "tablet";
	else if (p.android) kind = p.mobileToken || uaData.mobile === true ? "phone" : "tablet";
	else if (uaData.mobile === true) kind = "phone";
	else if (p.windows || p.mac || p.linux || p.chromeos) kind = "desktop";
	if (kind === "desktop" && Array.isArray(uaData.formFactors)) {
		if (uaData.formFactors.includes("Tablet") && !uaData.formFactors.includes("Desktop")) kind = "tablet";
	}

	// ── OS ──────────────────────────────────────────────────────────────────
	let os = p.os;
	let osVersion = p.osVersion;
	const pv = str(uaData.platformVersion);
	if (p.windows && pv) osVersion = windowsVersion(pv) ?? osVersion;
	if (p.mac && pv && !ipadDesktopMode) osVersion = pv.replace(/(\.0)+$/, "");
	if (p.android && pv) osVersion = pv.replace(/(\.0)+$/, "");
	if (ipadDesktopMode) {
		os = "iPadOS";
		osVersion = null;
		hints.push("iPad in desktop-class mode (Mac UA + touch points)");
	}
	if ((p.iphone || p.ipad) && osVersion && /^18\.[67]/.test(osVersion) && p.browser === "Safari" && Number(p.browserVersion?.split(".")[0]) >= 26) {
		hints.push(`UA OS token ${osVersion} is frozen by Safari ${p.browserVersion}; actual OS version is not exposed`);
		osVersion = `${osVersion} (frozen UA token)`;
	}
	if (p.mac && !pv && osVersion === "10.15.7") osVersion = "10.15.7 (frozen UA token)";
	const osLabel = os ? [os, osVersion].filter(Boolean).join(" ") : platform;
	const arch = str(uaData.architecture);
	const bitness = str(uaData.bitness);
	const archLabel = arch ? `${arch === "arm" ? "ARM" : /^x(86|64)/.test(arch) ? "x86" : arch}${bitness ? `-${bitness}` : ""}` : null;

	// ── browser ─────────────────────────────────────────────────────────────
	const brand = hasUaData ? brandBrowser(uaData) : null;
	let browserName = p.browser;
	let browserVersion = p.browserVersion;
	if (brand && (!browserName || browserName === "Chrome" || browserName === "Headless Chrome")) {
		browserName = brand.name;
		browserVersion = brand.version;
	}
	const browser = [browserName, browserVersion].filter(Boolean).join(" ") || null;
	const browserLabel = p.app ? `${p.app}${browser ? ` (${browser} engine)` : ""}` : browser;

	// ── screen ──────────────────────────────────────────────────────────────
	const screenLabel = w !== null && h !== null ? `${w}×${h}${dpr !== null ? ` @${round(dpr)}x` : ""}` : null;
	const physW = w !== null && dpr ? Math.round(w * dpr) : null;
	const physH = h !== null && dpr ? Math.round(h * dpr) : null;
	const physical = physW && physH ? `${physW}×${physH} px` : null;
	const availH = num(scr.availHeight);
	const availW = num(scr.availWidth);

	// ── model ───────────────────────────────────────────────────────────────
	let title = "Unknown device";
	let candidates = null;
	let vendor = null;
	let chip = null;
	let av1Basis = null;
	if (kind === "phone" && (p.iphone || os === "iOS")) {
		const key = short !== null ? `${short}x${long}@${dprKey(dpr)}` : null;
		const hw = ua.match(/iPhone(\d+,\d+)/);
		candidates = key ? IPHONES[key] ?? null : null;
		if (hw && IPHONE_IDS[hw[1]]) {
			title = IPHONE_IDS[hw[1]];
			candidates = null;
			hints.push(`exact model from in-app hardware ID iPhone${hw[1]}`);
		} else {
			const split = key ? IPHONE_AV1_SPLIT[key] : null;
			const av1 = split ? av1Support(a) : null;
			if (split && av1) {
				candidates = av1.value ? split.yes : split.no;
				av1Basis = av1.basis;
				hints.push(`AV1 decode ${av1.value ? "present → A17 Pro or newer" : "absent → older than A17 Pro"} (${av1.basis})`);
			}
			title = hw ? `iPhone (unknown ID iPhone${hw[1]})` : candidates ? "iPhone" : "iPhone (unmatched screen)";
		}
	} else if (kind === "tablet" && (p.ipad || ipadDesktopMode)) {
		candidates = short !== null ? IPADS[`${short}x${long}@${dprKey(dpr)}`] ?? null : null;
		title = "iPad";
	} else if (p.android) {
		const fbModel = (ua.match(/FBDV\/([^;]+)/) ?? [])[1];
		const model = str(uaData.model) ?? p.model ?? str(fbModel);
		vendor = androidVendor(model);
		title = [vendor, model].filter(Boolean).join(" ") || `Android ${kind}`;
		if (!model) {
			hints.push("Android model hidden (reduced UA, no userAgentData model)");
			const token = gpuToken(renderer);
			const panelKey = physW && physH ? `${Math.min(physW, physH)}x${Math.max(physW, physH)}` : null;
			const match = token && panelKey ? ANDROID_PANEL_GPU[`${panelKey}|${token}`] : null;
			if (match) {
				candidates = match;
				hints.push(`panel ${panelKey} + ${token} match`);
			}
		}
		const adreno = renderer?.match(/Adreno\D*(\d{3})/i);
		if (adreno) chip = `Qualcomm ${ADRENO[adreno[1]] ?? "Snapdragon"} (Adreno ${adreno[1]})`;
		else if (/Mali-G\d+/i.test(renderer ?? "")) chip = `${renderer?.match(/Mali-G\d+(?: MC\d+)?/i)?.[0]} (Exynos / MediaTek / Tensor)`;
		else if (/Xclipse/i.test(renderer ?? "")) chip = "Samsung Exynos (Xclipse GPU)";
		else if (/PowerVR/i.test(renderer ?? "")) chip = "MediaTek / Unisoc (PowerVR GPU)";
		else if (/Immortalis/i.test(renderer ?? "")) chip = "MediaTek Dimensity (Immortalis GPU)";
	} else if (kind === "desktop") {
		const panel = physW && physH ? `${Math.max(physW, physH)}x${Math.min(physW, physH)}` : null;
		const discharging = battery && (battery.charging === false || (num(battery.level) !== null && battery.level < 1));
		const scaled = dpr !== null && dpr > 1 && dpr < 2 && physW !== null && Math.max(physW, physH ?? 0) <= 2880;
		const laptopPanel = !p.mac && panel !== null && ((dpr === 1 && LAPTOP_PANELS_1X.has(panel)) || scaled);
		if (discharging) {
			kind = "laptop";
			hints.push(`battery ${Math.round((battery.level ?? 0) * 100)}%${battery.charging ? " charging" : " discharging"} → portable`);
		} else if (laptopPanel) {
			kind = "laptop";
			hints.push(`${panel} panel${dpr && dpr !== 1 ? ` at ${Math.round(dpr * 100)}% OS scaling` : ""} → likely a laptop`);
		}
		const appleChip = renderer?.match(/Apple (M\d+(?: Pro| Max| Ultra)?)/);
		if (p.mac) {
			if (appleChip) chip = `Apple ${appleChip[1]}`;
			else if (arch === "arm") chip = "Apple Silicon";
			else if (/^x/.test(arch ?? "")) chip = "Intel";
			const macKey = short !== null ? `${long}x${short}@${dprKey(dpr)}` : null;
			candidates = macKey ? MACS[macKey] ?? null : null;
			if (candidates?.startsWith("MacBook")) kind = "laptop";
			if (!candidates && dpr === 1) hints.push("1x display → external monitor (Mac mini / Studio / docked laptop)");
			title = kind === "laptop" ? "MacBook" : "Mac";
		} else if (p.windows) title = kind === "laptop" ? "Windows laptop" : "Windows PC";
		else if (p.chromeos) title = "Chromebook";
		else if (p.linux) title = kind === "laptop" ? "Linux laptop" : "Linux PC";
	}

	// ── capabilities / environment ──────────────────────────────────────────
	const cores = num(b.hardwareConcurrency);
	const memory = num(b.deviceMemory);
	const pointer = mq["(pointer: coarse)"] ? "touch" : mq["(pointer: fine)"] ? "mouse/trackpad" : null;
	const input = [pointer, touch ? `${touch} touch points` : null].filter(Boolean).join(" · ") || null;
	const language = str(b.language);
	const tz = str(loc.timeZone);
	const network = conn ? [conn.type, conn.effectiveType, conn.downlink ? `${conn.downlink} Mb/s` : null, conn.rtt ? `${conn.rtt} ms rtt` : null].filter(Boolean).join(" · ") || null : null;
	const power = battery && (battery.charging === false || (num(battery.level) ?? 1) < 1) ? `${Math.round((num(battery.level) ?? 0) * 100)}%${battery.charging ? " charging" : " on battery"}` : null;

	// ── consistency / automation flags ──────────────────────────────────────
	if (b.webdriver === true) flags.push("navigator.webdriver = true (automation)");
	if (/HeadlessChrome/.test(ua) || (Array.isArray(uaData.brands) && uaData.brands.some((x) => /Headless/i.test(x?.brand)))) flags.push("headless Chrome");
	if (CRAWLER.test(ua) && !/HeadlessChrome/.test(ua)) flags.push("crawler / tool user agent");
	if (/SwiftShader|llvmpipe|softpipe|Microsoft Basic Render/i.test(renderer ?? "")) flags.push("software GPU (headless / VM)");
	const pOs = platformOs(platform);
	if (pOs && os && pOs !== os && !(ipadDesktopMode && pOs === "macOS") && !(os === "Android" && pOs === "Linux")) {
		flags.push(`UA says ${os}, navigator.platform says ${platform}`);
	}
	const chOs = platformOs(str(uaData.platform));
	if (chOs && os && chOs !== os && !(os === "Android" && chOs === "Linux")) flags.push(`UA says ${os}, client hints say ${uaData.platform}`);
	if ((p.iphone || p.ipad) && hasUaData) flags.push("userAgentData on iOS (real iOS WebKit has none)");
	if ((p.iphone || p.ipad) && renderer && !/Apple/i.test(renderer)) flags.push(`non-Apple GPU on iOS: ${gpu}`);
	if (p.iphone && dpr !== null && dpr < 2) flags.push(`iPhone UA with ${dpr}x pixel ratio`);
	if ((kind === "phone" || kind === "tablet") && touch === 0) flags.push("mobile UA but no touch support");
	if (w !== null && h !== null && HEADLESS_SCREENS.has(`${w}x${h}`) && kind !== "phone") flags.push(`default headless screen ${w}×${h}`);
	if (w !== null && h !== null && availW === w && availH === h && (kind === "desktop" || kind === "laptop") && !p.mac && !p.linux) flags.push("no taskbar space (avail = screen)");
	if (tz && /^(UTC|Etc\/)/.test(tz)) flags.push(`timezone ${tz} (server / VM default)`);
	if (!renderer && a.webgl !== undefined && kind !== "unknown") flags.push("no WebGL renderer");
	if (p.mac && !ipadDesktopMode && short !== null && short < 600) flags.push(`desktop UA with phone-sized screen ${w}×${h}`);

	// Direct signals alone mark automation. Environment signals (software GPU,
	// headless-default screen, UTC timezone, no WebGL) are common in VMs or with
	// hardware acceleration off, so they need to stack before we call it a bot.
	const direct = flags.some((f) => /webdriver|headless Chrome|crawler/.test(f));
	const environment = flags.filter((f) => /software GPU|default headless|server \/ VM default|no WebGL/.test(f)).length;
	const automation = direct || environment >= 2;
	const spoofed = !automation && flags.some((f) => /^UA says|userAgentData on iOS|non-Apple GPU on iOS|pixel ratio|no touch support|phone-sized screen/.test(f));
	const claimedKind = kind;
	if (automation) kind = "bot";

	const sharedFamily = Boolean(candidates && candidates.includes("/"));
	// canPlayType is codec support, not hardware-decoder proof: cap at medium.
	const exactModel = hints.some((h) => h.startsWith("exact model"));
	const panelGuess = hints.some((h) => /^panel \S+ \+ .* match$/.test(h));
	const confidence = flags.length >= 2 ? "low" : flags.length === 1 || sharedFamily || panelGuess || av1Basis === "canPlayType" || (!candidates && !exactModel && (claimedKind === "phone" || claimedKind === "tablet")) ? "medium" : "high";

	return {
		kind,
		claimedKind,
		spoofed,
		title: automation ? `Automated client (claims ${title})` : spoofed ? `Spoofed / emulated (claims ${title})` : title,
		candidates,
		os: [osLabel, archLabel].filter(Boolean).join(" · ") || null,
		browser: browserLabel,
		screen: screenLabel,
		physical,
		gpu,
		chip,
		cpu: cores !== null ? `${cores} logical cores` : null,
		memory: memory !== null ? `~${memory} GB RAM (browser-bucketed)` : null,
		input,
		locale: [tz, language].filter(Boolean).join(" · ") || null,
		network,
		power,
		flags,
		hints,
		confidence,
	};
}
