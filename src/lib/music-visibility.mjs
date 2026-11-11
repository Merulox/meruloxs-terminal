// Dev-only control for the public music switch. The page itself always renders on dev;
// this only reads/writes the flag that gates merulox.com/music.
export function initMusicVisibility({ controls, button, status, isDev, signal, fetchImpl = fetch, pollMs = 30_000 }) {
	let enabled = null;
	let busy = false;
	let revision = 0;
	controls.hidden = !isDev;
	if (!isDev) return { refresh: async () => {}, toggle: async () => {} };
	button.disabled = true;

	function render(error = "") {
		button.disabled = busy || enabled === null;
		button.textContent = enabled ? "Disable music on public site" : "Enable music on public site";
		button.setAttribute("aria-pressed", String(enabled === true));
		status.textContent = error || (enabled === null ? "Checking public visibility…" : `Public music page: ${enabled ? "enabled" : "disabled (404 + nav entry removed)"}. Stays visible here.`);
	}
	async function request(method, value) {
		const response = await fetchImpl("/api/music", {
			method, cache: "no-store", credentials: "same-origin", signal,
			...(method === "PATCH" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: value }) } : {}),
		});
		if (!response.ok) throw new Error("Music setting request failed");
		const data = await response.json();
		if (typeof data.enabled !== "boolean") throw new Error("Invalid music setting");
		return data.enabled;
	}
	async function refresh() {
		if (signal.aborted || busy) return;
		const ticket = ++revision;
		try {
			const value = await request("GET");
			if (signal.aborted || ticket !== revision) return;
			enabled = value;
			render();
		} catch {
			if (signal.aborted || ticket !== revision) return;
			render("Could not load public visibility. Retrying automatically.");
		}
	}
	async function toggle() {
		if (signal.aborted || busy || enabled === null) return;
		busy = true;
		const ticket = ++revision;
		render();
		let error = "";
		try {
			const value = await request("PATCH", !enabled);
			if (signal.aborted || ticket !== revision) return;
			enabled = value;
		} catch {
			if (signal.aborted) return;
			error = "Could not save public visibility. Try again.";
		} finally {
			busy = false;
			if (!signal.aborted && ticket === revision) render(error);
		}
	}
	render();
	button.addEventListener("click", () => { void toggle(); }, { signal });
	const timer = pollMs > 0 ? setInterval(() => { void refresh(); }, pollMs) : null;
	signal.addEventListener("abort", () => clearInterval(timer), { once: true });
	void refresh();
	return { refresh, toggle };
}
