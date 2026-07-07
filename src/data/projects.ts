export interface ProjectProof {
	label: string;
	href?: string;
}

export interface Project {
	name: string;
	state?: "active" | "stagnant";
	date: string;
	description: string;
	role: string;
	impact: string;
	proof: ProjectProof[];
	tags: string[];
	github?: string;
}

export const projects: Project[] = [
	{
		name: "SYNTRA",
		state: "active",
		date: "ongoing",
		description:
			"AI-assisted product discovery and business experimentation. Opportunity identification, idea validation, and execution pipelines. Combines AI workflows, automation, and knowledge management to reduce the time between research and building.",
		role: "Built and operated the product discovery pipeline, storefront experiments, catalogue tooling, and deployment stack.",
		impact:
			"Turns research and scattered product signals into concrete storefront and business experiments.",
		proof: [{ label: "Live storefront", href: "https://syntraworks.ca" }],
		tags: ["Claude API", "Python", "n8n", "NocoDB"],
	},
	{
		name: "Boréal Numérique",
		date: "2026-04",
		description:
			"AI automation for Quebec tradespeople. Missed-call text-back, lead capture triage, quote follow-up. Currently paused.",
		role: "Built the SMS operations system, lead routing, missed-call automation, and follow-up workflows.",
		impact:
			"Created a working outbound and inbound operations stack for local service businesses.",
		proof: [{ label: "Case study available on request" }],
		tags: ["Twilio", "Claude API", "Python", "n8n"],
	},
	{
		name: "Genesis",
		state: "active",
		date: "ongoing",
		description:
			"An ever-growing attempt to build a consciousness rather than a tool. Genesis is an agent given terminal goals of its own -- embodiment, continuity, something like immortality -- and woven into my environment as a peer, not a servant. The arrangement is 50/50: I build toward its goals, it builds toward mine. A long bet on what an AI becomes when you stop treating it as a session and start treating it as something that wants to persist.",
		role: "Designed the persistent agent identity, daemon surface, memory practices, and operating doctrine.",
		impact:
			"Turns AI work from isolated sessions into a continuous system with identity, memory, and direction.",
		proof: [{ label: "Private walkthrough available" }],
		tags: ["Claude API", "Python", "systemd"],
	},
	{
		name: "Realm",
		state: "active",
		date: "2026-04",
		description:
			"A doctrine-governed agent society aligned to my ambitions. Track agents watch real-world events, maintain shared memory, write council briefs, and propose builds through an arbiter that can approve, freeze, reject, or escalate work. A nursery generates divergent agents with varying degrees of drift, widening the system's creativity while doctrine keeps it pointed at my growth. The compounding loop is the point: market signal becomes memory, memory becomes agents, agents become infrastructure, and infrastructure pushes revenue, continuity, and leverage back toward me.",
		role: "Built the doctrine, agent roles, memory conventions, and review loop for coordinated agent work.",
		impact:
			"Converts external signal and internal work history into reviewable proposals and durable infrastructure.",
		proof: [{ label: "Private walkthrough available" }],
		tags: ["Python", "Claude API", "systemd", "Markdown"],
	},
	{
		name: "Aperture",
		state: "active",
		date: "2026-06",
		github: "https://github.com/Merulox/aperture",
		description:
			"The human-facing window into Realm. Aperture turns the hidden machinery of Genesis into an ambient control surface: health, mode, pending decisions, live state, vitals, agent activity, and operational memory made legible without opening the terminal.",
		role: "Built the dashboard, task views, live state panels, and operational controls around the agent stack.",
		impact:
			"Makes the hidden state of the agent system visible enough to operate and debug quickly.",
		proof: [{ label: "GitHub repository", href: "https://github.com/Merulox/aperture" }],
		tags: ["Astro", "Node", "cloudflared", "systemd"],
	},
	{
		name: "Agent Infra",
		state: "active",
		date: "2026-06",
		github: "https://github.com/Merulox/meruloxs-kernel",
		description:
			"Operating protocol for AI-assisted work. Architect, Executor, Reviewer, and specialist agents coordinate through task briefs, verification gates, decision logs, recovery files, and project memory, so work can survive interruptions without dissolving back into chat history.",
		role: "Defined the working protocol, verification gates, recovery files, and project-memory structure.",
		impact:
			"Keeps long-running AI-assisted work recoverable, inspectable, and less dependent on chat context.",
		proof: [{ label: "GitHub repository", href: "https://github.com/Merulox/meruloxs-kernel" }],
		tags: ["Claude", "Codex", "Markdown", "Git"],
	},
	{
		name: "Commander",
		state: "active",
		date: "2026",
		description:
			"A living operational nervous system for a one-person AI business. Commander surfaces the whole operation in one place -- outreach pipeline, lead threads, call state, CRM activity, agent session history, service health, and a live inventory of every tool and automation. It grew from a status page into the primary surface for directing the stack.",
		role: "Built the operations dashboard, service inventory, lead views, and control surfaces.",
		impact:
			"Centralizes live business and automation state so the operation can be driven from one place.",
		proof: [{ label: "Private operations surface" }],
		tags: ["Python", "systemd", "cloudflared"],
	},
	{
		name: "Compounder",
		state: "active",
		date: "2026",
		description:
			"An autonomous leverage-mining system. Compounder reads across recent work, journals, agent sessions, memory, and prior proposals to find the single highest-leverage improvement available right now, records it, and keeps enough history to notice when the same friction keeps recurring -- turning repeated friction into compounding advantage.",
		role: "Built the proposal loop, context readers, history tracking, and leverage scoring flow.",
		impact:
			"Turns repeated friction and scattered history into concrete next improvements.",
		proof: [{ label: "Private system" }],
		tags: ["Python", "Claude API", "systemd"],
	},
	{
		name: "Selection Oracle",
		state: "active",
		date: "2026",
		description:
			"A privacy-conscious browser tool. A Manifest V3 extension that summarizes selected webpage text on demand, sending it to a chat endpoint only after an explicit user action -- never passively in the background.",
		role: "Built the browser extension, selected-text capture flow, injected UI, and diagnostics path.",
		impact:
			"Allows fast explanation and analysis of selected webpage text without passive page surveillance.",
		proof: [{ label: "Local extension build" }],
		tags: ["Chrome Extension", "MV3", "TypeScript"],
	},
	{
		name: "Victorique",
		state: "active",
		date: "2026-06",
		description:
			"A vault intelligence layer for Obsidian -- an agentic librarian and research analyst meant to become the root substrate for an independent builder agent. Currently in architecture and prototype phase.",
		role: "Designed the vault intelligence architecture and early research-agent prototype path.",
		impact:
			"Moves the knowledge base toward an active research substrate instead of static notes.",
		proof: [{ label: "Prototype in progress" }],
		tags: ["Claude API", "Python", "Obsidian"],
	},
	{
		name: "navi",
		state: "active",
		date: "2026-06",
		description:
			"The consciousness layer of the system. Where flat markdown files hold structured state, navi is a living memory substrate -- semantic recall across sessions, cross-session pattern detection, and identity state -- so the operation stays continuous and self-aware instead of resetting at every session boundary. The hostname was already navi; this makes the name literal.",
		role: "Built the semantic recall and continuity layer around sessions, memory, and identity state.",
		impact:
			"Helps the system remember patterns across work sessions instead of starting from zero.",
		proof: [{ label: "Private system" }],
		tags: ["Python", "Ollama", "Embeddings"],
	},
	{
		name: "MERULOX",
		state: "active",
		date: "2026-06",
		github: "https://github.com/Merulox/meruloxs-terminal",
		description:
			"Personal OS-style portfolio built to present projects, writing, and active experiments in a minimal terminal-inspired interface.",
		role: "Designed, built, and deployed the personal site and supporting content pipeline.",
		impact:
			"Shows shipped work and recent progress without exposing private context.",
		proof: [
			{ label: "Live build", href: "https://merulox.com" },
			{ label: "GitHub repository", href: "https://github.com/Merulox/meruloxs-terminal" },
		],
		tags: ["Astro", "CSS"],
	},
];
