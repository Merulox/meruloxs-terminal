# Interaction Recommendations

Navigation, keyboard, hover, and transition patterns from 30 examples.

---

## The keyboard-first principle

**Source:** Linear, Vim/Helix, the existing ArchiveBrowser.astro, Lobste.rs (j/k since 2012)
**What it is:** The site is fully navigable via keyboard. j/k for list movement, Enter to open, / for search, Escape to clear. Mouse works but isn't required.
**Why it works for MERULOX:** It demonstrates competence without describing it. A visitor who uses keyboard shortcuts will find them and have an immediate positive reaction. A visitor who doesn't will never notice they're there.

**Current implementation (ArchiveBrowser.astro) is the right pattern. Carry it forward exactly:**
- j / ArrowDown → move selection down
- k / ArrowUp → move selection up
- Enter / l / ArrowRight → open selected item
- h / ArrowLeft → back
- / → focus search
- g → top, G → bottom
- ? → help overlay
- Escape → clear / close

**One addition not in the current code:** `[` and `]` (or `[` and `Tab`) for navigating between sections in the left panel. This is a pattern from Linear and VS Code — the sidebar sections are keyboard-navigable, not just the content list.

---

## Discoverability without tutorialization

**Source:** Helix editor (context-aware bottom bar), htop (always-visible key hints), the existing keybar
**The problem:** Keyboard shortcuts are invisible unless the visitor already knows about them.
**The solution already in the site:** The keybar footer row. It shows the currently relevant shortcuts.
**Important rule:** The keybar should only show shortcuts that work on the current page. If a page has no list to navigate, don't show `j/k move`. If there's no search, don't show `/ search`. Context-aware keybars are more trustworthy than static ones.

---

## Hover: reveal, don't transform

**Source:** Tom MacWright (dates come into focus on hover), Gwern (popups on link hover), Linear (subtle row highlight)
**What it is:** Hover reveals information that was there but muted. It does NOT change layout, push elements, or animate the shape of things.
**The principle:** Hover reveals metadata. It does not perform.

**Specific hover behaviors to implement:**

1. **Entry rows:** On hover, `border-left-color` transitions to `--accent` and background to `--selection`. Already implemented. No other hover effect needed on the row itself.

2. **Entry metadata (dates, section tags):** Default: `color: --faint`. Hover on the row: metadata intensifies to `color: --muted`. Achieved with: `.entry:hover .entry-footer { color: var(--muted); }`. Subtle, earned.

3. **Nav links:** Default `color: --muted`. Hover: `color: --text`. 80ms transition. Already implemented.

4. **Links in prose:** Default: `color: inherit` (no visual distinction). Hover: `color: --text` or underline appears. Don't color all links blue by default — the monospace style makes links legible through context.

**What NOT to do on hover:**
- Move elements (no `transform: translateY`)
- Change font size or weight
- Add or remove borders that shift layout
- Trigger animations longer than 120ms

---

## Transition timing

**Source:** Linear (80ms for color transitions, 120ms for layout), Paco Coursey (instant), Rauno Freiberg (longer, deliberate — but he's a motion designer, different context)
**Recommendation for MERULOX:**
- Color, background, border: `80ms ease`
- Opacity: `80ms ease`
- Nothing else. No `transform`, no `height`, no `width` transitions.
- The current CSS has `transition: color 80ms ease, background-color 80ms ease, border-color 80ms ease` on `.entry` — correct.

---

## Search as primary navigation

**Source:** Linear (⌘K command palette), Notion (search everything), Are.na (search over browse), the existing `/ search` pattern
**What it is:** Search is not an afterthought in a header input. It's a primary navigation mode, accessible from anywhere via a keyboard shortcut.
**For MERULOX:** The `/ search` pattern already in the site is correct. As content grows, the search becomes more valuable. The current implementation filters visible entries by name/path/type — make sure future content is also indexed here.

---

## The selection indicator pattern

**Source:** VS Code (active file highlight in tree), Linear (selected task), the existing `aria-selected + border-left` pattern
**What it is:** The currently focused/selected item has a left border in the accent color and a subtle background tint. Nothing else changes.
**Why it works:** The indicator is always visible. You always know what's selected. The left border specifically reads as "cursor position" — it's the right metaphor for keyboard navigation.
**Current implementation is correct.** `border-left: 2px solid --accent; background: --selection` on `[aria-selected="true"]`.

---

## Help overlay

**Source:** Vim `:help`, the existing `data-help` / `?` pattern
**What it is:** Pressing `?` shows a modal overlay listing all keyboard shortcuts.
**Why it works:** It's the right model. The keybar shows the most common shortcuts; the help overlay shows everything. Users who want to explore find it; users who don't never see it.
**Keep the existing implementation exactly.** The `data-help hidden` pattern and the `?` trigger are correct.

---

## The "no scroll hijacking" principle

**Source:** Dan Luu, Patrick Collison, every site that respects the user
**What it is:** Scrolling scrolls. No custom scroll behavior, no scroll snapping (unless the content explicitly requires it), no parallax.
**Why it works:** Scroll hijacking is almost universally hated by keyboard and mouse users alike. It signals that the designer prioritized an animation over the visitor's control of their own viewport.
**For MERULOX:** The viewport is the page. Scroll is native. Never override it.

---

## The command palette (future)

**Source:** Linear (⌘K), VS Code (⌘P), Raycast, Vercel dashboard
**What it is:** A search-everything modal triggered by a keyboard shortcut. Surfaces pages, entries, actions from anywhere.
**Why it matters for MERULOX later:** When the site has 20+ entries across 5 sections, the entry-list search per page becomes insufficient. A global ⌘K palette that surfaces any entry across all pages is the correct solution. It also makes the site feel like an application, not a document.
**When to add it:** After 20+ total entries across pages. Before then, per-page search is sufficient.

---

## What NOT to build

- **Smooth scroll:** Native instant scroll is faster and feels more precise.
- **Page transition animations:** Fades and slides between pages add 200–400ms of latency to every navigation. Technical users notice and resent it.
- **Sticky headers with blur:** The left panel is already sticky. A sticky top bar on top of that creates z-index conflicts and visual noise.
- **Infinite scroll:** See patterns-to-avoid.md.
- **Hover menus / dropdowns:** The nav is flat. It should stay flat.
- **Drag-and-drop:** This is a personal site, not a workspace.
