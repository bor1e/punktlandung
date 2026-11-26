#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { extractJsonIsland } from './validate.mjs';

const args = process.argv.slice(2);
let asJson = false;
let asCopilot = false;
const files = [];

for (const a of args) {
  if (a === '--json') asJson = true;
  else if (a === '--copilot-prompt') asCopilot = true;
  else files.push(a);
}

if (files.length === 0) {
  console.error('Usage: node scripts/merge-answers.mjs [--json|--copilot-prompt] <returned-1.html> [returned-2.html ...]');
  process.exit(1);
}

const loaded = files.map((f) => {
  const html = fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
  const specData = extractJsonIsland(html, 'spec-data');
  const saved = extractJsonIsland(html, 'saved') || {};
  if (!specData) {
    console.error(`ERROR: ${f} missing #spec-data`);
    process.exit(1);
  }
  return { file: f, specData, state: saved.S || { role: '', name: '', a: {} } };
});

const { context, spec } = loaded[0].specData;
const partiesById = new Map((context.parties || []).map((p) => [p.id, p]));
const questions = spec.questions || [];

function deciderOf(q) {
  for (const p of context.parties || []) {
    if ((q.raci?.[p.id] || '').includes('A')) return p.id;
  }
  return Object.keys(q.raci || {})[0] || '';
}

function formatOption(q, ans) {
  if (!ans || !ans.o) return '';
  if (ans.o === 'x') return `Other: ${ans.t || ''}`;
  const idx = Number(ans.o);
  return `${'ABCDE'.charAt(idx)}: ${q.options?.[idx] ?? ans.o}`;
}

function isAnswered(ans) {
  return Boolean(ans && ans.o !== '' && (ans.o !== 'x' || (ans.t || '').trim() !== ''));
}

function evaluateQuestion(q) {
  const decider = deciderOf(q);
  const entries = [];

  for (const item of loaded) {
    const ans = item.state.a?.[q.id];
    if (!isAnswered(ans)) continue;
    const text = formatOption(q, ans);
    entries.push({
      file: item.file,
      respondent: item.state.name || '(anonymous)',
      role: item.state.role || '',
      isDecider: item.state.role === decider,
      optionIndex: ans.o,
      answer: text,
      note: ans.n || ''
    });
  }

  if (entries.length === 0) return { status: 'open', decider, entries };

  const uniqueKeys = new Set(entries.map((e) => `${e.optionIndex}::${e.answer}`));
  if (uniqueKeys.size === 1) {
    const chosen = entries.find((e) => e.isDecider) || entries[0];
    return { status: 'resolved', decider, chosen, entries };
  }

  const deciderEntries = entries.filter((e) => e.isDecider);
  const deciderKeys = new Set(deciderEntries.map((e) => `${e.optionIndex}::${e.answer}`));
  if (deciderEntries.length > 0 && deciderKeys.size === 1) {
    return { status: 'resolved', decider, chosen: deciderEntries[0], entries };
  }

  return { status: 'conflict', decider, entries };
}

// Pass 1: evaluate all branch-controlling questions (keystone + mootWhen targets)
const ks = spec.keystone;
const branchIds = new Set();
if (ks?.id) branchIds.add(ks.id);
for (const q of questions) {
  if (!q.mootWhen) continue;
  const rules = Array.isArray(q.mootWhen) ? q.mootWhen : [q.mootWhen];
  for (const r of rules) {
    if (r?.id) branchIds.add(r.id);
  }
}

const resolvedMap = new Map();
for (const q of questions) {
  if (branchIds.has(q.id)) {
    resolvedMap.set(q.id, evaluateQuestion(q));
  }
}

function mootReasonFor(q) {
  if (q.mootWhen) {
    const rules = Array.isArray(q.mootWhen) ? q.mootWhen : [q.mootWhen];
    for (const r of rules) {
      const target = resolvedMap.get(r.id);
      if (target?.status !== 'resolved') continue;
      const v = target.chosen.optionIndex;
      if (r.eq !== undefined && v === String(r.eq)) return r.reason || ks?.mootStatus || 'moot';
      if (r.neq !== undefined && v !== '' && v !== String(r.neq)) return r.reason || ks?.mootStatus || 'moot';
    }
  }
  if (ks?.id && q.keystoneDependent) {
    const ksRes = resolvedMap.get(ks.id);
    if (ksRes?.status === 'resolved' && ksRes.chosen.optionIndex === String(ks.mootOption)) {
      return ks.mootStatus || 'moot';
    }
  }
  return '';
}

const conflicts = [];
const resolved = [];
const stillOpen = [];
const moot = [];

for (const q of questions) {
  const mr = mootReasonFor(q);
  if (mr) {
    moot.push({ id: q.id, title: q.title, ref: q.ref, reason: mr });
    continue;
  }
  const res = resolvedMap.get(q.id) || evaluateQuestion(q);
  if (res.status === 'resolved') {
    resolved.push({
      id: q.id,
      title: q.title,
      ref: q.ref,
      decider: res.decider,
      answer: res.chosen.answer,
      note: res.entries.map((e) => e.note).filter(Boolean).join(' | '),
      by: res.chosen.respondent
    });
  } else if (res.status === 'conflict') {
    conflicts.push({ id: q.id, title: q.title, ref: q.ref, decider: res.decider, entries: res.entries });
  } else {
    stillOpen.push({ id: q.id, title: q.title, ref: q.ref, decider: res.decider });
  }
}

const output = {
  spec: spec.spec?.file || spec.id,
  version: spec.spec?.version || '',
  mergedFiles: files,
  summary: {
    resolved: resolved.length,
    conflicts: conflicts.length,
    moot: moot.length,
    open: stillOpen.length
  },
  resolved,
  conflicts,
  moot,
  open: stillOpen
};

if (asJson) {
  console.log(JSON.stringify(output, null, 2));
  process.exit(conflicts.length > 0 ? 2 : 0);
}

if (asCopilot) {
  const prompt = [];
  prompt.push(`Apply the stakeholder decisions below to \`${output.spec}\` (source version: ${output.version}).`);
  prompt.push('Update the specification scenarios/requirements for every resolved item, remove moot items, and do NOT invent answers for open or conflicted items.');
  prompt.push('');
  prompt.push('## Resolved Decisions to Apply');
  if (resolved.length === 0) prompt.push('- None.');
  for (const r of resolved) {
    prompt.push(`- \`${r.id}\` (${r.ref || '-'}): **${r.title}** -> ${r.answer} _(decided by ${r.by})_${r.note ? ` | Note: ${r.note}` : ''}`);
  }
  if (moot.length > 0) {
    prompt.push('');
    prompt.push('## Moot (Remove / Mark Out of Scope)');
    for (const m of moot) prompt.push(`- \`${m.id}\` (${m.ref || '-'}): ${m.title} — ${m.reason}`);
  }
  if (conflicts.length > 0) {
    prompt.push('');
    prompt.push('## Conflicts (Ask Human Before Implementing)');
    for (const c of conflicts) {
      prompt.push(`- \`${c.id}\`: ${c.entries.map((e) => `${e.respondent} [${e.role || 'no role'}]=${e.answer}`).join(' vs. ')}`);
    }
  }
  if (stillOpen.length > 0) {
    prompt.push('');
    prompt.push('## Still Open (Keep Marked as Unresolved)');
    for (const o of stillOpen) prompt.push(`- \`${o.id}\` (Owner: ${partiesById.get(o.decider)?.name || o.decider}): ${o.title}`);
  }
  console.log(prompt.join('\n'));
  process.exit(conflicts.length > 0 ? 2 : 0);
}

const lines = [];
lines.push(`# Merged Clarification Patch: ${spec.title || spec.id}`);
lines.push(`- **Source:** \`${output.spec}\` (v${output.version})`);
lines.push(`- **Inputs:** ${files.join(', ')}`);
lines.push(`- **Counts:** ${resolved.length} resolved, ${conflicts.length} conflicts, ${moot.length} moot, ${stillOpen.length} open`);
lines.push('');

lines.push('## Resolved Decisions');
if (resolved.length === 0) lines.push('- None yet.');
for (const r of resolved) {
  lines.push(`- **${r.id}** (${r.ref || '-'}, A=${partiesById.get(r.decider)?.name || r.decider}): ${r.title}`);
  lines.push(`  - Answer: ${r.answer} _(by ${r.by})_`);
  if (r.note) lines.push(`  - Note: ${r.note}`);
}
lines.push('');

if (conflicts.length > 0) {
  lines.push('## Conflicts (Action Needed)');
  for (const c of conflicts) {
    lines.push(`- **${c.id}** (${c.ref || '-'}, A=${partiesById.get(c.decider)?.name || c.decider}): ${c.title}`);
    for (const e of c.entries) {
      lines.push(`  - ${e.respondent} [${e.role || 'no role'}] (${e.file}): ${e.answer}${e.note ? ` — Note: ${e.note}` : ''}`);
    }
  }
  lines.push('');
}

if (moot.length > 0) {
  lines.push('## Removed by Branch / Keystone');
  for (const m of moot) {
    lines.push(`- ~~${m.id}~~ (${m.ref || '-'}): ${m.title} _(${m.reason})_`);
  }
  lines.push('');
}

lines.push('## Still Open');
if (stillOpen.length === 0) lines.push('- None (spec ready for release!).');
for (const o of stillOpen) {
  lines.push(`- **${o.id}** (${o.ref || '-'}, A=${partiesById.get(o.decider)?.name || o.decider}): ${o.title}`);
}

console.log(lines.join('\n'));
process.exit(conflicts.length > 0 ? 2 : 0);
