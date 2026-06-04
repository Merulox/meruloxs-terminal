# Closest to MERULOX

8 examples ranked by design fit. For each: what to steal specifically, what to avoid.

---

## 1. Linear (linear.app) — Closest overall reference

**Why it fits:**
Linear is not a personal site, but its design language is the closest to what MERULOX should feel like. It's dark, precise, keyboard-first, and uses typography as the primary design element. The sidebar + content split is exactly the right structure. The color language (near-black, muted off-white, one accent) is correct. The density is calibrated — not cramped, not airy.

**Steal:**
- The exact sidebar proportions: 240px, sticky, dense nav items at 12px with a meta column
- The selection indicator: left border + faint background tint
- The color discipline: three shades of gray, one accent, nothing else
- The keyboard shortcut pattern: discoverable, with a help overlay
- The transition timing: 80ms for color, 0 for layout

**Avoid:**
- Linear's gradients in the marketing site (not the app UI)
- Linear's onboarding animations — too much motion for a personal site

**One specific thing:** Linear's empty state text (`color: --faint`, centered, single sentence) is excellent. When a section has no content, show one quiet sentence. Don't show a skeleton loader or a placeholder card.

---

## 2. Tom MacWright (macwright.com) — Closest personal site reference

**Why it fits:**
MacWright is a developer who writes, builds tools, and thinks in public. The site reads like a compiled record of an active person. The date-first pattern, the multi-content-type index, the live state ("currently working on...") — these are exactly the right choices.

**Steal:**
- YYYY-MM-DD on everything, in a muted color, positioned consistently (right column or inline before the title)
- The hub-and-spoke homepage: categories with recent entries, links to full archives
- The "now" implicit signal — what's on the site right now communicates current focus
- The theme toggle (Auto/Light/Dark) — signals care about reading environment

**Avoid:**
- The horizontal top nav bar — MERULOX has a left panel instead, which is better for keyboard navigation
- The photos/drawings sections (unless you add similar non-technical content)

**One specific thing:** MacWright's arrow (`⇢`) pointing toward full category pages is a small but effective detail. It signals "more exists" without a button. Consider this for section links in the left panel.

---

## 3. Gwern.net — Closest for depth and density

**Why it fits:**
Gwern is the most fully-realized version of "personal archive as primary artifact." The site IS the person — everything they've thought and built is there, indexed, cross-referenced, annotated. The density is achieved without claustrophobia because the typography and spacing are controlled precisely.

**Steal:**
- The floating toggle bar (dark mode, reader mode, popup control) — ambient controls that don't interrupt the reading flow
- The popup-on-hover for internal links — reveals content without navigating away
- The confidence/certainty labels on essays — a form of content maturity labeling
- The breadth of content types coexisting: essays, links, wikis, data, code — all under one index

**Avoid:**
- The current visual implementation (ET Book on white, very academic) — the palette doesn't match MERULOX's dark, technical identity
- The absence of any navigation structure — Gwern works because of extreme reputation; for a less-known site, the left panel nav is essential

**One specific thing:** The sidenote pattern — metadata and citations in the right margin rather than inline or in footnotes. This is worth implementing for the /thinking section when it has content.

---

## 4. Pieter Levels (levels.io) — Closest for authenticity and operational transparency

**Why it fits:**
Levels doesn't explain what he does. He shows it. The site is a reverse-chronological list of everything he's shipped, written, and thought — going back years. The footer showing 5.8B total views is not bragging — it's the /stack equivalent for content output. The raw honesty of it is the identity.

**Steal:**
- The reverse-chronological list as primary content model: no curation, just what exists
- The footer stats — not fake metrics, but real accumulated output numbers
- The "building in public" framing: the site makes no claim to be finished or polished
- The sort/filter controls at the top of the list: `latest | oldest | views | views 30d` and `all | blog | long form` — this is lightweight navigation for a dense archive

**Avoid:**
- The visual rawness — Levels' site works because his output is massive. A sparse site with the same raw aesthetic looks unfinished.
- The X/Twitter post integration — mixing platforms with site content works for him but creates noise for MERULOX

**One specific thing:** The "pinned" section above the chronological list. A few evergreen items always visible above the fold, regardless of when they were created. Consider a `pinned: true` flag in content that keeps certain entries at the top of the index.

---

## 5. Derek Sivers (sive.rs) — Closest for voice and structure

**Why it fits:**
Sivers uses the simplest possible structure to express a fully-formed person. "Me in 10 seconds" is more effective as an intro than any three-paragraph bio. The books/projects/tweets sections are curated, not exhaustive. The transparency ("Everything I do is here on this site") is a design statement.

**Steal:**
- "Me in 10 seconds" — a distillation so short it forces clarity. MERULOX's lede h1 is this.
- The radical transparency framing: the site is the complete record, not a selection
- The single contact method ("say hello") — one action, not a row of icons
- The lack of a hero: identity is stated, then content begins immediately

**Avoid:**
- The white background and serif typography — doesn't match MERULOX's dark, technical register
- The overly personal tone (Sivers talks about his inner life) — MERULOX is more operational

**One specific thing:** Sivers updates his /now page regularly and it's dated at the bottom ("Updated: YYYY-MM"). The date on the /now page is a trust signal — it tells visitors the page is maintained, not abandoned.

---

## 6. Are.na — Closest for content-as-interface philosophy

**Why it fits:**
Are.na's central insight is that the interface should disappear into the content. There's no chrome, no marketing copy, no personality — just the blocks, organized by the person. The curator's taste is the identity. The blocks ARE the self-expression.

**Steal:**
- The block metaphor for entries: each item is a self-contained thing with a type, not a blob of text
- The "playlists but for ideas" framing: entries are curated, not just published
- The neutral, letting-content-speak palette: very little color, maximum focus on the content itself
- The organization by channel/collection rather than by category — the /stack, /work, /thinking split is a form of this

**Avoid:**
- The block-grid layout — too much like a mood board, doesn't communicate a person
- The absence of prose — Are.na works because blocks are the content. MERULOX needs written context alongside entries.

**One specific thing:** Are.na's channel descriptions (one sentence: "A place for…") are the right model for how MERULOX's section pages should introduce themselves. `/work — things built and shipped`. Not a paragraph. Not a mission statement. One phrase.

---

## 7. VS Code sidebar + editor split — Closest for layout reference

**Why it fits:**
The VS Code file tree (left) + editor (right) split is the most used two-panel layout in the world for technical users. The left panel is narrow, hierarchical, and always visible. The right panel is the working surface. The status bar at the bottom shows context-relevant state. The breadcrumb at the top shows where you are.

**Steal:**
- The sidebar proportion: VS Code default is 240px — the same as MERULOX spec ✓
- The active file indicator: the currently open file is highlighted in the tree — same as the active nav item in MERULOX ✓
- The status bar: context-specific information at the bottom of the viewport — the keybar serves this purpose ✓
- The breadcrumb: VS Code shows `filename > symbol` at the top of the editor — consider a subtle path indicator at the top of the reading column (e.g., `/work` in faint text, updated per page)

**Avoid:**
- The activity bar (far left icon column) — MERULOX doesn't have enough sections to need this extra layer of navigation
- The tab row above the editor — single-page navigation doesn't need tabs
- The split-editor / multi-panel — one reading column is sufficient

**One specific thing:** VS Code's "Explorer" title above the sidebar tree is tiny, uppercase, and muted — exactly the `section-label` treatment already in MERULOX's DESIGN.md. This validates the choice.

---

## 8. Maggie Appleton (digital garden) — Closest for content maturity model

**Why it fits:**
Appleton's system of distinguishing Essays (finished, opinionated) from Notes (loose, uncertain) from Patterns (reusable, documented) from Smidgeons (tiny, quick) is the best content taxonomy model for a personal site. It acknowledges that not everything is finished, and that's a feature, not a bug.

**Steal:**
- Typed entries: not all content is the same kind of thing. A shipped project is different from an in-progress experiment is different from a archived attempt. The state indicators (◆/○/·) are the current implementation of this.
- The antilibrary concept: a list of things you know you don't know. For MERULOX, this could be `/thinking — what I'm still figuring out` or a dedicated "open questions" section.
- The temporal markers: "9 months ago," "over a year ago" — these communicate active maintenance. The YYYY-MM dates already do this.
- The transparency framing: "Notes are loose and may be wrong." Honest about state.

**Avoid:**
- The thumbnail/image-heavy presentation — Appleton is a visual communicator. MERULOX is a builder.
- The blog-style "newest first" as primary nav — Appleton's garden is browsed, not read linearly. MERULOX's index is meant to be scanned quickly.

**One specific thing:** The distinction between Essays and Notes maps directly to MERULOX's shipped vs. active states. A published piece of writing that's done is like a ◆. A note that's still forming is like a ○. The state model already captures this — apply it to writing entries when /thinking has content.

---

## Summary table

| Site | Structure steal | Content steal | Interaction steal |
|---|---|---|---|
| Linear | Sidebar proportions, selection indicator, color discipline | — | 80ms transitions, help overlay, keyboard-first |
| MacWright | Hub-and-spoke homepage | Date-everything | Theme toggle |
| Gwern | Margin annotations (future) | Content maturity labels | Popup-on-hover (future) |
| Levels | — | Lead with current work, show the volume, pinned entries | Sort/filter controls |
| Sivers | — | "Me in 10 seconds" lede, radical transparency, dated /now | — |
| Are.na | — | Block metaphor, section one-liner descriptions | — |
| VS Code | Left panel = 240px, active state, status bar = keybar | — | Breadcrumb indicator |
| Appleton | — | Typed entries, content maturity transparency | — |
