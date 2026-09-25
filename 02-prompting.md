# Prompting: how to brief a deck

## What a good brief contains

- **The decision or the change.** What should the audience do, believe or approve at the end? "Approve a $400K pilot", "pick vendor B", "join the waitlist". A deck without a decision is a report.
- **The audience and the room.** Investors in a 20-minute slot, a board reading it cold as a PDF, 300 people at a conference, one skeptical CFO. This sets density, tone and how much the slides must work without the speaker.
- **The raw material.** Numbers, quotes, the product, what was tried. Paste it; do not describe it. Say which numbers are real and which are placeholders.
- **Length.** Minutes or slides. Rule of thumb: one slide per minute for a talk, fewer and denser for a read-alone PDF.
- **Style in words, if it matters.** "Like a railway departure board", "Swiss poster", "lab notebook", "annual report from 1970". Not a mood board. If you have a brand, give the colours and fonts.
- **What to avoid, by name.** "No gradients, no icon grids, no stock-photo feel, no centred bullet lists." A general "don't make it look like AI" swaps one default for another.

## Two modes

**Short, about the subject.** When you want the model to shape the story and the look.

```
Pitch deck for a seed round: a scale for restaurant kitchens that weighs food waste
and prints tomorrow's prep list. 12 slides, 8 minutes. Invent illustrative numbers
and say so on the title slide.
```

**Precise, about the structure.** When the story is fixed and you need the build.

```
Deck from the outline below, one slide per line, the line is the slide title.
Slide 4: waterfall chart, one bar per click: 1,000 → −230 → −110 → −70 → 590 kg.
Slide 7: morph the device from slide 6 into the first node of the flow.
Transitions: camera within a section, tear between sections, nothing else.
```

## Templates

### Startup pitch
```
Seed pitch for [product] in [N] slides for [investors / accelerator demo day].
Story: problem → why now → product → how it works → traction → market → competition → business model → team → ask.
Numbers: [paste; mark illustrative ones].
Style: derive it from what the product touches physically; explain the choice in one line.
One chart per claim, the title states the answer. End on the ask and use of funds.
Plan first (titles, steps, transitions), then code, then check and a contact sheet.
```

### Product launch / keynote
```
Launch keynote for [feature], [N] minutes, projected on stage.
Open with the moment the user feels the problem, then reveal the product with a morph
from the old way to the new way. Three features, one slide each, each with a live-looking
UI mock built in HTML. Big type, little text, everything else in speaker notes.
```

### Internal idea / proposal
```
Proposal to [leadership team] to [decision]. They will read the PDF before the meeting.
Structure: the situation, the complication, the question, our answer (SCQA).
Each slide must work without me: full-sentence titles, annotated charts, sources in the footer.
Options slide with 3 options and the one we recommend, costed. Last slide: the decision and the date.
```

### Quarterly / board review
```
Q[n] review for the board, [N] slides. Lead with the three numbers that matter and whether
each is on plan. Then what went well, what did not, what we changed, the plan for next quarter.
Every chart shows plan vs actual. Red only for misses.
```

### Tech talk
```
Conference talk on [topic], 25 minutes, projected. Audience: senior engineers.
Diagrams build step by step with the explanation; code on slides at most 12 lines, 28 px,
with the line that matters highlighted. One running example through the whole talk.
```

## Phrases for iteration

Address slides by number and step, and name the symptom:

- "4.1: the annotation sits on the line. Move it into the gap between the two lines."
- "Slide 7 has 70 words. Keep the title and the chart, move the rest to notes."
- "Titles 3–6 are topics ('Market', 'Team'). Rewrite them as claims."
- "The accent colour is on every slide for different things. Use it only for our product."
- "Too many transitions. Keep camera inside a section and one transition between sections."
- "The bars all grow at once. Stagger them left to right, 80 ms apart."
- "The PDF page for slide 9 does not make sense without the animation. Add a label for the final value."

## Working habits

- Ask for the plan first: titles only, then the plan with charts and transitions, then code. Plans are cheap to fix; decks are not.
- Give the whole brief at once, not a series of commands.
- For long decks (30+ slides), build section by section in one file with one theme.
- Keep the numbers in one place (a `DATA` object at the top of the script) so a correction is one edit.
