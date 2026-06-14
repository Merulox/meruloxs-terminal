export interface ProjectProof {
	label: string;
	href?: string;
}

export interface Project {
	name: string;
	state: "active";
	date: string;
	description: string;
	role: string;
	impact: string;
	proof: ProjectProof[];
	tags: string[];
}

export const projects: Project[] = [
	{
		name: "Boréal Numérique",
		state: "active",
		date: "2026-04",
		description:
			"Active SMS operations system for Quebec tradespeople: send gateway with STOP handling, cooldowns and deduplication, lead classification, hot-lead routing, and canonical follow-up workflows.",
		role: "End-to-end build and operation using Python services, Twilio, and Claude API.",
		impact: "1000+ SMS sent through the system.",
		proof: [{ label: "Case study available on request" }],
		tags: ["Python", "systemd", "Twilio", "Claude API"],
	},
	{
		name: "SYNTRA",
		state: "active",
		date: "ongoing",
		description:
			"Curated everyday-carry retailer with roughly 1,750 products across brands including Bellroy, Orbitkey, Secrid, and Peak Design.",
		role: "Built the affiliate storefront, product catalogue pipeline, React SPA with static generation, and deployment stack.",
		impact:
			"Makes a broad catalogue of practical carry goods searchable and browsable in one focused storefront.",
		proof: [{ label: "Live storefront", href: "https://syntraworks.ca" }],
		tags: ["React", "SSG", "Supabase", "Railway", "Cloudflare"],
	},
	{
		name: "Personal AI Infrastructure",
		state: "active",
		date: "ongoing",
		description:
			"Persistent multi-agent infrastructure for research, shared memory, and coordinated execution, supported by an architect/executor/reviewer methodology and the Aperture operations dashboard.",
		role: "Sole architect and operator. Built the services, agent-infra working protocol, verification gates, and operational control surface.",
		impact:
			"Turns fragmented research and work sessions into durable, recoverable system memory and reviewable execution.",
		proof: [{ label: "Private walkthrough available" }],
		tags: ["Claude API", "Codex", "Python", "systemd", "Astro"],
	},
	{
		name: "MERULOX",
		state: "active",
		date: "2026-06",
		description:
			"Personal portfolio and auto-updating log/feed pipeline. Static Astro site, keyboard-navigable, deployed on Cloudflare Pages with serverless feed proxies.",
		role: "Designed, built, and deployed.",
		impact:
			"Shows shipped work and recent progress without exposing private context.",
		proof: [{ label: "Live build", href: "https://merulox.com" }],
		tags: ["Astro", "TypeScript", "CSS", "Cloudflare"],
	},
];
