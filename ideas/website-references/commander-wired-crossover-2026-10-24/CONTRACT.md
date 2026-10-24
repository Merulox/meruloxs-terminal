# Contract — merulox.com × Commander WIRED crossover comparison

Frozen across both mockups: content, copy, information hierarchy, breakpoints.
Only the aesthetic treatment varies. Content is the real site's own copy
(wordmark, employer hero line, nav, focus areas, one archive-style entry list
with shipped/active/archived states) — nothing invented.

- Desktop 1440×900, mobile 390×844.
- Text ≥12px, body ≥13px, AA contrast.
- `<meta name="robots" content="noindex,nofollow">` on both.
- No network dependency beyond Google Fonts (JetBrains Mono, VT323 — both
  already used somewhere in the real site or the approved Commander hybrid).
- Status always glyph + word, never colour-only.

## A — "Shared Dialect" (borrow primitives, keep the site's own identity)
Current merulox.com column layout, current content, current teal accent kept
as primary — but: hard 0-radius edges everywhere (already true), an offset
2px/2px pixel-shadow on hover/active states (from hybrid.css), bracket-wrapped
wordmark `[MERULOX]`, a second accent (lavender, from the Commander hybrid)
reserved for one meaning only (hover/selection chrome), green kept for
shipped-state only. No panes, no rail, no status bar, no host-prompt branding.

## B — "Full reskin" (literal Commander chrome on personal-site content)
Same content, same copy — but staged inside Commander's actual DOM idiom:
status bar with host id, left icon rail, bordered panes with pane-head bars,
hard pixel-shadows throughout, lavender/green hybrid palette applied globally
including body copy. Built deliberately to test whether the audience-facing
content still reads as "a person" once wrapped in product chrome.
