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
node deck.mjs gif    deck.html [out.gif]     # video timeline; --from --to --fps 12 --width 960 --hold 1.2
node deck.mjs mp4    deck.html [out.mp4]     # video timeline via ffmpeg; --fps 30 --hold
node deck.mjs check  deck.html               # lint; exit code 1 on errors; --timeline, --no-webfonts
node deck.mjs perf   deck.html               # frame cost per step and transition; exit code 1 over 16 ms
node deck.mjs bundle deck.html [out.html]    # inline fonts, CDN scripts, remote images
```

## Page contract

The page is opened with `?render` and must expose:

```js
window.__deck = { W, H, slides, states(which), show(i, step), buildPrint(list), timeline() };
window.__meta = { W, H, FPS, DURATION };
window.__draw = T => {};   // timeline frame
window.__ready = true;     // after fonts and images
```

Decks built on `runtime/deck.js` provide all of it. Details in [../01-runtime.md](../01-runtime.md) and [../12-export-qa.md](../12-export-qa.md).
