# Book formatting: plan (not built yet)

Goal: format a finished book for sale, as well as Vellum and Atticus do, inside Inkling. That means ebooks for every store, print-ready paperback and hardcover PDFs, and a live preview of both.
Today Inkling's export makes a submission manuscript (Word/PDF in standard manuscript format) and a plain reading EPUB. This plan is the step from "manuscript" to "publishable book".

**Check before building:** the KDP numbers below come from KDP's help pages as quoted by several guides. kdp.amazon.com could not be fetched from the build environment, and some guides disagree (marked *verify*). Check each one against KDP's current help pages (Trim size, Bleed and Margins; Paperback/Hardcover manuscript templates; eBook manuscript formatting guide; Kindle Publishing Guidelines) when the work starts. Keep the numbers in one table in the code (`PUB_TRIM`, `PUB_GUTTER`) so they are easy to update.

## What Vellum and Atticus do (the bar to clear)

- **Vellum** (Mac only, $250 for print and ebook) has about 26 polished book styles and has long had the best-looking output. It offers:
  - chapter heading styles with ornaments
  - drop caps and small caps on first lines
  - scene-break ornaments
  - full front and back matter: also by, copyright, dedication, epigraph, contents, acknowledgments, about the author, and store-specific links
  - a live preview of each device and trim size
  - one source file to every store, with store-specific variations
  - box sets, and pull quotes, block quotes, verse and text messages
- **Atticus** (web, Windows, Mac and Linux, one-time fee) has:
  - a writing editor, which is the main thing Vellum lacks
  - fewer but customisable themes, with your own chapter heading images and drop cap fonts
  - live preview
  - export to EPUB, print PDF and DOCX
  - collaboration
- **Where Inkling can win:**
  - Writing, planning and formatting live in one app.
  - It runs on Windows, Mac, Linux and the web.
  - It's free, or one price.
  - Story pages already link characters, so we can build an automatic cast list or glossary.
  - Shared projects already work.
  - Inky can cheer when you publish.

## Ebooks (Kindle, Apple Books, Kobo, Google Play, Nook)

**What KDP requires and recommends**
- **Format:** KDP takes EPUB 2 and EPUB 3, DOCX and KPF; the standard is now EPUB 3. Amazon converts it to Kindle formats, and one EPUB file serves every store.
- **Cover:**
  - Upload it separately in KDP; don't put it inside the manuscript, because KDP adds it.
  - For other stores, the EPUB should still carry its own cover (`properties="cover-image"`).
  - Ideal size is 2560 × 1600 px, a height-to-width ratio of 1.6:1. The minimum is 1000 × 625 px. Use JPEG (TIFF also accepted), RGB. *Verify the current numbers.*
- **Table of contents:**
  - A real HTML table of contents is required: the `nav` document, which Inkling already writes.
  - Also add an NCX for older readers.
  - Add landmarks for the cover, the contents and the start of the book (`bodymatter`, the "start reading" location).
- **Reflowable text:**
  - Fixed font sizes or a forced body font are not allowed; readers choose these.
  - Use `em` units and a first-line indent. No blank lines for spacing, and no Enter at the end of each line.
  - Set the language, a unique identifier and the modified date.
- **Images:** JPEG, PNG or GIF. Keep the file under 650 MB (KDP's limit). Delivery fees grow with file size on the 70% royalty plan, so keep images small.
- **Kindle quirks:**
  - Drop caps and fancy headings must degrade gracefully. Use simple floats and test them in Kindle Previewer.
  - Avoid absolute positioning and complex tables.
  - Ornaments should be small images or Unicode characters, with alt text.
- **ISBN:** none needed for Kindle. Other stores may want one, so add an optional ISBN field.
- **Copyright page:** usual for all formats. Front matter should be short in ebooks, because store previews ("Look Inside") show the first ~10%. Put "also by" and the acknowledgments at the back.

**Features to build**
- **Book metadata:**
  - title, subtitle, series and number, author or pen name
  - publisher or imprint, ISBNs (ebook, paperback, hardcover), edition and year
  - description, language and keywords
- **Front matter:** each piece can be switched on or off and reordered.
  - Built from stored text: half title, title page, copyright (generated from a template, editable), dedication, epigraph.
  - Generated: table of contents.
  - A prologue, foreword or introduction is a chapter marked as front or back matter.
- **Back matter:** acknowledgments, about the author (with an optional photo), also by (with series grouping), a newsletter/store link block, a reading-group guide, and the cast list built from story pages.
- **Chapter types:** a normal chapter, an unnumbered chapter (prologue, epilogue, interlude), a part or book divider, and front or back matter.
- **Book styles (themes):**
  - Chapter number and title layouts.
  - Heading font and size, drop cap or small caps on the first line, and the first paragraph not indented.
  - Scene-break ornament (glyph, image or blank space), heading ornament/image, text alignment and paragraph indent.
  - Start with about 8 well-made styles, each with an ebook and a print version. Let writers copy and tweak a style.
- **Special paragraphs:** block quote, letter, verse, centred, text message, and an "align right" signature. These need a small paragraph-style marker in scene text, kept as a marker in the same way `**bold**` is.
- **Store links:** a "Read more by me" link that changes per store (Kindle/Apple/Kobo/Google/Nook build variants of the same EPUB).
- **Box sets:** combine several Inkling projects into one ebook.
- **Check before export:** warn about an empty chapter, a missing cover or a cover too small, very long paragraphs, leftover `TODO`/`TK`, straight quotes, or double spaces.

## Print: paperback and hardcover PDFs

**What KDP requires and recommends** (*verify all of these*)
- **Trim sizes:**
  - Paperback has many sizes. Common fiction sizes are 5 × 8, 5.25 × 8, 5.5 × 8.5 and 6 × 9 in (6 × 9 is the most common in the US), plus A5 and 6.14 × 9.21.
  - Hardcover sizes are 5.5 × 8.5, 6 × 9, 6.14 × 9.21, 7 × 10 and 8.25 × 11 in.
  - Each size has its own minimum and maximum page count.
- **Page counts:**
  - Paperback: at least 24 pages, and up to 828 for black-and-white.
  - Hardcover: at least 75 pages, and a maximum of 550 or 600 (sources disagree).
  - Hardcover uses white paper only.
  - KDP rounds the page count up to an even number. Make our PDF even by adding a blank page at the end.
- **Inside (gutter) margin**, by page count:

  | Pages | Gutter |
  |---|---|
  | 24–150 | 0.375 in |
  | 151–300 | 0.5 in |
  | 301–500 | 0.625 in |
  | 501–700 | 0.75 in |
  | 701–828 | 0.875 in |

  Outside, top and bottom margins: at least 0.25 in without bleed, 0.375 in with bleed. These are minimums. Good books use more: about 0.75–0.9 in outside, 0.6–0.8 in top and bottom, and the gutter plus about 0.25 in. Set the trim size first and the margins second, because the margins depend on the page count.
- **Bleed:**
  - Only needed when something reaches the page edge, such as a full-page image or a chapter heading image. Text-only novels don't need it.
  - With bleed, the PDF page is 0.125 in wider and 0.25 in taller than the trim size. The trim takes 0.125 in from the top, bottom and outside edges.
  - If any page bleeds, the whole PDF must be made with bleed.
- **PDF:** every font embedded (Chromium's printToPDF does this), with nothing smaller than 7 pt. Images at least 300 DPI. No crop marks, comments or form fields. The pages are single, not spreads.
- **Cover:** a separate wraparound PDF (back, spine and front, plus bleed). Spine width = page count × paper thickness:
  - white paper about 0.002252 in per page
  - cream about 0.0025 in per page
  - hardcover adds board allowances (use KDP's cover calculator numbers)

  Spine text is allowed only from 79 pages or more (*verify*). It's optional for us. At least, show the spine width and offer KDP's cover calculator/template link. A later step: a cover builder that places the front image, back blurb, barcode area and spine text.
- **IngramSpark:** has similar rules but its own trim and margin tables and needs PDF/X-1a. Plan an "IngramSpark" preset later and note the PDF/X limitation (Chromium can't output PDF/X).

**Book design best practices (what makes it look professional)**
- **Pages:**
  - Recto (right) pages are odd and verso (left) pages are even.
  - Chapters start on a recto page, or on any page if the writer chooses (fewer blank pages, cheaper printing).
  - The title page, copyright page and the first page of a part also go on fixed sides.
- **Running heads:** the author on verso pages and the title (or chapter title) on recto pages. Leave them off chapter openings, blank pages and front matter.
- **Page numbers:**
  - At the outside top or bottom centre.
  - None on blank pages or front matter, or roman numerals there.
  - Arabic numbering restarts at 1 where the story begins.
- **Text:**
  - Justified with hyphenation, at 10.5–12 pt in a book serif (Garamond, Minion, Caslon or Palatino class), with leading about 1.3–1.4.
  - First-line indent of 1–1.5 em, and none after headings or scene breaks.
  - No widows or orphans, and no hyphenated word across a page turn if possible.
  - Bottom margins line up across a spread (vertical justification, or allow a line short).
- **Chapter openings:**
  - Drop the text start about a third of the way down the page ("sink").
  - Drop cap or small caps for the first few words.
- **Scene breaks:** an ornament or a blank line. If a break lands at the bottom of a page, always show an ornament so it isn't lost.

**Technical notes from a test (Oct 2026, Chromium 141; Electron 44 ships a newer Chromium)**
- **What works in Chromium printing:**
  - exact trim sizes from `@page { size: 6in 9in }` (needs `preferCSSPageSize: true`)
  - page margin boxes (`@top-center`, `@bottom-center` with `counter(page)`)
  - `@page :left` / `:right` for mirrored margins and alternating running heads
  - named pages (`page: front`) to drop heads and folios on front matter
- **What did not work:**
  - `break-before: right` did not add a blank page, so chapters began on left pages.
  - `@page name:first` did not remove the head on a chapter's first page.
  - `@page :blank` did nothing.
  - The page counter can't restart at 1 mid-book.
- **So do our own pagination in the page:**
  - Lay the text out into fixed-size page boxes in JavaScript (measure line boxes, then break into pages with widow/orphan rules).
  - Draw the running heads and numbers ourselves, and insert blank versos where needed.
  - Then print one page box per sheet.
- **What we get from that:**
  - full control (recto starts, no heads on openings, front-matter roman numerals, even page count)
  - an exact page count for the gutter and spine
  - the live print preview that Vellum and Atticus show, using the same layout
- Desktop: extend `DESK.pdf` with a `css:true` mode (preferCSSPageSize, no Electron header/footer, zero margins). The browser and artifact use the print window, which also respects `@page size`.
- Fonts: ship a few open-licence book fonts so print and ebook look the same everywhere, for example EB Garamond, Crimson Pro, Libre Baskerville, Literata (already used) and Cormorant for headings. Embed them in the EPUB (allowed by the OFL) and the PDF. They must be bundled for the desktop app (no network; see `prepare.js`).

## Suggested order

1. **Book details and front/back matter:** metadata, copyright generator, dedication, about the author, and chapter types.
2. **Store-ready EPUB** (done: cover, styles, NCX, pre-flight check, EPUBCheck in CI; store variants still to do):
   - cover, landmarks, NCX
   - styles (heading layouts, ornaments, drop caps)
   - ISBN and store variants
   - a pre-flight check
   - test the result with EPUBCheck in CI if possible
3. **Print PDF** (done: own paginator, KDP trims, paperback/hardcover, gutter by page count, recto starts, running heads and folios, spine width, bundled static book fonts; to do: hyphenation, cover wrap):
   - our own paginator, with trim size and paperback/hardcover presets
   - KDP gutter by page count, recto starts, running heads and folios
   - spine width readout
4. **Live preview:** ebook (phone, tablet, Kindle sizes) and print (spreads), side by side with the writing.
5. **Extras:**
   - special paragraphs and heading images
   - box sets
   - large-print edition preset
   - IngramSpark preset
   - cover wrap builder
   - DOCX for print

## Sources consulted

- [KDP: Trim size, bleed and margins](https://kdp.amazon.com/en_US/help/topic/GVBQ3CMEQW3W2VL6)
- [KDP: Trim size](https://kdp.amazon.com/help/topic/G201834560)
- [KDP: eBook manuscript formatting](https://kdp.amazon.com/en_US/help/topic/G200645680)
- [Vappingo: KDP manuscript formatting requirements](https://www.vappingo.com/word-blog/kdp-manuscript-formatting-requirements/)
- [Vappingo: KDP paperback formatting](https://www.vappingo.com/word-blog/kdp-paperback-formatting/)
- [Cambric: KDP file spec guide](https://cambric.pub/guides/kdp-requirements/)
- [Kindlepreneur: Atticus vs Vellum](https://kindlepreneur.com/atticus-vs-vellum/)
- [ScribeCount: Atticus vs Vellum vs Kindle Create](https://scribecount.com/author-resource/writing-tools-for-authors/atticus-vs-vellum-vs-lacuna-vs-kindle-create)
