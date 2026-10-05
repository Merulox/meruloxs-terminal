// GET /api/visits?range=30d — aggregated visit data for the dev.merulox.com
// visits tab. GET /api/visits?ip=1.2.3.4 — one IP's history plus network
// enrichment (reverse DNS; ASN/org from ipinfo.io only with &ipinfo=1). Dev host only, after the
// root middleware's Basic auth.
import { DEV_HOST, ipDetail, normalizeIp, rangeStart, reverseName, summarize } from "../../src/lib/visits.js";

const json = (body, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
	});

async function fetchJson(url, init = {}) {
	try {
		const response = await fetch(url, {
			...init,
			signal: AbortSignal.timeout(4000),
			cf: { cacheTtl: 86400, cacheEverything: true },
		});
		return response.ok ? await response.json() : null;
	} catch {
		return null;
	}
}

// Best-effort enrichment; a failed lookup just leaves the field empty.
// Reverse DNS goes through Cloudflare's resolver (already sees every visitor IP).
// ipinfo.io is a third party, so it is only queried when the panel asks for it.
export async function enrichIp(ip, { ipinfo = false, fetcher = fetchJson } = {}) {
	const name = reverseName(ip);
	const [dns, info] = await Promise.all([
		name
			? fetcher(`https://cloudflare-dns.com/dns-query?name=${name}&type=PTR`, { headers: { Accept: "application/dns-json" } })
			: null,
		ipinfo ? fetcher(`https://ipinfo.io/${ip}/json`) : null,
	]);
	const ptr = (dns?.Answer ?? []).filter((a) => a.type === 12).map((a) => a.data.replace(/\.$/, ""));
	const org = typeof info?.org === "string" ? info.org : null;
	const asn = org?.match(/^AS\d+/)?.[0] ?? null;
	return {
		ipinfo: ipinfo ? (info ? "ok" : "unavailable") : "not queried",
		reverseDns: ptr,
		asn,
		org: asn ? org.slice(asn.length).trim() : org,
		hostname: info?.hostname ?? null,
		city: info?.city ?? null,
		region: info?.region ?? null,
		country: info?.country ?? null,
		postal: info?.postal ?? null,
		timezone: info?.timezone ?? null,
		loc: info?.loc ?? null,
		anycast: info?.anycast === true,
		bogon: info?.bogon === true,
	};
}

export async function onRequestGet(context) {
	const { request, env, data } = context;
	const url = new URL(request.url);
	if (url.hostname !== DEV_HOST) return json({ error: "not found" }, 404);

	// Returns visitor IPs: Basic-auth dev sessions only (not the ingest bearer token).
	if (data?.devAuthenticated !== true) return json({ error: "unauthorized" }, 401);
	if (!env.VISITS_DB) return json({ error: "VISITS_DB binding missing" }, 503);

	if (url.searchParams.has("ip")) {
		const ip = normalizeIp(url.searchParams.get("ip"));
		if (!ip) return json({ error: "invalid ip" }, 400);
		const ipinfo = url.searchParams.get("ipinfo") === "1";
		const [detail, network] = await Promise.all([ipDetail(env.VISITS_DB, ip), enrichIp(ip, { ipinfo })]);
		return json({ ...detail, network });
	}

	const range = url.searchParams.get("range") ?? "30d";
	const since = rangeStart(range);
	if (since === null) return json({ error: "invalid range" }, 400);

	return json({ range, since, generatedAt: Math.floor(Date.now() / 1000), ...(await summarize(env.VISITS_DB, since)) });
}
