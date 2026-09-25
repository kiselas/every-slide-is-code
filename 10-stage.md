# Stage: a world behind the slides

The stage is one canvas behind every slide. It is drawn every frame from the camera position, so it can make the deck feel like one continuous place instead of a stack of pages: paper that feeds past, a map that pans, a grid that recedes, light that shifts between chapters.

```js
Deck.stage({
  setup(ctx, { W, H, deck }) { /* once: build patterns, textures */ },
  draw(ctx, S) {
    // S = { W, H, T, rest, cam: {x, y, s}, i, from, to, p, slides: [{x, y, s}, …] }
  },
});
```

| Field | Meaning |
|---|---|
| `S.cam` | camera in world units (slide widths / heights): top-left `x, y` and scale `s` |
| `S.slides` | every slide's `data-pos`, to draw things at slide positions |
| `S.i` | current slide index; fractional during a transition |
| `S.T` | global clock; `S.rest` is true in exports |

During a `camera` transition, `cam` moves with the flight. During any other transition it sits at the destination, so the background does not slide under slides that are not moving.

## World to screen

```js
const k = 1 / S.cam.s;
const toScreen = (wx, wy) => [(wx - S.cam.x) * k * S.W, (wy - S.cam.y) * k * S.H];
```

A slide at `data-pos="0 1.12"` has its top-left at world `(0, 1.12)`. Draw what belongs to that slide at `toScreen(0, 1.12)` scaled by `k`.

## Recipes

**Paper grain that moves with the world.** Build a small seeded noise tile once, make it a pattern, and offset the pattern by the camera. Also give the tile to `--dk-card`, so opaque transitions (`tear`, `cover`) carry the same texture.

```js
setup(ctx, { deck }) {
  const n = 220, cv = document.createElement('canvas'); cv.width = cv.height = n;
  const g = cv.getContext('2d'), img = g.createImageData(n, n), r = Deck.rng(42);
  for (let i = 0; i < n * n; i++) { const v = r(); img.data[i * 4 + 3] = v > .97 ? 16 : v > .75 ? 6 : 0; }
  g.putImageData(img, 0, 0);
  grain = ctx.createPattern(cv, 'repeat');
  deck.style.setProperty('--dk-card', `#f2eee5 url(${cv.toDataURL()})`);
},
draw(ctx, { W, H, cam }) {
  ctx.fillStyle = '#f2eee5'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(-(cam.x * W / cam.s) % 220, -(cam.y * H / cam.s) % 220);
  ctx.fillStyle = grain; ctx.fillRect(-220, -220, W + 440, H + 440); ctx.restore();
}
```

**Marks between slides.** Draw something in the gap between slide positions (a dashed cut line, a chapter label, a fold). It is off-screen at rest and passes through the frame during a camera flight, which is what makes the flight read as travel. The demo draws a cut line under each slide and a small ticket number in the left margin.

**Parallax.** Draw a far layer offset by `cam * 0.3` and a near one by `cam * 1.4`: a grid, contour lines, a skyline. Keep it low-contrast; it must never compete with the slide.

**Chapter light.** Interpolate the background colour or a large soft gradient by `S.i`, so each chapter has its own tone and the change happens during the transition.

## Rules

- The stage is atmosphere. At rest, it should be nearly invisible behind the content.
- No information on the stage that the slide needs: `check` does not see canvas text, and exports treat it as a picture.
- Deterministic: seeded noise, no `Math.random()`, ambient motion only from `S.T` and frozen when `S.rest`.
- Performance: a full-screen fill with a pattern and a few paths is cheap. Per-pixel work belongs in a pre-rendered tile or a WebGL shader.

## WebGL stage

For a shader background (flowing noise, a light field), create a WebGL canvas in `setup`, render it in `draw`, then `ctx.drawImage(glCanvas, 0, 0)` into the stage. Create the context with `preserveDrawingBuffer: true` so the PDF export can capture it.
