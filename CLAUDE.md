# Inkling: notes for Claude Code

Single-file app: `index.html` holds markup, CSS and one IIFE of vanilla JS. No dependencies or build step. Only external requests are Google Fonts (Instrument Sans, Literata, IBM Plex Mono).

## Data model

State `S = { meta, sc, en }`:
- `meta`: title, goal, target, `chapters[{id,title,open,scenes[]}]`, `scenes{id:{title,status,words}}`, `ents{id:{id,type,name,aliases,tag}}`, `pet{name,total}`, `days{YYYY-MM-DD:newWords}`, `mark` (today's cheer flags), `saved` timestamp.
- `sc[id]`: `{text, synopsis, notes}` per scene.
- `en[id]`: `{fields:{}}` per story page. Entity types: `char`, `place`, `thing`.

## Persistence

`flush()` writes dirty docs. In the original Claude artifact it used the artifact `db` capability, one doc per `meta`, `sc_<id>`, `en_<id>`, under `data/users/<id>`. Outside that environment `window.claude` is absent, so it falls back to `localStorage` key `inkling:project` (mirrored on every save either way). Keep scene text in its own doc/key so no single record gets large.

## Key behaviours

- Name links: `buildLinker()` makes one case-sensitive regex from every entity name and alias. `relinkEditor()` re-renders spans only when the link set changes, and restores the caret by text offset. The editor is `contenteditable="plaintext-only"` with a fallback to `true`.
- Pet credit: `credit(delta)` counts only positive deltas, ignores single changes over 600 words (pastes), and drives cheers, confetti and level-ups. Stages are in `STAGES`.
- Layout: three panes above 1080px, tabbed below. All colours are CSS tokens with light and dark palettes.

## Ideas not built yet

Drag-and-drop in the binder, word-count history chart, Word/PDF export, per-scene snapshots, find and replace, mention counts in the binder.
