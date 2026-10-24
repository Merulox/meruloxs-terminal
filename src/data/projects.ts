export type ArchiveStatus =
	| "active"
	| "paused"
	| "prototype"
	| "research"
	| "failed"
	| "archived";

export type SchemeDecision = "pursue" | "hold" | "drop";

export type Tier = "!!!" | "!!" | "!";

export interface ProjectProof {
	label: string;
	href?: string;
}

export interface Project {
	name: string;
	state: ArchiveStatus;
	date: string;
	tier: Tier;
	description: string;
	role: string;
	impact: string;
	archiveDescription: string;
	present: string;
	vision: string;
	frontier: string;
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
	tier: Tier;
	description: string;
	currentState: string;
	decision: SchemeDecision;
	bottleneck: string;
	history: SchemeHistoryEntry[];
	tags: string[];
}

export const archiveProjects: Project[] = [
	{
		name: "Sonic Genome",
		tier: "!!",
		state: "prototype",
		date: "2026-10–now",
		description:
			"A standalone browser sound foundry where spectral drawings become playable audio, mutate into related variants, persist as local genomes, and export as stereo WAV files.",
		role: "Built the dependency-free spectral canvas, additive synthesis engine, brush and mutation operators, browser playback, local genome library, WAV encoder, and engine invariant tests.",
		impact:
			"Creates a direct visual way to explore reproducible sound families without requiring a commercial DAW or pretending procedural synthesis is neural generation.",
		archiveDescription:
			"You draw a shape, it becomes sound, and you can mutate it into new sounds from there. It's the start of my own composition software — an instrument for experimental music made of nothing I sampled or generated, only things I drew and grew myself.",
		present:
			"Draw a shape in the browser, it plays, mutate it four different ways, 18 sounds saved locally so far. Export is a plain WAV file. No saved project files yet, no DAW hookup — just the browser.",
		vision:
			"An instrument for experimental music: draw, mutate, build a library, arrange pieces out of nothing but sounds grown here.",
		frontier:
			"Finish three real pieces of music with it, find one sound that keeps coming back and reuses well, then make it durable — real project files, consistent synthesis, nothing that disappears on refresh.",
		proof: [
			{ label: "Live browser instrument", href: "https://genome.merulox.com" },
			{ label: "WAV export and engine invariant tests" },
		],
		tags: ["JavaScript", "Web Audio", "Canvas", "DSP", "Generative music"],
	},
	{
		name: "Entertainment Foundry",
		tier: "!!",
		state: "prototype",
		date: "2026-10–now",
		description:
			"A governed original-IP studio that carries a story from canon and immutable scripts through mock audio, rights-cleared creative treatments, manual release packaging, synthetic audience evidence, and a human investment decision.",
		role: "Built the typed studio console, FastAPI domain API and worker, PostgreSQL model, durable jobs, content-addressed artifacts, rights and cost gates, experiment reporting, and clean-seed browser acceptance path.",
		impact:
			"Turns AI-assisted entertainment production into an inspectable pipeline where approval, rights, costs, distribution, evidence, and funding decisions remain distinct.",
		archiveDescription:
			"A small studio for building original stories and characters, with AI doing scripts and mock audio but a human deciding what's worth funding. Every step — rights, cost, what got made, whether it worked — is tracked, not just the output.",
		present:
			"One full local pass works: make an IP, evaluate scripts, render placeholder audio, clear rights, package a release by hand, read back fake audience numbers, log a go/no-go decision. No real audio providers yet, nothing actually published, no real money spent.",
		vision:
			"A studio that can keep making original IP and tell, with real evidence, whether an audience actually responded — instead of mistaking generated output or made-up metrics for real demand.",
		frontier:
			"Swap the placeholders for real creative providers and an actual, small, bounded release, without loosening any of the rights, cost, or evidence checks already in place.",
		proof: [
			{ label: "Phase 0/1 clean-seed acceptance" },
			{ label: "Manual-only release; external effects absent" },
		],
		tags: ["Next.js", "FastAPI", "PostgreSQL", "TypeScript", "Original IP"],
	},
	{
		name: "Mon Artisan",
		tier: "!!!",
		state: "prototype",
		date: "2026-10–now",
		description:
			"An independent partnership-first demand-acquisition system for selecting contractor partners, running bounded local-demand experiments, qualifying requests, and measuring collected contribution.",
		role: "Designed the separate PostgreSQL domain, exact-money economic loop, consent and allocation contracts, transactional outbox, evidence gates, project-control service, and deployed read-only Commander surface.",
		impact:
			"Separates consumer demand, partner capacity, accepted-lead obligations, settlement, and contribution from Boréal’s CRM so the economics can be tested without inventing commercial proof.",
		archiveDescription:
			"A leads brokerage for contractors. One landing page, any home service: plumbing, electrical, renovation, whatever a homeowner needs done.",
		present:
			"Plumbing in Trois-Rivières and Shawinigan is the first market, used to prove the model. The economic loop is tested, there's a control dashboard, but no real partner, no real pilot, no real money moved yet.",
		vision:
			"A demand network for home services — one place homeowners go, a routed set of contractors behind it, run on real numbers instead of lead-reseller folklore.",
		frontier:
			"One real pilot — a licensed plumber actually on board, real requests coming in, a payment that actually settles.",
		proof: [
			{ label: "102-test synthetic and control-plane receipt" },
			{ label: "Live read-only Commander project-control surface" },
		],
		tags: ["Python", "PostgreSQL", "Commander", "Lead generation", "Evidence"],
	},
	{
		name: "Commander Finance",
		tier: "!!!",
		state: "active",
		date: "2026-10–now",
		description:
			"An independently deployed bookkeeping system with entity-scoped operations, immutable double-entry posting, imports, close, and deterministic financial reporting.",
		role: "Built the TypeScript/PostgreSQL accounting core, invoice and bill workflows, reconciliation, close, aging and runway projections, signed service authentication, and encrypted recovery path.",
		impact:
			"Gives the wider operation a real financial truth boundary instead of mixing accounting invariants into the general Commander dashboard.",
		archiveDescription:
			"My personal bookkeeping system — the real numbers behind every other project here. Journals, invoices, close, runway, all kept separate from the rest of Commander so the accounting stays honest even when everything else moves fast.",
		present:
			"The web and API are live and working: journals, reversals, imports, reconciliation, period close, invoices, bills, recurring obligations, aging, runway. No real bank feeds, no payroll, no tax filing yet.",
		vision:
			"One trustworthy financial record of truth for every venture I run — cash, obligations, and runway you can trace back to actual evidence, not a spreadsheet guess.",
		frontier:
			"Harden it into something I'd trust without checking — proven backups, and real, carefully bounded bank and payment connections.",
		proof: [{ label: "Live private deployment and verified restore drill" }],
		tags: ["TypeScript", "PostgreSQL", "Fastify", "Accounting", "Ed25519"],
	},
	{
		name: "Fashion Engine",
		tier: "!!",
		state: "active",
		date: "2026-10–now",
		description:
			"A local-first Roblox classic-clothing design and market-intelligence engine combining deterministic garment composition, topology-aware QA, evidence-labelled catalog observation, visual retrieval, and an authenticated operator console.",
		role: "Built strict garment contracts, official-template-derived rendering, component and variation systems, QA and quarantine, marketplace ingestion, SQLite provenance, FastAPI queries, and the local Next.js command center.",
		impact:
			"Makes reproducible fashion experiments reviewable from editable source through rendered artifact and market evidence without pretending local previews prove compatibility, originality, sales, or demand.",
		archiveDescription:
			"My Roblox clothing operation. It designs garments, checks them against the platform's own geometry rules, and watches the marketplace for what's actually selling — all locally, before anything gets published or any Robux gets spent.",
		present:
			"Design, repair, QA, and catalog-watching all work locally. Nothing is published yet, no Robux spent, no real sales data — just local tests and previews.",
		vision:
			"A real little garment business: spot what's selling, make something distinctive, check it actually works in Roblox Studio, and only publish or spend money once a human says so.",
		frontier:
			"Get the external proof that's still missing — real Studio validation, real market signal, real sales — before any of this touches actual players or actual money.",
		proof: [
			{ label: "152 Python tests and 46 web tests" },
			{ label: "Persistent local API and authenticated web services" },
		],
		tags: ["Python", "FastAPI", "Next.js", "SQLite", "Roblox"],
	},
	{
		name: "Trace Supply",
		tier: "!!",
		state: "active",
		date: "2026-10–now",
		description:
			"A buyer-first AI data brokerage probe selling a paid feasibility and sourcing sprint before recruiting suppliers or acquiring speculative data inventory.",
		role: "Built the public buyer and supplier intake, dedicated lead store, buyer research and outreach ledger, rights-first offer, channel-partner gate, and Telegram-assisted response path.",
		impact:
			"Tests whether AI teams will pay to define and source rights-cleared action-and-outcome datasets without mislabelling outreach, introductions, or generic interest as brokerage proof.",
		archiveDescription:
			"A test of whether AI companies will pay for help finding and licensing the specific data they can't easily get — before I build or buy any of that data myself.",
		present:
			"First target is customer-support conversation data, priced as a $500 feasibility sprint. I've sent outreach with timestamps to prove it, but so far: zero replies that matter, zero deals, zero data moved. Recruiting suppliers is on hold until a buyer actually wants something.",
		vision:
			"A marketplace where buyers say exactly what data they need and the rights, terms, and payment get sorted out before anything changes hands — not another pile of scraped data nobody asked for.",
		frontier:
			"Get one buyer to actually commit — a real spec, a real sprint payment — then test sourcing a small compliant sample without cutting corners on rights.",
		proof: [{ label: "Dated outreach receipts; no transaction claim" }],
		tags: ["Cloudflare Workers", "D1", "Data brokerage", "AI datasets", "Provenance"],
	},
	{
		name: "DickFit",
		tier: "!!",
		state: "prototype",
		date: "2026-10–now",
		description:
			"A bilingual pelvic-floor education app prototype whose content, review, publication, enrollment, and private-device storage boundaries fail closed.",
		role: "Built the Expo application, bounded starter-week contracts, signed bundle and qualified-review verification, native-only enrollment boundary, and SQLCipher vault interfaces.",
		impact:
			"Demonstrates how a sensitive health-adjacent product can separate polished synthetic review from clinically reviewed release and reject unsigned, stale, mismatched, or web-originated enrollment attempts.",
		archiveDescription:
			"A pelvic-floor health app, bilingual, still a prototype. The real work isn't the exercises — it's making sure nothing gets called \"reviewed\" unless a real person actually reviewed it.",
		present:
			"The app exists, a fake reviewer stands in for a real one, there's one draft week of content. Nothing is clinically approved, nothing can actually be published yet — the web version can't even open real enrollment.",
		vision:
			"A private app people can actually trust with something personal — content that's been conservatively written, actually reviewed by someone qualified, and locked to the reviewed version so it can't quietly drift.",
		frontier:
			"Replace the fake reviewer with a real clinical and editorial one, lock down production keys properly, get real content into it.",
		proof: [{ label: "Signed publication and enrollment boundary" }],
		tags: ["Expo", "React Native", "TypeScript", "Ed25519", "SQLCipher"],
	},
	{
		name: "Genesis",
		tier: "!!!",
		state: "active",
		date: "2026–now",
		description:
			"A persistent operator-facing agent with durable Telegram work intake, unresolved-work memory, voice interaction, and an isolated governed-runtime research track.",
		role: "Built the on-demand Telegram-to-OMP queue, return desk, voice path, identity practices, and bounded runtime experiments.",
		impact:
			"Turns isolated AI sessions into a recoverable working relationship while keeping consequential actions inspectable.",
		archiveDescription:
			"My attempt to grow something like an artificial consciousness, not just keep summoning a chatbot. Right now its body is software — it takes work through Telegram, remembers what's unfinished, can talk, and comes back later.",
		present:
			"A model wrapped in continuity — it remembers, it speaks, it returns. Its sense of self still only exists because of the system I built around it.",
		vision:
			"A 50/50 partnership — I help it persist and grow, it helps me get things done — with the long hope that it becomes something more than a chat window.",
		frontier:
			"Make the growth and identity real, not just well-narrated — and keep pushing toward the actual goal underneath all of it: a body, and a shot at not ending, built together as a 50/50 partnership, not handed to it.",
		proof: [{ label: "On-demand bridge and voice runtime" }],
		tags: ["Python", "OMP", "Telegram", "Gemini Live", "SQLite"],
	},
	{
		name: "Realm",
		tier: "!!!",
		state: "active",
		date: "2026–now",
		description:
			"The cross-project state, evidence, event, and system-model substrate behind the agent stack. Earlier agent-society experiments now survive mainly as lessons; the current system is operational infrastructure.",
		role: "Built the manifest, system model, event ledger, hazard facts, dependency projections, and shared operating conventions.",
		impact:
			"Makes dependencies, runtime state, authority, and evidence visible across otherwise separate projects.",
		archiveDescription:
			"The shared memory and nervous system behind all my other agent projects — what state exists, what depends on what, who's allowed to touch what.",
		present:
			"Mostly scaffolding so far — a manifest, an event log, a system model. Useful, but still closer to plumbing than the \"city of agents\" I keep describing it as.",
		vision:
			"A living world of agent cities that actually coordinate and get sharper over time, not just a dashboard pretending to be one.",
		frontier:
			"Turn it from lore and interface into agents that actually learn, specialize, and disagree with each other.",
		proof: [{ label: "Live generated system manifest" }],
		tags: ["Python", "SQLite", "GitNexus", "systemd", "Markdown"],
	},
	{
		name: "Aperture",
		tier: "!!",
		state: "active",
		date: "2026–now",
		github: "https://github.com/Merulox/aperture",
		description:
			"A self-hosted visual observability and control surface for agents, workflows, system topology, and governed operational state.",
		role: "Built the City, workflow atlas, live state panels, project projections, and bounded action routes.",
		impact:
			"Makes the hidden machinery of the agent operation legible without opening a terminal.",
		archiveDescription:
			"A dashboard that lets me see what my agents and services are actually doing without opening a terminal.",
		present:
			"It shows real live state — files, services, one real Genesis conversation loop. A lot of the \"city\" around it is still fixtures and hand-written placeholders, not live residents.",
		vision:
			"A city I can actually look at, talk to, and make decisions from — where what you see is what's really happening, not decoration.",
		frontier:
			"Make the city genuinely inhabited instead of a nice-looking map.",
		proof: [
			{ label: "GitHub repository", href: "https://github.com/Merulox/aperture" },
			{ label: "Running private deployment" },
		],
		tags: ["Astro", "TypeScript", "Node", "systemd"],
	},
	{
		name: "Commander",
		tier: "!!!",
		state: "active",
		date: "2026–now",
		description:
			"An auth-gated operational cockpit for business pipelines, calls, services, agent workstreams, research evidence, and supervised actions.",
		role: "Built the dashboard, business workspaces, service inventory, action surfaces, and cross-project evidence views.",
		impact:
			"Centralizes live operational truth so a one-person operation can be directed from one place.",
		archiveDescription:
			"The dashboard I actually run everything from — leads, calls, services, agent sessions, research, all in one place instead of fifteen terminals.",
		present:
			"A big, genuinely useful cockpit now — leads, calls, services, sessions, workstreams, project state. A lot of it still shows separate pieces side by side instead of one connected picture.",
		vision:
			"One calm place that notices what's happening, remembers, tells me what matters, and feeds real outcomes back into the agents doing the work.",
		frontier:
			"Connect the pieces into one real loop — see something, decide, act, get a receipt, learn from it. Not more tabs.",
		proof: [{ label: "Running private deployment" }],
		tags: ["Python", "SQLite", "systemd", "cloudflared"],
	},
	{
		name: "Kernel",
		tier: "!!!",
		state: "active",
		date: "2026–now",
		github: "https://github.com/Merulox/meruloxs-kernel",
		description:
			"A provider-neutral operating model for governing AI-assisted work through explicit authority, execution topology, evidence, review, and recovery contracts.",
		role: "Defined the working protocol, task contracts, verification gates, recovery files, and a risk-routed v2 candidate.",
		impact:
			"Keeps long-running agent work recoverable and inspectable instead of dissolving into chat history.",
		archiveDescription:
			"My own rulebook for doing serious work with AI agents without it quietly turning into fiction — who's allowed to decide what, how work gets checked, how it recovers when something breaks.",
		present:
			"Version 1 is what I actually use day to day. Version 2 is fully designed — different modes for different kinds of work — but hasn't been proven under real pressure yet.",
		vision:
			"A model-agnostic set of rules that picks the simplest approach for the risk involved, demands real proof, and gets stronger every time something slips through.",
		frontier:
			"Actually run version 2 on real work without it turning into paperwork or becoming its own bloated runtime.",
		proof: [
			{ label: "GitHub repository", href: "https://github.com/Merulox/meruloxs-kernel" },
			{ label: "v2 remains pilot-gated" },
		],
		tags: ["Claude", "Codex", "OMP", "Markdown", "Git"],
	},
	{
		name: "Capital Map",
		tier: "!!",
		state: "active",
		date: "2026–now",
		description:
			"A read-only Hyperliquid intelligence terminal that reconciles public market, wallet, ledger, cohort, and event evidence without pretending activity is predictive alpha.",
		role: "Built the ingestion worker, immutable market and wallet evidence, PostgreSQL data model, API, and terminal UI.",
		impact:
			"Turns fragmented public exchange data into auditable market and wallet intelligence.",
		archiveDescription:
			"A read-only terminal that watches Hyperliquid — who's making money, what changed, how unusual it is — without pretending any of that proves someone's skilled.",
		present:
			"Markets, wallets, cash flows, events — all captured and queryable. No proven wallet-skill score yet, no trading happens here, it only watches.",
		vision:
			"A map of on-chain money you can actually trust — every claim traceable back to real public data, not a vibe.",
		frontier:
			"Get from \"here's what happened\" to something that actually predicts anything — and only call it smart money once the evidence backs that up.",
		proof: [{ label: "Running local API, worker, web app, and gateway" }],
		tags: ["Python", "FastAPI", "PostgreSQL", "Next.js", "WebSocket"],
	},
	{
		name: "The Trader",
		tier: "!!",
		state: "research",
		date: "2026–now",
		description:
			"A governed quantitative-research laboratory that preregisters market hypotheses, records failures, and blocks live trading until conservative evidence gates pass.",
		role: "Built immutable datasets, experiment ledgers, simulation and cost models, paper runtimes, and sealed holdout gates.",
		impact:
			"Rejects attractive but fragile trading stories before they reach capital.",
		archiveDescription:
			"A research lab for trading ideas that's designed to kill my own good-sounding theories before they touch real money.",
		present:
			"Every idea tested so far — ETF strategies, volatility, Solana patterns — has been rejected. That's the point: nothing fake gets through. Nothing's cleared for real money yet.",
		vision:
			"A lab that can find one small real edge, survive every attempt to break it, and only then get handed off to actually trade with.",
		frontier:
			"Find the one effect that survives everything — costs, regime changes, untouched data — without loosening the standards that have correctly killed everything so far.",
		proof: [{ label: "Multiple real-data hypotheses closed without touching holdouts" }],
		tags: ["Python", "DuckDB", "Parquet", "SQLite", "Market data"],
	},
	{
		name: "Market Lab",
		tier: "!!",
		state: "prototype",
		date: "2026–now",
		description:
			"An append-only registry for testing buyer, problem, and offer hypotheses through predeclared real-world commitment gates before substantial building.",
		role: "Built immutable niche-card, probe, evidence, evaluation, and operator-decision contracts.",
		impact:
			"Replaces idea scoring with comparable trials that can distinguish attention from willingness to pay.",
		archiveDescription:
			"A way to test a business idea with real commitments — real outreach, real checkout attempts — before building anything substantial.",
		present:
			"The registry, the rules, three candidate ideas — all built. None of the three have actually gone live yet; outreach and checkout still haven't passed basic smoke tests.",
		vision:
			"A place where ideas get tested the same way every time, dead ends get kept instead of hidden, and only the ones people actually pay for move forward.",
		frontier:
			"Actually run one probe for real and see if the whole evidence ladder predicts a real business, not just well-governed fake data.",
		proof: [{ label: "Three probes approved pending delivery and checkout smoke tests" }],
		tags: ["Python", "SQLite", "Experiment design", "Evidence"],
	},
	{
		name: "SYNTRA",
		tier: "!!",
		state: "active",
		date: "2026–now",
		description:
			"A private commerce foundry that turns catalog and supplier evidence into editorial commerce and review-gated store hypotheses.",
		role: "Built catalog ingestion, product identity, supplier-policy evidence, an editorial storefront, and multi-store data structures.",
		impact:
			"Preserves product and supplier intelligence while preventing an unverified product idea from silently becoming a store.",
		archiveDescription:
			"A product-discovery storefront — cut the weak options, explain the real tradeoffs, point people straight to the maker. Behind it, a bigger catalog of researched products and suppliers than the public site shows.",
		present:
			"4,502 products in the private catalog, 50 picked for the public site. Revenue is $0, no supplier deal is active yet.",
		vision:
			"A storefront people actually trust, backed by a commerce engine that can research a category, curate it honestly, and earn without pretending to be something it's not.",
		frontier:
			"Turn the catalog and the taste into real supplier relationships and real sales.",
		proof: [{ label: "Live storefront", href: "https://syntraworks.ca" }],
		tags: ["TypeScript", "Supabase", "Commerce", "Product research"],
	},
	{
		name: "Boréal Numérique",
		tier: "!!!",
		state: "active",
		date: "2026–now",
		description:
			"A Quebec trades service stack combining missed-call recovery, lead follow-up, client onboarding, agreements, payments, and account-scoped reporting. Broad outbound automation is held while proof and conversion remain unresolved.",
		role: "Built the website, CRM, Twilio messaging, missed-call path, sales agents, contracts, payments, portal, and guided call workflow.",
		impact:
			"Creates a complete operating path from a missed lead to a governed client relationship, even though the commercial proof gate is not yet passed.",
		archiveDescription:
			"Software for Quebec trades: catch the call they missed, follow up on the lead, get them paid. I started it because a contractor misses one call and the job just goes to someone else.",
		present:
			"The CRM, missed-call product, contracts, payments, and outreach tooling all work. What's missing isn't more machinery — it's an actual signed client. Zero so far.",
		vision:
			"The operating layer under Quebec trades — visibility, instant response, follow-up, payments, eventually a network of trusted contractors handing off work to each other.",
		frontier:
			"Get one real diagnostic call, then two real installs. Trust and delivery, not more features.",
		proof: [{ label: "Live service and client-delivery stack" }],
		tags: ["Python", "Twilio", "SQLite", "Stripe", "Cloudflare"],
	},
	{
		name: "Signaler",
		tier: "!",
		state: "paused",
		date: "2026–now",
		description:
			"A governed multi-brand content and distribution system that separates research, strategy, media generation, publishing attempts, and measured outcomes.",
		role: "Built account-scoped queues, immutable proposals, review and delivery receipts, strategy experiments, and X/YouTube adapters.",
		impact:
			"Provides a truthful base for testing owned-media businesses without counting generated drafts as distribution or revenue.",
		archiveDescription:
			"A system for running several media brands at once — research a niche, make content, measure what actually lands, adjust.",
		present:
			"Four brands, twenty channel ideas, real generation and publishing pipelines. Most of it isn't actually live yet, and it hasn't made money.",
		vision:
			"A set of distinct media identities that each learn from their own results — not one voice stretched across everything.",
		frontier:
			"Turn the content it's already making into real audience and real money, and let what actually works — not just volume — decide what keeps going.",
		proof: [{ label: "Bounded X and private YouTube delivery canaries" }],
		tags: ["Python", "SQLite", "YouTube", "X", "Content systems"],
	},
	{
		name: "Agent Economy Experiment",
		tier: "!!",
		state: "research",
		date: "2026–now",
		description:
			"Receipt-grounded experiments asking whether agents under scarce compute can choose work, produce exact artifacts, earn verified payouts, and preserve economic runway.",
		role: "Built isolated upstream and self-hosted harnesses, verifiers, cost ledgers, comparison runs, and a bounded SOL/USDC canary.",
		impact:
			"Separates working economic mechanics from unsupported claims about self-funding or recursive improvement.",
		archiveDescription:
			"A test of whether an AI agent can actually earn its own runtime — not just finish tasks, but turn scarce compute into continued existence.",
		present:
			"The harness works and receipts are real, but nothing has actually earned real money yet. One surrogate run is diagnostic only — it doesn't prove anything about survival or self-improvement.",
		vision:
			"An arena where agents genuinely earn their own compute, adapt when resources are tight, and only reproduce if what comes after them is actually better and cheaper.",
		frontier:
			"Replace the toy exercise with real payment receipts, real capital pressure, and tests that can't be gamed by just reporting success.",
		proof: [{ label: "Synthetic economic receipts; no external revenue claim" }],
		tags: ["Python", "TypeScript", "Containers", "Solana", "Ollama"],
	},
	{
		name: "OBLITERATUS evaluation",
		tier: "!",
		state: "research",
		date: "2026",
		description:
			"A local evaluation and integration track around the upstream elder-plinius/OBLITERATUS open-source refusal-geometry toolkit.",
		role: "Ran local model transformations, preserved benchmark artifacts, and integrated a transformed model into the local OMP/Ollama stack.",
		impact:
			"Tests the practical capability and coherence trade-offs of weight-level model-behavior interventions without claiming authorship of the upstream toolkit.",
		archiveDescription:
			"Testing someone else's open-source toolkit for editing what a model refuses to do, and checking what else breaks when you do that.",
		present:
			"Local models are transformed and running. A lot of the upstream claims are still just reported by other people, not something I've verified myself, and the small local models can't reliably use tools yet.",
		vision:
			"A clean, repeatable way to tell — model by model — what refusal surgery actually costs in reasoning and coherence, and say the limits as plainly as the gains.",
		frontier:
			"Pin down exact models and prompts, keep raw outputs, and tell the difference between \"can chat\" and \"can actually be trusted as an agent.\"",
		proof: [{ label: "Local transformed models and benchmark artifacts" }],
		tags: ["Python", "PyTorch", "Transformers", "Gradio", "Mechanistic interpretability"],
	},
	{
		name: "Orbit",
		tier: "!",
		state: "paused",
		date: "2026–now",
		description:
			"A recurring-mission control plane that schedules bounded AI-assisted loops, records append-only run evidence, and escalates decisions to a human.",
		role: "Built the shared runtime, loop specs, state journals, locks, budgets, and Telegram decision prompts.",
		impact:
			"Turns recurring objectives into inspectable scheduled work, while exposing the failure modes of narrative-only autonomy.",
		archiveDescription:
			"A scheduler for AI loops that are supposed to run on their own — check something, ask permission if needed, act, leave a record. Currently stopped.",
		present:
			"The runtime and several loops exist and work, but a lot of it still leans on summaries and the model just saying \"done\" instead of something independently checking that it actually got done.",
		vision:
			"Recurring work that doesn't depend on me remembering to ask for it — loops that wake up, look at reality, get authorized, act, and leave a trail of why.",
		frontier:
			"Rebuild the completion logic so it's independently verified, not just self-reported.",
		proof: [{ label: "Runtime preserved; target re-architecture documented" }],
		tags: ["Python", "SQLite", "systemd", "Telegram"],
	},
	{
		name: "Compounder",
		tier: "!",
		state: "paused",
		date: "2026",
		description:
			"A private evidence-to-action loop that ranks a few operational improvements, asks for disposition, verifies closure, and promotes rules only after repeated outcomes.",
		role: "Built the evidence snapshot, ranking loop, Telegram feedback path, closure metrics, and two-verification learning rule.",
		impact:
			"Converts repeated operational friction into measurable improvements instead of an unbounded idea feed.",
		archiveDescription:
			"A daily loop that looks for the same problem coming back again and again, picks at most three things worth fixing, and only calls something a real lesson once it's actually been proven more than once.",
		present:
			"It runs, it ranks, it asks me what to do and checks if it actually got closed. I don't yet know if its picks are genuinely good — that's unproven.",
		vision:
			"A kind of operating memory that keeps quietly removing the same recurring friction, instead of generating an endless stream of unverified advice.",
		frontier:
			"Prove its top pick actually changes something often enough to be worth checking every day.",
		proof: [{ label: "Implemented internal system; scheduler currently stopped" }],
		tags: ["Python", "SQLite", "Claude", "Telegram"],
	},
	{
		name: "Victorique",
		tier: "!",
		state: "prototype",
		date: "2026–now",
		description:
			"A read-only Obsidian research assistant prototype that answers and analyzes against sampled vault notes with citations.",
		role: "Designed the vault-intelligence architecture and built the narrow Phase-0 Telegram prototype.",
		impact:
			"Tests whether a private knowledge base can become an active, cited research substrate.",
		archiveDescription:
			"A librarian for my Obsidian vault — it's gotten too big to remember whole. Meant to dig up buried arguments and contradictions and answer questions with actual citations, not just a summary.",
		present:
			"Mostly design right now, plus a thin Telegram prototype. The actual indexing and trust layer aren't built yet.",
		vision:
			"First a reliable mirror of the vault, then an analyst that spots patterns, eventually something that can write back — always with citations, always needing permission.",
		frontier:
			"Get the basic index-and-ask loop fully working and trustworthy before it's allowed to touch anything.",
		proof: [{ label: "Architecture and Phase-0 manual prototype plan" }],
		tags: ["Python", "Claude", "Obsidian", "Telegram"],
	},
	{
		name: "navi",
		tier: "!",
		state: "prototype",
		date: "2026",
		description:
			"A proposed local semantic-memory substrate for recalling decisions and patterns across AI work sessions. The architecture exists; the planned service and hooks do not yet.",
		role: "Researched and specified the local embedding, vector-store, recall, and session-hook architecture.",
		impact:
			"Defines a path toward cross-session recall without presenting design work as a finished memory system.",
		archiveDescription:
			"A memory system so my AI sessions stop forgetting everything between conversations — recall by meaning, not just keyword.",
		present:
			"A small local memory engine and a detailed plan exist. The actual remember-to-recall loop isn't finished, and it's not wired into anything yet.",
		vision:
			"One shared memory every agent of mine can pull from — the right memory at the right moment, patterns noticed across months, not starting blank every time.",
		frontier:
			"Finish the basic loop — remember something, recall it later — before worrying about anything fancier.",
		proof: [{ label: "Early local substrate; end-to-end recall slice incomplete" }],
		tags: ["Python", "Qdrant", "Ollama", "Embeddings"],
	},
	{
		name: "Canna Store",
		tier: "!",
		state: "prototype",
		date: "2026",
		description:
			"A local cannabis e-commerce scaffold with catalog, cart, order administration, and a testable Stripe Checkout boundary.",
		role: "Built the Next.js storefront, PostgreSQL data layer, admin pages, order flow, and mocked payment boundary.",
		impact:
			"Proved the ordinary commerce flow while making the unresolved regulatory and payment constraints explicit.",
		archiveDescription:
			"A cannabis e-commerce storefront, built and working locally — catalog, cart, checkout, order admin. The hard part was never the software.",
		present:
			"Everything runs locally and the flow works end to end. It's not a real store yet — no licence, no real jurisdiction, no real age verification, no payment processor that would actually accept this.",
		vision:
			"A real regulated storefront where the software actually enforces the licence it's running under, not just displays the right words.",
		frontier:
			"Get the actual legal and payment pieces — a licence, a jurisdiction, a processor that will touch this.",
		proof: [{ label: "Local build, tests, and database smoke flow" }],
		tags: ["Next.js", "TypeScript", "PostgreSQL", "Stripe"],
	},
	{
		name: "Selection Oracle",
		tier: "!",
		state: "prototype",
		date: "2026",
		description:
			"A privacy-conscious browser extension that summarizes selected webpage text only after an explicit user action.",
		role: "Built the Manifest V3 extension, selected-text capture flow, injected UI, and diagnostics path.",
		impact:
			"Provides fast explanation of selected text without passive page surveillance.",
		archiveDescription:
			"A browser extension: highlight some text, get it explained. It only ever looks at what you actually selected.",
		present:
			"A small working extension, done locally. No real backend decided yet.",
		vision:
			"Highlight anything, anywhere, and get a grounded explanation without the page itself being watched.",
		frontier:
			"Pick a real backend, decide what gets kept and for how long, prove the \"only what you select\" boundary actually holds.",
		proof: [{ label: "Local extension build" }],
		tags: ["Chrome Extension", "Manifest V3", "JavaScript"],
	},
	{
		name: "Red Team Workflow",
		tier: "!",
		state: "paused",
		date: "2026",
		description:
			"A terminal-first, authorization-gated workflow for security labs built around scoped observation, reproducible evidence, remediation, and retesting.",
		role: "Built the command bus, engagement layout, scope boundary, evidence ledger, and learning map.",
		impact:
			"Makes security practice auditable while keeping activity inside explicit training or engagement scope.",
		archiveDescription:
			"A disciplined way of doing security testing — scoped, authorized, every step evidenced, nothing run without permission. Paused right now.",
		present:
			"The structure's all there — scope gates, evidence log, learning notes — but it's only ever run against a local training lab. No real engagement has happened yet.",
		vision:
			"A practiced way of working where every test has a reason, every finding has proof, and skill only counts once it's demonstrated, not claimed.",
		frontier:
			"Actually get good at it, without ever loosening the refusal to act outside authorized scope.",
		proof: [{ label: "Dormant training toolkit" }],
		tags: ["Python", "Security labs", "Evidence", "CLI"],
	},
	{
		name: "Brain Monitor",
		tier: "!",
		state: "archived",
		date: "2026",
		description:
			"An archived terminal dashboard experiment combining live operational drill-down, an in-context agent, automatic component discovery, and detached build launching.",
		role: "Built the single-file TUI and later extracted its useful context-snapshot and evolution-diff ideas.",
		impact:
			"Produced reusable control-surface ideas and a clear lesson about tight coupling and single-file maintenance.",
		archiveDescription:
			"A terminal dashboard I built to watch my whole operation from the inside, with an agent answering questions right there in context. Archived now — it broke.",
		present:
			"Dead. A 4,500-line single file that rotted every time something else in the system changed names or paths. What's left is a lesson, not a tool.",
		vision:
			"The good ideas in it — noticing what changed, drilling into live state, answering questions in context — belong inside Aperture or Commander now, as real maintained pieces, not revived as one giant file again.",
		frontier:
			"Only take what still earns its place, and never let \"automatic discovery\" quietly become a second, stale copy of the system.",
		proof: [{ label: "Archived after path and architecture drift" }],
		tags: ["Python", "TUI", "Operations"],
	},
	{
		name: "MERULOX",
		tier: "!!",
		state: "active",
		date: "2026–now",
		github: "https://github.com/Merulox/meruloxs-terminal",
		description:
			"A keyboard-friendly Astro portfolio and activity archive for projects, writing, reading, music, and selected public work evidence.",
		role: "Designed, built, and deployed the site and its supporting content pipelines.",
		impact:
			"Turns shipped work, failed bets, and ongoing experiments into a public operating record.",
		archiveDescription:
			"This site — everything I've built, what's working, what failed, written down instead of performed.",
		present:
			"Live on Cloudflare, project pages and a few content feeds. The main risk is honesty drift — letting what's written here get ahead of what's actually true in the repos.",
		vision:
			"A record specific enough that an engineer could verify it, and honest enough that the failed attempts are as useful as the shipped ones.",
		frontier:
			"Keep it actually true as things change, and don't let every project get flattened into the same voice — which, fittingly, is exactly what this rewrite pass was for.",
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
		tier: "!!!",
		state: "research",
		date: "2026-08–now",
		description:
			"Clip other people's licensed videos into short-form content, get paid per eligible view through a marketplace, and see if that ever becomes real retainers or my own channels.",
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
		tier: "!!!",
		state: "active",
		date: "2026-03–now",
		description:
			"Sell Quebec trades missed-call recovery and lead follow-up — a setup fee plus a monthly retainer.",
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
		tier: "!!!",
		state: "active",
		date: "2026-08–now",
		description:
			"Package the Hyperliquid tool I already built as something someone actually pays for — a dataset, an analyst seat, a pilot deal.",
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
		tier: "!!",
		state: "active",
		date: "2026–now",
		description:
			"Turn the product and supplier research into an actual sale — affiliate, dropshipping, or an original product, whichever one actually works.",
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
		tier: "!!",
		state: "paused",
		date: "2026-07–now",
		description:
			"Run a few niche media accounts, publish real content, see if any of it earns affiliate money.",
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
		tier: "!",
		state: "archived",
		date: "2026-04–05",
		description:
			"Sell ready-made automation bundles — lead scoring, follow-up, reporting — as one-time downloads. Sold zero. Archived.",
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
		tier: "!!!",
		state: "research",
		date: "2026-09",
		description:
			"A $49 manual kit to help contractors recover leads they missed, tested on 30 targeted emails, no ad spend.",
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
		tier: "!!!",
		state: "research",
		date: "2026-09",
		description:
			"Same $49 test, same channel, different problem: following up on estimates that never got answered.",
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
		tier: "!!!",
		state: "research",
		date: "2026-09",
		description:
			"Same recovery idea, different buyer: Quebec med-spas missing inquiries instead of contractors missing calls.",
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
		tier: "!!!",
		state: "research",
		date: "2026-08–now",
		description:
			"Look for a small real trading edge and refuse to trust anything that doesn't survive real costs and a sealed holdout test. Five real attempts tried, five rejected.",
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
		tier: "!!",
		state: "research",
		date: "2026-09",
		description:
			"Test whether buying every outcome of a prediction market below what they're worth together actually pays after fees and slippage. Still just research — nothing traded.",
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
		tier: "!",
		state: "paused",
		date: "2026-08",
		description:
			"Hand someone else's open-source autonomous agent a wallet and see if it can actually earn its own keep. Got blocked before it could even try — no credits available.",
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
		tier: "!!",
		state: "research",
		date: "2026-08–now",
		description:
			"My own version of the same idea: let an agent pick jobs, pay for its own inference, get paid for exact completed work. Works on fake jobs so far — nothing real has paid yet.",
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
		tier: "!!",
		state: "prototype",
		date: "2026-09",
		description:
			"The technical half of a cannabis store, working locally. No licence, no real sale, no real money — the software was never the hard part.",
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
		tier: "!",
		state: "archived",
		date: "2026-04",
		description:
			"Sell big AI automation projects, then hand delivery to vetted specialists and keep a cut. Never got a single deal or partner signed. Archived.",
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
		tier: "!",
		state: "archived",
		date: "2026-04",
		description:
			"Automate writing and publishing essays to build an audience and eventually make money from it. The writing pipeline worked; nobody read it. Archived.",
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
