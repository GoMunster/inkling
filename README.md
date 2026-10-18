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
- **Story bible:** character, place and thing pages with fill-in templates and a picture at the top (character art, a map, a mood board) with its own caption, shape and size.
- **Auto-linking:** any name or alias that has a page is highlighted in your scenes. Click it to open that page; each page lists the scenes where it appears. Select text and use *Link selection* to create a page.
- **Focus timer:** a pomodoro timer next to Inky with your own focus and break lengths, a per-session word goal and a chime. Every session is saved with its new words, and **Writing sessions** shows your history for the project, with totals, per-day groups, and deleting by session, day or all.
- **Inky, the pet:** reacts to your daily goal (25/50/75/100%, bonus words, streaks) and grows from Blot to Inkling, Scribe, Bard and Laureate as lifetime words add up.
- **Export and backup:** manuscript as Markdown, project as JSON (restore from the menu).

## Desktop app

Inkling also comes as a downloadable app for Windows, macOS and Linux that needs no Claude account or internet, and keeps several projects on the computer, each in its own folder with automatic backups. See [desktop/README.md](desktop/README.md) for installing, building and releasing it.

## Run it

It is a single static file with no build step.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

Or open `index.html` directly in a browser. Projects save to `localStorage` in that browser, so use *Back up project* in the menu regularly.

## Notes

See `CLAUDE.md` for architecture and conventions.
