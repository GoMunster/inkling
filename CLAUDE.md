# Inkling: notes for Claude Code

Single-file app: `index.html` holds markup, CSS and one IIFE of vanilla JS. No dependencies or build step. Only external requests are Google Fonts (Instrument Sans, Literata, IBM Plex Mono).

## Data model

State `S = { meta, sc, en }`:
- `meta`: title, goal, target, `chapters[{id,title,open,scenes[]}]`, `scenes{id:{title,status,words}}`, `ents{id:{id,type,name,aliases,tag}}`, `tls[{id,name}]` (timeline order), `pet{name,total}`, `days{YYYY-MM-DD:newWords}`, `mark` (today's cheer flags), `saved` timestamp.
- `sc[id]`: `{text, synopsis, notes}` per scene.
- `en[id]`: `{fields:{}}` per story page. Entity types: `char`, `place`, `thing`.
- `tl[id]`: one timeline: `axis{start,step,px,fmt,names,cycle,snap}`, `cardW`, `density`, `showWhen`, `showMarks`, `grid`, `lanes[{id,name,color,hide}]`, `cards{id:{lane,at,len,title,body,when,icon,color,style,scene}}`, `marks[{id,label,at,len,color}]`. Positions are in axis units, not pixels. `normTl()` validates everything.

## Persistence

`flush()` writes dirty docs. In the original Claude artifact it used the artifact `db` capability, one doc per `meta`, `sc_<id>`, `en_<id>`, `tl_<id>`, under `data/users/<id>`. Outside that environment `window.claude` is absent, so it falls back to `localStorage` key `inkling:project` (mirrored on every save either way). Keep scene text in its own doc/key so no single record gets large.

## Key behaviours

- Name links: `buildLinker()` makes one case-sensitive regex from every entity name and alias. `relinkEditor()` re-renders spans only when the link set changes, and restores the caret by text offset. The editor is `contenteditable="plaintext-only"` with a fallback to `true`.
- Pet credit: `credit(delta)` counts only positive deltas, ignores single changes over 600 words (pastes), and drives cheers, confetti and level-ups. Stages are in `STAGES`.
- Timeline (`renderTl`): `drawTl()` redraws only the board, `drawSide()` only the card/settings panel, so inputs keep focus while the board updates. Tick labels come from the `fmt` template (`{n}`, `{name}`, `{cycle}`, `{i}`). Cards stack into rows within a lane when they overlap. Mouse drags the whole card; touch drags only the grip or the resize edge so the board still scrolls. Card colour `''` means "use the lane colour"; colours are token names or `#rrggbb`.
- Layout: three panes above 1080px, tabbed below. All colours are CSS tokens with light and dark palettes.

## Ideas not built yet

Drag-and-drop in the binder, linking timeline cards to each other, a vertical timeline layout, word-count history chart, Word/PDF export, per-scene snapshots, find and replace, mention counts in the binder.
