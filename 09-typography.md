# Typography

## Fonts

- Two families at most, with clear contrast: a display face for titles and numbers, a text face for everything else. Serif + grotesque, condensed + wide, or a monospace for a technical voice.
- Load from Google Fonts with `&display=block`; the runtime waits for `document.fonts.ready` before the first frame and the exporter waits for it before any capture.
- Pairings that avoid the default look:

| Voice | Display | Text |
|---|---|---|
| Industrial, loud (demo) | Big Shoulders Display 800–900 | IBM Plex Mono |
| Editorial (template) | Instrument Serif | Instrument Sans |
| Engineering | Space Grotesk 700 | JetBrains Mono |
| Finance, sober | Newsreader | Public Sans |
| Warm, human | Fraunces | Work Sans |
| Swiss | Archivo 800 | Archivo |

Inter, Roboto and Montserrat are not wrong, but they are the default; choose them deliberately.

## Sizes on the 1920×1080 canvas

| Role | Size | Notes |
|---|---|---|
| Hero number | 240–380 px | tabular figures, tight line-height (.8–.85) |
| Title slide | 150–330 px | |
| Slide title | 72–110 px | line-height .94–1.05, max about 1500 px wide |
| Statement | 110–160 px | one sentence |
| Body | 28–38 px | line-height 1.35–1.45, max about 60 characters per line |
| Labels, axes | 20–26 px | muted colour, often uppercase with .06–.2 em tracking |
| Footer, source | 20–22 px | muted |

`check` fails anything under 20 px. On a projector at the back of a room, 24 px is the practical minimum for anything you expect people to read.

## Titles

- Sentence case or uppercase, consistently. Uppercase suits condensed display faces; tighten tracking slightly at large sizes.
- Balance line breaks by hand with `<br>` or `max-width` so a title never leaves one word alone on the last line.
- The title is already there when the slide lands. Animate content, not titles, except on the title slide and statements.

## Text on a slide

- Left-aligned by default. Centre only symmetric, ceremonial slides (title, statement, close).
- Numbers in running text use the same figures as the charts; use `font-variant-numeric: tabular-nums` wherever numbers change or line up.
- Use real typographic characters: −, ×, →, ’, “ ”, en dashes for ranges (Q3–Q4).
- Highlight with weight, the marker (`data-anim="highlight"`) or the accent colour: one of them, sparingly.

## Kinetic type that earns its place

| Technique | `data-anim` | Where |
|---|---|---|
| Mask reveal (the line rises from an invisible edge) | `mask` | title slide, statements, the close |
| Count up | `count` | the hero number |
| Typewriter | `type` | a quote, a prompt, a terminal line |
| Highlight sweep | `highlight` | the phrase the speaker is saying now |
| Strike and replace | `strike` + `count` with `data-from` | before → after numbers |
| Word by word | `data-stagger` on spans | a short manifesto line, not paragraphs |

Multi-line mask reveals: wrap each line in a `<span style="display:block">` inside a `data-stagger` container, so the lines rise one after another.

## Speaker notes

Notes are text too, and presenter view shows them at 24 px. Write them as you would say them: short paragraphs, the transition line to the next slide at the end.
