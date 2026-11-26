#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePayload } from './validate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
let ctxArg = '';
let specArg = '';
let outArg = '';
let isDraft = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o' || args[i] === '--out') {
    outArg = args[++i] || '';
  } else if (args[i] === '--draft') {
    isDraft = true;
  } else if (!ctxArg) {
    ctxArg = args[i];
  } else if (!specArg) {
    specArg = args[i];
  } else {
    console.error(`Unexpected argument: ${args[i]}`);
    process.exit(1);
  }
}

if (!ctxArg || !specArg || !outArg) {
  console.error('Usage: node scripts/build.mjs <context.json> <spec.json> -o <output.html> [--draft]');
  process.exit(1);
}

const root = process.cwd();
const templatePath = path.resolve(__dirname, '..', 'template', 'overview.html');
const specPath = path.resolve(root, specArg);
const specDir = path.dirname(specPath);
const context = JSON.parse(fs.readFileSync(path.resolve(root, ctxArg), 'utf8'));
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

const IMAGE_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

if (spec.comparison && Array.isArray(spec.comparison.cards)) {
  for (const card of spec.comparison.cards) {
    const rawSrc = typeof card?.image?.src === 'string' ? card.image.src.trim() : '';
    if (!rawSrc) continue;
    if (/^(?:data:|https?:|javascript:)/i.test(rawSrc)) continue;
    const imgPath = path.resolve(specDir, rawSrc);
    const ext = path.extname(imgPath).toLowerCase();
    const mime = IMAGE_MIME[ext];
    if (!mime) {
      console.error(`ERROR: Unsupported comparison image extension "${ext}" for "${rawSrc}" (use .png, .jpg, .jpeg, .webp, .gif, or .svg).`);
      process.exit(1);
    }
    if (!fs.existsSync(imgPath)) {
      console.error(`ERROR: comparison image not found: ${rawSrc}`);
      process.exit(1);
    }
    const buf = fs.readFileSync(imgPath);
    card.image.src = `data:${mime};base64,${buf.toString('base64')}`;
  }
}

const payload = { context, spec };

const { errs, stats } = validatePayload(payload, `${specArg}`, { allowDraft: isDraft });
if (errs.length > 0) {
  for (const e of errs) console.error(`ERROR: ${e}`);
  process.exit(1);
}
if (isDraft) {
  console.error('Warning: built in --draft mode (contains placeholder options; not ready for stakeholders).');
}

const lang = context.lang === 'de' ? 'de' : 'en';
const pageTitle = `${spec.brand || spec.title || 'Open Points'} · ${lang === 'de' ? 'Übersicht der offenen Punkte' : 'Open Points Overview'}`;
const escapedJson = JSON.stringify(payload).replace(/</g, '\\u003c');
const escapedTitle = pageTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let html = fs.readFileSync(templatePath, 'utf8');
html = html.replace('__LANG__', lang);
html = html.replace('__TITLE__', escapedTitle);
html = html.replace('__SPEC_DATA__', escapedJson);

const outPath = path.resolve(root, outArg);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html, 'utf8');

console.log(`Built ${outArg} (${Buffer.byteLength(html, 'utf8')} bytes): ${stats.topics} topics, ${stats.questions} questions.`);
