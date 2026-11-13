# Facilitation Design Canvas

An interactive version of the "Designing Facilitated Experiences" canvas!

- Fill in the Working Title, Client Name and Number of Participants at the top.
- Every section collects sticky notes (change color, delete). Drag a sticky by its grip to reorder it or move it to another section, or use its Move button to pick a section and position. Text typed into sections in older versions becomes a sticky note automatically.
- The canvas is stacked by default. On wide screens a Stacked / Canvas toggle in the toolbar switches to the original two-column canvas; the choice is remembered on that device. Phones and tablets stay stacked.
- Sections, in order: Session Brief, Participants at the Center, Participant Before, Participant After, Facilitator at the Center, Time Blocks, Flow, Function, and Form (type a name for each column where it says Name this function), Activity Ideation, Session Outline.
- **Formatting:** sticky notes, Activities and Moves + Materials support bold (Ctrl/Cmd+B), italic (Ctrl/Cmd+I) and bullets (start a line with "- "). Activities also take a title (start a line with "# "). There is no toolbar. Notes show as formatted text and switch into the editor when clicked; the editor downloads the first time someone heads for a note. Only those styles are kept, so pasted or synced content cannot carry anything else. Block details keep their simple automatic bullets.
- **Breaks:** add a Break from the bank (15 min, resizable) or mark any block as a break with its cup button. Breaks are striped with a cup icon in Time Blocks and the outline, where their two text columns merge into one notes cell. Totals show break time separately ("3 hr · 45 min of breaks").
- **Multi-day sessions:** Add next day puts a Day 2 divider in a draft; blocks after it are the next day and the clock starts again. Each day has its own start time (typed on its first row in the outline) and total. Dividers move and remove like blocks. The outline groups rows by day, and each day prints on its own page.
- **Session Outline** is a run-of-show table built from a session draft: each time block becomes a row with its start and end time and length, plus Activities and Moves + Materials to fill in. Type the first start time to set when the session begins (all times, including the time blocks, follow it), or type any end time or length to resize that block; each row starts when the one above ends. It shows the Working Title, and with more than one draft you choose which draft it follows.
- A **backup reminder** appears in the corner once a solo canvas has real work in it (8+ notes, blocks or details) and no backup in the last week; Remind me later waits 3 days. Workshop canvases are saved online, so they do not show it.
- **Sharing:** link previews (title, description, image in `public/og-image.png`) for LinkedIn, Slack and email, and every printout ends with "Made with the Facilitation Design Canvas™ · canvas.womenfacilitating.com".
- The **More** menu holds Save as PDF, Download backup, Restore backup and Clear canvas. **Download backup** saves the canvas as a file; **Restore backup** loads it on any device (it replaces the current canvas after confirming).
- A new canvas guides you step by step: it starts with Session Brief, Participants at the Center and Participant Before and After, and Next adds Facilitator at the Center, then Time Blocks, then Flow, Function, and Form with Activity Ideation, then Session Outline. Show full canvas skips ahead. Canvases saved before the guide existed open in full, Clear canvas starts the guide over, and printing always shows the full canvas.
- Drag starter time blocks (15, 30, 60 min) from the Time Block Bank into Session Draft 1. Change a block's length by typing in the number on its side (arrow keys step by 5) or dragging its bottom edge; lengths go in 5-minute steps from 5 to 180 minutes, and the color follows the length. Use Add another draft for up to three drafts; only the last draft can be removed. With three drafts, a block's move button asks which draft to move it to. Name them, add bullet-point notes (Enter starts a new bullet; Enter on an empty bullet ends the list), reorder, move between drafts, or remove them. Drafts show running times and totals.
- Everything autosaves in your browser. **Save as PDF** opens the print dialog. Print uses landscape pages in your chosen paper size (Letter or A4), keeps each section whole so pages never break mid-section, and leaves out the Time Block Bank.

## Workshop mode

Facilitators can host a live workshop and see every participant's canvas as they work.

- **Facilitators only:** hosting is limited to approved emails (any @womenfacilitating.com address plus the list in `src/workshop/host-allowlist.json`; the database rules enforce the same list). Facilitators open the private link `https://canvas.womenfacilitating.com/?host`, enter their email and click the sign-in link they receive. After that, Workshop shows Host a workshop on that device, with **Your workshops** to reopen any of them from any device. Participants never see the Host option. **Co-facilitating:** any approved facilitator can open a workshop's host view by entering its code under Co-facilitating? in their facilitator panel (or in Join while signed in); it then appears in their Your workshops list too. To change who can host, edit the allowlist, run `python3 scripts/build-rules.py`, and publish the new rules.
- **Host:** You get a 6-character code and a join link. The host view shows a live card for each participant. Open one to see their canvas (view only), send private comments tied to a section, or spotlight it so everyone can open it. A toggle lets participants see each other's canvases.
- **Join:** Workshop > Join a workshop, enter the code and your name. Your workshop canvas is saved separately from your personal one, and you can copy it to your personal canvas when you leave.
- **Guided reveal:** by default participants start with the Session Brief group (Session Brief, Participants at the Center, Participant Before and After). The host reveals Facilitator at the Center, then Time Blocks, then Flow, Function, and Form together with Activity Ideation, then Session Outline, or everything at once, and can hide the last step again. Participants get a notice with a Go to it button. Uncheck the guided option when hosting to show the full canvas from the start.
- **Notifications:** participants see newly revealed sections, new facilitator comments and spotlights as cards in the bottom-right corner, wherever they have scrolled. Comment cards show the text and a button to jump to that section; cards stay until dismissed.
- **Rejoin codes:** every participant gets a personal 8-character rejoin code, shown in their workshop bar and on their card in the host view. On another device (or after clearing their browser) they choose Workshop > Return on a new device and enter the workshop code plus their rejoin code to get their canvas and comments back. A device opening the workshop loads the newest online copy, so an older device never overwrites newer work. Use one device at a time.
- Ending a workshop deletes it online. Workshops expire after 30 days: they become unreadable straight away and are deleted by a daily cleanup job.
- The Workshop button only appears when the build has Firebase settings.

### Free plan usage

The free Firebase plan (Spark) allows about 10 GB of downloads a month and 100 people connected at once; over that, Firebase pauses the database until the next month (no charge). The app keeps usage low: participants send changes about once a second while typing, and only download someone else's canvas when they open it. The host view shows how many participants are online. A typical 30-person, 3-hour workshop should use well under 1 GB. Check usage in the Firebase console under Realtime Database > Usage.

### Set up Firebase (one time)

1. Create a project at console.firebase.google.com (the free Spark plan is enough).
2. Build > Authentication > Get started > enable **Anonymous** sign-in, and **Email/Password** with **Email link (passwordless sign-in)** turned on.
3. Build > Realtime Database > Create database (locked mode).
4. Publish the rules in `database.rules.json` (generated by `python3 scripts/build-rules.py`; edit that script, not the JSON): paste them in the Rules tab, or run `firebase deploy --only database`.
5. Project settings > Your apps > add a Web app and copy its config.
6. In Vercel, Project Settings > Environment Variables, add `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` for Production, then redeploy. These are safe to publish: access is controlled by the rules.
7. For the 30-day cleanup: Project settings > Service accounts > Generate new private key, and save the whole JSON as the **secret** `FIREBASE_SERVICE_ACCOUNT`. `.github/workflows/cleanup.yml` runs daily.
8. Add `canvas.womenfacilitating.com` and `dice-mu-neon.vercel.app` under Authentication > Settings > Authorized domains, and turn on App Check to limit abuse.

For local development put the same `VITE_FIREBASE_*` values in `.env.local`.

### Test workshop mode locally

Needs Java (for the database emulator) and `npm i -g firebase-tools`.

```bash
npm run test:rules          # 98 security rule checks against the emulator
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

Hosted on Vercel, which builds `main` with `npm run build` and serves `dist/`. Workshop mode needs the `VITE_FIREBASE_*` values set in Vercel under Project Settings > Environment Variables (see below), then a redeploy.

## Brand

- Colors live in `src/styles/tokens.css` (navy `#252a5c`, blue `#708bd6`, yellows `#fbd36b` / `#ffdc83`, pink `#e875c2`, magenta `#d755b3`, orange `#f27c22`).
- Be Vietnam Pro (Regular, SemiBold, Bold, ExtraBold, Black) is self-hosted in `src/assets/fonts` for all text. Section headings use Bold.
- The "Designing Facilitated Experiences" wordmark is `src/assets/designing-facilitated-experiences.png`, extracted from the brand SVG with a transparent background.
