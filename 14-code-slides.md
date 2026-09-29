# Code slides (optional plugin)

For technical talks. `runtime/code.js` + `runtime/code.css` add code blocks with Shiki highlighting, magic-move between code states, line focus per step, diffs and typing. The core stays as it is; a deck without the two slots is unchanged.

## When code earns a slide

- Show **8–15 lines**, never a whole file. The plugin warns above 18. Cut to the lines the sentence in the title is about; the rest goes in notes or a link.
- The title states what the code proves ("The fix lives in the writer, not in the reader"), not what it is ("import.ts").
- One idea per state. If a click changes four things, split it into two clicks or use line focus.
- Code that changes shape between clicks: **states** (morph). Code that stays and gets explained: **line focus**. A patch: **diff**. Building something up on stage: **cursor**.
- Prefer a light theme in a light deck. A dark block inside a light deck is a deliberate contrast (`data-code-theme="dark"`), used once.

## Enable

Two slots, in this order (the plugin must come before the deck script that calls `Deck.slide`):

```html
<style id="deck-kit-css"></style>
<style id="deck-kit-code-css"></style>          <!-- plugin CSS, right after the runtime CSS -->
...
<script id="deck-kit-js"></script>
<script id="deck-kit-code-js"></script>         <!-- plugin JS, right after the runtime JS -->
<script>Deck.slide(...)</script>
```

`node scripts/sync-runtime.mjs deck.html` fills the slots, like the runtime's. Slides with code and no `id` get one (`code-slide-N`); give slides real ids anyway.

## Markup

```html
<pre data-code="ts" data-file="cache.ts" data-numbers data-lines="*|5-6|8-10">
const TTL = 60_000;
...
</pre>
```

Escape `<` and `&` as in any HTML. Each state is dedented on its own.

| Attribute | Meaning |
|---|---|
| `data-code="ts"` | language. `ts js python go rust sql json yaml bash html css java c cpp ...` (any Shiki language id; aliases `py rs sh yml`); `text` for none |
| `data-file="cache.ts"` | filename chip above the code |
| `data-numbers`, `data-numbers="12"` | line-number gutter, from 1 or from 12 |
| `data-lines="1-3\|5\|7-"` | line focus, one spec per step (below) |
| `data-diff` | diff mode (below) |
| `data-code-cursor` | new code types itself in (below) |
| `data-code-theme="light\|dark"` | palette preset for this block; also allowed on `.deck` |
| `data-step`, `data-anim` | the block's own entrance, like any element (`rise`, `fade`) |
| `data-code-from="n"` | step at which the first state is shown (default: the block's `data-step`, else 0) |
| `data-code-dur=".9"` | seconds per state change |
| `data-code-dim=".38"` | opacity of lines outside the focus |
| `data-code-size="34"`, `data-code-min="24"` | font size in px; floor for shrinking |

**Steps and states.** Every step changes one thing: state *k* appears at step `from + k`. The slide's step count grows to fit.

```html
<div data-code="ts" data-file="import.ts" data-numbers>       <!-- states as children -->
<pre data-code-step>...first state...</pre>
<pre data-code-step data-lines="4-5">...second state, lines 4-5 in focus...</pre>
</div>

<pre data-code="ts">                                           <!-- or one source, states split by --- -->
...first state...
---
...second state...
--- 2-3|5
...third state, two steps: lines 2-3, then 5...
</pre>
```

`---` is taken as a separator; for YAML use `data-code-step` children, or `data-code-sep="off"`. A separator may carry a focus spec (`--- 2-3|5`).

**Line focus.** `data-lines="*|5-6|8-10"`: `*` (or empty) is every line, numbers are 1-based lines of that state, `,` joins ranges (`1,3-4`), `7-` runs to the end. On a single-state block each part is one step. On a multi-state block, parts go to steps in order (their count must match), or put `data-lines` on each state (`4-5|6` on a state gives it two steps). Focused lines stay at full strength, the rest dims; the rest frame of every step shows its focus without motion.

**Diff.** With `data-diff`, every line starts with `+ `, `- ` or two spaces (marker, then one space). The marker moves into a sign column and the line gets a tint and a bar. Colours are `--dk-code-ins` (accent, blue) and `--dk-code-del` (second accent, amber): never red and green alone, because the sign carries the meaning and the block reads in greyscale. Diff plus `data-lines` walks through a patch: what goes, what comes, what ties it together.

**Cursor.** `data-code-cursor`: at each state change removed code fades, moved code glides, and new code types in character by character in reading order, with a caret. The first state types in on the block's step. Typing is a function of the step's progress, so a jump, the rest frame and the video all agree; the caret shows only while typing. Duration follows the amount of new text (0.7–2 s).

## Magic move, and why it is our own

Between two states, lines are matched first (longest common subsequence of trimmed lines), then the words and punctuation marks inside the changed hunks. Matched tokens glide to their new place (0.1–0.8 of the step), removed ones fade out first (0–0.35), new ones fade in last (0.45–1); colours switch half-way. A lone punctuation mark that matched far from any matched neighbour is not matched, so it does not fly across the block. Line numbers, signs and tints move the same way.

We did not wrap `shiki-magic-move`: as far as its docs show it animates by time (duration, stagger), and the kit needs the state as a pure function of the step's progress (00-agent-brief.md rule 2): that is what gives rest frames, jumps, PDF and video. The plugin does the diff once, in `setup`, and every frame is `paint(frame a, frame b, progress)`. Each state change is a hidden marker element with `data-step` and `data-anim="code-step"`, so the runtime counts the steps, reads the timing and knows when the slide goes idle.

## Highlighting and themes

Shiki 3 loads lazily from a CDN: core, the JavaScript regex engine and one grammar per language, each requested from jsDelivr and esm.sh at once, the first answer wins. Version and hosts: `Deck.code.config({ shiki: '3.13.0', hosts: ['jsdelivr', 'esm'] })`, before the deck script ends. While it loads, the block shows the same tokens uncoloured with identical metrics, so nothing jumps; `__ready` waits for it (10 s, then the built-in highlighter takes over with a console warning; in a live deck a slow CDN still upgrades the colours later, exports never do).

The Shiki theme is made of CSS variables, so code matches the deck without re-highlighting. `runtime/code.css` derives them from the deck's own `--bg --ink --muted --accent` and an optional `--accent-2`. Override any of them in the deck's `<style>`:

`--dk-code-fg bg line comment keyword string number const function type prop punct param tag attr ins del`, plus `--dk-code-size` (28px), `--dk-code-lh` (1.5), `--dk-code-pad-x/-y`, `--dk-code-radius`, `--dk-code-font`.

Presets `light` and `dark` set all of them. Keep the palette to what the deck already has: keyword = accent, everything else quiet. Code font: a local monospace stack by default; for a webfont put it in the Google Fonts link and in `--dk-code-font`.

## Size and containment

- Code is at least 24 px on the 1080 canvas (default 28; set `--dk-code-size` per deck). The gutter, signs and filename chip are 22–28 px, above the `check` floor of 20.
- Rule for long lines, applied once in `setup`: the block shrinks its font to fit the longest line of any state, never below `data-code-min` (24 px); a line still too long **wraps** at token boundaries with a hanging indent of two columns, and the plugin warns. There is no horizontal scroll and no clipping.
- A block is sized once: its height is the maximum over all its states (in wrapped rows), so nothing jumps between steps. Width comes from CSS (`width`, or the parent); the block hugs its content vertically.
- Layout is a monospace grid: the character width is measured once after fonts load. ASCII code only; wide glyphs (CJK, emoji) break the grid.

## Offline

`bundle` inlines fonts and `<script src>`, but not the ES modules Shiki is made of. Store the highlighted tokens in the deck instead:

```bash
node scripts/sync-runtime.mjs --code-cache deck.html      # once, online; needs export/ installed
node export/deck.mjs bundle deck.html deck.offline.html   # now offline with the same colours
```

This writes a `<script type="application/json" id="deck-kit-code-cache">` (a few KB); blocks whose text is in it never touch the network. Re-run it after editing code (unknown text falls back to Shiki, then to the built-in highlighter: coloured, less precise). Without the cache, an offline deck still works and warns once in the console.

## Checks

```bash
node export/deck.mjs check deck.html               # 24+ px, containment, escapes-box on every step
node export/deck.mjs check deck.html --timeline    # atoms mid-glide stay inside the block
node export/deck.mjs check deck.html --no-webfonts # fallback monospace: wrap points move, nothing spills
node export/deck.mjs sheet deck.html               # look at every state and every focus
node export/deck.mjs pdf deck.html --steps         # one page per step, code is selectable text
```

- `check` counts every token as a word, so code slides get a `density` warning; that is expected. Keep the number of *lines* low instead.
- `perf` is 1–3 ms per frame for 15 lines; a slide with three states holds about 120 nodes.
- Look at a morph live, once (open `deck.html#4`, press next): tokens crossing for a moment is normal; a mess for over half a second is not, so shorten the change or split it into two states.

## Gotchas

- The plugin script goes before the deck script that calls `Deck.slide`; it wraps `Deck.slide` so your `setup` still runs (an error in the console says so if the order is wrong).
- Keep indentation identical between states for lines that should stay put. A state that shows only an inner fragment slides left, usually what you want.
- Line numbers in `data-lines` are relative to the state's first line, not to `data-numbers="12"`.
- The plugin owns the block's content: do not put your own children inside it, only `data-code-step` states.
- `data-lint-skip` on a block silences its tiny-text check too; do not use it.
- Different machines have different monospace fonts; wrap points differ unless the webfont is loaded (it is, with `display=block`).
- Do not animate the block with `data-anim="type"` or `count`; use `data-code-cursor`.
