# Facilitation Design Canvas

An interactive version of the "Designing Facilitated Experiences" canvas.

- Type in any section, or add sticky notes (change color, delete).
- Drag time blocks (15, 20, 30, 45, 60 min) from the Time Block Bank into Session Draft 1 or 2. Name, reorder, move between drafts, or remove them. Drafts show running times and totals.
- Everything autosaves in your browser. **Save as PDF** opens the print dialog, sized to fit the canvas.

## Accessibility

Built to WCAG 2.2 AA: full keyboard use (Space to pick up a block, arrow keys to move, Space to drop, Escape to cancel), button alternatives for every drag action, screen reader announcements, labeled fields, AA contrast, 24px minimum targets, reflow down to 320px, and reduced motion support.

## Develop

```bash
npm install
npm run dev       # local dev server
npm run lint
npm test          # unit tests
npm run build
npm run preview   # serve the build, then in another shell:
npm run e2e       # Playwright smoke test + axe scan (set CHROMIUM_PATH if needed)
```

## Deploy

`.github/workflows/deploy.yml` publishes `dist/` to GitHub Pages on pushes to `main`. Enable it under Settings > Pages > Source: GitHub Actions.

## Brand

- Colors live in `src/styles/tokens.css` (navy `#252a5c`, blue `#708bd6`, yellows `#fbd36b` / `#ffdc83`, pink `#e875c2`, magenta `#d755b3`, orange `#f27c22`).
- Be Vietnam Pro (Regular, SemiBold) is self-hosted in `src/assets/fonts` for all text.
- The "Designing Facilitated Experiences" wordmark is `src/assets/designing-facilitated-experiences.png`, extracted from the brand SVG with a transparent background.
