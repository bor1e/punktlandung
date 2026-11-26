#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
let inputArg = '';
let ctxArg = '';
let outDirArg = '';
let lang = 'en';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--context' || args[i] === '-c') ctxArg = args[++i] || '';
  else if (args[i] === '--out-dir' || args[i] === '-d') outDirArg = args[++i] || '';
  else if (args[i] === '--lang' || args[i] === '-l') lang = args[++i] === 'de' ? 'de' : 'en';
  else if (!inputArg) inputArg = args[i];
  else {
    console.error(`Unexpected argument: ${args[i]}`);
    process.exit(1);
  }
}

if (!inputArg) {
  console.error('Usage: node scripts/init-case.mjs <plan.md|spec.md|proposal.md> [--context <context.json>] [--out-dir <dir>] [--lang en|de]');
  process.exit(1);
}

const root = process.cwd();
const inPath = path.resolve(root, inputArg);
const md = fs.readFileSync(inPath, 'utf8');
const outDir = outDirArg ? path.resolve(root, outDirArg) : path.dirname(inPath);
fs.mkdirSync(outDir, { recursive: true });

const titleMatch = md.match(/^#\s+(.+)$/m);
const title = titleMatch ? titleMatch[1].replace(/^(Feature Plan|Specification|Proposal|Change):\s*/i, '').trim() : path.basename(inPath, path.extname(inPath));
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'open-points';
const logo = slug.split('-').slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'PL';
const verMatch = md.match(/\*\*Version:\*\*\s*([^\s]+)/i);
const specVersion = verMatch ? verMatch[1] : '0.1.0';
const relInput = path.relative(root, inPath) || path.basename(inPath);

// Extract open points from [NEEDS CLARIFICATION: ...], OQ-x / Q-x / U-x bullets, or unchecked checkboxes
const extracted = [];
let idx = 1;
for (const line of md.split(/\r?\n/)) {
  const nc = line.match(/\[NEEDS CLARIFICATION:\s*([^\]]+)\]/i);
  if (nc) {
    extracted.push({ id: `Q-${idx++}`, text: nc[1].trim(), ref: `[NEEDS CLARIFICATION]` });
    continue;
  }
  const tagged = line.match(/^\s*[-*]\s+`?([A-Z]{1,3}-\d+)`?(?:\s*\([^)]*\))?:\s*(.+)$/);
  if (tagged) {
    extracted.push({ id: tagged[1], text: tagged[2].trim(), ref: tagged[1] });
    continue;
  }
  const todo = line.match(/^\s*[-*]\s+\[\s\]\s+(.+)$/);
  if (todo) {
    extracted.push({ id: `Q-${idx++}`, text: todo[1].trim(), ref: 'TODO' });
  }
}

if (extracted.length === 0) {
  extracted.push({
    id: 'Q-1',
    text: `Clarify primary open point in ${path.basename(inPath)}`,
    ref: 'Q-1'
  });
}

const spec = {
  id: slug,
  logo,
  brand: title.slice(0, 24),
  subtitle: `From ${path.basename(inPath)}`,
  title,
  lead: `Open points extracted from ${path.basename(inPath)}. Replace placeholder options and RACI before sharing.`,
  spec: {
    file: relInput,
    version: specVersion,
    date: new Date().toISOString().slice(0, 10),
    openCount: extracted.length,
    unprovableCount: 0
  },
  groups: [{ id: 'open', title: lang === 'de' ? 'Offene Punkte' : 'Open Points' }],
  topics: {},
  questions: extracted.map((item) => ({
    id: item.id,
    group: 'open',
    topic: null,
    title: item.text.length > 72 ? `${item.text.slice(0, 69)}...` : item.text,
    question: item.text,
    context: `Extracted from ${path.basename(inPath)} (${item.ref}).`,
    options: ['Option A (replace with concrete choice)', 'Option B (replace with concrete choice)'],
    proposal: null,
    reason: 'Review with AI/team: add proposal + reason, or keep null if fact question.',
    raci: { PO: 'A', BIZ: 'C', ARCH: 'C' },
    ref: item.ref,
    dependsOn: []
  })),
  sources: [relInput]
};

const specOut = path.join(outDir, 'spec.json');
fs.writeFileSync(specOut, JSON.stringify(spec, null, 2) + '\n', 'utf8');

let ctxRelForCmd = ctxArg;
if (!ctxArg) {
  const defaultCtx = {
    lang,
    org: 'Delivery Team',
    assignmentNote: 'Proposed default team roles. Adjust once and reuse across specs.',
    constraints: [
      'An AI coding agent implements after sign-off — ambiguities must be closed beforehand.',
      'Platform team receives no product requirement questions (consulted only on infra/deploy changes).'
    ],
    parties: [
      { id: 'BIZ', name: lang === 'de' ? 'Fachbereich' : 'Business', short: 'Biz', color: '#7b3fb5', role: 'Business & Compliance', job: 'Decides domain rules and supplies facts.', isPlatform: false },
      { id: 'PO', name: 'Product Owner', short: 'PO', color: '#1c6dd0', role: 'Product Management', job: 'Decides UX defaults and scope trade-offs.', isPlatform: false },
      { id: 'ARCH', name: lang === 'de' ? 'Architekt' : 'Architect', short: 'Arch', color: '#0e7c86', role: 'Software Architect', job: 'Decides interfaces, data flows, and bounds.', isPlatform: false },
      { id: 'PLAT', name: lang === 'de' ? 'Plattform-Team' : 'Platform Team', short: 'Plat', color: '#5c7a1f', role: 'Central Platform / Ops', job: 'Consulted only when build or deployment infra changes.', isPlatform: true }
    ]
  };
  const ctxOut = path.join(outDir, 'context.json');
  fs.writeFileSync(ctxOut, JSON.stringify(defaultCtx, null, 2) + '\n', 'utf8');
  ctxRelForCmd = path.relative(root, ctxOut);
}

const specRelForCmd = path.relative(root, specOut);
const htmlRelForCmd = path.relative(root, path.join(outDir, 'open-points.html'));
console.log(`Scaffolded ${specRelForCmd} (${extracted.length} starter questions).`);
console.log(`Next:\n  1. Refine options, proposals, and RACI in ${specRelForCmd} (see skills/open-points-overview/SKILL.md)\n  2. node scripts/build.mjs ${ctxRelForCmd} ${specRelForCmd} -o ${htmlRelForCmd}`);
