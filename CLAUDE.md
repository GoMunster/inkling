# Inkling: notes for Claude Code

Single-file app: `index.html` holds markup, CSS and one IIFE of vanilla JS. No dependencies or build step. Only external requests are Google Fonts (Instrument Sans, Literata, IBM Plex Mono).

## Data model

State `S = { meta, sc, en, tl, ch, nt, ol }`. Every map except `meta` is listed in `DOCS`; each record saves as its own doc, so a new kind of record only needs adding there:
- `meta`: title, goal, target, `chapters[{id,title,open,scenes[]}]`, `scenes{id:{title,status,words}}`, `ents{id:{id,type,name,aliases,tag}}`, `tls[{id,name}]`, `ols[{id,name}]`, `nts[{id,name,kind}]` (order of timelines, outlines, notes; `kind` is `page` or `board`), `labels{ol|nt|tl|char|place|thing:{p,s}}` (user names for binder sections, plural and singular; read them through `LP(t)`/`LS(t)`, never `TYPES[t].label`, and escape them), `pet{name,total}`, `days{YYYY-MM-DD:newWords}`, `mark` (today's cheer flags), `saved` timestamp.
- `sc[id]`: `{text, synopsis, notes}` per scene.
- `en[id]`: `{fields:{}, pic}` per story page. `pic` is `{a, l, cap, shape, size, fit}`: `a` is an artifact asset id (shown from `/_blob/<id>`), `l` means a resized data URL in `localStorage` key `inkling:img:<entId>` (outside the project record; JSON backups carry those as `imgs`). Use `picSrc()`, `setPic()`, `removePic()`; deleting a page calls `dropPic()`. Entity types: `char`, `place`, `thing`.
- `tl[id]`: one timeline: `axis{start,step,px,fmt,names,cycle,snap}`, `cardW`, `density`, `showWhen`, `showMarks`, `grid`, `lanes[{id,name,color,hide}]`, `cards{id:{lane,at,len,title,body,when,icon,color,style,scene}}`, `marks[{id,label,at,len,color}]`, `ticks{columnIndex:label}` (renamed header columns), `corner`, `tickSize`. Positions are in axis units, not pixels. `normTl()` validates everything.
- `ch[id]`: `{notes}` per chapter, shown above that chapter's corkboard.
- `nt[id]`: `{text, ideas[{id,text,color}]}`; a `page` uses `text`, a brainstorm `board` uses `ideas`.
- `ol[id]`: `{num, showNotes, items[{id,text,note,depth,done,open,noteOpen,scene}]}`. The outline is a flat list with `depth` (max `OL_MAX`); an item's children are the following items with a greater depth (`olEnd`). Indent, outdent and moves always carry the whole block. Templates live in `OL_TPL`.

## Persistence

`flush()` writes dirty docs. In the original Claude artifact it used the artifact `db` capability, one doc per `meta` and `<prefix>_<id>` for each `DOCS` prefix (`sc`, `en`, `tl`, `ch`, `nt`, `ol`), under `data/users/<id>`. Outside that environment `window.claude` is absent, so it falls back to `localStorage` key `inkling:project` (mirrored on every save either way). Keep scene text in its own doc/key so no single record gets large. The artifact declares `db`, `user`, `downloads` and `assets` (pictures); never put image bytes in a doc.

## Key behaviours

- Name links: `buildLinker()` makes one case-sensitive regex from every entity name and alias. `relinkEditor()` re-renders spans only when the link set changes, and restores the caret by text offset. The editor is `contenteditable="plaintext-only"` with a fallback to `true`.
- Pet credit: `credit(delta)` counts only positive deltas, ignores single changes over 600 words (pastes), and drives cheers, confetti and level-ups. Stages are in `STAGES`.
- Timeline (`renderTl`): `drawTl()` redraws only the board, `drawSide()` only the card/settings panel, so inputs keep focus while the board updates. Tick labels come from the `fmt` template (`{n}`, `{name}`, `{cycle}`, `{i}`), unless the column (`tlIdx`) has a custom label in `ticks`; cards in that column show it too. Cards stack into rows within a lane when they overlap. Mouse drags the whole card; touch drags only the grip or the resize edge so the board still scrolls. Lane names are edited inline (`tlEditLane`) or in Customize; lanes also have an optional `note` (what the lane tracks). Card colour `''` means "use the lane colour"; colours are token names or `#rrggbb`.
- Layout: three panes above 1080px, tabbed below. All colours are CSS tokens with light and dark palettes.

## Ideas not built yet

Drag-and-drop in the binder and on the brainstorm board, several pictures per story page, linking timeline cards to each other, a vertical timeline layout, word-count history chart, Word/PDF export, per-scene snapshots, find and replace, mention counts in the binder.
