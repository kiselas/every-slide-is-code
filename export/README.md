# export

The HTML deck is the source; this turns it into everything else, and checks it.

## Setup

Node 18+ and Google Chrome.

```bash
npm install
```

Chrome elsewhere: `CHROME_PATH=/path/to/chrome node deck.mjs ...`. MP4 also needs `ffmpeg` in PATH; GIF does not.

## Commands

```bash
node deck.mjs pdf    deck.html [out.pdf]     # vector, final step per slide; --steps, --raster
node deck.mjs pptx   deck.html [out.pptx]    # static slides + speaker notes; --steps
node deck.mjs png    deck.html [dir]         # every rest frame; --last, --jpg --width 960
node deck.mjs sheet  deck.html [sheet.png]   # contact sheet of all rest frames; --cols 5
node deck.mjs strip  deck.html [strip.png]   # one transition: --slide N --frames 8
node deck.mjs still  deck.html 6.2 6.2@0.4 6.2@rest 7 --out dir [--width 960]   # exactly these states as PNG
node deck.mjs gif    deck.html [out.gif]     # video timeline; --from --to --fps 12 --width 960 --hold 1.2
node deck.mjs mp4    deck.html [out.mp4]     # video timeline via ffmpeg; --fps 30 --hold
node deck.mjs check  deck.html               # lint; exit code 1 on errors; --timeline, --no-webfonts
node deck.mjs perf   deck.html               # frame cost per step and transition; exit code 1 over 16 ms
node deck.mjs fonts  deck.html [out.html]    # metric-matched fallback fonts; --write inserts them
node deck.mjs bundle deck.html [out.html]    # inline fonts, CDN scripts, remote images (+ fallback fonts)
```

### Speed: `--workers`, `--draft`, `--profile`

`gif`, `mp4`, `check`, `png`, `sheet`, `strip` and `still` capture frames with CDP `Page.captureScreenshot` (`optimizeForSpeed`) and run on a pool of browsers: one worker thread with its own Chrome each.

- `--workers N` (default `min(4, max(1, floor(cpus / 4)))`). The browsers share one GPU, so more than about a quarter of the cores does not help; measure once on your machine.
- Chunking depends only on the frame range, never on `--workers`: any worker count gives the same frames in the same order (pixels can differ by 1 to 2 levels between runs: GPU rounding). `--signatures a.txt` writes a 16x9 luma signature per captured frame and `node deck.mjs sigdiff a.txt b.txt` compares two runs (`--workers 1` vs `--workers 4`).
- `--draft` (gif, mp4): half size, half the frame rate (mp4 15 fps, gif 8 fps, unless `--fps` is given), JPEG frames, x264 `veryfast` at crf 26, a 63-colour GIF palette. For iterating on timing; render the final cut without it.
- `check` without `--timeline` uses one browser by default (it is two seconds of work; extra browsers cost more to start than they save); `check --timeline` uses the pool.
- `--profile` (gif, mp4): the 10 slowest frames by timecode (with the slide and step they belong to) and the mean frame cost for every second of the timeline.
- Each chunk of a GIF starts with a full frame, so a parallel GIF is a little larger than one written in a single pass (a few KB per chunk).

### `still`: look at exactly one state

```bash
node deck.mjs still deck.html 6.2 6.2@0.4 6.2@rest 7 --out stills --width 960
```

`S.T` is slide S, step T (1-based slide, as in `check` output); a bare `S` is the slide's last step. `@t` is seconds into that step's animation, the number `check --timeline` prints next to a finding (`[still 6.2@0.45]`); `@rest` or no suffix is the rest frame. For step 0 of a slide after the first, the animation clock starts with the incoming transition, so `@t` below the transition length lands inside the transition. The command prints the path of every PNG. `--width` scales the output (default: full canvas).

### `check`: new in this version

- `low-contrast` (warning from 3:1 to the norm, error under 3:1; deliberately dimmed text is skipped): WCAG 2 contrast of the text colour against the real backdrop, norm 4.5:1, or 3:1 for text of 40 px and above. The backdrop is composited from what is painted under the text (backgrounds, SVG shapes, opacity); a canvas is measured when the pixels under the line are uniform. The message also shows APCA Lc as information. Findings are grouped by text colour, with the count and examples.
- `contrast-unknown` (warning): the backdrop is an image, video, gradient or a non-uniform canvas.
- `data-lint-skip` on an element (or an ancestor) skips both.
- `escapes-box`, `overflow` and `off-canvas` now say by how many pixels; the summary line ends with the worst one.
- `--timeline` findings end with `[still 6.2@0.45]`, ready to paste into `still`, and the run ends with one `still ...` command listing them all.

### `fonts`: fallbacks that keep the layout when Google Fonts is blocked

```bash
node deck.mjs fonts deck.html                 # print the CSS block and what --write would change
node deck.mjs fonts deck.html --write         # insert the block and extend the font stacks in place
node deck.mjs fonts deck.html out.html --write
```

For every family requested from Google Fonts (or declared with `@font-face`), the metrics come from `@capsizecss/metrics`, and a `@font-face` named `<Family> Fallback` on a local system font (Arial, Times New Roman or Courier New, chosen by the family's category) is computed with `size-adjust`, `ascent-override`, `descent-override` and `line-gap-override`. `--write` puts the block in a `<style id="dk-font-fallbacks">` and adds `'<Family> Fallback'` right after the family in every font stack it finds (CSS, custom properties, SVG and canvas font strings). It is idempotent. A family capsize does not know is reported and skipped. `bundle` does the same automatically.

## Page contract

The page is opened with `?render` and must expose:

```js
window.__deck = { W, H, slides, states(which), show(i, step), buildPrint(list), timeline() };
window.__meta = { W, H, FPS, DURATION };
window.__draw = T => {};   // timeline frame
window.__ready = true;     // after fonts and images
```

Decks built on `runtime/deck.js` provide all of it. Details in [../01-runtime.md](../01-runtime.md) and [../12-export-qa.md](../12-export-qa.md).

`gif`, `mp4`, `check` and `still` jump between arbitrary times, so `__draw(T)` must be a pure function of `T` (the runtime guarantees it). Every worker loads the deck in its own browser and renders its own chunks.
