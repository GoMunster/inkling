# Inkling

A novel-writing app inspired by Scrivener, with a virtual pet that cheers you on as your word count grows.

## Features

- **Binder:** chapters and scenes with reordering, status (Draft / Revised / Final) and word counts.
- **Editor:** distraction-free page with focus mode and adjustable text size.
- **Corkboard:** index cards with editable synopses, per chapter or for the whole book.
- **Story bible:** character, place and thing pages with fill-in templates.
- **Auto-linking:** any name or alias that has a page is highlighted in your scenes. Click it to open that page; each page lists the scenes where it appears. Select text and use *Link selection* to create a page.
- **Inky, the pet:** reacts to your daily goal (25/50/75/100%, bonus words, streaks) and grows from Blot to Inkling, Scribe, Bard and Laureate as lifetime words add up.
- **Export and backup:** manuscript as Markdown, project as JSON (restore from the menu).

## Run it

It is a single static file with no build step.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

Or open `index.html` directly in a browser. Projects save to `localStorage` in that browser, so use *Back up project* in the menu regularly.

## Notes

See `CLAUDE.md` for architecture and conventions.
