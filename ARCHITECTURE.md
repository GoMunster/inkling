# How Inkling is built

A guide to the code for anyone changing it. It explains how the parts fit together. `CLAUDE.md` lists every data field and function name, and each source file opens with a comment saying what it does.

## One app, three places

Inkling runs in three places from the same file, `index.html`:

| Where | How it saves | Pictures |
|---|---|---|
| A plain browser (opened from disk or a web server) | `localStorage` in that browser | Resized copies in `localStorage` |
| The Claude artifact | The artifact's database (`db` capability) | Uploaded as assets |
| The desktop app (`desktop/`, Electron) | A folder per project on the computer | Files in the project's `pictures/` folder |

The code notices where it is running: `window.claude` means the artifact, `window.inklingDesktop` (`DESK`) means the desktop app, and neither means a plain browser. Everything else is the same code.

## Source and build

```
src/index.html        the page: <head>, the markup of the panes, and two markers
src/css/NN-*.css      styles, joined in file-name order into the page's <style>
src/js/NN-*.js        code, joined in file-name order into the page's one <script>
build.js              joins them into index.html (node build.js; no dependencies)
```

- **Why one file:** the artifact publishes one file, a browser can open it offline with a double-click, and the desktop app copies it (`desktop/scripts/prepare.js` swaps in bundled fonts and a strict security policy).
- **Shared scope:** all JS files share one scope, an immediately-run function in `src/index.html`. They are not modules.
  - A function in any file can call a function in any other.
  - A top-level `const` or `let` can only be used, while the files load, by later files. The numbers fix the order.
- **Never edit `index.html` itself.** Change `src/`, run `npm run format` (Prettier, then the build) and commit both. `npm test` builds first, and CI fails if `index.html` doesn't match `src/` or the code isn't formatted.

### The code, file by file

| Files | What they do |
|---|---|
| `01-core` | Helpers, icons, kinds of story page, the state (`S`, `ui`, `P`) |
| `02-project-data` | The sample and blank projects; `normalize()`, which checks every project as it loads; timeline basics |
| `03-pictures` | Pictures for story pages and maps, in all three storage places |
| `04-text` | Name links, bold/italic/underline markers, the editor's caret |
| `05-saving` | `dirty()`, `flush()`, the stores; derived numbers (today's words, streak) |
| `06-inky`, `07-inky-reads` | Inky: drawing, talking, rewards, the room; reading over your shoulder |
| `08-drag` | Drag to reorder, for every list |
| `09-continuity`, `10-story-insights`, `11-world`, `12-series` | Story tools: continuity check, Story insights (pacing, point of view, threads, setups, arcs), calendars and money, the series bible |
| `13-navigation` … `19-binder` | Moving between views, Trash, search, side by side, quick switcher, right-click menus, structure operations, the binder |
| `20-scene-editor` … `26-timeline` | The main pane's views: scene editor, story pages, corkboard, notes and world maps, outlines, relationship maps and family trees, timelines |
| `27-snapshots-find` … `32-inspector` | Snapshots, find and replace, tour, to-do list, sidebar widths, deadline planner, layout and settings, focus timer, the Inkling panel |
| `33-export` | The ⋯ menu, backups, Word/PDF/EPUB/Markdown export |
| `34-book` | Book details, front and back matter, chapter kinds and headings, the cover, ebook styles and the check before publishing (Publishing) |
| `35-print` | Print-ready paperback and hardcover PDFs: trim sizes, our own page layout, running heads, page numbers, spine width |
| `36-preview` | Book preview: the ebook on a phone, tablet or Kindle screen, and the print book as spreads; live beside the writing |
| `37-sharing`, `38-desktop` | Shared projects (merging, presence) and the desktop app's projects |
| `39-boot` | Start-up: `init()` and `renderAll()` |

## Data

- **The open project is `S`:** `meta` (the index: title, chapters, scene titles, story page names, settings) plus one map per kind of record.
  - `sc` holds scene text and `en` story pages.
  - Then timelines (`tl`), chapter notes (`ch`), notes and maps (`nt`), outlines (`ol`), relationship maps (`rm`), family trees (`ft`), writing sessions (`ss`), snapshots (`sn`) and the Trash (`tr`).
- **Records save separately:** each record is saved as its own document (`sc_<id>`), so typing in one scene never rewrites the whole book in the artifact's database.
- **`normalize()` is the gate:** everything loaded passes through it. It fills in defaults, keeps only valid values and drops broken links, so the rest of the code can trust `S`.
- **Old formats are upgraded on load:** the save format has a version (`FORMAT`), and `MIGRATE` upgrades older projects as they load.
  - A project saved by a newer Inkling opens read-only, so an old copy never overwrites newer work.

## The flow of a change

1. **Something changes:** the writer types or clicks, and the code changes `S`.
2. **The record is marked:** the code calls `dirty('sc_' + id)` (or `dirty('meta')`), which stamps the record with the time, the device and the writer's name, and schedules a save.
3. **The screen updates:** the code redraws what changed. Each view has a `render…()` function that builds its HTML and wires up its events. Some redraw only part of themselves so text boxes keep focus (the timeline's `drawTl`/`drawSide`, the outline's `drawOl`).
4. **The save happens:** about 1.4 seconds after the last change, `flush()` hands the changed records to the store (`STORES`). In a browser it also keeps a whole copy in `localStorage`.

## Views

- **The main pane:** it shows one view at a time, such as `{k:'scene', id}`, `{k:'ent', id}` (a story page), `{k:'cork'}` or `{k:'tl', id}`.
- **Opening a view:** `go(view)` opens a view and keeps history for Back and Forward, and `renderMain()` picks the render function for the view's kind.
- **Other panes:** the binder (`renderBinder`) and the Inkling panel (`renderInspector`) are redrawn when what they show changes.

## Shared projects (desktop)

- **How the folder is shared:** co-writers share a project folder through a sync service.
- **Saving checks first:** a save is compare-and-swap. If the file on disk isn't the version this computer last saw, `mergeProjects()` merges the two record by record:
  - A record only one side changed takes that change.
  - A true clash goes to the newer change, and a scene clash keeps the other text as a snapshot.
  - Deletions are known from `meta.gone`.
- **The screen updates in place:** `patchState()` updates the live state, so whatever is on screen keeps working.
- **Personal things:** Inky, goals, the timer, the to-do list and the layout are kept per writer (`meta.writers`).

## Performance notes

Inkling is meant to stay quick with very large manuscripts. On a 126,000-word test book (240 scenes, 80 story pages), opening a scene takes about 50 ms and a keystroke about 4 ms.

- **Typing does as little as possible:**
  - The text is saved after a pause.
  - Name links are redrawn only when they change.
  - The word count on the page is touched only when it changes.
- **The binder is rebuilt only when what it shows changes:**
  - `renderBinder0` keeps the last HTML and skips rebuilding when it is the same.
  - Opening something just moves the highlight (`paintBinderSel`).
- **Whole-book reads are remembered per scene:**
  - Story insights (`sceneReading`, `SCENE_READ`) and the continuity check (`contScene`, `CONT_SCENE`) keep what they read from each scene until its text or the names change.
  - Only scenes written since last time are read again.
  - Their overall results are also cached for a few seconds, because several panes ask at once.
- **Long lists skip what is off screen:** binder chapters, search results, find results, corkboard chapters and "Appears in" lists use `content-visibility: auto`, so the browser lays out only what is near the screen.
- **Small things add up on long books:**
  - Number formatting uses one shared formatter (`NUM_FMT`).
  - Page-wide settings that force a layout run once (`styleWithCSS`).
- **When adding a feature that reads every scene:** cache its result per scene (keyed by the scene's text and `linker`), and never rebuild a long list when only a highlight or a count changed.

## Tests

- **What runs:** `npm test` builds, then runs Playwright: `tests/web.spec.js` in Chromium against `index.html`, and `tests/desktop.spec.js` against the Electron app (needs `npm ci` in `desktop/`, and `xvfb-run -a` on a Linux server).
- **Every feature gets a test:** add one with each feature.
- **Ebooks are validated:** CI downloads EPUBCheck (the validator ebook stores use) and sets `EPUBCHECK_JAR`, and the ebook test runs it on an exported book. Locally the test skips that step unless you set the variable.
