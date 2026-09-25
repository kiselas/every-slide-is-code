# Agent brief: presentations as code

Short rules. The details are in the neighbouring files.

## Architecture
1. One self-contained HTML file per deck. The runtime (`runtime/deck.js`, `runtime/deck.css`) is pasted inline. Fonts from Google Fonts, libraries only from a CDN, nothing else external. `export/deck.mjs bundle` makes it fully offline.
2. The deck is a pure function of `(slide, step, t)`. No animation state carried between frames, no `setTimeout` choreography, no CSS `transition`/`@keyframes` on content. Every visual value is computed from `st` in `frame(el, st)` or declared with `data-anim`. That is what makes jumping, the rest frames for PDF/PPTX and the video timeline possible.
3. Randomness is seeded (`Deck.rng(seed)`). `Math.random()` is banned in anything that draws.
4. Plan as data first: the storyline (one sentence per slide), the steps of each slide, the transitions and what each one means. Then code.
5. Slides are DOM and SVG at a fixed 1920×1080 canvas, scaled to the screen. Measure in pixels of that canvas, never in `vw`/`vh`.

## Story
6. One idea per slide. The title is that idea as a full sentence with a verb: "Costs flattened after the switch", not "Costs".
7. Read the titles alone, in order. If they do not tell the whole argument, fix the story before the slides.
8. Every chart answers one question, and the title states the answer. Highlight the part that proves it; grey the rest.
9. End on the decision or the ask, not on "Questions?".

## Visual
10. Derive the style from the subject: its materials, era, craft, where it lives. A food-waste pitch can be a receipt; a logistics plan can be a departure board. If no style is given, propose one and say why.
11. Avoid the default look: purple-to-blue gradient, glassmorphism cards, a row of three icon cards, emoji bullets, everything centred, a dark navy background with a neon accent. Legitimate only when chosen on purpose.
12. 4–6 colours with roles (background, ink, muted, rule, accent, second accent). The accent covers under 10% of a slide and carries meaning, the same meaning on every slide.
13. One bold decision per deck. Everything else is disciplined.

## Motion
14. Motion explains, it does not decorate. Builds reveal the argument in reading order; a transition says how two slides relate (06-transitions.md).
15. Nothing moves linearly except constant processes (flow along an edge, a ticker). Entrances on outExpo/outCubic, moves on inOutCubic, emphasis on a spring.
16. Stagger groups by 40–120 ms. Never animate more than one thing that matters at the same time.
17. Two or three transition types per deck, each tied to a meaning. A deck where every slide uses a different transition reads as a demo reel.

## Rest frames
18. Every step has a rest frame: the state when all its animations have finished. It must carry the full message without motion, because it is what PDF, PPTX, the overview and anyone who skims will see.
19. If the point only exists in the motion ("watch the line overtake"), add a label, an annotation or a highlight that makes it visible when still.

## Text
20. Body text at least 24 px on the 1080 canvas, labels at least 20 px. Titles 72–110 px. The runtime's `check` flags anything under 20 px.
21. Under 40 words on screen per step. What does not fit goes into speaker notes (`<aside class="notes">`).
22. Safe area: keep text at least 60 px from the edges (the check flags under 38 px).
23. Fonts are loaded before the first frame (`display=block`, `document.fonts.ready` is awaited by the runtime).

## Check
24. After every version run `node export/deck.mjs check deck.html` and `sheet`, open the sheet, describe what you see, then fix by slide and step number.
25. Check at least one transition with `strip` when you add or change it.
26. Numbers in an invented deck are labelled as illustrative on the title slide. Never present made-up figures as real data.
