// Shared visit-tracking logic for functions/api/visit.js (collect) and
// functions/api/visits.js (dev-only aggregate). Plain JS so it runs in Pages
// Functions and under `node --test` without a build step.

export const TRACKED_HOSTS = new Set(["merulox.com", "www.merulox.com"]);
export const DEV_HOST = "dev.merulox.com";
const SELF_HOSTS = new Set([...TRACKED_HOSTS, DEV_HOST]);
const BOT_UA = /bot|crawl|spider|slurp|headless|preview|monitor|lighthouse|curl|wget|python|httpclient|okhttp|java\//i;
export const MAX_BODY = 1024;
const DAY = 86_400;

export const RANGES = {
	"24h": DAY,
	"7d": 7 * DAY,
	"30d": 30 * DAY,
	"90d": 90 * DAY,
	all: null,
};

export function cleanPath(value) {
	if (typeof value !== "string" || !value.startsWith("/")) return null;
	let path = value.split(/[?#]/, 1)[0];
	if (path.length > 200) return null;
	if (path.length > 1) path = path.replace(/\/+$/, "") || "/";
	if (path === "/api" || path.startsWith("/api/") || path === "/visits" || path.startsWith("/visits/")) {
		return null;
	}
	return path;
}

export function referrerHost(value) {
	if (typeof value !== "string" || !value) return null;
	try {
		const url = new URL(value);
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		const host = url.hostname.toLowerCase().replace(/^www\./, "");
		if (SELF_HOSTS.has(host) || SELF_HOSTS.has(`www.${host}`)) return null;
		return host.slice(0, 120);
	} catch {
		return null;
	}
}

const round = (value) => {
	const number = Number(value);
	return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
};
const text = (value, max = 80) =>
	typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

export function geoFrom(cf = {}) {
	return {
		country: text(cf.country, 2)?.toUpperCase() ?? null,
		region: text(cf.region),
		city: text(cf.city),
		lat: round(cf.latitude),
		lon: round(cf.longitude),
		colo: text(cf.colo, 8),
	};
}

// Returns { status } when the request must not be recorded, else { row }.
export function parseVisit(request, bodyText, now = Date.now()) {
	const url = new URL(request.url);
	if (!TRACKED_HOSTS.has(url.hostname)) return { status: 204, reason: "untracked host" };

	const origin = request.headers.get("Origin");
	if (origin) {
		let originHost = null;
		try {
			originHost = new URL(origin).hostname;
		} catch {}
		if (!TRACKED_HOSTS.has(originHost)) return { status: 403, reason: "foreign origin" };
	}

	if (BOT_UA.test(request.headers.get("User-Agent") ?? "")) return { status: 204, reason: "bot" };
	if (typeof bodyText !== "string" || bodyText.length > MAX_BODY) {
		return { status: 413, reason: "payload too large" };
	}

	let body;
	try {
		body = JSON.parse(bodyText);
	} catch {
		return { status: 400, reason: "invalid json" };
	}
	const path = cleanPath(body?.p);
	if (!path) return { status: 400, reason: "invalid path" };

	return {
		row: {
			ts: Math.floor(now / 1000),
			path,
			entry: body.e === 1 ? 1 : 0,
			referrer: referrerHost(body.r),
			...geoFrom(request.cf),
			ip: text(request.headers.get("CF-Connecting-IP"), 45),
		},
	};
}

export async function recordVisit(db, row) {
	await db
		.prepare(
			"INSERT INTO visits (ts, path, entry, referrer, country, region, city, lat, lon, colo, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		)
		.bind(row.ts, row.path, row.entry, row.referrer, row.country, row.region, row.city, row.lat, row.lon, row.colo, row.ip ?? null)
		.run();
}

export function rangeStart(range, now = Date.now()) {
	if (!Object.hasOwn(RANGES, range)) return null;
	const span = RANGES[range];
	return span === null ? 0 : Math.floor(now / 1000) - span;
}

const COUNTS = "SUM(weight) AS views, SUM(entry) AS visits";

export async function summarize(db, since) {
	const all = (sql) =>
		db
			.prepare(sql)
			.bind(since)
			.all()
			.then((result) => result.results ?? []);

	const [totals, points, countries, cities, paths, referrers, daily, recent] = await Promise.all([
		all(`SELECT ${COUNTS}, COUNT(DISTINCT country) AS countries, COUNT(DISTINCT ip) AS ips, SUM(CASE WHEN source = 'cloudflare' THEN weight ELSE 0 END) AS imported, MIN(ts) AS first, MAX(ts) AS last FROM visits WHERE ts >= ?`),
		all(`SELECT lat, lon, city, region, country, ${COUNTS} FROM visits WHERE ts >= ? AND lat IS NOT NULL AND lon IS NOT NULL GROUP BY lat, lon, city, region, country ORDER BY views DESC LIMIT 500`),
		all(`SELECT country, ${COUNTS} FROM visits WHERE ts >= ? GROUP BY country ORDER BY views DESC LIMIT 50`),
		all(`SELECT city, region, country, ${COUNTS} FROM visits WHERE ts >= ? AND city IS NOT NULL GROUP BY city, region, country ORDER BY views DESC LIMIT 25`),
		all(`SELECT path, ${COUNTS} FROM visits WHERE ts >= ? GROUP BY path ORDER BY views DESC LIMIT 25`),
		all(`SELECT referrer, ${COUNTS} FROM visits WHERE ts >= ? AND referrer IS NOT NULL GROUP BY referrer ORDER BY views DESC LIMIT 25`),
		all(`SELECT date(ts, 'unixepoch') AS day, ${COUNTS} FROM visits WHERE ts >= ? GROUP BY day ORDER BY day`),
		all(`SELECT ts, ip, path, entry, referrer, city, region, country, source FROM visits WHERE ts >= ? ORDER BY ts DESC, id DESC LIMIT 200`),
	]);

	const total = totals[0] ?? {};
	return {
		totals: {
			views: total.views ?? 0,
			visits: total.visits ?? 0,
			countries: total.countries ?? 0,
			ips: total.ips ?? 0,
			imported: total.imported ?? 0,
			first: total.first ?? null,
			last: total.last ?? null,
		},
		points,
		countries,
		cities,
		paths,
		referrers,
		daily,
		recent,
	};
}
