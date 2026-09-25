# Transitions

## A transition is a sentence about two slides

Pick the transition from how the two slides relate, not from what looks good:

| Relation | Transition | Example |
|---|---|---|
| We continue the same thought | `camera` (the world scrolls), `push` | problem → its size → its cause |
| The same object, new role | `morph` | the device on slide 5 becomes a node in the loop on slide 6 |
| Going inside something | `zoom` with `data-origin` on that thing | from the "prep ticket" node into the ticket itself |
| A new chapter | one chapter transition, always the same | `tear`, `dip`, `cover` |
| Revealing an answer | `iris` from the point of interest, `wipe` | the question → the answer |
| Time passes | `dip` through black | before → after a year |
| A change of mood or medium | `dissolve` | the vision slide |
| Nothing special | `fade`, or `none` | appendix |

Rules:

- **Two or three types per deck, each with one meaning.** In the demo: camera inside a chapter, tear between chapters, morph and zoom where an object carries over. Nothing else.
- The transition belongs to the slide it **enters**. Going back plays it reversed.
- Keep the kicker, title and footer in the same place on every slide, so `push`, `camera` and `morph` look deliberate.
- Transitions are short: 0.6–1.3 s. The audience is waiting for the next idea.

## Catalogue

| `data-transition` | What happens | Options |
|---|---|---|
| `none` | cut | |
| `fade` | cross-dissolve | |
| `dip` | through a colour, cut at the middle | `data-color` (default black) |
| `push` | the new slide pushes the old one out | `data-dir="left right up down"` |
| `cover` | the new slide slides over the old one, which darkens and recedes | `data-dir` |
| `zoom` | dive into a point of the old slide; the new one grows out of it | `data-origin="x y"` |
| `iris` | a circle opens from a point | `data-origin` |
| `wipe` | a soft edge sweeps across | `data-dir` |
| `blinds` | vertical stripes open | `data-count` on the slide |
| `cube` | 3D rotation of two faces | |
| `flip` | a card turns over | |
| `tear` | the old slide is torn off along a zigzag edge and lifted away | |
| `dissolve` | noise dissolve through an SVG filter | |
| `morph` | magic move: `data-morph` elements travel, the rest crossfades | |
| `camera` | the camera flies across one continuous world to the slide's `data-pos` | `data-pos`, `data-lift` |

Durations are set with `data-transition-dur`. Defaults are in the runtime: 0.6 s for fade, 1.3 s for camera.

`cover`, `cube`, `flip` and `tear` treat slides as opaque cards. The card background is `var(--dk-card)`, falling back to the deck's background colour. Set `--dk-card` to a colour plus a texture if the deck has one (the demo passes its paper grain).

## Camera: one world instead of a stack

Every slide has a position in a 2D world: `data-pos="x y [scale]"` in slide units. Without it, slides sit in a row. The `camera` transition flies from one position to the next and pulls back mid-flight in proportion to the distance (`data-lift` scales that, 0 for a straight pan).

```html
<section class="slide" data-pos="0 0">     <!-- chapter I: a column going down -->
<section class="slide" data-pos="0 1.12">
<section class="slide" data-pos="0 2.24">
<section class="slide" data-pos="3 0" data-transition="tear">  <!-- chapter II: a new column -->
```

The gap (`1.12` instead of `1`) leaves room between slides, visible during the flight. A stage (10-stage.md) can draw something in that gap: the demo draws a dashed cut line, so the camera visibly feeds down a receipt roll.

Ideas for world layouts:

- a column per chapter (receipt, scroll, document);
- a row along a timeline, where slide x is the year;
- a big map, where each slide is a region and the overview is the map zoomed out;
- a zoom-in chain: slide k+1 at 0.25 scale inside slide k, so each click dives deeper.

## Morph

Elements with the same `data-morph` key on the outgoing and the incoming slide fly from one place and size to the other while everything else crossfades. The runtime measures both rest positions at the start of the transition and animates clones on top.

```html
<!-- slide 5 -->
<div class="device" data-morph="device" style="left:150px; top:440px; width:900px; height:530px">…</div>
<!-- slide 6, transition morph -->
<div class="device" data-morph="device" style="left:150px; top:560px; width:450px; height:265px">…</div>
```

- Use it only when it is the same thing. A morph between unrelated shapes is noise.
- Put the moving thing in an HTML wrapper; an SVG child cannot leave its SVG.
- The two versions may differ (colour, content): they crossfade in flight. Keep the aspect ratio close, or the content stretches.
- Several keys can move at once (title, logo, a card), and the eye follows the largest one.

## Zoom into a point

```html
<section class="slide" id="ticket" data-transition="zoom" data-origin="1575 675">
```

`data-origin` is the point on the **outgoing** slide to dive into, in canvas pixels. Aim it at the element the next slide is about, so the dive reads as "let's look inside this".

## Custom transitions

```js
Deck.transition('slide-up-fade', { dur: .8, fn(A, B, p, o) {
  const e = Deck.ease.inOutCubic(p);
  A.style.opacity = 1 - e;
  B.style.transform = `translateY(${(1 - e) * 80 * o.sign}px)`;
  B.style.opacity = e;
} });
```

`A` and `B` are the layers of the outgoing and incoming slides. Their inline styles are cleared every frame, so set everything each time. `o.sign` is 1 forwards and -1 backwards; `o.origin`, `o.dir`, `o.color`, `o.veil` (a full-screen overlay element) are available. Add `opaque: true` to the spec to give layers a card background. A transition is a pure function of `p`, like everything else.

## Checking a transition

```bash
node export/deck.mjs strip deck.html strip.png --slide 6 --frames 8
```

Eight frames across the transition into slide 6. Look for: a frame where both slides are unreadable at once, text crossing text, content jumping at `p = 1` (the rest frame differs from the last transition frame), and the background moving when the slides do not.
