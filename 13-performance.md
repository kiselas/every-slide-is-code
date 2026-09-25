# Performance

A deck runs on whatever laptop is plugged into the projector, often on battery, often with a second window open for presenter view. It must stay smooth there, and it must not burn a core while a slide just sits on screen.

## What the runtime already does

- **Idle slides cost nothing.** Once every build of the current step has finished and nothing read the clock, the frame loop skips rendering until the state changes. On the demo, a still chart slide went from ~470 ms of main-thread work per second to ~28 ms.
- **The stage redraws only when it has to**: when the camera moved, the canvas was resized, or the drawing reads `S.T`.
- **Layers are promoted to the GPU only while they move.** `will-change` is set on the two layers of a transition and cleared at the end; permanent promotion of every slide would cost memory.
- **Slides are isolated.** `contain: layout paint style` on each slide keeps a change on one slide from re-laying out the others; inactive slides are `display: none`.
- **Styles are written only when they change.** Builds cache the last value of opacity, transform, filter and clip.
- **Fonts and layout are warmed up before the first frame**, so the first transition does not stutter on a font swap or a first layout.
- **Resize is debounced to one frame.**

## Rules for deck code

1. **Never read layout inside `frame`.** `offsetHeight`, `getBoundingClientRect`, `getComputedStyle`, `getTotalLength` force a synchronous layout after the writes of the same frame. Measure once in `setup` (or in an animation's `init`) and keep the number. `Deck.pointAt` caches path lengths for this reason.
2. **Declare how long code-driven motion lasts.** `st.p(n, delay, dur)` tells the runtime when the motion ends. Motion driven by `st.since(n)` counts as active for `hook.active` seconds (default 4): set `active` on the slide spec to the real duration. Reading `st.T` or `st.life()` keeps the slide animating for as long as it is on screen, so use them only for real ambient motion.
3. **Set what changed, not everything.** In `frame`, write attributes that depend on `st`; static attributes belong in `setup`.
4. **Animate transform and opacity.** They are composited. Animating `width`, `height`, `top`, `left`, `font-size` or `box-shadow` triggers layout or paint on every frame. SVG geometry attributes (`height` of a bar, `d` of a path) are fine: they repaint only the SVG.
5. **Filters are paint-heavy.** `blur` builds, the `zoom` transition's blur and the `dissolve` SVG filter repaint the whole element every frame. Keep blurred elements small, and at most one filtered thing moving at a time.
6. **Keep the DOM per slide modest.** A few hundred nodes are fine; a thousand SVG points are not. For dense scatter plots or particle effects, draw into a `<canvas>` inside the slide.
7. **Big raster images: size them for 1920×1080.** A 6000-pixel photo scaled down costs decode time and memory on every transition.
8. **The stage is one full-screen draw.** Pre-render textures into a pattern once; never do per-pixel work in `draw`. If the stage reads `S.T`, it redraws every frame for the whole deck.
9. **`backdrop-filter` and large `box-shadow` on slide content** are expensive while layers move. Prefer a solid or semi-transparent fill.
10. **Presenter view runs the deck twice** (current and next). A deck that is borderline on one window will drop frames with presenter view open. Test with it open.

## Measuring

**In the browser**: open the deck with `?perf`. A small HUD shows the frame rate, how many frames per second were actually drawn (0 on an idle slide), the average and worst frame cost of the runtime's own work, whether the slide is idle, animating or in a transition, and the DOM size of the slide.

```
deck.html?perf#6.3
60 fps · drawn 0/s · 0.21 ms (worst 0.9) · idle · 45 nodes
```

If "drawn" stays at 60/s on a slide where nothing moves, something reads the clock (`st.T`, `st.life`, a stage that uses `S.T`) or a `since()` slide has no `active` limit.

**From the command line**:

```bash
node export/deck.mjs perf deck.html
```

For every step and every transition, it reports the median and worst main-thread cost of a frame (the runtime's script plus the style and layout it causes), the number of DOM nodes on screen and the number of elements with a live filter. Budget: under 8 ms (a warning above), never over 16 ms (an error: that frame misses 60 fps on its own). Paint and compositing are not in this number; filters and huge images show up in `?perf` on a real screen.

**Chrome DevTools, Performance panel**: record a transition with CPU throttling at 4×. That approximates an old office laptop.
