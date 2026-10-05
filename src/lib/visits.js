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

	const [totals, points, countries, cities, paths, referrers, daily] = await Promise.all([
		all(`SELECT ${COUNTS}, COUNT(DISTINCT country) AS countries, COUNT(DISTINCT ip) AS ips, SUM(CASE WHEN source = 'cloudflare' THEN weight ELSE 0 END) AS imported, MIN(ts) AS first, MAX(ts) AS last FROM visits WHERE ts >= ?`),
		all(`SELECT lat, lon, city, region, country, ${COUNTS} FROM visits WHERE ts >= ? AND lat IS NOT NULL AND lon IS NOT NULL GROUP BY lat, lon, city, region, country ORDER BY views DESC LIMIT 500`),
		all(`SELECT country, ${COUNTS} FROM visits WHERE ts >= ? GROUP BY country ORDER BY views DESC LIMIT 50`),
		all(`SELECT city, region, country, ${COUNTS} FROM visits WHERE ts >= ? AND city IS NOT NULL GROUP BY city, region, country ORDER BY views DESC LIMIT 25`),
		all(`SELECT path, ${COUNTS} FROM visits WHERE ts >= ? GROUP BY path ORDER BY views DESC LIMIT 25`),
		all(`SELECT referrer, ${COUNTS} FROM visits WHERE ts >= ? AND referrer IS NOT NULL GROUP BY referrer ORDER BY views DESC LIMIT 25`),
		all(`SELECT date(ts, 'unixepoch') AS day, ${COUNTS} FROM visits WHERE ts >= ? GROUP BY day ORDER BY day`),
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
	};
}

// ── Per-IP detail (dev panel) ───────────────────────────────────────────────

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-f:]{2,39}$/i;

export function normalizeIp(value) {
	if (typeof value !== "string") return null;
	const ip = value.trim().toLowerCase();
	if (IPV4.test(ip)) return ip;
	if (IPV6.test(ip) && ip.includes(":") && expandIpv6(ip)) return ip;
	return null;
}

function expandIpv6(ip) {
	const halves = ip.split("::");
	if (halves.length > 2) return null;
	const head = halves[0] ? halves[0].split(":") : [];
	const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
	const missing = 8 - head.length - tail.length;
	if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
	const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
	if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
	return groups.map((g) => g.padStart(4, "0"));
}

// DNS name for a PTR (reverse DNS) lookup.
export function reverseName(ip) {
	if (IPV4.test(ip)) return `${ip.split(".").reverse().join(".")}.in-addr.arpa`;
	const groups = expandIpv6(ip);
	return groups ? `${groups.join("").split("").reverse().join(".")}.ip6.arpa` : null;
}

export async function ipDetail(db, ip) {
	const one = (sql) => db.prepare(sql).bind(ip).all().then((r) => r.results ?? []);
	const [totals, paths, places] = await Promise.all([
		one(`SELECT ${COUNTS}, COUNT(*) AS rows, MIN(ts) AS first, MAX(ts) AS last, COUNT(DISTINCT date(ts, 'unixepoch')) AS days, SUM(CASE WHEN source = 'cloudflare' THEN weight ELSE 0 END) AS imported FROM visits WHERE ip = ?`),
		one(`SELECT path, ${COUNTS} FROM visits WHERE ip = ? GROUP BY path ORDER BY views DESC, path`),
		one(`SELECT city, region, country, lat, lon, ${COUNTS} FROM visits WHERE ip = ? GROUP BY city, region, country ORDER BY views DESC`),
	]);
	const total = totals[0] ?? {};
	return {
		ip,
		totals: {
			views: total.views ?? 0,
			visits: total.visits ?? 0,
			rows: total.rows ?? 0,
			days: total.days ?? 0,
			imported: total.imported ?? 0,
			first: total.first ?? null,
			last: total.last ?? null,
		},
		paths,
		places,
	};
}

// ── Paged raw history (recent table + per-IP panel) ─────────────────────────

export const PAGE_SIZES = [25, 50, 100, 200];
export const DEFAULT_PAGE_SIZE = 50;

export function pageParams(searchParams) {
	const size = Number(searchParams.get("size") ?? DEFAULT_PAGE_SIZE);
	const page = Number(searchParams.get("page") ?? 1);
	if (!PAGE_SIZES.includes(size) || !Number.isInteger(page) || page < 1 || page > 1_000_000) return null;
	return { size, page };
}

// Newest first. `since` filters by time (recent table); `ip` filters by address (panel).
export async function historyPage(db, { since = 0, ip = null, page = 1, size = DEFAULT_PAGE_SIZE }) {
	const where = ip ? "ip = ? AND ts >= ?" : "ts >= ?";
	const binds = ip ? [ip, since] : [since];
	const [{ rows: total = 0 } = {}] =
		(await db.prepare(`SELECT COUNT(*) AS rows FROM visits WHERE ${where}`).bind(...binds).all()).results ?? [];
	const pages = Math.max(1, Math.ceil(total / size));
	const current = Math.min(page, pages);
	const rows =
		(
			await db
				.prepare(
					`SELECT ts, ip, path, entry, referrer, city, region, country, colo, source, weight FROM visits WHERE ${where} ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?`,
				)
				.bind(...binds, size, (current - 1) * size)
				.all()
		).results ?? [];
	return { rows, total, page: current, pages, size };
}
