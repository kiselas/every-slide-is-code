# Export and checking

## Formats

The HTML deck is the source. Every other format is a view of it:

| Format | Command | Contents |
|---|---|---|
| PDF | `node deck.mjs pdf deck.html` | vector, selectable text, one page per slide at its final step; `--steps` for every step, `--raster` for image pages |
| PPTX | `node deck.mjs pptx deck.html` | one full-bleed image per slide plus speaker notes; static and not editable as shapes |
| PNG | `node deck.mjs png deck.html frames/` | the rest frame of every step; `--last` final steps only; `--jpg --width 960` for small previews |
| single states | `node deck.mjs still deck.html 6.2 6.2@0.4 --out stills` | exactly the named frames as PNG (see "Look at one state") |
| GIF | `node deck.mjs gif deck.html teaser.gif --hold 1.1 --to 30` | the video timeline; frame-differenced, so holds cost almost nothing; parallel, `--draft` for previews |
| MP4 | `node deck.mjs mp4 deck.html film.mp4` | the timeline at 30 fps; needs ffmpeg; parallel, `--draft` for previews |
| offline HTML | `node deck.mjs bundle deck.html deck.offline.html` | Google Fonts, CDN scripts and remote images inlined, plus metric-matched fallback fonts |

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
| `escapes-box` | text sticks out of the box it sits in (an element with a background or border), or out of the SVG rect/circle it is centred on; the message says by how many pixels |
| `off-canvas` | a box extends past the slide edge (mark intended bleeds with `data-bleed`) |
| `low-contrast` | text colour against the real backdrop under 4.5:1 (WCAG 2), or under 3:1 for text of 40 px and above: a warning between 3:1 and that norm, an error under 3:1; deliberately dimmed text (effective opacity under 0.9) is skipped; the message adds APCA Lc for information (see below) |
| `contrast-unknown` | the backdrop is an image, video, gradient or a non-uniform canvas, so the contrast cannot be measured (warning) |
| `density` | over 60 words on screen (warning) |
| `notes` | a slide without speaker notes (warning) |
| page errors | console errors and exceptions while rendering |

The exit code is 1 when there are errors, so it can run in CI. Text that is part of an illustration (a receipt, a code sample) can opt out with `data-lint-skip`.

Two flags widen the net. Run both before calling a deck done:

```bash
node deck.mjs check deck.html --timeline       # also every 0.15 s of every step while it animates
node deck.mjs check deck.html --no-webfonts    # with Google Fonts blocked, as on a locked-down network
```

Rest frames hide transient problems: in the demo, the scale read-out passed at rest but its minus sign stuck 29 px out of its box for half a second while it settled. Only `--timeline` catches that.

Each `--timeline` finding is one line per element, at its worst frame, and ends with a ready-to-copy state for `still`:

```
ERR   3.0   number  escapes-box (while animating, +1.20s): "re-entering data we already have" spills out of <div> by 36px   [still 3.0@1.2]
```

The summary line ends with the worst overflow in pixels, so a before/after comparison of a fix is one number.

**Contrast.** `low-contrast` composites what is painted under each text line (element backgrounds, SVG shapes, opacity; a canvas such as a stage counts when the pixels under the line are uniform) and computes the WCAG 2 ratio of the text colour against it. The gate is 4.5:1, or 3:1 for text of 40 px and above on the 1080 canvas (04-slide-design.md). The message also shows APCA Lc (SAPC 0.0.98G-4g, the constants of Myndex's apca-w3) as information: Lc 60 is a common floor for body text, 75 is comfortable. It never fails the check. Findings are grouped by text colour with a count and examples, and printed once per slide, again only when a later step adds texts. A dimmed or faded state that is intended (the previous point of a build, an unlit indicator on an illustration) is reported too; mark it `data-lint-skip`. `--timeline` does not check contrast.

With the severity policy above (a warning from 3:1 to the norm, an error under 3:1; dimmed builds are skipped) the demo deck has 45 `low-contrast` warnings and no errors. Before that policy the check reported 46 errors and one `contrast-unknown`, all true positives by the rule as written: the muted colour `#857f72` on the paper (3.0 to 3.8:1) for every kicker, axis label and caption at 22 to 26 px; the accent `#dd4428` used as text on paper (3.0 to 3.7:1, at 24 to 30 px); the green `#2b7a4b` (4.1 to 4.5:1); the white step numbers on the accent discs (4.05:1). Two are not text in the reading sense: the lit "TARE" lamp drawn dimmed on the scale illustration (1.4:1) and the `■` legend swatches. The unknown is the highlighter behind "$249 a month" (a gradient). The fix belongs in the deck's palette (a darker `--muted`), not in the checker.

### Look at one state: `still`

```bash
node deck.mjs still deck.html 6.2 6.2@0.4 6.2@rest 7 --out stills --width 960
```

Renders exactly the named states as PNG and prints the paths. `S.T` is slide S, step T (1-based slide, the numbers `check` prints); a bare `S` is the slide's last step. `@t` is seconds into that step's animation, the same clock `check --timeline` prints, so pasting its `[still 6.2@0.45]` shows the frame with the problem; `@rest` or no suffix is the rest frame. For step 0 of a slide after the first, the clock starts with the incoming transition. `--width` scales the output; the default is the full canvas.

### Fallback fonts: `fonts`

The brief (rules 25 and 28) says a deck must survive blocked Google Fonts. `check --no-webfonts` tells you whether it does; `fonts` makes it more likely.

```bash
node deck.mjs fonts deck.html            # print the CSS and what would change
node deck.mjs fonts deck.html --write    # insert it into the deck; idempotent
```

For every requested family, `@capsizecss/metrics` gives the font's average glyph width and vertical metrics, and a `@font-face` called `<Family> Fallback` on a local system font (Arial, Times New Roman or Courier New by category) is computed with `size-adjust`, `ascent-override`, `descent-override` and `line-gap-override`, so the fallback takes the same space. `--write` puts the block in `<style id="dk-font-fallbacks">` and adds the fallback name right after the family in every font stack it finds (CSS, custom properties, SVG and canvas font strings). `bundle` does it automatically. A family that capsize does not know is listed and skipped; the metrics are those of the regular weight, so a heavy display face stays an approximation.

Measured on the demo deck with Google Fonts blocked, over all 666 text boxes of the 40 rest frames, against the same deck with the fonts loaded:

| | mean width error | worst width error | boxes more than 2 px off |
|---|---|---|---|
| fonts blocked, no fallback block | 8.2% (20.9 px) | 569 px | 576 |
| fonts blocked, with `fonts --write` | 1.8% (9.1 px) | 213 px | 110 |

`check --no-webfonts` finds nothing on the demo either way (0 containment findings, worst overflow 0 px; the demo already leaves the slack the brief asks for), so the fallback block does not change that result there; it shrinks the layout shift (a title that wraps to a different line, a label that moves) that the check cannot see. Decks with tight boxes are where the two checks part ways: run `check --no-webfonts` before and after.

### Rendering fast: `--workers`, `--draft`, `--profile`

`gif`, `mp4`, `check`, `png`, `sheet`, `strip` and `still` capture with CDP `Page.captureScreenshot` and run on a pool of browsers, one worker thread with its own Chrome each. The timeline is cut into chunks whose size depends only on the frame range, so any `--workers` gives the same chunks and the same frames in the same order; MP4 chunks are encoded separately and joined without re-encoding, GIF chunks are joined by concatenation (each starts with a full frame). `__draw(T)` must be a pure function of `T`; renders of the same `T` differ by at most 2 levels in a few dozen pixels (GPU rounding), which is why the debug flag compares signatures, not hashes.

```bash
node deck.mjs mp4 deck.html film.mp4 --workers 4       # default min(4, cpus/4)
node deck.mjs mp4 deck.html preview.mp4 --draft        # half size, 15 fps, JPEG frames, x264 veryfast crf 26
node deck.mjs gif deck.html teaser.gif --draft         # half width, 8 fps, JPEG frames, 63 colours
node deck.mjs mp4 deck.html part.mp4 --from 30 --to 40 --profile
node deck.mjs mp4 deck.html a.mp4 --to 4 --workers 1 --signatures a.txt   # debug: prove the order
node deck.mjs mp4 deck.html b.mp4 --to 4 --workers 4 --signatures b.txt
node deck.mjs sigdiff a.txt b.txt
```

`--profile` prints the ten slowest frames by timecode (with the slide and step) and the mean cost of a frame for each second of the timeline, split into the draw call, the capture and, for GIF, the encode. The capture is where heavy filters show up.

Measured on the demo deck (seconds 0 to 10 of the timeline, 1080p, 20 logical CPUs, headless Chrome, best of three runs on a machine that was 60 to 90% busy with other work, so read the ratios, not the seconds):

| Command | before (one process, `page.screenshot`) | 1 worker | 4 workers (default) | `--draft`, 4 workers | `--draft`, 1 worker |
|---|---|---|---|---|---|
| `mp4` (300 frames) | 56.7 s | 40.5 s | 15.8 s | 5.4 s | 7.0 s |
| `gif` (120 frames) | 15.1 s | 10.7 s | 6.4 s | 4.4 s | 4.5 s |

`--draft` is 6.1x faster than the default for MP4 with one worker and 2.9x with four (10x faster than the old default); for GIF 2.4x and 1.5x (3.4x faster than the old default). What stops it at four workers is the fixed cost of starting four browsers and loading the deck in each (about 3 s), which a 10 second range cannot hide; on a whole film the ratio grows. Other commands, same setup: `png` (40 frames) 7.9 s to 4.6 s, `sheet` 6.6 s to 5.4 s. `check` is not faster on a deck this small: 1.6 s to 2.5 s for rest frames (the contrast pass), 3.4 s to 4.7 s with `--timeline` (four browsers start for about 40 frames of work); the pool pays off on decks of dozens of slides.

Working loop: iterate on a 5 to 10 second range with `--draft`, look at `still` frames and the sheet, render the whole film at full quality once. Numbers and caveats in 13-performance.md.

### Performance

```bash
node deck.mjs perf deck.html
```

Frame cost per step and per transition, DOM size and live filters; budget 8 ms. See 13-performance.md.

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
- [ ] `check` passes with no errors (contrast included: no `low-contrast`, every `contrast-unknown` looked at)
- [ ] Under 40 words per step; the rest in notes
- [ ] One focal point per step
- [ ] The accent has one meaning
- [ ] Every final step reads without motion

**Motion**
- [ ] Two or three transition types, each with a meaning
- [ ] No linear motion except constant processes
- [ ] Groups staggered; nothing important animates at the same time as something else important
- [ ] Nothing that matters takes longer than two seconds

**Containment**
- [ ] `check --timeline` and `check --no-webfonts` pass; `fonts --write` (or `bundle`) added the fallback block
- [ ] Boxes with text have no fixed height
- [ ] Changing numbers fit at their widest value

**Technical**
- [ ] No `Math.random()`, no CSS transitions or keyframes on content
- [ ] `perf` under 8 ms; `?perf` shows idle on still slides
- [ ] Every slide has a title for the control bar and overview
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
- A box with a fixed height that holds only as long as the webfont loads.
- A counter or read-out sized for its final value, not its widest one.
