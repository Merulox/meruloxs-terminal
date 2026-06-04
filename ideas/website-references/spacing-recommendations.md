# Spacing Recommendations

Density findings from 30 examples. The core tension: information density vs. breathing room.

---

## The density spectrum

The 30 examples fall roughly into three density bands:

**Maximum density** (content first, whitespace never)
Dan Luu, Paul Graham, Hacker News, Suckless — these sites use almost no whitespace. The implicit message: "If you're here, you're here for the content. The design is not the point."
Risk for MERULOX: reads as unpolished to non-technical audiences (startup founders, recruiters).

**Calibrated density** (each item gets space, not luxury)
Linear, VS Code, Lobste.rs, Tom MacWright, Lee Robinson — these sites breathe without wasting. Sections are separated clearly. Items have padding. But nothing is padded for aesthetics alone.
This is the right target for MERULOX.

**Generous whitespace** (breathing room as identity)
Paco Coursey, Rauno Freiberg, Patrick Collison — large outer margins, tall section gaps, very few items per viewport. The whitespace IS the design statement.
Risk for MERULOX: too precious for a systems-builder site. Whitespace here communicates "carefully crafted artifact" — which is true for a product designer but feels mismatched for an operator/builder.

**Verdict:** Aim for calibrated density. Not cramped, not airy.

---

## Outer padding (site-level)

**What the examples teach:**
- Sites targeting technical audiences: 16–24px outer padding on mobile, 28–40px on desktop
- Sites targeting design/creative audiences: 40–80px outer padding
- Linear: 24px container padding — feels tight but resolved
- VS Code: essentially no outer padding — but it's an application, not a site

**Recommendation for MERULOX:**
- Reading column: `padding: 28px 40px` on desktop (already specced) ✓
- Mobile: `padding: 20px 16px` (already specced) ✓
- Don't add more. The current values are in the calibrated-density zone.

---

## Section separation

**What the examples teach:**
- A `<hr>` (or 1px border line) between sections does more work than `margin` alone
- Maggie Appleton, Tom MacWright: visual dividers between major sections, whitespace within sections
- Linear: sections separated by both whitespace AND a subtle rule
- The rule communicates "this is a deliberate boundary," not just "I left space"

**Recommendation for MERULOX:**
- Use a 1px `--line-strong` rule between major sections (lede → index, sections on work page)
- Use `margin` alone (no rule) between items within a section
- The `content-rule` class in DESIGN.md is correct — use it consistently

**Measurements:**
- Before a section rule: 24–28px
- After a section rule: 16–20px
- Between list entries: 0px (entries are separated by padding, not margin — the border-left selection indicator needs flush rows)

---

## Entry row padding

**What the examples teach:**
- Lobste.rs entries: approximately 6–8px vertical padding, 4–6px horizontal — tight but scannable
- Hacker News: essentially 2–4px — extremely tight, works because font is large enough
- Linear tasks: 8–10px vertical — slightly more breathing room for the drag handle affordance
- VS Code file tree: 4–6px — dense, scannable

**Recommendation for MERULOX:**
- Entry row: `padding: 10px 6px` (already specced) — this is in the right zone
- Don't go below 8px or above 12px — below 8px feels cramped for mouse users, above 12px wastes list space

---

## Left panel spacing

**What the examples teach:**
- VS Code sidebar: 6px padding on items, 24px outer padding — fits 20+ items comfortably
- Linear sidebar: 8px padding on items, 16px outer padding — denser, works because items are few
- Figma layers panel: 4px padding — extremely dense, designed for power users who know what they're looking for

**Recommendation for MERULOX:**
- Nav link padding: `5px 7px` (already in CSS) — correct
- Outer panel padding: `28px 18px` (already in CSS) — slightly generous on top, reasonable on sides
- Wordmark to first nav item: 26px (already) — provides enough separation between identity and nav

---

## The 4px grid

**Source:** Linear, Stripe, most modern design systems
**What it is:** All spacing values are multiples of 4px. Never 3px, 6px, 10px (unless 10 is intentional — but 8 or 12 is cleaner).
**Why it works:** When every spacing value is on the grid, elements feel resolved. When they're off-grid, nothing looks wrong but nothing clicks into place.

**Current CSS audit — values to reconsider:**
- `gap: 10px` in entry-list: use 8px or 12px
- `padding: 6px 0` in input: use 4px or 8px
- `margin-bottom: 3px` in entry-name: use 4px
- `gap: 14px` in entry-footer: use 12px or 16px

These are small, but they add up. Clean grid = resolved page.

---

## The margin as breathing room vs. margin as statement

**Key distinction from the examples:**

Paco Coursey and Rauno Freiberg use large margins as the statement — the whitespace IS the aesthetic. This only works when the content is sparse and the site is designed for a design audience.

Linear and VS Code use margins functionally — enough to separate regions, no more.

**For MERULOX:** The outer margin (everything to the right of the 700px reading column) is empty. This is intentional. Don't fill it with decorative elements or a right panel. The emptiness signals that the content is dense enough not to need width to fill the viewport.

In a future iteration: the outer margin could hold marginalia (dates, tags, annotations) that appear on hover — the Gwern pattern. But only when there's content worth annotating.

---

## Mobile spacing

**What the examples teach:**
- Mobile should feel like a compact version of desktop, not a different site
- The left panel collapsing to a top bar is standard (VS Code mobile, Linear mobile)
- Reading column on mobile: 16px horizontal padding is the standard (matches iOS Safari safe area)
- Entry rows on mobile can be slightly tighter: 8px vertical instead of 10px

**Current spec already handles this correctly.** No changes needed.
