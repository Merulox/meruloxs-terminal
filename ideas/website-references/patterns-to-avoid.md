# Patterns to Avoid

14 anti-patterns observed across portfolio, founder, and developer sites.
Each entry: what it is, why it fails, where it's common.

---

## 1. The skills grid with tech logos

**What it is:** A section of tool/language icons arranged in a grid. React. TypeScript. Python. Docker. Sometimes with a label, sometimes just the icon.
**Why it fails:** It proves breadth, not depth. Anyone can list tools they've touched. The logos communicate nothing about how you actually use them or at what level. It reads as "I took these courses" not "I shipped with these."
**Where it lives:** Nearly every developer portfolio template includes this. If you're using a template and it has this section, delete it.
**Alternative:** Show a project that used the tool. One shipped thing is worth twenty logo icons.

---

## 2. Skill proficiency bars

**What it is:** Horizontal bars showing "Python: 90%" or star ratings for skills.
**Why it fails:** The metric is invented. 90% of what? Compared to whom? These bars communicate insecurity — the need to quantify things that aren't quantifiable. A senior engineer reading a portfolio will immediately distrust the site when they see this.
**Where it lives:** Every resume builder, every WordPress portfolio plugin.
**Alternative:** Nothing. Skills section should not exist. Projects demonstrate skills implicitly.

---

## 3. The animated hero section

**What it is:** Large text that types itself out, or parallax scrolling, or a particle background, or a gradient that moves.
**Why it fails:** Animation signals that you don't trust your content to make the impression. It's the design equivalent of a salesperson who talks before you can sit down. Visitors who came to read your work are interrupted by motion before they see anything.
**Where it lives:** Bootcamp graduate portfolios universally. Also: many "creative developer" sites.
**Alternative:** Static. One line. Get to the work immediately.

---

## 4. The fake terminal prompt

**What it is:** A code block styled to look like a terminal, with a fake `$ whoami` → `developer` exchange, or fake commands showing "skills."
**Why it fails:** It performs technical identity rather than demonstrating it. It's cosplay. An actual terminal user knows immediately that this is decorative. A non-technical visitor doesn't understand it. It serves no one.
**Where it lives:** Common on React developer portfolios. Very common in 2019–2022.
**Alternative:** If you want terminal aesthetic, use it structurally (layout, keyboard nav, monospace) — not as a decorative widget.

---

## 5. Gradient blobs / glassmorphism

**What it is:** Blurred, semi-transparent cards. Large colored blobs in the background. Frosted glass surfaces.
**Why it fails:** It peaked in 2021 and reads as dated. More importantly, it communicates "I followed a Dribbble trend" rather than "I made decisions." It's decoration that references other decoration.
**Where it lives:** Apple-influenced design systems, Framer templates, most "modern" portfolio themes.
**Alternative:** Flat, dark, structured. Surface difference through subtle background color change, not blur and transparency.

---

## 6. The "available for hire" green dot

**What it is:** A green circle (sometimes pulsing) next to the nav or name, with text "Available for new opportunities."
**Why it fails:** It frames the visitor as a potential employer rather than an interesting person. It signals desperation. Pieter Levels built a $5M business with a site that never once says "available for hire" — the work speaks.
**Where it lives:** LinkedIn-influenced portfolios. Developer templates that default to "looking for work."
**Alternative:** Contact information in a predictable location. If they want to reach you, they'll find the email.

---

## 7. The testimonial section

**What it is:** Quotes from managers, colleagues, or clients, usually in a carousel.
**Why it fails:** Nobody believes them. They look fabricated even when they're real. The carousel format makes them feel like a SaaS pricing page. They add length without adding credibility.
**Where it lives:** Every freelancer template, many agency sites repurposed as portfolios.
**Alternative:** Case studies. Show a real project with a real problem and a real outcome. That does more than any quote.

---

## 8. The social media icon row

**What it is:** A row of icons (Twitter, LinkedIn, GitHub, Instagram) in the footer or nav.
**Why it fails:** It tells visitors to leave your site. It turns your portfolio into a directory. It also implies that your Twitter and your LinkedIn carry equal weight as professional context, which they don't.
**Where it lives:** Everywhere. Footer of every portfolio ever.
**Alternative:** One relevant link, inline where it's relevant. Link to a GitHub repo on the project page where that repo lives. If your Twitter/X is part of how people know your work, mention it once in the about context — not as an icon.

---

## 9. The contact form

**What it is:** A name / email / message form on a contact page.
**Why it fails:** It adds friction without adding value. Anyone who wants to contact you can email you. A form implies a workflow that probably doesn't exist. Most portfolio contact forms end up unmonitored.
**Where it lives:** Every portfolio template.
**Alternative:** An email address, displayed simply. merultox@gmail.com. That's it.

---

## 10. Lorem ipsum placeholder content

**What it is:** Placeholder text in a template that never gets replaced. "Project Title," "A brief description of this project," "Company Name, 2023."
**Why it fails:** It's a red flag that the site was deployed without thought. It destroys credibility instantly. A visitor who sees lorem ipsum doesn't read the rest of the page.
**Where it lives:** Everywhere. Portfolio sites that were set up but never finished.
**Alternative:** Ship nothing until the content is real. An empty section is better than a fake one. A stub page with "coming soon" is better than lorem ipsum.

---

## 11. Infinite scroll

**What it is:** Loading more content as the visitor scrolls, without pagination or clear end point.
**Why it fails:** It makes the site feel boundless and therefore undefined. The visitor can't judge the scope of what exists. Infinite scroll works for feeds where volume is the value (Twitter, Instagram) — it doesn't work for a curated personal site where every entry should be deliberately included.
**Where it lives:** Developer blogs that tried to be Twitter.
**Alternative:** Pagination with visible counts, or a single page with all entries visible. Let the visitor see the whole thing.

---

## 12. The card carousel

**What it is:** Project cards that slide horizontally. Usually requires clicking arrows or dragging.
**Why it fails:** It hides content from visitors. Anything not visible in the initial view requires effort to discover. Effort = drop-off. A carousel implies you have more to show than you have space for — but that's a layout problem, not a carousel problem.
**Where it lives:** Mobile-first templates, Bootstrap portfolio themes.
**Alternative:** A list. All items visible. No hiding.

---

## 13. The download resume button

**What it is:** A prominent button or CTA: "Download my resume" or "View CV."
**Why it fails:** It shifts the frame from "this site IS the portfolio" to "this site is a cover for a PDF resume." It signals that the real document lives elsewhere. It's also immediately dated — a PDF resume is a 1990s workflow.
**Where it lives:** Common on "serious professional" portfolio sites, LinkedIn-adjacent designs.
**Alternative:** The site IS the resume. If a recruiter asks for a PDF, provide it on request. Don't build the site around that workflow.

---

## 14. The "about me" wall of text

**What it is:** A long paragraph (or worse, multiple paragraphs) describing who you are, your journey, your values, your love of problem-solving.
**Why it fails:** Nobody reads it. Visitors who are hiring scan for proof — projects, outputs, skills demonstrated. Visitors who are peers want to see work. A wall of bio text serves nobody.
**Where it lives:** First section of nearly every portfolio site.
**Alternative:** Two sentences maximum, in the lede. Not a bio — a position. "I build systems that run without me" is more informative and more memorable than three paragraphs about your journey from mechanical engineering to software.
