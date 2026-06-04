# Typography Recommendations

Findings from 30 examples. Organized by decision, not by principle.

---

## The core question: one typeface or two?

### All-monospace (current direction)
**Examples using it:** Dan Luu (effectively), Paco Coursey, the existing site
**What it communicates:** Technical precision, system-first thinking, consistency
**Risk:** Fatigue on long prose. Monospace at small sizes (11–12px) in metadata is fine. Monospace at reading size (13–14px) for 500-word descriptions becomes tiring.
**Verdict:** Correct for MERULOX at current content volume. If writing sections grow past 300 words per entry, reconsider.

### Two typefaces (mono + proportional)
**Examples using it:** Gwern (ET Book + code mono), Maggie Appleton (sans body + mono accents), Tom MacWright (system sans + mono dates)
**What it communicates:** Authorship — the person writes, not just builds. Warmth alongside precision.
**Risk:** Requires discipline. The moment typefaces are mixed without strict rules, the page looks undecided.
**Verdict:** Right choice once writing becomes primary. Not yet.

### Single variable font spanning mono/sans
**Examples using it:** Sites built on Recursive (spans mono to sans), iA Writer Duo
**What it communicates:** Unity — everything from code to prose looks like it belongs together
**Risk:** Requires a font that loads fast and renders cleanly at 14px on dark backgrounds
**Verdict:** Worth exploring for a future iteration. Recursive (monospace axis → casual axis) would let you keep mono for labels and pull toward sans for longer prose without introducing a second font file.

---

## Size scale

**What the examples teach:**
- Base 13–14px is standard for technical sites (Linear uses 14px, Notion 14px, VS Code 13px)
- Going below 12px for metadata is fine if contrast is sufficient — but never below 11px
- Going above 16px for anything that's not a wordmark risks looking like a landing page

**Recommendation for MERULOX:**
```
wordmark:       13px   700   letter-spacing 0.14em
nav / labels:   12px   400
section labels: 11px   400   uppercase  letter-spacing 0.08em
entry names:    13px   600
body / desc:    13px   400
metadata:       11px   400
```

The gap between 13px (content) and 11px (metadata) is the key hierarchy. Don't add intermediate sizes — every size you add is a decision you'll have to maintain.

---

## Weight

**What the examples teach:**
- Most technical sites use only two weights: regular (400) and semibold/bold (600–700)
- Lightweight (300) text on dark backgrounds reads as faint, not elegant — Linear avoids it
- Extra bold (800+) is for wordmarks and wordmarks only

**Recommendation for MERULOX:**
- 700: wordmark only
- 600: entry names, project headings, page h1
- 400: everything else
- Never 300 or 800

---

## Line length

**What the examples teach:**
- Tom MacWright, Gwern, and Maggie Appleton all cap prose at approximately 65–70ch
- Dan Luu and Paul Graham let lines run long — works when typography is doing nothing else, feels cramped otherwise
- Dark backgrounds need slightly shorter lines (60–65ch) because contrast fatigue happens faster

**Recommendation for MERULOX:**
- Lede h1: max 50ch (short, punchy)
- Body / descriptions: max 58ch (already in DESIGN.md — correct)
- The `max-width: 58ch` currently in the CSS is the right call

---

## Letter-spacing

**What the examples teach:**
- Monospace fonts at small sizes need positive tracking to breathe — 0.04–0.08em
- Section labels (uppercase, small) need more tracking — 0.08–0.12em
- Wordmarks with short words benefit from aggressive tracking — 0.12–0.16em
- Body text at reading size should never be tracked — it slows reading

**Recommendation for MERULOX:**
- Wordmark `MERULOX`: letter-spacing 0.14em ✓ (already specced)
- Section labels (uppercase 11px): letter-spacing 0.08em ✓ (already specced)
- Everything else: default (no explicit letter-spacing)

---

## Line height

**What the examples teach:**
- Monospace at 14px: line-height 1.5 is comfortable — matches VS Code defaults
- At 11–12px (metadata): 1.3–1.4 is fine — tighter for labels, not for paragraphs
- Long prose blocks (300+ words): 1.6–1.65 becomes noticeably more readable
- Terminal/htop-style displays: 1.2–1.3 for maximum density

**Recommendation for MERULOX:**
- Base: 1.5 ✓ (already in CSS)
- Lede h1: 1.4 (it's a statement, not prose)
- Body descriptions: 1.55–1.6 (slightly looser than base for readability)
- Metadata: inherit (1.5 is fine for 11px)

---

## Color in type

**What the examples teach:**
- The sites that feel most typographically controlled use color only to indicate hierarchy, never decoration
- Gwern: black / dark gray / gray — three shades, nothing else
- Linear: near-white / muted / faint — three shades, nothing else
- Accent color in type: used only for links on hover or active states — never as a text color in body content

**Recommendation for MERULOX:**
- --text (primary), --muted (secondary), --faint (tertiary): the only text colors
- --accent appears in: selected state indicator, active nav item meta, active/focus borders
- Never use --accent as inline text color in prose or descriptions

---

## The one typographic detail that separates good from great

**Source:** Observation from Linear, Paco Coursey, Rauno Freiberg
**The detail:** Consistent baseline grid. Every text element sits on an invisible 4px or 8px grid. Headings, body, metadata — when these align, the page feels resolved. When they don't, it feels like assembled parts.

**How to get it without measurement:**
Set all `padding`, `margin`, and `gap` values to multiples of 4px. If something feels "off" visually, check whether a spacing value is breaking the grid (e.g., 6px instead of 4px or 8px).

The existing CSS uses `6px 0` for input padding and `3px` for entry gaps — these are the gaps in the current grid. Worth cleaning up to strict 4px multiples.
