import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { onRequest as camerasGate } from "../functions/cameras/_middleware.js";

const catalog = JSON.parse(readFileSync(new URL("../src/data/cameras.json", import.meta.url), "utf8"));
const pageSource = readFileSync(new URL("../src/pages/cameras.astro", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../src/scripts/visits-client.ts", import.meta.url), "utf8");
const packageManifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const DATASET_URL = "https://open.canada.ca/data/dataset/d2f1dce5-35c5-4bb5-a54c-3b8ec9ac9de9";
const SOURCE_ID = "quebec-mtmd-traffic-cameras";

function gateContext(url) {
	return { request: new Request(url), next: async () => new Response("camera page") };
}

function allKeys(value, keys = []) {
	if (!value || typeof value !== "object") return keys;
	for (const [key, child] of Object.entries(value)) {
		keys.push(key);
		allKeys(child, keys);
	}
	return keys;
}

test("/cameras is statically available only on dev.merulox.com", async () => {
	for (const url of [
		"https://merulox.com/cameras",
		"https://www.merulox.com/cameras/",
		"https://preview.merulox.pages.dev/cameras",
		"http://localhost:4321/cameras",
	]) {
		const response = await camerasGate(gateContext(url));
		assert.equal(response.status, 404, url);
		assert.equal(response.headers.get("cache-control"), "no-store", url);
		assert.equal(await response.text(), "Not Found", url);
	}
	assert.equal(await (await camerasGate(gateContext("https://dev.merulox.com/cameras"))).text(), "camera page");
});

test("catalog has exactly one approved official source with explicit public-use policy", () => {
	assert.equal(catalog.schemaVersion, 1);
	assert.deepEqual(catalog.sourcePolicy.approvedSources.map((source) => source.id), [SOURCE_ID]);
	const source = catalog.sourcePolicy.approvedSources[0];
	assert.equal(source.publisherName, "Government of Québec");
	assert.match(source.agencyName, /Ministère des Transports et de la Mobilité durable \(MTMD\)/);
	assert.equal(source.datasetUrl, DATASET_URL);
	assert.match(source.licenseName, /CC BY 4\.0 Québec/);
	assert.equal(source.licenseUrl, "https://www.donneesquebec.ca/licence/#cc-by");
	assert.equal(source.ingestionMethod, "official_wfs");
	assert.equal(source.intentionalPublicConfidence, "high");
	assert.match(source.sourceFileSha256, /^[a-f0-9]{64}$/);
	assert.equal(catalog.sourcePolicy.embeddingAllowed, false);
	assert.equal(catalog.sourcePolicy.embeddingUsed, false);
	assert.equal(catalog.sourcePolicy.proxyingUsed, false);
	assert.equal(catalog.sourcePolicy.scrapingUsed, false);
	assert.equal(catalog.sourcePolicy.streamExtractionUsed, false);
	assert.equal(catalog.sourcePolicy.healthProbingUsed, false);
	assert.match(catalog.sourcePolicy.note, /does not embed, proxy, scrape, extract streams, or claim feed health/i);
});

test("all usable source listings are canonical public camera metadata", () => {
	assert.equal(catalog.catalog.jurisdiction, "Québec, Canada");
	assert.equal(catalog.catalog.scope, "pilot");
	assert.equal(catalog.catalog.sourceListingCount, 680);
	assert.equal(catalog.catalog.globalCatalog, false);
	assert.match(catalog.catalog.note, /not a global catalog yet/i);
	assert.equal(catalog.cameras.length, 680);
	assert.ok(catalog.cameras.length >= 100, "fixture must be large enough to exercise clustering");

	const ids = new Set();
	const sourceCameraIds = new Set();
	const allowedKeys = [
		"coordinates",
		"feedType",
		"id",
		"lastVerified",
		"name",
		"region",
		"route",
		"sourceCameraId",
		"sourceId",
		"sourcePageUrl",
		"status",
	].sort();

	for (const camera of catalog.cameras) {
		assert.deepEqual(Object.keys(camera).sort(), allowedKeys, camera.id);
		assert.match(camera.id, /^qc-mtmd-\d+$/, camera.id);
		assert.equal(camera.id, `qc-mtmd-${camera.sourceCameraId}`, camera.id);
		assert.equal(camera.sourceId, SOURCE_ID, camera.id);
		assert.match(camera.sourceCameraId, /^\d+$/, camera.id);
		assert.ok(camera.name.trim().length > 0, camera.id);
		assert.ok(camera.region.trim().length > 0, camera.id);
		assert.match(camera.route, /^\d+$/, camera.id);
		assert.equal(camera.coordinates.length, 2, camera.id);
		const [longitude, latitude] = camera.coordinates;
		assert.ok(Number.isFinite(longitude) && longitude >= -80 && longitude <= -57, camera.id);
		assert.ok(Number.isFinite(latitude) && latitude >= 44 && latitude <= 63, camera.id);
		const sourcePage = new URL(camera.sourcePageUrl);
		assert.equal(sourcePage.protocol, "https:", camera.id);
		assert.equal(sourcePage.hostname, "www.quebec511.info", camera.id);
		assert.equal(sourcePage.pathname, "/Carte/Fenetres/FenetreVideo.html", camera.id);
		assert.equal(sourcePage.searchParams.get("id"), camera.sourceCameraId, camera.id);
		assert.equal(camera.feedType, "source_page", camera.id);
		assert.equal(camera.status, "unknown", camera.id);
		assert.equal(camera.lastVerified, "2026-10-06", camera.id);
		assert.equal(ids.has(camera.id), false, camera.id);
		assert.equal(sourceCameraIds.has(camera.sourceCameraId), false, camera.id);
		ids.add(camera.id);
		sourceCameraIds.add(camera.sourceCameraId);
	}
});

test("camera records expose no raw stream or credential-bearing fields", () => {
	const forbiddenKey = /(?:^|_)(?:raw|stream|flux|embed|iframe|hls|m3u8|rtsp|token|secret|password|credential|authorization|cookie|username)(?:$|_)/i;
	for (const camera of catalog.cameras) {
		for (const key of allKeys(camera, [])) assert.doesNotMatch(key, forbiddenKey, `${camera.id}.${key}`);
		const serialized = JSON.stringify(camera);
		assert.doesNotMatch(serialized, /(?:m3u8|rtsp:\/\/|authorization:|bearer\s|password=|token=)/i, camera.id);
	}
});

test("map uses MapLibre clustering, link-out viewing, honest state, and URL controls", () => {
	assert.match(packageManifest.dependencies["maplibre-gl"], /^\^5\./);
	assert.match(pageSource, /tiles\.openfreemap\.org\/styles\/liberty/);
	assert.match(pageSource, /cluster:\s*true/);
	assert.match(pageSource, /getClusterExpansionZoom/);
	assert.match(pageSource, /target="_blank" rel="noopener noreferrer"/);
	assert.match(pageSource, /Embedding is not permitted or used/);
	assert.match(pageSource, /not probed/i);
	for (const key of ["lat", "lon", "z", "camera", "q", "region"]) {
		assert.match(pageSource, new RegExp(`(?:get|set)\\(\\"${key}\\"`), key);
	}
	for (const feature of ["Explore random", "Fit results", "Nearby cameras", "prefers-reduced-motion", "popstate", 'event.key !== "Escape"']) {
		assert.ok(pageSource.includes(feature), feature);
	}
});

test("dev nav injects cameras next to visits without changing production tracking branch", () => {
	const visitsIndex = clientSource.indexOf('{ href: "/visits", label: "visits" }');
	const camerasIndex = clientSource.indexOf('{ href: "/cameras", label: "cameras" }');
	assert.ok(visitsIndex >= 0);
	assert.ok(camerasIndex > visitsIndex);
	assert.ok(camerasIndex - visitsIndex < 100, "dev tabs should remain adjacent");
	assert.match(clientSource, /if \(location\.hostname === DEV_HOST\) addDevTabs\(\);\s*else if \(TRACKED_HOSTS\.includes\(location\.hostname\)\)/);
	assert.match(clientSource, /const TRACKED_HOSTS = \["merulox\.com", "www\.merulox\.com"\];/);
	assert.match(pageSource, /href="\/visits">visits<\/a>[\s\S]{0,120}href="\/cameras" aria-current="page">cameras<\/a>/);
});
