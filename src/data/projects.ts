export type ArchiveStatus =
	| "active"
	| "paused"
	| "prototype"
	| "research"
	| "failed"
	| "archived";

export type SchemeDecision = "pursue" | "hold" | "drop";

export interface ProjectProof {
	label: string;
	href?: string;
}

export interface Project {
	name: string;
	state: ArchiveStatus;
	date: string;
	description: string;
	role: string;
	impact: string;
	proof: ProjectProof[];
	tags: string[];
	github?: string;
}

export interface SchemeHistoryEntry {
	date: string;
	attemptedModel: string;
	work: string;
	result: string;
	state: ArchiveStatus;
	proof: ProjectProof[];
}

export interface MoneyScheme {
	name: string;
	state: ArchiveStatus;
	date: string;
	description: string;
	currentState: string;
	decision: SchemeDecision;
	bottleneck: string;
	history: SchemeHistoryEntry[];
	tags: string[];
}

export const archiveProjects: Project[] = [
	{
		name: "Genesis",
		state: "active",
		date: "2026–now",
		description:
			"A persistent operator-facing agent with durable Telegram work intake, unresolved-work memory, voice interaction, and an isolated governed-runtime research track.",
		role: "Built the on-demand Telegram-to-OMP queue, return desk, voice path, identity practices, and bounded runtime experiments.",
		impact:
			"Turns isolated AI sessions into a recoverable working relationship while keeping consequential actions inspectable.",
		proof: [{ label: "On-demand bridge and voice runtime" }],
		tags: ["Python", "OMP", "Telegram", "Gemini Live", "SQLite"],
	},
	{
		name: "Realm",
		state: "active",
		date: "2026–now",
		description:
			"The cross-project state, evidence, event, and system-model substrate behind the agent stack. Earlier agent-society experiments now survive mainly as lessons; the current system is operational infrastructure.",
		role: "Built the manifest, system model, event ledger, hazard facts, dependency projections, and shared operating conventions.",
		impact:
			"Makes dependencies, runtime state, authority, and evidence visible across otherwise separate projects.",
		proof: [{ label: "Live generated system manifest" }],
		tags: ["Python", "SQLite", "GitNexus", "systemd", "Markdown"],
	},
	{
		name: "Aperture",
		state: "active",
		date: "2026–now",
		github: "https://github.com/Merulox/aperture",
		description:
			"A self-hosted visual observability and control surface for agents, workflows, system topology, and governed operational state.",
		role: "Built the City, workflow atlas, live state panels, project projections, and bounded action routes.",
		impact:
			"Makes the hidden machinery of the agent operation legible without opening a terminal.",
		proof: [
			{ label: "GitHub repository", href: "https://github.com/Merulox/aperture" },
			{ label: "Running private deployment" },
		],
		tags: ["Astro", "TypeScript", "Node", "systemd"],
	},
	{
		name: "Commander",
		state: "active",
		date: "2026–now",
		description:
			"An auth-gated operational cockpit for business pipelines, calls, services, agent workstreams, research evidence, and supervised actions.",
		role: "Built the dashboard, business workspaces, service inventory, action surfaces, and cross-project evidence views.",
		impact:
			"Centralizes live operational truth so a one-person operation can be directed from one place.",
		proof: [{ label: "Running private deployment" }],
		tags: ["Python", "SQLite", "systemd", "cloudflared"],
	},
	{
		name: "Kernel",
		state: "active",
		date: "2026–now",
		github: "https://github.com/Merulox/meruloxs-kernel",
		description:
			"A provider-neutral operating model for governing AI-assisted work through explicit authority, execution topology, evidence, review, and recovery contracts.",
		role: "Defined the working protocol, task contracts, verification gates, recovery files, and a risk-routed v2 candidate.",
		impact:
			"Keeps long-running agent work recoverable and inspectable instead of dissolving into chat history.",
		proof: [
			{ label: "GitHub repository", href: "https://github.com/Merulox/meruloxs-kernel" },
			{ label: "v2 remains pilot-gated" },
		],
		tags: ["Claude", "Codex", "OMP", "Markdown", "Git"],
	},
	{
		name: "Capital Map",
		state: "active",
		date: "2026–now",
		description:
			"A read-only Hyperliquid intelligence terminal that reconciles public market, wallet, ledger, cohort, and event evidence without pretending activity is predictive alpha.",
		role: "Built the ingestion worker, immutable market and wallet evidence, PostgreSQL data model, API, and terminal UI.",
		impact:
			"Turns fragmented public exchange data into auditable market and wallet intelligence.",
		proof: [{ label: "Running local API, worker, web app, and gateway" }],
		tags: ["Python", "FastAPI", "PostgreSQL", "Next.js", "WebSocket"],
	},
	{
		name: "The Trader",
		state: "research",
		date: "2026–now",
		description:
			"A governed quantitative-research laboratory that preregisters market hypotheses, records failures, and blocks live trading until conservative evidence gates pass.",
		role: "Built immutable datasets, experiment ledgers, simulation and cost models, paper runtimes, and sealed holdout gates.",
		impact:
			"Rejects attractive but fragile trading stories before they reach capital.",
		proof: [{ label: "Multiple real-data hypotheses closed without touching holdouts" }],
		tags: ["Python", "DuckDB", "Parquet", "SQLite", "Market data"],
	},
	{
		name: "Market Lab",
		state: "prototype",
		date: "2026–now",
		description:
			"An append-only registry for testing buyer, problem, and offer hypotheses through predeclared real-world commitment gates before substantial building.",
		role: "Built immutable niche-card, probe, evidence, evaluation, and operator-decision contracts.",
		impact:
			"Replaces idea scoring with comparable trials that can distinguish attention from willingness to pay.",
		proof: [{ label: "Three probes approved pending delivery and checkout smoke tests" }],
		tags: ["Python", "SQLite", "Experiment design", "Evidence"],
	},
	{
		name: "SYNTRA",
		state: "active",
		date: "2026–now",
		description:
			"A private commerce foundry that turns catalog and supplier evidence into editorial commerce and review-gated store hypotheses.",
		role: "Built catalog ingestion, product identity, supplier-policy evidence, an editorial storefront, and multi-store data structures.",
		impact:
			"Preserves product and supplier intelligence while preventing an unverified product idea from silently becoming a store.",
		proof: [{ label: "Live storefront", href: "https://syntraworks.ca" }],
		tags: ["TypeScript", "Supabase", "Commerce", "Product research"],
	},
	{
		name: "Boréal Numérique",
		state: "active",
		date: "2026–now",
		description:
			"A Quebec trades service stack combining missed-call recovery, lead follow-up, client onboarding, agreements, payments, and account-scoped reporting. Broad outbound automation is held while proof and conversion remain unresolved.",
		role: "Built the website, CRM, Twilio messaging, missed-call path, sales agents, contracts, payments, portal, and guided call workflow.",
		impact:
			"Creates a complete operating path from a missed lead to a governed client relationship, even though the commercial proof gate is not yet passed.",
		proof: [{ label: "Live service and client-delivery stack" }],
		tags: ["Python", "Twilio", "SQLite", "Stripe", "Cloudflare"],
	},
	{
		name: "Signaler",
		state: "paused",
		date: "2026–now",
		description:
			"A governed multi-brand content and distribution system that separates research, strategy, media generation, publishing attempts, and measured outcomes.",
		role: "Built account-scoped queues, immutable proposals, review and delivery receipts, strategy experiments, and X/YouTube adapters.",
		impact:
			"Provides a truthful base for testing owned-media businesses without counting generated drafts as distribution or revenue.",
		proof: [{ label: "Bounded X and private YouTube delivery canaries" }],
		tags: ["Python", "SQLite", "YouTube", "X", "Content systems"],
	},
	{
		name: "Agent Economy Experiment",
		state: "research",
		date: "2026–now",
		description:
			"Receipt-grounded experiments asking whether agents under scarce compute can choose work, produce exact artifacts, earn verified payouts, and preserve economic runway.",
		role: "Built isolated upstream and self-hosted harnesses, verifiers, cost ledgers, comparison runs, and a bounded SOL/USDC canary.",
		impact:
			"Separates working economic mechanics from unsupported claims about self-funding or recursive improvement.",
		proof: [{ label: "Synthetic economic receipts; no external revenue claim" }],
		tags: ["Python", "TypeScript", "Containers", "Solana", "Ollama"],
	},
	{
		name: "OBLITERATUS evaluation",
		state: "research",
		date: "2026",
		description:
			"A local evaluation and integration track around the upstream elder-plinius/OBLITERATUS open-source refusal-geometry toolkit.",
		role: "Ran local model transformations, preserved benchmark artifacts, and integrated a transformed model into the local OMP/Ollama stack.",
		impact:
			"Tests the practical capability and coherence trade-offs of weight-level model-behavior interventions without claiming authorship of the upstream toolkit.",
		proof: [{ label: "Local transformed models and benchmark artifacts" }],
		tags: ["Python", "PyTorch", "Transformers", "Gradio", "Mechanistic interpretability"],
	},
	{
		name: "Orbit",
		state: "paused",
		date: "2026–now",
		description:
			"A recurring-mission control plane that schedules bounded AI-assisted loops, records append-only run evidence, and escalates decisions to a human.",
		role: "Built the shared runtime, loop specs, state journals, locks, budgets, and Telegram decision prompts.",
		impact:
			"Turns recurring objectives into inspectable scheduled work, while exposing the failure modes of narrative-only autonomy.",
		proof: [{ label: "Runtime preserved; target re-architecture documented" }],
		tags: ["Python", "SQLite", "systemd", "Telegram"],
	},
	{
		name: "Compounder",
		state: "paused",
		date: "2026",
		description:
			"A private evidence-to-action loop that ranks a few operational improvements, asks for disposition, verifies closure, and promotes rules only after repeated outcomes.",
		role: "Built the evidence snapshot, ranking loop, Telegram feedback path, closure metrics, and two-verification learning rule.",
		impact:
			"Converts repeated operational friction into measurable improvements instead of an unbounded idea feed.",
		proof: [{ label: "Implemented internal system; scheduler currently stopped" }],
		tags: ["Python", "SQLite", "Claude", "Telegram"],
	},
	{
		name: "Victorique",
		state: "prototype",
		date: "2026–now",
		description:
			"A read-only Obsidian research assistant prototype that answers and analyzes against sampled vault notes with citations.",
		role: "Designed the vault-intelligence architecture and built the narrow Phase-0 Telegram prototype.",
		impact:
			"Tests whether a private knowledge base can become an active, cited research substrate.",
		proof: [{ label: "Read-only Telegram prototype" }],
		tags: ["Python", "Claude", "Obsidian", "Telegram"],
	},
	{
		name: "navi",
		state: "prototype",
		date: "2026",
		description:
			"A proposed local semantic-memory substrate for recalling decisions and patterns across AI work sessions. The architecture exists; the planned service and hooks do not yet.",
		role: "Researched and specified the local embedding, vector-store, recall, and session-hook architecture.",
		impact:
			"Defines a path toward cross-session recall without presenting design work as a finished memory system.",
		proof: [{ label: "Architecture complete; implementation not started" }],
		tags: ["Python", "Qdrant", "Ollama", "Embeddings"],
	},
	{
		name: "Canna Store",
		state: "prototype",
		date: "2026",
		description:
			"A local cannabis e-commerce scaffold with catalog, cart, order administration, and a testable Stripe Checkout boundary.",
		role: "Built the Next.js storefront, PostgreSQL data layer, admin pages, order flow, and mocked payment boundary.",
		impact:
			"Proved the ordinary commerce flow while making the unresolved regulatory and payment constraints explicit.",
		proof: [{ label: "Local build, tests, and database smoke flow" }],
		tags: ["Next.js", "TypeScript", "PostgreSQL", "Stripe"],
	},
	{
		name: "Selection Oracle",
		state: "active",
		date: "2026",
		description:
			"A privacy-conscious browser extension that summarizes selected webpage text only after an explicit user action.",
		role: "Built the Manifest V3 extension, selected-text capture flow, injected UI, and diagnostics path.",
		impact:
			"Provides fast explanation of selected text without passive page surveillance.",
		proof: [{ label: "Local extension build" }],
		tags: ["Chrome Extension", "Manifest V3", "JavaScript"],
	},
	{
		name: "Red Team Workflow",
		state: "paused",
		date: "2026",
		description:
			"A terminal-first, authorization-gated workflow for security labs built around scoped observation, reproducible evidence, remediation, and retesting.",
		role: "Built the command bus, engagement layout, scope boundary, evidence ledger, and learning map.",
		impact:
			"Makes security practice auditable while keeping activity inside explicit training or engagement scope.",
		proof: [{ label: "Dormant training toolkit" }],
		tags: ["Python", "Security labs", "Evidence", "CLI"],
	},
	{
		name: "Brain Monitor",
		state: "archived",
		date: "2026",
		description:
			"An archived terminal dashboard experiment combining live operational drill-down, an in-context agent, automatic component discovery, and detached build launching.",
		role: "Built the single-file TUI and later extracted its useful context-snapshot and evolution-diff ideas.",
		impact:
			"Produced reusable control-surface ideas and a clear lesson about tight coupling and single-file maintenance.",
		proof: [{ label: "Archived after path and architecture drift" }],
		tags: ["Python", "TUI", "Operations"],
	},
	{
		name: "MERULOX",
		state: "active",
		date: "2026–now",
		github: "https://github.com/Merulox/meruloxs-terminal",
		description:
			"A keyboard-friendly Astro portfolio and activity archive for projects, writing, reading, music, and selected public work evidence.",
		role: "Designed, built, and deployed the site and its supporting content pipelines.",
		impact:
			"Turns shipped work, failed bets, and ongoing experiments into a public operating record.",
		proof: [
			{ label: "Live site", href: "https://merulox.com" },
			{ label: "GitHub repository", href: "https://github.com/Merulox/meruloxs-terminal" },
		],
		tags: ["Astro", "TypeScript", "CSS", "Cloudflare Pages"],
	},
];

const employerProjectNames: Record<string, true> = {
	SYNTRA: true,
	"Boréal Numérique": true,
	Genesis: true,
	Realm: true,
	Aperture: true,
	Kernel: true,
	Commander: true,
	Compounder: true,
	"Selection Oracle": true,
	Victorique: true,
	navi: true,
	MERULOX: true,
};

export const projects = archiveProjects.filter(
	(project) => employerProjectNames[project.name] === true,
);

export const moneySchemes: MoneyScheme[] = [
	{
		name: "Permissioned short-form clipping",
		state: "research",
		date: "2026-08–now",
		description:
			"Use a licensed marketplace campaign as paid training, then move toward direct creator retainers or owned media only if the evidence supports it.",
		currentState:
			"This is the current non-Boréal revenue hypothesis, but no campaign, accepted clip, eligible view, or payout has been recorded.",
		decision: "pursue",
		bottleneck:
			"Campaign access and usage rights come first; the real test is whether accepted clips produce repeatable retention and an attributable payout above a chosen hourly floor.",
		history: [
			{
				date: "2026-08",
				attemptedModel:
					"One licensed campaign, one niche, seven days, and 12–15 clips; measure acceptance, views, retention, labor, and payout.",
				work:
					"Compared marketplace, retainer, and owned-media economics; reconciled campaign rules; defined creative cells and explicit go/stop conditions.",
				result:
					"Research found marketplace clipping useful for proof but weak as a terminal business at common $1–$2 per 1,000 eligible-view rates. The canary remains unlaunched.",
				state: "research",
				proof: [{ label: "Evidence-backed canary plan" }],
			},
		],
		tags: ["Content", "Marketplace", "Creator services", "Owned media"],
	},
	{
		name: "Quebec trades automation agency",
		state: "active",
		date: "2026-03–now",
		description:
			"Sell missed-call recovery, lead follow-up, onboarding, and operating support to Quebec trades businesses through setup fees and recurring service.",
		currentState:
			"The service and delivery stack exists. The current signal ledger records 536 outbound messages, six qualified replies, zero completed discovery calls, and zero signed clients.",
		decision: "pursue",
		bottleneck:
			"Trust, case-study proof, and reply-to-call conversion—not missing software or lead volume. Broad outbound scaling is held until that gate moves.",
		history: [
			{
				date: "2026-03",
				attemptedModel:
					"Start as a productized AI-automation service for tradespeople, then expand only after real installs prove measurable value.",
				work:
					"Built the offer, website, outreach and CRM stack, Twilio messaging, missed-call recovery, sales agents, and follow-up workflows.",
				result:
					"Outreach created replies but did not convert into a completed diagnostic call or paying client.",
				state: "failed",
				proof: [{ label: "CRM and signal-ledger outcomes" }],
			},
			{
				date: "2026-09",
				attemptedModel:
					"Close the delivery gap so a real client can move from agreement and payment through onboarding, portal access, and reporting.",
				work:
					"Added governed agreements, live-payment plumbing, onboarding, account-scoped portal views, weekly digests, and guided sales-call support.",
				result:
					"Delivery readiness improved substantially, but the commercial outcome remains unchanged: no signed-client receipt.",
				state: "active",
				proof: [{ label: "Implemented client-delivery stack" }],
			},
		],
		tags: ["Services", "Trades", "Twilio", "Recurring revenue"],
	},
	{
		name: "Capital Map intelligence desk",
		state: "active",
		date: "2026-08–now",
		description:
			"Package a working Hyperliquid market and wallet-intelligence system as a paid analyst tool, dataset, or bounded design-partner service.",
		currentState:
			"The local product is substantial and running; a paying design partner, price test, or subscription has not been recorded.",
		decision: "pursue",
		bottleneck:
			"A specific buyer must prove the system saves decision time or produces valuable evidence. More features cannot substitute for willingness to pay.",
		history: [
			{
				date: "2026-08",
				attemptedModel:
					"Build a historically correct observation layer before offering predictive claims or execution.",
				work:
					"Built real-time ingestion, immutable trades and episodes, wallet accounting, cohorts, events, backups, API, and terminal UI.",
				result:
					"The technical product works locally and exposes its own data-quality blockers; it has not yet demonstrated commercial demand.",
				state: "active",
				proof: [{ label: "Running local product" }],
			},
			{
				date: "2026-09",
				attemptedModel:
					"Sell a bounded intelligence-desk pilot before committing to product pricing or more engineering.",
				work:
					"Defined a design-partner pipeline and reframed the existing data substrate as a possible niche data service.",
				result:
					"No paid pilot or external customer outcome is present in the evidence reviewed.",
				state: "research",
				proof: [{ label: "Design-partner experiment defined" }],
			},
		],
		tags: ["Market intelligence", "Hyperliquid", "Data service", "B2B"],
	},
	{
		name: "SYNTRA commerce foundry",
		state: "active",
		date: "2026–now",
		description:
			"Use product and supplier intelligence to find an executable editorial-affiliate, dropshipping, or original-product opportunity.",
		currentState:
			"Catalog and storefront infrastructure exists, but no attributable affiliate transaction, qualified dropshipping offer, or store-level revenue is recorded.",
		decision: "hold",
		bottleneck:
			"Network-issued affiliate tracking, one fully qualified supplier offer, and a buyer/offer/distribution test. Catalog scale is not demand evidence.",
		history: [
			{
				date: "2026-04",
				attemptedModel:
					"Import and normalize exceptional products into a durable intelligence database that could later support commerce.",
				work:
					"Built an idempotent importer and clean 107-product Orbitkey catalog in NocoDB.",
				result:
					"The ingestion MVP worked, but it was explicitly not a storefront or revenue-generating business.",
				state: "prototype",
				proof: [{ label: "Clean catalog audit" }],
			},
			{
				date: "2026-08",
				attemptedModel:
					"Move from a catalog into an editorial affiliate surface and evidence-gated multi-store foundry.",
				work:
					"Built a curated storefront, explicit public-catalog boundary, supplier-policy registry, store models, and review-gated product council.",
				result:
					"The platform became more coherent, but the first attributable transaction and qualified supplier remain unproven.",
				state: "active",
				proof: [{ label: "Live storefront", href: "https://syntraworks.ca" }],
			},
		],
		tags: ["Affiliate", "Dropshipping", "Commerce", "Supplier research"],
	},
	{
		name: "Autonomous affiliate media network",
		state: "paused",
		date: "2026-07–now",
		description:
			"Operate several niche media identities, publish platform-native content, and monetize attention through affiliate offers or owned products.",
		currentState:
			"Publishing mechanics exist, one X lane and a private YouTube path were exercised, but there is no affiliate conversion or payout evidence and the scheduler is stopped.",
		decision: "hold",
		bottleneck:
			"Public profile readiness, media production, reliable exposure analytics, and an actual offer with attributable conversions. Generated drafts are not distribution.",
		history: [
			{
				date: "2026-07",
				attemptedModel:
					"Create four brands across five platforms and let a governed content pipeline publish and learn from outcomes.",
				work:
					"Built the account registry, proposal and review ledgers, bundled generation, scheduled cycle, and platform adapter contracts.",
				result:
					"Most channel ideas remained unlinked and several media-dependent lanes stayed staged.",
				state: "prototype",
				proof: [{ label: "Four-brand, twenty-lane internal matrix" }],
			},
			{
				date: "2026-08",
				attemptedModel:
					"Prove end-to-end publishing and then optimize only from fixed-window outcome evidence.",
				work:
					"Delivered an X post, captured outcome snapshots, and completed a private YouTube upload canary with durable receipts.",
				result:
					"Delivery was demonstrated; the X sample had no observed interactions and no usable exposure denominator. No monetization event followed.",
				state: "paused",
				proof: [{ label: "Delivery receipts and fixed-window snapshots" }],
			},
		],
		tags: ["Affiliate", "Owned media", "YouTube", "X", "Automation"],
	},
	{
		name: "Packaged n8n workflows on Gumroad",
		state: "archived",
		date: "2026-04–05",
		description:
			"Sell one-time workflow bundles for lead enrichment, follow-up, reporting, onboarding, review requests, and invoice extraction.",
		currentState:
			"A $49 lead-enrichment product was published with a buyer-ready bundle. The source of truth records zero sales and zero revenue; the project is archived.",
		decision: "drop",
		bottleneck:
			"Distribution and measurable exposure, plus setup friction and free competing templates. Packaging more products did not answer whether buyers would see or want them.",
		history: [
			{
				date: "2026-04",
				attemptedModel:
					"Productize already-built automations into $29–$59 downloads with near-zero fulfillment.",
				work:
					"Built the AI lead-enrichment scorer, setup guide, Google Sheet, listing copy, ZIP, and community distribution drafts; also packaged lead-follow-up and weekly-report workflows.",
				result:
					"The Gumroad listing went live, but no sale was recorded and distribution posts were staged rather than proven delivered.",
				state: "failed",
				proof: [
					{ label: "Archived revenue ledger: $0" },
					{ label: "Gumroad listing", href: "https://merultox.gumroad.com/l/znbdz" },
				],
			},
		],
		tags: ["Digital products", "n8n", "Gumroad", "Automation"],
	},
	{
		name: "Contractor missed-lead recovery kit",
		state: "research",
		date: "2026-09",
		description:
			"Test a CAD 49 manual recovery kit with 30 targeted Quebec contractor emails over 14 days and zero paid spend.",
		currentState:
			"The card and probe are approved, but no exposure may be recorded until outbound delivery and CAD checkout receipt capture pass smoke tests.",
		decision: "pursue",
		bottleneck:
			"The exposure and payment-receipt lane is not active, and the existing pain evidence does not establish urgency or willingness to pay.",
		history: [
			{
				date: "2026-09",
				attemptedModel:
					"Sell a finite missed-lead recovery kit before building more software.",
				work:
					"Froze the buyer, problem, offer, CAD 49 price, cohort, evidence ladder, lane, time window, and stop rules.",
				result:
					"Approved pending lane smoke; zero delivered exposures, checkout attempts, payments, or fulfillments so far.",
				state: "research",
				proof: [{ label: "Immutable Market Lab probe" }],
			},
		],
		tags: ["Market probe", "Trades", "CAD 49", "Manual outreach"],
	},
	{
		name: "Contractor estimate-follow-up kit",
		state: "research",
		date: "2026-09",
		description:
			"Test a CAD 49 finite estimate-follow-up process under the same controlled channel and sample as the missed-lead kit.",
		currentState:
			"The comparative probe is approved but has not produced an exposure, checkout attempt, payment, or fulfillment.",
		decision: "pursue",
		bottleneck:
			"Payment is unvalidated and follow-up cadence may not be the real problem; qualification, pricing, timing, or proposal quality could dominate.",
		history: [
			{
				date: "2026-09",
				attemptedModel:
					"Hold buyer, price, and channel stable while changing the problem from missed leads to unsold estimates.",
				work:
					"Registered the frozen niche card and probe, with practitioner evidence and counterevidence preserved.",
				result:
					"Approved pending the shared lane smoke; no customer action has tested the hypothesis.",
				state: "research",
				proof: [{ label: "Immutable Market Lab probe" }],
			},
		],
		tags: ["Market probe", "Trades", "CAD 49", "Follow-up"],
	},
	{
		name: "Med-spa missed-inquiry recovery kit",
		state: "research",
		date: "2026-09",
		description:
			"Test the missed-inquiry recovery mechanism with Quebec med-spas while holding the price and outreach lane comparable.",
		currentState:
			"The probe is approved but unstarted; its pain evidence is weaker and more vendor-contaminated than the contractor cards.",
		decision: "pursue",
		bottleneck:
			"Weak source verifiability, healthcare privacy boundaries, and no proof that inquiry leakage—not demand or management—is the causal problem.",
		history: [
			{
				date: "2026-09",
				attemptedModel:
					"Change the buyer while keeping the recovery mechanism and CAD 49 test structure comparable.",
				work:
					"Froze the card, probe, evidence ladder, and qualitative pain record with explicit source limitations.",
				result:
					"Approved pending lane smoke; no exposure or financial commitment exists.",
				state: "research",
				proof: [{ label: "Immutable Market Lab probe" }],
			},
		],
		tags: ["Market probe", "Med-spa", "CAD 49", "Lead recovery"],
	},
	{
		name: "Quantitative trading strategies",
		state: "research",
		date: "2026-08–now",
		description:
			"Search for weak but reproducible market effects, and promote nothing until it survives costs, stability checks, sealed holdouts, and prospective paper trading.",
		currentState:
			"Several complete families were rejected without opening holdouts. New mechanisms may still be researched, but no live trading is authorized.",
		decision: "pursue",
		bottleneck:
			"No tested strategy has survived conservative economics and stability gates. The discipline is finding real edge—not rescuing failed backtests.",
		history: [
			{
				date: "2026-08-10",
				attemptedModel: "Five-day cross-sectional reversal across twelve liquid ETFs.",
				work:
					"Built a 75,444-row immutable dataset and ran seven validation folds with costs and controls.",
				result:
					"Rejected before holdout: mean net return was -3.297 bps/day and no fold was positive after costs.",
				state: "failed",
				proof: [{ label: "REJECT_BEFORE_HOLDOUT" }],
			},
			{
				date: "2026-08-10",
				attemptedModel: "Monthly 12/1/1 sector momentum across Select Sector SPDRs.",
				work:
					"Evaluated 161 monthly decisions across seven folds with SPY, equal-weight, stale, and random controls.",
				result:
					"Rejected before holdout: the confidence interval crossed zero, only three folds were positive, and the random control did better.",
				state: "failed",
				proof: [{ label: "REJECT_BEFORE_HOLDOUT" }],
			},
			{
				date: "2026-08-19",
				attemptedModel: "JUP, RAY, BONK, and JTO momentum from executable Jupiter quotes.",
				work:
					"Collected 1,008 prospective cycles and evaluated 875 opportunities with 99.975% quote coverage.",
				result:
					"Economically rejected: mean after-cost return was -116.86 bps and every fold was negative.",
				state: "failed",
				proof: [{ label: "REJECT_BEFORE_HOLDOUT" }],
			},
			{
				date: "2026-09-01",
				attemptedModel: "Monthly volatility-managed SPY exposure targeting 12% volatility.",
				work:
					"Evaluated 251 months over seven frozen folds with placebo and reverse-sign controls.",
				result:
					"Rejected economically: some crisis improvement did not survive pooled uncertainty and low-volatility bull regimes.",
				state: "failed",
				proof: [{ label: "REJECT_ECONOMIC" }],
			},
			{
				date: "2026-09-03",
				attemptedModel: "Inventory-skew market making on Hyperliquid BTC perpetuals.",
				work:
					"Ran a frozen 48-hour source canary with more than 25,000 L2 snapshots and 596,000 public trades.",
				result:
					"Rejected at the data gate because continuity, source gaps, and fill observability failed the preregistered thresholds; no P&L was computed.",
				state: "failed",
				proof: [{ label: "REJECT_DATA" }],
			},
		],
		tags: ["Quant", "ETFs", "Solana", "Hyperliquid", "Paper research"],
	},
	{
		name: "Polymarket complete-set arbitrage",
		state: "research",
		date: "2026-09",
		description:
			"Test whether buying every mutually exclusive outcome below its combined redemption value survives fees, depth, latency, partial fills, and settlement costs.",
		currentState:
			"The mechanism and shadow contracts were researched, but no candidate was registered and no prospective source canary started.",
		decision: "hold",
		bottleneck:
			"Account-profit reconciliation remains incomplete, public data cannot reveal private strategy or queue position, and a separate priority decision would be required.",
		history: [
			{
				date: "2026-09",
				attemptedModel:
					"Reconcile a viral wallet claim, then separate aggressive complete-set acquisition from passive two-leg market making.",
				work:
					"Archived immutable account evidence, compared conflicting official P&L surfaces, analyzed one complete market, and designed outcome-blind source and shadow contracts.",
				result:
					"The mechanism is valid in principle, but the wallet story did not reconcile and the sampled market lost about $28. No trading claim was promoted.",
				state: "research",
				proof: [{ label: "Immutable claim-reconciliation bundle" }],
			},
		],
		tags: ["Prediction markets", "Arbitrage", "Shadow research"],
	},
	{
		name: "Conway self-funding agent",
		state: "paused",
		date: "2026-08",
		description:
			"Run the exact upstream Automaton under survival pressure and observe whether it can create paid value, fund compute, and adapt.",
		currentState:
			"The isolated harness reached identity registration, but beta-credit access blocked the agent loop. No artifact or revenue was produced.",
		decision: "drop",
		bottleneck:
			"Closed beta and unavailable credit provisioning. The recorded decision is not to plan around the upstream API.",
		history: [
			{
				date: "2026-08",
				attemptedModel:
					"Give the pinned upstream runtime a wallet, bounded scenario capital, and an independently observed economic loop.",
				work:
					"Built hard isolation, created a wallet, registered the identity, entered the economic loop, and captured host-verifiable receipts.",
				result:
					"Inference failed before useful work because credits were unavailable and the minimum top-up exceeded the scenario budget.",
				state: "failed",
				proof: [{ label: "Blocked-before-agent-loop receipt" }],
			},
		],
		tags: ["Autonomous agents", "Economic survival", "Conway"],
	},
	{
		name: "Self-hosted agent economy",
		state: "research",
		date: "2026-08–now",
		description:
			"Let a self-hosted agent choose immutable jobs, pay measured inference costs, and receive verifier-controlled payouts for exact artifacts.",
		currentState:
			"The mechanics work in controlled experiments, but every payout so far is synthetic. The service and separate live capital canary are stopped.",
		decision: "hold",
		bottleneck:
			"A real external payer and receipt. Synthetic jobs prove accounting and behavior mechanics, not market value or sustainable income.",
		history: [
			{
				date: "2026-08",
				attemptedModel:
					"Replace unavailable upstream services with a host-owned substrate, cost ledger, job menu, and independent verifier.",
				work:
					"Built the fork, exact-artifact contracts, verifier, append-only cost/revenue ledger, survival tiers, and A/B runs.",
				result:
					"Agents completed exact synthetic jobs and earned test credits; local-model substitution was cheaper but failed the one paired job. None of this is external revenue.",
				state: "research",
				proof: [{ label: "Receipt-grounded synthetic canaries" }],
			},
		],
		tags: ["Autonomous agents", "Verification", "Synthetic economy", "Local models"],
	},
	{
		name: "Cannabis e-commerce storefront",
		state: "prototype",
		date: "2026-09",
		description:
			"Operate a regulated cannabis catalog and checkout with product administration and Stripe-hosted payments.",
		currentState:
			"The technical storefront works locally. There is no licensed live operation, compatible payment receipt, sale, or revenue evidence.",
		decision: "hold",
		bottleneck:
			"Licensing, real age and identity compliance, jurisdiction rules, fulfillment, and cannabis-compatible payment processing.",
		history: [
			{
				date: "2026-09",
				attemptedModel:
					"Build the ordinary commerce path first: catalog, cart, order state, administration, and checkout boundary.",
				work:
					"Implemented the Next.js storefront, Postgres migrations, admin views, Stripe session mapping, webhooks, tests, and local smoke flow.",
				result:
					"Orders persisted and the flow reached Stripe; placeholder credentials correctly stopped the payment. Compliance reference code is not wired into checkout.",
				state: "prototype",
				proof: [{ label: "Local build, tests, and smoke flow" }],
			},
		],
		tags: ["E-commerce", "Cannabis", "Stripe", "Regulated market"],
	},
	{
		name: "AI implementation brokerage",
		state: "archived",
		date: "2026-04",
		description:
			"Sell high-ticket AI automation projects, route delivery to vetted white-label builders, and keep a 15–20% relationship and scoping margin.",
		currentState:
			"The deal structure and partner-vetting system were documented, but every specialist slot remained unsourced and no executed deal was recorded.",
		decision: "drop",
		bottleneck:
			"Credibility, qualified deal flow, and vetted delivery partners. The activation rule itself required two prior client wins before sourcing partners.",
		history: [
			{
				date: "2026-04",
				attemptedModel:
					"Own discovery and the client relationship while specialist partners perform technical delivery.",
				work:
					"Designed the deal flow, margin structure, non-circumvention terms, five partner specialties, and a four-step vetting protocol.",
				result:
					"Zero partner slots were filled and no client deal reached execution. The model remained a plan rather than an operating channel.",
				state: "archived",
				proof: [{ label: "Archived deal and partner registry" }],
			},
		],
		tags: ["Brokerage", "AI services", "White-label delivery"],
	},
	{
		name: "Automated Substack essay engine",
		state: "archived",
		date: "2026-04",
		description:
			"Automate a consistent essay publication pipeline, grow an audience, and eventually monetize the publication.",
		currentState:
			"The writing workflow and several essays exist, but no audience or revenue outcome was recorded and publication still depended on human review.",
		decision: "drop",
		bottleneck:
			"Distribution and audience formation, plus an unofficial Substack session-cookie integration that expires and leaves final publication manual.",
		history: [
			{
				date: "2026-04",
				attemptedModel:
					"Turn a two-sentence brief into an on-voice essay draft, save it to Substack, and notify Telegram in under a minute.",
				work:
					"Built the n8n workflow, voice prompt, form trigger, Substack draft call, Telegram notification, and a small essay corpus.",
				result:
					"Draft generation worked as a workflow concept; no monetization evidence followed, and the unofficial API path required recurring cookie maintenance.",
				state: "archived",
				proof: [{ label: "Archived workflow and essays" }],
			},
		],
		tags: ["Publishing", "Substack", "n8n", "Audience"],
	},
];
