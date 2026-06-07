# merulox.com

**A public index of systems, experiments, field notes, and work in motion.**

[merulox.com](https://merulox.com) is the public surface of a systems thinker
building AI-first operational infrastructure.

The site is designed as a maintained specs sheet for a person: authoritative
enough to navigate quickly, human enough to reveal process, and honest about
what is shipped, active, experimental, or archived.

## Design Direction

The site combines two ideas:

- **Specs sheet structure:** indexed, precise, legible, and easy to scan.
- **Field notes content:** authored voice, visible process, honest dates, and
  work shown in its actual state.

It deliberately rejects the usual performances of technical identity:

- no fake terminal;
- no SaaS-dashboard framing;
- no invented metrics;
- no stock imagery;
- no heavy animation;
- no claims unsupported by real work.

The visual system is dark, restrained, and quietly technical. One accent color,
system monospace, compact state indicators, and durable information hierarchy do
the work.

## What Lives Here

- current and shipped projects;
- systems and operational experiments;
- field notes and thinking;
- an evolving account of what is being built now;
- selected conversation and log artifacts;
- a reading tree reconciled with local Kobo ownership data.

The website is not meant to manufacture a polished identity detached from the
work. It is meant to make the work, direction, and underlying way of thinking
legible.

## Architecture

- **Astro** for static, content-forward pages
- **Cloudflare Pages** for deployment
- **Plain Astro, HTML, and CSS** by default
- **Browser extension and log bridge** for selected conversation-history flows
- **JSON content files** for inspectable, versionable site state

The site remains intentionally light. A dependency or dynamic layer must earn
its place.

## Commands

```sh
npm install
npm run dev
npm run build
npm run deploy
```

## Repository Map

- `src/pages/` - public routes
- `src/layouts/` - shared document structure
- `src/components/` - reusable presentation patterns
- `src/styles/` - global visual system
- `src/data/` - inspectable content state
- `extension/` - browser extension for conversation-history capture
- `.agent/` - project state, decisions, roadmap, risks, and recovery context
- `DESIGN.md` - detailed design specification and current visual doctrine

## Current State

The site is live and under active maintenance. Current work focuses on making
the public index more accurate, connecting project state to the public surface,
and improving the reliability of the log and conversation pipeline.

The site should evolve as the operation evolves, without becoming a substitute
for the operation itself.
