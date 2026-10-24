# Could merulox.com redesign around Commander's WIRED direction?

Question: should the public site inherit Commander's upcoming "restrained TTY × WIRED
hybrid" redesign. Two real mockups built against a frozen content contract
(`commander-wired-crossover-2026-10-24/CONTRACT.md`, same HTML files + PNGs) to answer
with evidence instead of opinion.

## The tension, stated plainly

This site's own `DESIGN.md` already litigated this exact question and ruled against it:

> It must NOT feel like: a SaaS dashboard, a Linux terminal clone, a developer
> portfolio template, or any performance of technical identity.

And `patterns-to-avoid.md` #4, "the fake terminal prompt": *"It performs technical
identity rather than demonstrating it. It's cosplay... If you want terminal aesthetic,
use it structurally — not as a decorative widget."*

Commander's WIRED//NAVI direction (`~/projects/commander/docs/research/commander-hacker-aesthetic-directions-2026-10-23.md`)
is explicitly a hacker/Lain/cyberpunk product-dashboard skin, built for an audience of
one (the operator) running a multi-pane ops tool. merulox.com's audience is startup
founders, engineers, and recruiters evaluating a person, not a tool. Those are
different jobs. A literal reskin would reintroduce the exact failure mode the site's
own research already rejected — confirmed below, not just asserted.

## What was tested

Same frozen content (wordmark, employer-facing role line, focus-area list, a 3-entry
archive list with shipped/active/archived states) rendered two ways:

**Direction A — Shared Dialect.** Current merulox.com column layout and teal primary
accent, untouched. Borrowed exactly three *structural* primitives from Commander's
approved `sim/hybrid.css` tokens, each reserved for one meaning: 0-radius hard edges
+ an offset 2px/2px pixel-shadow (no blur) on hover/active chrome, a bracket-wrapped
wordmark `[MERULOX]`, and the hybrid's lavender (`#9c86c4`) as a second accent used
*only* for hover/selection — green stays reserved for shipped-state, teal stays
primary everywhere else. No panes, no rail, no status bar, no host-prompt branding.

**Direction B — Full reskin.** Same content, staged inside Commander's actual DOM
idiom verbatim: status bar with host id (`[navi] merulox`), icon rail, bordered panes
with pane-head bars, JetBrains Mono, hybrid palette applied globally including body
copy.

Screenshots: `a-shared-dialect-{desktop,mobile}.png`, `b-full-reskin-{desktop,mobile}.png`.
Source: `a-shared-dialect.html`, `b-full-reskin.html` (both noindex, open directly in a browser).

## Result

**Direction A reads as a person's site with a sharper edge.** The bracket wordmark and
pixel-shadow hover give it a harder, more deliberate texture than the current teal-only
version, without the content ever competing with chrome. Still passes the "would I send
this to a recruiter" test.

**Direction B concretely fails, not just stylistically.** On mobile the pane/table
layout breaks: the "recent" table can't reflow inside a 390px pane, cell text wraps
into unreadable multi-line fragments, and the identity pane pushes the actual bio
copy below the fold behind rail icons and a status bar advertising `PRESENT DAY ·
PRESENT TIME` — a Lain reference a recruiter has no context for. The audience-facing
copy is intact but *buried inside product chrome*, which is exactly the "performance
of technical identity" DESIGN.md names as the thing to avoid. This isn't a close call.

## Recommendation

**Adopt Direction A's three primitives, reject a full reskin.** This gives merulox.com
and Commander (and commander-previews.merulox.com) a recognizable shared dialect —
hard edges, pixel-shadow instead of blur, a reserved-meaning lavender accent — so the
surfaces read as built by the same operator, without merulox.com becoming a dashboard
skin. Concretely, if adopted:

- `src/styles/global.css`: add `--chrome: #9c86c4` and `--shadow: #06070a`; add
  `box-shadow: 2px 2px 0 var(--shadow)` + `outline: 1px solid` on `.nav a:hover`,
  `.kbd-item:hover`, list-row hover states (currently color-only transitions).
  `--shipped` and `--accent` stay exactly as documented — the lavender has one job.
- Wordmark: wrap in `[` `]` spans colored `--chrome` on the homepage (`index.astro`)
  and the employer hero (`employers.astro`); VT323 usage stays exactly as scoped today
  (display only, never body text).
- No new fonts, no panes, no rail, no status bar, no `navi`/host branding on the public
  site — those stay Commander-only, where the audience is the operator.

This is additive and reversible (new CSS custom property + a handful of hover rules);
it does not touch `DESIGN.md`'s structure, audience framing, or SPECSHEET layout.

## Claims

- merulox.com's `DESIGN.md` and `ideas/website-references/patterns-to-avoid.md` explicitly reject terminal-clone/dashboard aesthetics and "fake terminal prompt" cosplay for this site, grounded in research against Linear, macwright.com, Gwern.net, levels.io, and sive.rs.
- Commander's approved restrained TTY×WIRED hybrid (`sim/hybrid.css`) uses bg `#111016`/`#19171f`/`#272330`, lavender chrome `#c6b1e4`/`#9782b3`/`#cbb8e1`, green `#b0df9b`, 0-radius panes with an offset `2px 2px 0` pixel-shadow (no blur), and JetBrains Mono; intensity 1 ("daily") has no scanlines, glow, dither, or glitch — only intensity 2 adds texture/animation.
- Staging merulox.com's real employer-facing copy inside Commander's literal pane/rail/status-bar DOM breaks on a 390px mobile viewport (table cells wrap into unreadable fragments, bio copy pushed below rail/status chrome) — a concrete, reproducible failure, not a stylistic preference.
- Three structural primitives from the hybrid (0-radius hard edges, offset pixel-shadow instead of blur, a second accent reserved for exactly one meaning) can be grafted onto merulox.com's existing SPECSHEET layout and teal-primary palette without reproducing the dashboard/cosplay failure mode, verified by rendering the site's real homepage and employer-page copy both ways.

## Summary

merulox.com's own design research already answered "should this look like a terminal
product" — no, because the audience is people evaluating a person, not an operator
running a tool. Testing Commander's actual approved WIRED-hybrid tokens against the
site's real content confirms that verdict concretely on mobile, not just in principle.
The useful move isn't a reskin: it's lifting three restrained structural primitives
(hard edges, pixel-shadow, one reserved-meaning accent) so merulox.com, Commander, and
commander-previews read as one operator's work without merulox.com becoming Commander's
skin. Decision point: adopt Direction A's primitives into `global.css` (small, additive,
reversible) — awaiting confirmation before touching the live site.
