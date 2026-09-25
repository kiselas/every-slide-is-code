# Presenting

## Running the deck

Open the HTML file in Chrome, Edge or Firefox. It scales to any screen and letterboxes to 16:9.

| Key | |
|---|---|
| → ↓ Space PgDn Enter, click | next step |
| ← ↑ PgUp Backspace | previous (lands on the finished state, no replay) |
| Home / End | first / last slide |
| digits, Enter | go to that slide |
| O | overview grid; arrows and Enter to jump |
| P | presenter view in a new window |
| F | fullscreen |
| B or . | black screen, press again to return |
| ? | key help |
| Esc | closes help or black screen; otherwise opens the overview |

**With the mouse**, move it and the control bar appears at the bottom: back and next buttons, the slide number and title, dots for the steps of the slide (filled up to the current one), a scrubber with one segment per slide (hover shows the title, click jumps), and buttons for the overview, presenter view, fullscreen and help. It hides after a few seconds of stillness, so it never sits on the projected slide. Clicking the slide itself goes forward; clicking its left fifth goes back, and an arrow at the edge shows which way a click will go.

**On touch screens**, swipe or tap the sides.

The first seconds show a hint with the main keys. Typing a number shows "Go to slide 12 · Enter". Reaching the last step shows "End of the deck".

Presentation clickers send PgUp/PgDn or arrows, so they work as they are. Links, buttons and anything with `data-no-advance` do not advance on click, so a slide can hold an interactive demo. For a kiosk or an embedded deck, `data-controls="off"` on `.deck` removes the on-screen controls; keys still work.

## Presenter view

**P** (or the button in the control bar) opens a second window: the current slide (live, with animations), the next state (as a rest frame), the speaker notes in large type, back/next buttons, the position ("4 / 15 · step 2 of 3"), a timer (click to reset) and the clock. Move it to your laptop screen and put the deck window fullscreen on the projector. Either window drives both.

Notes come from `<aside class="notes">` inside each slide and can hold HTML: paragraphs, a bold number, a list of beats.

## Before the talk

- Run it on the presentation machine and screen. Check that fonts loaded (the deck waits for them; if it is offline, bundle first).
- For offline or locked-down laptops: `node export/deck.mjs bundle deck.html deck.offline.html` inlines Google Fonts and CDN scripts into one file.
- Export a PDF as a backup and for people who ask for "the slides" (`node export/deck.mjs pdf deck.html`).
- Rehearse with presenter view and the timer. If a slide takes more than two minutes, split it.
- Open the deck once with `?perf` on the presentation laptop with presenter view open: every still slide should say "idle", and transitions should hold 60 fps (13-performance.md).
- Turn off notifications, set the display to never sleep, and close other windows that might steal focus.

## In the room

- Projectors lower contrast and saturation. Thin grey lines and light-grey text may vanish; the `muted` and `rule` colours need to survive that.
- Big rooms: the back row sees your 24 px as 12 px on a laptop. When in doubt, go bigger and say less.
- Use **B** during a discussion so the room looks at people, not at the slide.
- Jump with digits + Enter during Q&A instead of clicking through; keep an appendix after the close for expected questions.

## Sharing

| They need | Send |
|---|---|
| to present it themselves, or see the motion | the HTML (bundled for offline) |
| to read it or print it | PDF, one page per slide (`--steps` for one page per build step) |
| to put it into their own deck | PPTX: static slides with your notes |
| a clip for social media or a README | GIF or MP4 of the timeline (12-export-qa.md) |
