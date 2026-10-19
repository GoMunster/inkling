# Inkling

A novel-writing app inspired by Scrivener, with a virtual pet that cheers you on as your word count grows.

## Features

- **Binder:** chapters and scenes with reordering, status (Draft / Revised / Final) and word counts.
- **Editor:** distraction-free page with focus mode and adjustable text size.
- **Corkboard:** index cards with editable synopses, per chapter or for the whole book. Each chapter has its own notes above its cards.
- **Your own section names:** rename Characters, Places, Things and Timelines in the binder (say *Cast*, *Realms*, *Relics*).
- **Outlines:** a nestable outline with numbering, checkboxes, notes and scene links per line, keyboard shortcuts, and templates (three-act, Save the Cat, Hero's Journey, seven-point, romance beats). It can also be filled from your chapters and scenes.
- **Notes and brainstorming:** free-form notes pages and brainstorm boards of colour-coded idea cards.
- **Relationship maps (optional):** bubbles for characters, places, things or anything else, joined by lines you can label. Relationship types (family, romance, rivals, your own) each have a colour and line style and can be hidden. Drag to arrange, drag a bubble's + onto another to connect.
- **Family trees (optional):** add parents, partners, children and siblings and the tree lays itself out. Partnership types have their own symbols and lines; children can be by birth, adopted, fostered, step or rumoured.
- **Your binder, your way:** turn Outlines, Notes, Timelines, Relationship maps, Family trees, Places and Things on or off with *Customize binder*.
- **Timelines:** as many as you like, with lanes for characters or plotlines. Drag cards along the scale, stretch them to show how long something lasts, and stack eras or act markers behind them. The time scale is yours to define: days, years, chapters, or a made-up calendar like `{name}, year {cycle}` with your own month names. Click any column in the header row to rename it, for example *The Siege* instead of *Day 4*. Lanes can be renamed by clicking their name, and can say what they track. Cards can have colours, styles, icons, notes with auto-linked names, and a link to a scene.
- **Story bible:** character, place and thing pages with fill-in templates and a picture at the top (character art, a map, a mood board) with its own caption, shape and size; drag the picture inside its frame and zoom to choose exactly what shows.
- **Auto-linking:** any name or alias that has a page is highlighted in your scenes. Click it to open that page; each page lists the scenes where it appears. Select text and use *Link selection* to create a page.
- **Focus timer:** a pomodoro timer next to Inky with your own focus and break lengths, a per-session word goal and a chime. Every session is saved with its new words, and **Writing sessions** shows your history for the project, with totals, per-day groups, and deleting by session, day or all.
- **Inky, the pet:** reacts to your daily goal (25/50/75/100%, bonus words, streaks) and grows from Blot to Inkling, Scribe, Bard and Laureate as lifetime words add up. Inky notices what you do (a new character or place, a finished chapter, a scene passing 1,000 words, writing at dawn or after midnight, coming back after a break) and lives in a little room behind it: the window follows the time of day, a plant grows with your streak, and stars on the wall count your goal days.
- **Inky's room:** 21 achievements earn hats, glasses, scarves, a bow tie, a medal, a mug of ink, and furniture for the room (a lamp, a rug, a map, an armchair, a bookshelf that fills with finished chapters). Each project has its own Inky. Dress Inky up, pick a colour, and choose how chatty Inky is (chatty, only big moments, or quiet), with or without confetti.
- **Sprint together:** on a shared project, you see when a co-writer starts a focus sprint, and can join it so both timers end together; their Inky appears beside yours while you sprint.
- **Export:** Word (.docx) and PDF in standard manuscript format (12 pt Times or Courier, double spaced, 1" margins, a *Surname / TITLE / page* header, a title page with your contact details and a rounded word count), an EPUB ebook to read your draft on a Kindle or phone, Markdown and plain text. Export the whole book or one chapter. `*Asterisks*` or `_underscores_` make italics.
- **Scene snapshots:** save a version of a scene before a rewrite, compare any snapshot with the current text (added and removed words highlighted) and restore it. Inkling also keeps one automatically each day you change a scene, and before find and replace or a restore changes it.
- **Find and replace:** across the whole book or one chapter, with match case and whole words. Click a result to jump to it in the scene. Replace one at a time or all at once (each changed scene is snapshotted first).
- **Writing history:** a chart of new words per day (30 or 90 days) or per week (12 months), with totals, best day, streak and days at goal, and a table view.
- **Sharing with co-writers (desktop app):** keep a project in a Dropbox, Google Drive, OneDrive or iCloud Drive folder and several people can work on it from their own computers. Inkling merges everyone's changes piece by piece, shows who is in which scene, keeps each writer's pet and goals separate, and saves the other version of any scene two people changed at once as a snapshot. See [SHARING.md](SHARING.md).
- **Settings:** light or dark theme, writing font, text size, line spacing, page width and spellcheck, kept per device.
- **A short tour** on first run, replayable from the menu.
- **Backup:** the whole project as JSON, pictures included (restore from the menu).

## Desktop app

Inkling also comes as a downloadable app for Windows, macOS and Linux that needs no Claude account or internet, and keeps several projects on the computer, each in its own folder with automatic backups. Put a project in Dropbox, iCloud Drive, Google Drive or OneDrive to back it up online, write on more than one computer, or share it with co-writers ([SHARING.md](SHARING.md)). It tells people when a new version is out and, on Windows and Linux, installs it with one click. See [desktop/README.md](desktop/README.md) for installing and building it, and [RELEASING.md](RELEASING.md) for publishing an update.

## Privacy

Inkling has no accounts, ads, analytics or tracking. The desktop app keeps everything in your projects folder and connects to the internet only to check GitHub for a new version (which you can switch off in Settings). In a browser your project stays in that browser's storage; in the Claude artifact it saves to your Claude account, private to you.

## Run it

It is a single static file with no build step.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

Or open `index.html` directly in a browser. Projects save to `localStorage` in that browser, so use *Back up project* in the menu regularly.

## Tests

```sh
npm install
npx playwright install chromium
npm test                     # web and desktop tests
npm run test:web             # just the browser ones
```

The desktop tests need `npm ci` in `desktop/` first, and a screen (on Linux servers, run them under `xvfb-run -a`). GitHub Actions runs everything on every push and before each release.

## Notes

See `CLAUDE.md` for architecture and conventions.
