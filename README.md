# Facilitation Design Canvas

An interactive version of the "Designing Facilitated Experiences" canvas!

- Fill in the Working Title, Client Name and Number of Participants at the top.
- Every section collects sticky notes (change color, delete). Drag a sticky by its grip to reorder it or move it to another section, or use its Move button to pick a section and position. Text typed into sections in older versions becomes a sticky note automatically.
- Sections are stacked in one column: Session Brief, Participants at the Center, Participant Before, Participant After, Facilitator at the Center, Time Blocks, Flow, Function, and Form (each column has a title field), Activity Ideation.
- A new canvas guides you step by step: it starts with Session Brief, Participants at the Center and Participant Before and After, and Next adds Facilitator at the Center, then Time Blocks, then Flow, Function, and Form with Activity Ideation. Show full canvas skips ahead. Canvases saved before the guide existed open in full, Clear canvas starts the guide over, and printing always shows the full canvas.
- Drag time blocks (5, 10, 15, 20, 30, 45, 60 min) from the Time Block Bank into Session Draft 1. Use Add another draft for up to three drafts; only the last draft can be removed. With three drafts, a block's move button asks which draft to move it to. Name them, add bullet-point notes (Enter starts a new bullet; Enter on an empty bullet ends the list), reorder, move between drafts, or remove them. Drafts show running times and totals.
- Everything autosaves in your browser. **Save as PDF** opens the print dialog. Print uses landscape pages in your chosen paper size (Letter or A4), keeps each section whole so pages never break mid-section, and leaves out the Time Block Bank.

## Workshop mode

Facilitators can host a live workshop and see every participant's canvas as they work.

- **Host:** Workshop > Host a workshop. You get a 6-character code and a join link. The host view shows a live card for each participant. Open one to see their canvas (view only), send private comments tied to a section, or spotlight it so everyone can open it. A toggle lets participants see each other's canvases.
- **Join:** Workshop > Join a workshop, enter the code and your name. Your workshop canvas is saved separately from your personal one, and you can copy it to your personal canvas when you leave.
- **Guided reveal:** by default participants start with the Session Brief group (Session Brief, Participants at the Center, Participant Before and After). The host reveals Facilitator at the Center, then Time Blocks, then Flow, Function, and Form together with Activity Ideation, or everything at once, and can hide the last step again. Participants get a notice with a Go to it button. Uncheck the guided option when hosting to show the full canvas from the start.
- Ending a workshop deletes it online. Workshops expire after 30 days: they become unreadable straight away and are deleted by a daily cleanup job.
- The Workshop button only appears when the build has Firebase settings.

### Set up Firebase (one time)

1. Create a project at console.firebase.google.com (the free Spark plan is enough).
2. Build > Authentication > Get started > enable **Anonymous** sign-in.
3. Build > Realtime Database > Create database (locked mode).
4. Publish the rules in `database.rules.json`: paste them in the Rules tab, or run `firebase deploy --only database`.
5. Project settings > Your apps > add a Web app and copy its config.
6. In GitHub, Settings > Secrets and variables > Actions > **Variables**, add `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`. These are safe to publish: access is controlled by the rules.
7. For the 30-day cleanup: Project settings > Service accounts > Generate new private key, and save the whole JSON as the **secret** `FIREBASE_SERVICE_ACCOUNT`. `.github/workflows/cleanup.yml` runs daily.
8. Optional: add your Pages domain under Authentication > Settings > Authorized domains, and turn on App Check to limit abuse.

For local development put the same `VITE_FIREBASE_*` values in `.env.local`.

### Test workshop mode locally

Needs Java (for the database emulator) and `npm i -g firebase-tools`.

```bash
npm run test:rules          # 53 security rule checks against the emulator
npm run emulators           # terminal 1
npm run dev:emulator        # terminal 2: app wired to the emulators
```

End to end with three browsers (host and two participants):

```bash
npx vite build --mode emulator --outDir dist-emu && npx vite preview --outDir dist-emu --port 4174
npm run e2e:workshop
```

## Accessibility

Built to WCAG 2.2 AA (workshop views included): full keyboard use (Space to pick up a block, arrow keys to move, Space to drop, Escape to cancel), button alternatives for every drag action, screen reader announcements, labeled fields, AA contrast, 24px minimum targets, reflow down to 320px, and reduced motion support.

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
- Be Vietnam Pro (Regular, SemiBold, Bold, ExtraBold, Black) is self-hosted in `src/assets/fonts` for all text. Section headings use Bold.
- The "Designing Facilitated Experiences" wordmark is `src/assets/designing-facilitated-experiences.png`, extracted from the brand SVG with a transparent background.
