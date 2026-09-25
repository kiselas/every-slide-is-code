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

Presentation clickers send PgUp/PgDn or arrows, so they work as they are. Links, buttons and anything with `data-no-advance` do not advance on click, so a slide can hold an interactive demo.

## Presenter view

**P** opens a second window: the current slide (live, with animations), the next state (as a rest frame), the speaker notes in large type, a timer (click to reset) and the clock. Move it to your laptop screen and put the deck window fullscreen on the projector. Either window drives both.

Notes come from `<aside class="notes">` inside each slide and can hold HTML: paragraphs, a bold number, a list of beats.

## Before the talk

- Run it on the presentation machine and screen. Check that fonts loaded (the deck waits for them; if it is offline, bundle first).
- For offline or locked-down laptops: `node export/deck.mjs bundle deck.html deck.offline.html` inlines Google Fonts and CDN scripts into one file.
- Export a PDF as a backup and for people who ask for "the slides" (`node export/deck.mjs pdf deck.html`).
- Rehearse with presenter view and the timer. If a slide takes more than two minutes, split it.
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
