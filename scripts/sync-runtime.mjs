#!/usr/bin/env node
// Inlines runtime/deck.css and runtime/deck.js into decks, so every deck stays one self-contained file.
// A deck marks the slots with <style id="deck-kit-css"></style> and <script id="deck-kit-js"></script>.
//   node scripts/sync-runtime.mjs                     refresh the template and the examples
//   node scripts/sync-runtime.mjs my-deck.html        refresh one deck
//   node scripts/sync-runtime.mjs --new my-deck.html  start a new deck from the template
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'runtime/deck.css'), 'utf8').trim();
const js = fs.readFileSync(path.join(root, 'runtime/deck.js'), 'utf8').trim().replace(/<\/script/gi, '<\\/script');

const args = process.argv.slice(2);
if (args[0] === '--new') {
  const dst = args[1];
  if (!dst) { console.error('usage: sync-runtime.mjs --new my-deck.html'); process.exit(1); }
  if (fs.existsSync(dst)) { console.error(`${dst} already exists`); process.exit(1); }
  fs.copyFileSync(path.join(root, 'template/deck.html'), dst);
  args.splice(0, 2, dst);
}
const files = args.length ? args : [path.join(root, 'template/deck.html'),
  ...fs.readdirSync(path.join(root, 'examples'), { withFileTypes: true }).filter(d => d.isDirectory())
    .map(d => path.join(root, 'examples', d.name, 'deck.html')).filter(f => fs.existsSync(f))];

for (const f of files) {
  let h = fs.readFileSync(f, 'utf8');
  const before = h;
  h = h.replace(/<style id="deck-kit-css">[\s\S]*?<\/style>/, () => `<style id="deck-kit-css">\n${css}\n</style>`);
  h = h.replace(/<script id="deck-kit-js">[\s\S]*?<\/script>/, () => `<script id="deck-kit-js">\n${js}\n</script>`);
  if (!/id="deck-kit-js"/.test(h)) { console.warn(`skip ${f}: no <script id="deck-kit-js"> slot`); continue; }
  fs.writeFileSync(f, h);
  console.log(`${h === before ? 'up to date' : 'synced    '}  ${path.relative(process.cwd(), f)}`);
}
