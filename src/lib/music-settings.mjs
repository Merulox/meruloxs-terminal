// Dev-only controls for the public music config. The page and every section always render
// on dev; these controls only read/write what merulox.com serves.
const SECTION_LABELS = { recent: "recently played", artists: "top artists", albums: "top albums", tracks: "top tracks" };

export function initMusicSettings({ controls, pageButton, modeSelect, status, sectionButtons = {}, isDev, signal, fetchImpl = fetch, pollMs = 30_000 }) {
	controls.hidden = !isDev;
	for (const button of Object.values(sectionButtons)) button.hidden = !isDev;
	if (!isDev) return { refresh: async () => {}, patch: async () => {} };

	let config = null;
	let busy = false;
	let revision = 0;
	pageButton.disabled = true;
	modeSelect.disabled = true;
	for (const button of Object.values(sectionButtons)) button.disabled = true;

	function render(error = "") {
		const locked = busy || config === null;
		pageButton.disabled = locked;
		modeSelect.disabled = locked;
		if (config) {
			pageButton.textContent = config.page.enabled ? "Disable whole page on public site" : "Enable whole page on public site";
			pageButton.setAttribute("aria-pressed", String(config.page.enabled));
			modeSelect.value = config.page.whenDisabled;
		}
		for (const [key, button] of Object.entries(sectionButtons)) {
			button.disabled = locked;
			const on = config ? config.sections[key] : true;
			button.textContent = on ? "Disable on public site" : "Enable on public site";
			button.setAttribute("aria-pressed", String(on));
			button.setAttribute("aria-label", `${on ? "Disable" : "Enable"} ${SECTION_LABELS[key] ?? key} on public site`);
		}
		if (error) status.textContent = error;
		else if (!config) status.textContent = "Checking public visibility…";
		else {
			const off = Object.keys(sectionButtons).filter((key) => !config.sections[key]).map((key) => SECTION_LABELS[key] ?? key);
			const page = config.page.enabled ? "page enabled" : `page disabled (${config.page.whenDisabled === "notice" ? "tab shows “currently disabled”" : "tab hidden"})`;
			status.textContent = `Public: ${page}${off.length ? `; sections off: ${off.join(", ")}` : ""}. Everything stays visible here.`;
		}
	}
	async function request(method, body) {
		const response = await fetchImpl("/api/music", {
			method, cache: "no-store", credentials: "same-origin", signal,
			...(method === "PATCH" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
		});
		if (!response.ok) throw new Error("Music setting request failed");
		const data = await response.json();
		if (typeof data?.page?.enabled !== "boolean" || typeof data?.sections !== "object") throw new Error("Invalid music setting");
		return data;
	}
	async function refresh() {
		if (signal.aborted || busy) return;
		const ticket = ++revision;
		try {
			const value = await request("GET");
			if (signal.aborted || ticket !== revision) return;
			config = value;
			render();
		} catch {
			if (signal.aborted || ticket !== revision) return;
			render("Could not load public visibility. Retrying automatically.");
		}
	}
	async function patch(body) {
		if (signal.aborted || busy || config === null) return;
		busy = true;
		const ticket = ++revision;
		render();
		let error = "";
		try {
			const value = await request("PATCH", body);
			if (signal.aborted || ticket !== revision) return;
			config = value;
		} catch {
			if (signal.aborted) return;
			error = "Could not save public visibility. Try again.";
		} finally {
			busy = false;
			if (!signal.aborted && ticket === revision) render(error);
		}
	}
	render();
	pageButton.addEventListener("click", () => { if (config) void patch({ page: { enabled: !config.page.enabled } }); }, { signal });
	modeSelect.addEventListener("change", () => { void patch({ page: { whenDisabled: modeSelect.value } }); }, { signal });
	for (const [key, button] of Object.entries(sectionButtons)) {
		button.addEventListener("click", () => { if (config) void patch({ sections: { [key]: !config.sections[key] } }); }, { signal });
	}
	const timer = pollMs > 0 ? setInterval(() => { void refresh(); }, pollMs) : null;
	signal.addEventListener("abort", () => clearInterval(timer), { once: true });
	void refresh();
	return { refresh, patch };
}
