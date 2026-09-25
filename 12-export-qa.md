# Export and checking

## Formats

The HTML deck is the source. Every other format is a view of it:

| Format | Command | Contents |
|---|---|---|
| PDF | `node deck.mjs pdf deck.html` | vector, selectable text, one page per slide at its final step; `--steps` for every step, `--raster` for image pages |
| PPTX | `node deck.mjs pptx deck.html` | one full-bleed image per slide plus speaker notes; static and not editable as shapes |
| PNG | `node deck.mjs png deck.html frames/` | the rest frame of every step; `--last` final steps only; `--jpg --width 960` for small previews |
| GIF | `node deck.mjs gif deck.html teaser.gif --hold 1.1 --to 30` | the video timeline; frame-differenced, so holds cost almost nothing |
| MP4 | `node deck.mjs mp4 deck.html film.mp4` | the timeline at 30 fps; needs ffmpeg |
| offline HTML | `node deck.mjs bundle deck.html deck.offline.html` | Google Fonts, CDN scripts and remote images inlined |

Setup once: `cd export && npm install`. Needs Node 18+ and Google Chrome (another Chromium via `CHROME_PATH`).

PDF and PPTX are static on purpose: PDF viewers do not play animation outside Acrobat, and PowerPoint cannot run the deck's builds. The rest-frame rule (00-agent-brief.md, 18) is what makes them good.

**The video timeline.** Each step holds for `data-hold` seconds (per slide, per step, or `--hold` for all), transitions play in between, step-0 builds start during the incoming transition. `--from` and `--to` cut a range.

## Checking

### 1. `check`: automatic lint on every rest frame

```bash
node deck.mjs check deck.html
```

| Finding | Meaning |
|---|---|
| `tiny-text` | rendered text under 20 px (SVG text is measured after scaling) |
| `safe-area` | text within 38 px of an edge (skip with `data-bleed`) |
| `overlap` | two text boxes overlap (glyph bands, not font boxes) |
| `overflow` | a box with `overflow: hidden` clips its content |
| `density` | over 60 words on screen (warning) |
| `notes` | a slide without speaker notes (warning) |
| page errors | console errors and exceptions while rendering |

The exit code is 1 when there are errors, so it can run in CI. Text that is part of an illustration (a receipt, a code sample) can opt out with `data-lint-skip`.

### 2. `sheet`: the contact sheet

```bash
node deck.mjs sheet deck.html sheet.png --cols 5
```

Every rest frame on one image, labelled `slide.step · id`. This is the main review tool. Look at it after every version and describe what you see before changing anything:

- Read the titles in order: is it an argument?
- Is there one focal point per frame?
- Do kicker, title and footer sit in the same place on every slide?
- Is the accent used for one meaning only?
- Do step 0 frames make sense on their own (they are what the audience sees while the speaker starts talking)?

### 3. `strip`: one transition, frame by frame

```bash
node deck.mjs strip deck.html strip.png --slide 6 --frames 8
```

Look for frames where both slides are unreadable at once, text crossing text, the background moving while slides do not, and a jump between the last transition frame and the rest frame.

### 4. Live pass

Open the deck, press through it once with presenter view open, and time it.

## Checklist

**Story**
- [ ] Titles alone tell the argument
- [ ] Every chart title states its answer
- [ ] The deck ends on the decision or the ask
- [ ] Invented numbers are labelled as illustrative

**Slides**
- [ ] `check` passes with no errors
- [ ] Under 40 words per step; the rest in notes
- [ ] One focal point per step
- [ ] The accent has one meaning
- [ ] Every final step reads without motion

**Motion**
- [ ] Two or three transition types, each with a meaning
- [ ] No linear motion except constant processes
- [ ] Groups staggered; nothing important animates at the same time as something else important
- [ ] Nothing that matters takes longer than two seconds

**Technical**
- [ ] No `Math.random()`, no CSS transitions or keyframes on content
- [ ] Opens offline after `bundle`
- [ ] PDF pages match the sheet's final steps
- [ ] Presenter view shows notes for every slide

## Common first-draft problems

- Topic titles ("Market", "Team") instead of claims.
- Every slide in a different layout; the title jumps around.
- A different transition on every slide.
- Charts with four colours and a legend instead of one highlighted series and a label on the mark.
- The point only visible mid-animation; the PDF page is ambiguous.
- Labels overlapping lines or bars (the demo had two until `check` caught them).
- SVG `fill`/`font-size` attributes silently overridden by the stylesheet (01-runtime.md, Gotchas).
- A background that slides under a static slide during a transition.
