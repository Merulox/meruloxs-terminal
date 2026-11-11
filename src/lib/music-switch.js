export const MUSIC_KEY = "music_enabled";

// Public-site switch for the music page and its nav entries. Commander/dev writes
// SITE_CONTROL["music_enabled"] = "0" | "1". Fails open: a missing binding, missing key,
// unexpected value, or KV error keeps music public. dev.merulox.com ignores the switch.
export async function publicMusicEnabled(env) {
	if (!env?.SITE_CONTROL) return true;
	try {
		return (await env.SITE_CONTROL.get(MUSIC_KEY)) !== "0";
	} catch {
		return true;
	}
}

export function isMusicPath(pathname) {
	const path = String(pathname).toLowerCase();
	return path === "/music" || path === "/music.html" || path.startsWith("/music/");
}

export function notFound(request) {
	return new Response(request.method === "HEAD" ? null : "Not Found", {
		status: 404,
		headers: { "Content-Type": "text/plain;charset=UTF-8", "Cache-Control": "no-store" },
	});
}

// Remove the music nav entries from public HTML while the switch is off. Entries are removed
// server-side so keyboard navigation (position-based) never sees them.
export function stripMusicNav(response) {
	if (typeof HTMLRewriter === "undefined") return response;
	const remove = { element: (element) => element.remove() };
	return new HTMLRewriter()
		.on('a[href="/music"]', remove)
		.on('a[href="/music/"]', remove)
		.transform(response);
}
