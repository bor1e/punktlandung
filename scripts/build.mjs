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

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o' || args[i] === '--out') {
    outArg = args[++i] || '';
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
  console.error('Usage: node scripts/build.mjs <context.json> <spec.json> -o <output.html>');
  process.exit(1);
}

const root = process.cwd();
const templatePath = path.resolve(__dirname, '..', 'template', 'overview.html');
const context = JSON.parse(fs.readFileSync(path.resolve(root, ctxArg), 'utf8'));
const spec = JSON.parse(fs.readFileSync(path.resolve(root, specArg), 'utf8'));
const payload = { context, spec };

const { errs, stats } = validatePayload(payload, `${specArg}`);
if (errs.length > 0) {
  for (const e of errs) console.error(`ERROR: ${e}`);
  process.exit(1);
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
