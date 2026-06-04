# MERULOX — Design Specification

> For the builder (Codex). This document is the source of truth.
> The creative director (Claude) owns this document. Do not modify it — implement from it.

---

## What this site is

A personal website for a systems thinker who builds AI-first infrastructure.
Target audience: startup founders, engineers, technical recruiters, AI builders.

It should communicate: systems thinking, leverage, experimentation, product building, AI-assisted workflows, curiosity.

It should feel: intelligent, technical, exploratory, ambitious, modern, memorable.

It must NOT feel like: a SaaS dashboard, a Linux terminal clone, a developer portfolio template, or any performance of technical identity.

---

## What has been tried and failed

**Failure A — terminal-themed SaaS dashboard**
Cards, fake metrics, system status widgets, startup aesthetic. Rejected: performs being technical instead of demonstrating it.

**Failure B — literal file manager (current state)**
ncurses clone, ls-style file list sourced from a local ideas/ folder. Rejected: inaccessible, not presentable to employers, container with no visible person inside.

---

## Direction: SPECSHEET structure + FIELDNOTES content layer

**Structure (SPECSHEET):** Authoritative, indexed, always-legible. Persistent left nav panel + reading column. Like a well-maintained API reference for a person.

**Content (FIELDNOTES):** Authored voice. Visible project states (shipped / active / archived). Honest dates. Process visible alongside output.

The combination: precision in form, humanity in content.

---

## Layout

### Two-panel grid

```
┌─────────────────┬────────────────────────────────────┐
│   LEFT PANEL    │          READING COLUMN            │
│   224px fixed   │   max-width 680px, padded          │
│   sticky        │   scrollable                       │
│   100vh         │                                    │
└─────────────────┴────────────────────────────────────┘
```

- Left panel: `position: sticky; top: 0; height: 100vh; overflow-y: auto`
- Right column: `padding: 28px 40px; max-width: 700px`
- Outer margin: the remainder of viewport width — leave it empty

### Mobile (< 720px)

Left panel becomes a top bar:
- Horizontal flex row: wordmark | nav links | contact
- `overflow-x: auto` for links if they overflow
- Identity tagline hidden
- Panel becomes `position: static; height: auto; border-bottom`

---

## Left panel — content and structure

```
MERULOX                          ← wordmark, 13px, 700, letter-spacing 0.14em

Systems thinker.                 ← identity tagline, 12px, --muted, 3 lines
AI-first workflows.
Quebec.

──────────────────               ← hr, 1px --line-strong

index                            ← nav items, 12px, --muted
/work          3                 ← label left, meta right (count or state)
/thinking      —
/stack         live
/now           →

──────────────────

merultox@gmail.com               ← margin-top: auto (pushes to bottom)
```

**Nav item active state:** `background: --surface; color: --text`
**Nav meta active state:** `color: --accent`
**Hover:** `color: --text` transition 80ms

---

## Color tokens

```css
--bg:          #0c0e12;   /* dark slate, blue undertone — not pure black */
--surface:     #131720;   /* barely lighter — rows, active nav */
--line:        #1e2530;   /* structural dividers */
--line-strong: #2a3444;   /* emphasized dividers, nav rules */
--text:        #d6dde8;   /* primary text — warm off-white */
--muted:       #6b7a8e;   /* secondary text, descriptions */
--faint:       #3d4a5a;   /* tertiary — metadata, rules, placeholders */
--accent:      #3ab8c4;   /* teal — selection, active, links */
--selection:   rgba(58, 184, 196, 0.10);

--shipped:     #2d9e6b;   /* green — done, stable, in production */
--active-col:  #b08c3e;   /* amber — in-progress, current work */
--arch:        #3d4a5a;   /* same as --faint — archived/deprecated */
```

**No background patterns.** No grid lines. No scan-line overlay. Solid `--bg` only.

---

## Typography

Single font family: `"SFMono-Regular", Consolas, "Liberation Mono", ui-monospace, monospace`

No external font dependencies. System monospace stack only.

| Role | Size | Weight | Color | Notes |
|---|---|---|---|---|
| Wordmark | 13px | 700 | --text | letter-spacing 0.14em, uppercase |
| Nav items | 12px | 400 | --muted / --text | left label, right meta |
| Body / descriptions | 13px | 400 | --muted | max 58ch line length |
| Entry names | 13px | 600 | --text | |
| Section labels | 11px | 400 | --faint | uppercase, letter-spacing 0.08em |
| Metadata / dates | 11px | 400 | --faint | |
| Page h1 lede | 15px | 600 | --text | homepage identity statement |
| Tags / chips | 10–11px | 400–600 | varies | see state chips |

Base font-size: **14px**. Line-height: **1.5**.

---

## State indicators

Used in entry lists (inline, left of entry name):

```
◆   data-state="shipped"   color: --shipped    (green)
○   data-state="active"    color: --active-col (amber)
·   data-state="archived"  color: --faint      (grey)
```

Size: 9–10px. Sits in a 14px column left of entry body.

State chips (used on work page, in work-item headers):

```
shipped   bg: rgba(45,158,107,0.12)  text: --shipped
active    bg: rgba(176,140,62,0.12)  text: --active-col
archived  bg: rgba(61,74,90,0.12)    text: --faint
```

Chip: `font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 2px`

---

## Entry list pattern

Used on homepage (master index) and section pages.

```html
<ul class="entry-list">
  <li class="entry" data-href="/work#boreal" data-state="shipped">
    <span class="entry-indicator" data-state="shipped"></span>
    <div class="entry-body">
      <span class="entry-name">Boréal Numérique</span>
      <p class="entry-desc">AI automation for Quebec trades. Missed-call text-back, lead triage, quote follow-up.</p>
      <div class="entry-footer">
        <span>/work</span>
        <span>2026-04</span>
      </div>
    </div>
  </li>
  ...
</ul>
```

**Entry layout:** `display: grid; grid-template-columns: 14px minmax(0,1fr); gap: 10px; padding: 10px 6px`

**Selection / hover state:** `border-left: 2px solid --accent; background: --selection`
Default: `border-left: 2px solid transparent`

**Keyboard nav (carry over from existing ArchiveBrowser pattern):**
- `j` / ArrowDown → move selection down
- `k` / ArrowUp → move selection up
- `Enter` / `l` → follow `data-href` of selected entry
- `/` → focus search (if search present)
- `Escape` → clear search / deselect

The JS pattern from the existing `ArchiveBrowser.astro` is the correct reference. Adapt it for the entry list — entries are `[data-href]` elements, not file-list rows.

---

## Pages and content

### `/` — Homepage

**Lede (reading column, top):**
```
I build systems that run without me.

Currently: AI-first operational scaffolding for Quebec tradespeople.
Incoming clients for Boréal Numérique — the first case study install.
```

**Then a `<hr class="content-rule">` and a section label:**
```
recent
```

**Then the master entry list — all projects, most recent first:**

```
◆  Boréal Numérique                               /work    2026-04
   AI automation for Quebec trades. Missed-call text-back,
   lead capture triage, quote follow-up automation.

◆  Personal AI Infrastructure                     /stack   ongoing
   Multi-agent Claude system: persistent memory, synthesis,
   autonomous task execution. Runs on systemd. Coordinates
   via a message bus across multiple specialized instances.

○  MERULOX                                        here     2026-06
   This site. Astro, static, keyboard-navigable.
   Rebuilt from scratch.
```

**Keybar at bottom:**
```
j/k move   enter open   / search
```

---

### `/work` — Projects

**Page heading:**
```
/work
things built and shipped
```

**Work items (not cards — rows with a border-bottom separator):**

---

**Boréal Numérique** [shipped chip] [2026-04 right-aligned]

AI-first operational scaffolding for Quebec tradespeople in growth mode.
Missed-call text-back, lead capture triage, quote follow-up automation.
The AI does the clerical work; the contractor keeps every client conversation.

Tags: `Twilio` `Claude API` `n8n` `GHL` `Python`

---

**Personal AI Infrastructure** [active chip] [ongoing right-aligned]

Multi-agent system built on Claude. Persistent memory across sessions,
knowledge synthesis from ingested content, autonomous task execution.
Multiple specialized instances coordinate via a shared message bus.
Runs persistently on systemd.

Tags: `Claude API` `systemd` `Python` `bash`

---

**MERULOX** [active chip] [2026-06 right-aligned]

This site. Static, keyboard-navigable, deployed to Cloudflare Pages.
Built to communicate systems thinking without performing it.

Tags: `Astro` `CSS`

---

### `/now` — Current focus

**Prose blocks with uppercase section labels:**

```
focus

Closing first clients for Boréal Numérique.
Target: 2 Quebec tradespeople already running paid lead-gen
(Facebook ads, Kijiji, SoumissionRenovation).

The goal is a working operational case study install before
scaling cold outreach. One real install validates the offer.


not doing

Track B (L'Arbitrageur) — deferred until Track A has 2 clients.


updated

2026-06-03
```

---

### `/thinking` — Writing

**Stub for now:**

```
/thinking
frameworks, positions, and long-form writing

[stub notice]
Nothing published yet. Writing comes after the first client ships.
```

---

### `/stack` — Operational layer

**Intro:**
```
/stack
what runs in the background
```

**Then a list of active systems with descriptions:**

```
◆  Brain / Memory System                          ongoing
   Persistent knowledge graph fed by ingested content. Multiple
   Claude instances read from and write to a shared vault.
   Synthesis, atomization, and promotion run on schedule.

◆  Outreach Pipeline                              2026
   Lead scraping → SMS campaign → reply agent → close agent.
   Twilio for SMS. Claude API for reply classification
   and response drafting.

◆  Command Center                                 running
   Dashboard + Telegram commander. Monitors services, routes
   commands, surfaces signals.
```

---

## File structure to create

```
src/
  styles/
    global.css          ← rewrite (this doc is the spec)
  layouts/
    Layout.astro        ← rewrite (two-panel shell + SiteNav)
  components/
    SiteNav.astro       ← new (left panel)
    EntryList.astro     ← new (reusable entry list with keyboard nav)
  pages/
    index.astro         ← rewrite (homepage: lede + master index)
    work.astro          ← new
    now.astro           ← new
    thinking.astro      ← new (stub)
    stack.astro         ← new
```

`ArchiveBrowser.astro` — keep in place, do not import from any page. It can be wired up to `/thinking` in a future iteration.

---

## What to keep from the existing codebase

- **Keyboard navigation pattern** — the JS in `ArchiveBrowser.astro` is the reference. The j/k/Enter/l/h/g/G/? pattern is correct. Adapt it for the new entry list.
- **Keybar HTML pattern** — the `<footer class="keybar">` pattern is correct. Keep the hint bar.
- **Help overlay pattern** — the `data-help` overlay is correct. Keep it.
- **Astro + static conventions** — plain Astro, HTML, CSS. No framework dependencies. No npm additions unless absolutely necessary.

---

## What NOT to do

- No background grid or scan-line overlay (they're decorative noise)
- No `MERULOX_OS` anywhere — drop the `_OS`
- No breadcrumb header showing file paths (e.g. `MERULOX_OS / /ideas / N files`)
- No cards as the primary unit — rows and lists only
- No fake metrics, status indicators, or animated counters
- No tech logo grids
- No skill proficiency bars
- No "available for work" banners
- No hero image or stock photography
- No transitions longer than 120ms
- No separate contact page — contact (email) lives in the left panel footer
- No hamburger menus
- No `body::before` scan-line effect
- No grid background on body

---

## Acceptance criteria

A senior engineer landing on this site should conclude within 20 seconds:
"This person builds systems, thinks precisely, and ships things."

They should NOT conclude: "This person likes terminal aesthetics."

The keyboard navigation should be discoverable but not required.
A visitor using only a mouse and scroll should have a complete experience.
