# Slide design

## Defaults to move away from

Models have a house taste for slides: a dark navy or near-black background, a purple-to-blue gradient, glassmorphism cards, three icon cards in a row, emoji bullets, every block centred, big rounded corners everywhere. None of it is wrong when chosen, but as a default it makes every deck look the same. If no style is given, derive one from the subject:

- food, hospitality: receipts, kitchen tickets, chalkboards, enamel signs (the demo deck);
- logistics, travel: departure boards, luggage tags, route maps;
- finance: annual-report typography, ledger rules, one ink colour;
- science, health: lab notebook, specimen labels, journal figures;
- developer tools: terminal, man pages, diff colours used with meaning;
- climate, energy: survey maps, engineering drawings, weathered print.

Say the choice and the reason in one line of the plan.

## The canvas

1920×1080 pixels. A grid keeps slides consistent:

| | Value |
|---|---|
| Outer margin | 150–160 px left and right, 110–130 px top, 90 px bottom |
| Columns | 12, gutter 40 px (content width 1600 px) |
| Title baseline | same position on every content slide |
| Safe area | nothing important within 60 px of the edge; `check` flags under 38 px |

Positions of the kicker, title and footer do not move between slides. When they stay put, the eye goes to what changed, and `camera` and `morph` transitions look intentional.

## Palette

4–6 colours with roles, defined as CSS variables on `:root`:

| Role | Share of a slide | Example (demo deck) |
|---|---|---|
| background | most | `--paper: #f2eee5` |
| ink | text, main shapes | `--ink: #1c1b18` |
| muted | labels, axes, secondary text | `--muted: #857f72` |
| rule | grid lines, separators | `--rule: #cbc3b2` |
| accent | the one thing to look at | `--waste: #dd4428` |
| second accent | only when it has a meaning | `--saved: #2b7a4b` |

Rules:

- The accent covers under 10% of a slide and means the same thing everywhere. In the demo, red is always waste and green is always saved; neither is ever decoration.
- Grey out what is context. A chart with one coloured bar and three grey ones says more than four colours.
- Text contrast: at least 4.5:1 for body text, 3:1 for 40 px and above. Projectors wash out contrast; test with the lights on.
- Light backgrounds survive projectors and PDFs better. Dark decks need higher contrast and fewer thin lines.

Starting palettes (background, ink, muted, accent):

| Direction | Background | Ink | Muted | Accent |
|---|---|---|---|---|
| Receipt | #f2eee5 | #1c1b18 | #857f72 | #dd4428 |
| Editorial (template) | #f4f2ee | #16161a | #6f6b63 | #2b4fe0 |
| Swiss poster | #f1efe9 | #111111 | #7a7a7a | #e3242b |
| Ledger | #fbfaf5 | #1f2a44 | #7d8597 | #0f7b5f |
| Blueprint | #17324d | #eaf2f8 | #8fb0c9 | #ffb000 |
| Terminal | #0f1110 | #d8f3dc | #6b8f71 | #ffd166 |
| Lab notebook | #fdfcf7 | #22302a | #8a958f | #c44536 |

## Density

- Under 40 words per step; the title does most of the work.
- One focal element per step. If two things compete, dim one (`data-dim`) or split the step.
- Lists: three to five items, each under ten words, revealed one per step, the previous one dimmed.
- A table on a slide has at most 5 rows × 4 columns; highlight the row that matters. Bigger tables go in an appendix or a handout.
- Code on a slide: at most 12 lines at 28 px, with the line that matters highlighted.

## Layouts that cover most decks

- **Title**: one claim, one line of context, presenter and date.
- **Statement**: one sentence, huge. For the turn in the story.
- **Big number**: the number (240–380 px), the unit and the comparison in one line under it.
- **Chart + title**: the title states the answer; the chart takes 60–70% of the slide; the annotation sits on the chart, not in a legend.
- **Split**: visual on one side, 2–3 short points on the other.
- **Diagram**: a flow or an architecture that builds node by node.
- **Timeline / roadmap**: one axis, milestones per step.
- **Ask**: the number, the use, the date.

## Containment

Text never leaves the box it sits in, in any frame and with any font:

- Boxes that hold text have a fixed width and a **minimum** height; the content decides the rest.
- Leave 10–15% slack. Webfonts can fail on corporate networks and the fallback is wider; `check --no-webfonts` shows what happens then.
- Titles: `data-fit="2"` keeps them to two lines whatever font renders them.
- Changing values are sized for their widest state: sign, all digits, the unit (`−0.000 kg`). Use tabular figures.
- Labels on shapes (inside a bar, a node, a circle) are checked with the longest label; if it does not fit, put the label next to the shape.
- `check` reports `escapes-box` (text outside a box with a background or border, or outside the SVG rect/circle it sits on) and `off-canvas` (a box past the slide edge). `check --timeline` repeats this on frames mid-animation.

## Imagery

Everything should be drawn: SVG illustrations, HTML mock-ups of UI, charts. That keeps the deck one file, crisp at any size, animatable and exportable. When a real photo or screenshot is needed, embed it as a data URI or put it next to the deck and let `bundle` inline it. A photo covers the full slide or a clean crop of it; small photos in boxes read as clip art.

## Style check before code

Write down: palette with roles, 1–2 fonts, the grid (margins, title position), the one bold decision, what the accent means. Imagine a similar prompt from someone else: if the result would look the same, the style is not tied to the subject yet.
