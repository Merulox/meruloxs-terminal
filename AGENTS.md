# AGENTS.md

## Project

This is `merulox.com`, a fast static Astro website for Merulox. Keep the site minimal, readable, and easy to edit. Do not add fake accomplishments, stock images, lorem ipsum, or heavy animation.

## Commands

```sh
npm install
npm run dev
npm run build
```

Use `npm run dev` for local development and `npm run build` before handing off changes.
For branch previews and verification, use `https://dev.merulox.com` as the default preview target.

## Structure

- `src/layouts/Layout.astro` contains the shared document shell, navigation, metadata, and footer.
- `src/components/Card.astro` contains the reusable card pattern used across pages.
- `src/styles/global.css` contains the global design system and responsive styles.
- `src/pages/` contains static Astro routes.
- `public/` contains static assets.

## Conventions

- Use plain Astro, HTML, and CSS unless there is a clear reason to add a dependency.
- Keep content factual and conservative.
- Use one accent color and the existing dark visual system.
- Leave missing contact/profile URLs as clear `TODO` comments until real values are provided.
- Keep pages static and deployable to Cloudflare Pages.
- Treat `dev.merulox.com` as the preview destination for branch builds unless the user says otherwise.
