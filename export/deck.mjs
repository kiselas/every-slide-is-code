#!/usr/bin/env node
// deck-kit exporter. The HTML deck is the source; every other format is a view of it.
// Usage: node deck.mjs <command> <deck.html> [out] [options]   (run with no args for help)
// Chrome: the installed Google Chrome by default; another binary via CHROME_PATH.

import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const HELP = `deck-kit export

  node deck.mjs pdf    deck.html [out.pdf]    vector PDF, one page per slide (final step)
                                              --steps   one page per step   --raster  image pages
  node deck.mjs pptx   deck.html [out.pptx]   static PowerPoint: full-bleed image per page + speaker notes
                                              --steps   one slide per step
  node deck.mjs png    deck.html [dir]        rest frame of every step as PNG   --last  final steps only
                                              --jpg --width 960  small JPEG previews
  node deck.mjs sheet  deck.html [sheet.png]  contact sheet of every rest frame --cols 5
  node deck.mjs strip  deck.html [strip.png]  frames across the transition into --slide N (--frames 8)
  node deck.mjs gif    deck.html [out.gif]    animated GIF of the timeline  --from s --to s --fps 12 --width 960
                                              --hold 1.2  same hold for every step (short teasers; mp4 too)
  node deck.mjs mp4    deck.html [out.mp4]    MP4 of the timeline (needs ffmpeg)  --from --to --fps 30
  node deck.mjs check  deck.html              lint rest frames: overflow, safe area, tiny text, overlaps, density
  node deck.mjs bundle deck.html [out.html]   inline CDN scripts, stylesheets and Google Fonts: one offline file
`;

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); if (i < 0) return false; argv.splice(i, 1); return true; };
const opt = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv.splice(i, 2)[1]; };
const cmd = argv.shift();
if (!cmd || cmd === '-h' || cmd === '--help') { console.log(HELP); process.exit(0); }

const O = {
  steps: flag('--steps'), raster: flag('--raster'), last: flag('--last'), jpg: flag('--jpg'), hold: opt('--hold', null),
  cols: +opt('--cols', 5), slide: +opt('--slide', 2), frames: +opt('--frames', 8),
  from: +opt('--from', 0), to: opt('--to', null), fps: opt('--fps', null), width: +opt('--width', 960),
};
const [input, outArg] = argv;
if (!input) { console.error(HELP); process.exit(1); }
const inputAbs = path.resolve(input);
const base = path.basename(input, path.extname(input));
const out = outArg || { pdf: `${base}.pdf`, pptx: `${base}.pptx`, png: `${base}-frames`, sheet: `${base}-sheet.png`,
  strip: `${base}-strip.png`, gif: `${base}.gif`, mp4: `${base}.mp4`, bundle: `${base}.bundle.html` }[cmd];

if (cmd === 'bundle') { await bundle(inputAbs, out); process.exit(0); }

/* ───────── browser ───────── */
const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' };
const browser = await chromium.launch(launchOpts);
const errors = [];
async function open(scale = 1) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(pathToFileURL(inputAbs).href + '?render' + (O.hold ? `&hold=${O.hold}` : ''));
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const meta = await page.evaluate(() => ({ ...window.__meta, deck: window.__deck.slides, title: document.title }));
  await page.setViewportSize({ width: meta.W, height: meta.H });
  return { page, meta };
}
const states = (page, which) => page.evaluate(w => window.__deck.states(w), which);
async function shot(page, meta, type = 'png') {
  return page.screenshot({ type, clip: { x: 0, y: 0, width: meta.W, height: meta.H }, ...(type === 'jpeg' ? { quality: 90 } : {}) });
}
async function showShot(page, meta, st, type) {
  await page.evaluate(({ i, step }) => window.__deck.show(i, step), st);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  return shot(page, meta, type);
}
const label = (meta, st) => `${st.i + 1}${meta.deck[st.i].steps ? '.' + st.step : ''}`;
function done(msg) { if (errors.length) console.warn(`page errors:\n  ${[...new Set(errors)].join('\n  ')}`); console.log(msg); }

try {
  const { page, meta } = await open(cmd === 'gif' || (cmd === 'png' && O.jpg) ? O.width / 1920 : 1);

  if (cmd === 'pdf') {
    const list = await states(page, O.steps ? 'all' : 'last');
    if (O.raster) {
      const imgs = [];
      for (const st of list) imgs.push((await showShot(page, meta, st, 'jpeg')).toString('base64'));
      await page.setContent(`<style>@page{size:${meta.W}px ${meta.H}px;margin:0}body{margin:0}img{display:block;width:${meta.W}px;height:${meta.H}px;break-after:page}</style>` +
        imgs.map(b => `<img src="data:image/jpeg;base64,${b}">`).join(''));
    } else {
      await page.evaluate(list => window.__deck.buildPrint(list), list);
      await page.addStyleTag({ content: `@page{size:${meta.W}px ${meta.H}px;margin:0}` });
      await page.evaluate(() => document.fonts.ready);
    }
    await page.pdf({ path: out, width: meta.W + 'px', height: meta.H + 'px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    done(`pdf: ${out} (${list.length} pages, ${O.raster ? 'raster' : 'vector'})`);
  }

  else if (cmd === 'pptx') {
    const { default: PptxGenJS } = await import('pptxgenjs');
    const pptx = new PptxGenJS();
    const wIn = 13.333, hIn = wIn * meta.H / meta.W;
    pptx.defineLayout({ name: 'DECK', width: wIn, height: hIn }); pptx.layout = 'DECK';
    pptx.title = meta.title || base;
    const list = await states(page, O.steps ? 'all' : 'last');
    for (const st of list) {
      const png = await showShot(page, meta, st, 'png');
      const s = pptx.addSlide();
      s.addImage({ data: 'data:image/png;base64,' + png.toString('base64'), x: 0, y: 0, w: wIn, h: hIn, altText: meta.deck[st.i].title });
      const n = meta.deck[st.i].notes; if (n) s.addNotes(n);
    }
    await pptx.writeFile({ fileName: out });
    done(`pptx: ${out} (${list.length} slides, static)`);
  }

  else if (cmd === 'png') {
    fs.mkdirSync(out, { recursive: true });
    const list = await states(page, O.last ? 'last' : 'all');
    for (const st of list) fs.writeFileSync(path.join(out, `${String(st.i + 1).padStart(2, '0')}-${st.step}.${O.jpg ? 'jpg' : 'png'}`), await showShot(page, meta, st, O.jpg ? 'jpeg' : 'png'));
    done(`png: ${list.length} frames in ${out}/`);
  }

  else if (cmd === 'sheet' || cmd === 'strip') {
    const tiles = [];
    if (cmd === 'sheet') {
      for (const st of await states(page, 'all'))
        tiles.push({ b64: (await showShot(page, meta, st, 'jpeg')).toString('base64'), label: `${label(meta, st)} · ${meta.deck[st.i].id}` });
    } else {
      const tl = await page.evaluate(() => window.__deck.timeline());
      const g = tl.segs.find(s => s.kind === 'tr' && s.to.i === O.slide - 1);
      if (!g) throw new Error(`no transition into slide ${O.slide}`);
      for (let k = 0; k < O.frames; k++) {
        const p = k / (O.frames - 1), T = g.t0 + Math.min(g.dur * p, g.dur - 1e-3);
        await page.evaluate(T => window.__draw(T), T);
        tiles.push({ b64: (await shot(page, meta, 'jpeg')).toString('base64'), label: `p ${p.toFixed(2)}` });
      }
    }
    const cols = cmd === 'strip' ? Math.min(4, O.frames) : O.cols, tw = 480, th = Math.round(tw * meta.H / meta.W);
    const sheet = await browser.newPage({ viewport: { width: cols * (tw + 12) + 12, height: 400 } });
    await sheet.setContent(`<style>body{margin:0;background:#161616;font:600 15px/1 ui-monospace,monospace;color:#ddd}
      .g{display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:12px;padding:12px}
      figure{margin:0}img{display:block;width:${tw}px;height:${th}px;outline:1px solid #333}figcaption{padding:6px 2px 0}</style>
      <div class="g">${tiles.map(t => `<figure><img src="data:image/jpeg;base64,${t.b64}"><figcaption>${t.label}</figcaption></figure>`).join('')}</div>`);
    await sheet.screenshot({ path: out, fullPage: true });
    done(`${cmd}: ${out} (${tiles.length} frames)`);
  }

  else if (cmd === 'gif' || cmd === 'mp4') {
    const fps = +(O.fps || (cmd === 'gif' ? 12 : meta.FPS || 30));
    const to = O.to != null ? +O.to : meta.DURATION, first = Math.round(O.from * fps), last = Math.round(to * fps);
    const t0 = Date.now();
    const progress = i => { if ((i - first) % fps === 0) process.stdout.write(`\rframe ${i - first + 1}/${last - first}  ${Math.round((Date.now() - t0) / 1000)}s  `); };
    if (cmd === 'gif') {
      const cjs = m => m.default || m;   // both packages are CommonJS
      const { GIFEncoder, quantize, applyPalette } = cjs(await import('gifenc'));
      const { PNG } = cjs(await import('pngjs'));
      // Frame differencing: pixels the viewer already sees are written as transparent,
      // and each frame's palette is built from the changed pixels only. Holds cost almost nothing.
      const gif = GIFEncoder();
      let shown = null;
      for (let i = first; i < last; i++) {
        await page.evaluate(T => window.__draw(T), i / fps);
        const png = PNG.sync.read(await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: meta.W, height: meta.H } }));
        const px = png.data, n = px.length / 4, changed = new Uint8Array(n);
        let count = 0;
        for (let k = 0; k < n; k++) {
          const o = k * 4;
          if (!shown || Math.abs(px[o] - shown[o]) > 6 || Math.abs(px[o + 1] - shown[o + 1]) > 6 || Math.abs(px[o + 2] - shown[o + 2]) > 6) { changed[k] = 1; count++; }
        }
        const sample = new Uint8Array(Math.max(1, count) * 4);
        for (let k = 0, j = 0; k < n; k++) if (changed[k]) { sample.set(px.subarray(k * 4, k * 4 + 4), j); j += 4; }
        const palette = quantize(sample, 255);
        const T = palette.length; palette.push([0, 0, 0]);
        const index = applyPalette(px, palette.slice(0, T));
        if (!shown) shown = new Uint8Array(px.length);
        for (let k = 0; k < n; k++) {
          if (!changed[k]) { index[k] = T; continue; }
          const c = palette[index[k]]; shown[k * 4] = c[0]; shown[k * 4 + 1] = c[1]; shown[k * 4 + 2] = c[2];
        }
        gif.writeFrame(index, png.width, png.height, { palette, delay: Math.round(1000 / fps), transparent: true, transparentIndex: T, dispose: 1 });
        progress(i);
      }
      gif.finish();
      fs.writeFileSync(out, gif.bytes());
    } else {
      if (spawnSync('ffmpeg', ['-version']).error) throw new Error('ffmpeg not found in PATH (needed for mp4; gif works without it)');
      const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', path.resolve(out)], { stdio: ['pipe', 'ignore', 'inherit'] });
      const ffDone = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
      for (let i = first; i < last; i++) {
        await page.evaluate(T => window.__draw(T), i / fps);
        const png = await shot(page, meta, 'png');
        if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
        progress(i);
      }
      ff.stdin.end(); await ffDone;
    }
    done(`\n${cmd}: ${out} (${((last - first) / fps).toFixed(1)} s at ${fps} fps)`);
  }

  else if (cmd === 'check') {
    const list = await states(page, 'all');
    let errs = 0, warns = 0;
    for (const st of list) {
      await page.evaluate(({ i, step }) => window.__deck.show(i, step), st);
      const r = await page.evaluate(lint);
      const tag = `${label(meta, st).padEnd(5)} ${meta.deck[st.i].id}`;
      for (const x of r) { x.level === 'error' ? errs++ : warns++; console.log(`${x.level === 'error' ? 'ERR ' : 'warn'}  ${tag}  ${x.kind}: ${x.msg}`); }
    }
    for (const [i, s] of meta.deck.entries()) if (!s.notes) { warns++; console.log(`warn  ${String(i + 1).padEnd(5)} ${s.id}  notes: slide has no speaker notes`); }
    done(`check: ${list.length} rest frames, ${errs} errors, ${warns} warnings`);
    process.exitCode = errs ? 1 : 0;
  }

  else throw new Error(`unknown command: ${cmd}`);
} finally {
  await browser.close();
}

/* ───────── lint (runs inside the page on one rest frame) ───────── */
function lint() {
  const { W, H } = window.__deck, M = Math.round(Math.min(W, H) * .035), out = [];
  const layer = document.querySelector('.deck:not(.dk-print) .dk-layer.is-on');
  const add = (level, kind, msg) => out.push({ level, kind, msg });
  const alpha = el => { let a = 1; for (let e = el; e && e !== layer; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return 0; a *= +cs.opacity; } return a; };
  const short = s => JSON.stringify(s.length > 42 ? s.slice(0, 40) + '…' : s);
  const boxes = []; let words = 0;
  const tw = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    const txt = n.textContent.replace(/\s+/g, ' ').trim(), el = n.parentElement;
    if (!txt || el.closest('.notes,[data-lint-skip]') || alpha(el) < .05) continue;
    words += txt.split(' ').length;
    const cs = getComputedStyle(el);
    const k = el instanceof SVGElement && el.getScreenCTM ? Math.hypot(el.getScreenCTM().a, el.getScreenCTM().b) : 1;
    const size = parseFloat(cs.fontSize) * k;
    if (size < 20) add('error', 'tiny-text', `${size.toFixed(0)}px ${short(txt)} (min 20px at 1080p; 24+ for body)`);
    const rg = document.createRange(); rg.selectNodeContents(n);
    for (const r of rg.getClientRects()) {
      if (r.width < 2 || r.height < 2) continue;
      if (!el.closest('[data-bleed]') && (r.left < M || r.top < M || r.right > W - M || r.bottom > H - M))
        add('error', 'safe-area', `${short(txt)} is within ${M}px of the edge`);
      // the font's content box is taller than the glyphs; compare glyph bands instead
      const pad = r.height * .2;
      boxes.push({ el, txt, r: { left: r.left, right: r.right, top: r.top + pad, bottom: r.bottom - pad, width: r.width, height: r.height - pad * 2 } });
    }
  }
  for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
    const A = boxes[a], B = boxes[b];
    if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue;
    const ix = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left), iy = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
    if (ix > 2 && iy > 2 && ix * iy > .15 * Math.min(A.r.width * A.r.height, B.r.width * B.r.height))
      add('error', 'overlap', `${short(A.txt)} overlaps ${short(B.txt)}`);
  }
  for (const el of layer.querySelectorAll('*')) {
    if (el instanceof SVGElement || alpha(el) < .05) continue;
    const cs = getComputedStyle(el);
    if (/hidden|clip/.test(cs.overflow) && el.clientHeight > 0 && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) && !el.matches('.slide,.dk-mask-i') && !el.closest('[data-bleed]'))
      add('error', 'overflow', `<${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}> content is clipped`);
  }
  if (words > 60) add('warn', 'density', `${words} words on screen (aim for under 40)`);
  return out;
}

/* ───────── bundle: make the deck work offline as one file ───────── */
async function bundle(src, dst) {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
  const get = async (url, as = 'text') => { const r = await fetch(url, { headers: { 'user-agent': UA } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return as === 'text' ? r.text() : Buffer.from(await r.arrayBuffer()); };
  const mime = u => (/\.woff2(\?|$)/.test(u) ? 'font/woff2' : /\.woff(\?|$)/.test(u) ? 'font/woff' : /\.ttf(\?|$)/.test(u) ? 'font/ttf' : /\.svg/.test(u) ? 'image/svg+xml' : /\.png/.test(u) ? 'image/png' : /\.jpe?g/.test(u) ? 'image/jpeg' : 'application/octet-stream');
  let h = fs.readFileSync(src, 'utf8'), n = 0;
  const swap = async (re, fn) => { const found = [...h.matchAll(re)]; for (const m of found) { h = h.replace(m[0], await fn(m)); n++; } };
  await swap(/<link[^>]+rel=["']preconnect["'][^>]*>\s*/g, async () => '');
  await swap(/<link[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>|<link[^>]+rel=["']stylesheet["'][^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>/g, async m => {
    const url = m[1] || m[2]; let css = await get(url);
    for (const u of [...new Set([...css.matchAll(/url\((['"]?)(https?:[^)'"]+)\1\)/g)].map(x => x[2]))])
      css = css.split(u).join(`data:${mime(u)};base64,${(await get(u, 'buf')).toString('base64')}`);
    return `<style>/* ${url} */\n${css}</style>`;
  });
  await swap(/<script([^>]*)\ssrc=["'](https?:\/\/[^"']+)["']([^>]*)><\/script>/g, async m => {
    const code = (await get(m[2])).replace(/<\/script/gi, '<\\/script');
    return `<script${m[1]}${m[3]}>/* ${m[2]} */\n${code}</script>`;
  });
  await swap(/<img([^>]*)\ssrc=["'](https?:\/\/[^"']+)["']/g, async m => `<img${m[1]} src="data:${mime(m[2])};base64,${(await get(m[2], 'buf')).toString('base64')}"`);
  if (/import\s[^;]*from\s*["']https?:/.test(h) || /"imports"\s*:/.test(h)) console.warn('warning: ES module imports from a CDN are not inlined; use a UMD <script src> build for offline decks');
  fs.writeFileSync(dst, h);
  console.log(`bundle: ${dst} (${n} resources inlined, ${(fs.statSync(dst).size / 1024).toFixed(0)} KB)`);
}
