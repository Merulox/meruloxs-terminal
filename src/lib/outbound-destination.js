// Shared by the browser and edge: retain only an external HTTP(S) origin + path.
export function outboundDestination(value) {
	if (typeof value !== "string" || value.length > 4096) return null;
	try {
		const url = new URL(value);
		if (url.protocol !== "https:" && url.protocol !== "http:") return null;
		const host = url.hostname.toLowerCase().replace(/\.$/, "");
		if (host === "merulox.com" || host.endsWith(".merulox.com")) return null;
		url.username = "";
		url.password = "";
		url.search = "";
		url.hash = "";
		const destination = url.href;
		return destination.length <= 600 ? destination : null;
	} catch {
		return null;
	}
}
