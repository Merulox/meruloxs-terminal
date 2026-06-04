# Patterns Worth Stealing

15 patterns extracted from analysis of 30 examples.
Each pattern: what it is, where it comes from, why it works, how to apply it.

---

## 1. Date everything

**Source:** Tom MacWright, Dan Luu, Pieter Levels, Gwern
**What it is:** Every piece of content carries a visible date in ISO or MM/YY format. Not buried in metadata — displayed inline, at the top or in the margin.
**Why it works:** Dates communicate that the site is maintained. They signal that the person ships and documents over time. They make the site feel like a record, not a brochure.
**For MERULOX:** Put `YYYY-MM` on every entry, project, and now-page update. Don't hide it. The date is a signal, not a detail.

---

## 2. Content maturity labels

**Source:** Maggie Appleton (Essays vs. Notes vs. Patterns), Gwern (confidence levels on essays)
**What it is:** Content is labeled by its state — not just "published" vs. "draft" but nuanced: finished, in-progress, seedling, abandoned.
**Why it works:** It communicates intellectual honesty. It also makes it safe to publish unfinished thinking without it looking like failure. The state IS the metadata.
**For MERULOX:** Already using shipped / active / archived. This validates that decision. Consider adding one more state: `experiment` — things tried but not committed to.

---

## 3. The /now page

**Source:** Derek Sivers (inventor), Tom MacWright, hundreds of others at nownownow.com
**What it is:** A page that answers: "What are you working on right now?" Updated regularly. Not a resume — a current state.
**Why it works:** It makes a static site feel alive. It signals that the person is active, focused, and honest about their priorities. It's the one place where the site admits to being a human, not a product.
**For MERULOX:** Already in the spec. The /now page should be the most frequently updated page on the site. Even a two-line update matters.

---

## 4. The left panel as wayfinding, not decoration

**Source:** VS Code, Linear, Obsidian, Tom Critchlow's digital garden
**What it is:** A persistent left panel that shows the structure of the site — not a hamburger menu, not a top bar, but a constant presence that tells you where you are and what else exists.
**Why it works:** The visitor always knows what's available without hunting. The panel is architecture made visible, not a nav widget bolted on.
**For MERULOX:** Already in the spec. The key detail from VS Code and Linear: the panel should be narrow and dense, not wide and spacious. 200–240px is the right range. Anything wider starts becoming a feature.

---

## 5. Rows over cards

**Source:** Hacker News, Lobste.rs, Dan Luu, Linear, Pieter Levels
**What it is:** Content is presented as flat rows in a list, not cards with borders and shadows and equal-weight visual presence.
**Why it works:** Rows imply a system produced this list. Cards imply a designer laid them out. Rows are faster to scan. Cards emphasize individual items at the expense of the whole. When you have 3 items, rows feel like a deliberate collection. Cards feel like a portfolio template.
**For MERULOX:** Entries are already rows. Resist any instinct to add border, shadow, or background fill to individual entries. The selected state (border-left + faint background) is sufficient.

---

## 6. Monospace for structure, proportional for reading

**Source:** Tom MacWright, Gwern (ET Book body + mono for code), Paco Coursey (mono throughout), Linear (Inter for UI)
**What it is:** A deliberate division between typeface roles. Monospace is used for: identifiers, paths, dates, tags, navigation labels, metadata. Proportional (or a more readable mono) is used for: body text, descriptions, prose.
**Why it works:** Monospace signals "system label" — the reader's brain treats it as metadata, not content to read. It creates a visual layer that organizes the page without using color or weight alone.
**For MERULOX:** Currently all-monospace. This is defensible but watch readability at length. If writing sections grow, consider iA Writer Duo or Recursive (variable font bridging mono and sans) for prose.

---

## 7. Metadata in the margin (annotations)

**Source:** Gwern (sidenotes, popups on link hover), Maggie Appleton (tags, dates in margins)
**What it is:** Secondary information — dates, tags, word counts, confidence levels — lives in the outer margin, not inline with the main text. On hover, more annotation appears.
**Why it works:** The main text stays clean. The margin is for those who want to go deeper. It creates two reading speeds in one page: fast scan (main text) and deep read (margin annotations).
**For MERULOX:** Not in the spec yet. Consider it for the entry list: date + section in a right-aligned column, rather than stacked below the description. Or: dates appear at full opacity on hover, faint by default.

---

## 8. Show the volume

**Source:** Pieter Levels (5.8B total views in footer), Dan Luu (hundreds of posts just visible as a list), Gwern (years of archived work visible in index)
**What it is:** The sheer amount of work is visible. Not described ("I've written 200 posts") — just present. The list IS the proof.
**Why it works:** Quantity communicates consistency. One great project could be luck. Twenty shipped things over five years is character.
**For MERULOX:** The /stack page is where this lives. The list of 50+ scripts in ~/scripts/ is a form of this — a visible body of work. The site doesn't need to brag about it; it just needs to show it.

---

## 9. Lead with current work, not history

**Source:** Pieter Levels (homepage is latest posts, not "about me"), Tom MacWright (recent entries dominate homepage), Rauno Freiberg (manifesto leads, then current projects)
**What it is:** The homepage prioritizes what you're doing now, not your backstory. History is available but not the entry point.
**Why it works:** What you did 3 years ago is less interesting than what you're shipping today. Leading with current work signals momentum.
**For MERULOX:** The master index on the homepage should sort by recency. The lede should mention current work explicitly ("Currently: Boréal Numérique"). The most recent entry in the list gets visual emphasis — not a different treatment, just first position.

---

## 10. One contact method, placed simply

**Source:** Paco Coursey (p@paco.me in nav), Derek Sivers ("say hello" inline link), Paul Graham (no contact at all — you email his published addresses)
**What it is:** Contact information is one method, placed once, in a predictable location. No contact form. No social row. One email address.
**Why it works:** Multiple contact methods signal anxiety about being reached. One email address signals confidence. The visitor can reach you if they want to; the site doesn't beg.
**For MERULOX:** Email in the bottom of the left panel, as specced. One line. No label — the address is self-explanatory.

---

## 11. State over description

**Source:** Maggie Appleton (maturity labels), Pieter Levels (category tags on posts), Linear (status on every item)
**What it is:** Every item has a declared state — what it is, not what it was called. "shipped" is more informative than "project." "experiment" is more informative than "idea."
**Why it works:** State is objective metadata. Description is subjective prose. State lets visitors filter mentally before reading.
**For MERULOX:** Already using ◆/○/· for shipped/active/archived. This is the right move. Keep it. Don't soften it into prose ("this project is complete").

---

## 12. No hero, no above-the-fold logic

**Source:** Dan Luu, Paul Graham, Derek Sivers, Paco Coursey
**What it is:** There is no "hero section." No large type designed to make an impression before scroll. The content starts at line 1.
**Why it works:** Hero sections optimize for a first impression that doesn't require reading. That's marketing logic applied to a person. The sites that skip the hero trust the content to make the impression instead.
**For MERULOX:** The lede (one h1 + one paragraph) is not a hero. It's a position statement. Keep it brief, keep it high, and get to the index quickly.

---

## 13. Typography as the only decoration

**Source:** Linear, Paco Coursey, Rauno Freiberg, Patrick Collison
**What it is:** When there are no images, no gradients, and no icons, typography does all the visual work. Size, weight, and color carry the entire hierarchy.
**Why it works:** It forces discipline. Every typographic decision has to earn its place. The result is a page that looks designed, not dressed.
**For MERULOX:** The five-level hierarchy in DESIGN.md (wordmark → section labels → entry names → body → metadata) is this pattern. Don't add icons or illustrations to compensate for absent color. Trust the type.

---

## 14. The keybar / status line

**Source:** htop, Helix, Emacs modeline, the existing ArchiveBrowser.astro
**What it is:** A persistent footer row that shows keyboard shortcuts. Small, muted, always present.
**Why it works:** It's an ambient affordance. The visitor who uses a keyboard discovers it without having to find a help page. The visitor who uses a mouse ignores it without it cluttering the interface. It's honest about the site's interaction model.
**For MERULOX:** Already in the existing code and DESIGN.md. Keep it. The shortcuts shown should be exactly the ones that work on the current page — not a static global list.

---

## 15. The /stack or /uses page as operational proof

**Source:** No single example — synthesized from Pieter Levels (tools in footer), Gwern (footnotes on software used), various "uses.tech" pages
**What it is:** A page that shows what actually runs — not a skills list, but the tools, services, and systems in active use. A real inventory.
**Why it works:** It's more credible than a skills section. Anyone can list "TypeScript" in a skills grid. Showing that you run 15 systemd services, a Claude API pipeline, a Twilio webhook, and a SQLite CRM demonstrates operational reality.
**For MERULOX:** The /stack page is the differentiator. Most portfolios don't have one. It makes the "systems thinker" claim concrete rather than descriptive. List what's actually running, not what you know how to run.
