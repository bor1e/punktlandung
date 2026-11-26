#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { extractJsonIsland } from './validate.mjs';

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function optHash(options) {
  return fnv1a(JSON.stringify(options || []));
}

const args = process.argv.slice(2);
let asJson = false;
let asCopilot = false;
const files = [];
const directCodes = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--json') asJson = true;
  else if (a === '--copilot-prompt') asCopilot = true;
  else if (a === '--code') {
    const val = args[++i];
    if (!val) {
      console.error('ERROR: --code requires a PKL1:... token');
      process.exit(1);
    }
    directCodes.push(val.trim());
  } else files.push(a);
}

if (files.length === 0) {
  console.error('Usage: node scripts/merge-answers.mjs [--json|--copilot-prompt] <open-points.html> [more.html|reply.txt ...] [--code "PKL1:..."]');
  process.exit(1);
}

function tryParseCode(token) {
  const b64url = token
    .replace(/^PKL1:/, '')
    .replace(/:PKL$/, '')
    .replace(/[\s>]+/g, '');
  if (!b64url || !/^[A-Za-z0-9_-]+$/.test(b64url)) {
    throw new Error('malformed base64url payload');
  }
  const obj = JSON.parse(Buffer.from(b64url, 'base64url').toString('utf8'));
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('decoded payload is not an object');
  }
  if (obj.a !== undefined && (typeof obj.a !== 'object' || obj.a === null || Array.isArray(obj.a))) {
    throw new Error('decoded answers field must be an object');
  }
  return obj;
}

function decodeAnswerCode(token, sourceLabel) {
  try {
    const obj = tryParseCode(token);
    return {
      file: sourceLabel,
      specId: obj.id || '',
      specVersion: obj.ver || '',
      state: { role: obj.role || '', name: obj.name || '', a: obj.a || {} }
    };
  } catch (err) {
    console.error(`ERROR: Invalid or truncated PKL1 answer code in ${sourceLabel}: ${err.message}`);
    process.exit(1);
  }
}

function extractCodesFromText(raw, sourceFile) {
  const delimited = [...raw.matchAll(/PKL1:([A-Za-z0-9_\-\s>]+?):PKL/g)];
  if (delimited.length > 0) {
    return delimited.map((m, idx) => decodeAnswerCode(m[0], `${sourceFile}#${idx + 1}`));
  }

  const legacy = [...raw.matchAll(/PKL1:([^\s]+(?:[ \t]*\r?\n[ \t>]*[A-Za-z0-9_-]+)*)/g)];
  if (legacy.length === 0) {
    console.error(`ERROR: ${sourceFile} contains no PKL1: answer code`);
    process.exit(1);
  }
  return legacy.map((m, idx) => {
    const label = `${sourceFile}#${idx + 1}`;
    const chunks = m[0].split(/\r?\n/);
    for (let len = chunks.length; len >= 1; len--) {
      const candidate = chunks.slice(0, len).join('\n');
      try {
        const obj = tryParseCode(candidate);
        return {
          file: label,
          specId: obj.id || '',
          specVersion: obj.ver || '',
          state: { role: obj.role || '', name: obj.name || '', a: obj.a || {} }
        };
      } catch {
        // try shorter slice if trailing prose line matched
      }
    }
    return decodeAnswerCode(m[0], label);
  });
}

const loaded = [];
let baseSpecData = null;

for (const f of files) {
  const raw = fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
  if (f.toLowerCase().endsWith('.html') || f.toLowerCase().endsWith('.htm')) {
    const specData = extractJsonIsland(raw, 'spec-data');
    const saved = extractJsonIsland(raw, 'saved') || {};
    if (!specData) {
      console.error(`ERROR: ${f} missing #spec-data`);
      process.exit(1);
    }
    if (!baseSpecData) baseSpecData = specData;
    loaded.push({
      file: f,
      specId: saved.specId || specData.spec?.id || '',
      htmlSpecId: specData.spec?.id || '',
      specVersion: saved.specVersion || specData.spec?.spec?.version || '',
      state: saved.S || { role: '', name: '', a: {} }
    });
  } else {
    loaded.push(...extractCodesFromText(raw, f));
  }
}

directCodes.forEach((tok, idx) => {
  loaded.push(decodeAnswerCode(tok, `code#${idx + 1}`));
});

if (!baseSpecData) {
  console.error('ERROR: at least one .html file with #spec-data is required to resolve question definitions.');
  process.exit(1);
}

const { context, spec } = baseSpecData;
const baseSpecId = spec.id || '';
const baseSpecVer = spec.spec?.version || '';
const warnings = [];

// Bug 3 fix: refuse replies from a different spec ID; warn on spec version drift
for (const item of loaded) {
  if (item.htmlSpecId && item.htmlSpecId !== baseSpecId) {
    console.error(`ERROR: Spec mismatch: ${item.file} is for "${item.htmlSpecId}", expected "${baseSpecId}".`);
    process.exit(1);
  }
  if (!item.specId || item.specId !== baseSpecId) {
    console.error(`ERROR: Spec mismatch: ${item.file} is for "${item.specId || '(missing)'}", expected "${baseSpecId}".`);
    process.exit(1);
  }
  if (item.specVersion && baseSpecVer && item.specVersion !== baseSpecVer) {
    warnings.push(`${item.file}: reply was built for spec v${item.specVersion}, current spec is v${baseSpecVer}.`);
  }
}

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
  const expectedHash = optHash(q.options);
  const entries = [];

  for (const item of loaded) {
    const ans = item.state.a?.[q.id];
    if (!isAnswered(ans)) continue;
    const stale = Boolean(ans.oh && ans.oh !== expectedHash);
    const text = stale ? `[STALE option #${ans.o}]` : formatOption(q, ans);
    entries.push({
      file: item.file,
      respondent: item.state.name || '(anonymous)',
      role: item.state.role || '',
      isDecider: item.state.role === decider,
      optionIndex: ans.o,
      answer: text,
      note: ans.n || '',
      stale
    });
  }

  if (entries.length === 0) return { status: 'open', decider, entries };

  // Bug 2 fix: refuse stale answers whose options changed since reply was generated
  if (entries.some((e) => e.stale)) {
    return {
      status: 'conflict',
      decider,
      entries,
      reason: 'Options changed since reply was recorded (stale answer refused).'
    };
  }

  const deciderEntries = entries.filter((e) => e.isDecider);

  // Bug 1 fix: ONLY the deciding party (A) can resolve a question or trigger mootWhen
  if (deciderEntries.length === 0) {
    const uniqueKeys = new Set(entries.map((e) => `${e.optionIndex}::${e.answer}`));
    if (uniqueKeys.size > 1) {
      return { status: 'conflict', decider, entries, reason: 'Non-deciders disagreed before decider voted.' };
    }
    return { status: 'suggested', decider, entries };
  }

  const deciderKeys = new Set(deciderEntries.map((e) => `${e.optionIndex}::${e.answer}`));
  if (deciderKeys.size === 1) {
    return { status: 'resolved', decider, chosen: deciderEntries[0], entries };
  }

  return { status: 'conflict', decider, entries, reason: 'Multiple decider answers conflict.' };
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
const suggested = [];
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
  } else if (res.status === 'suggested') {
    suggested.push({
      id: q.id,
      title: q.title,
      ref: q.ref,
      decider: res.decider,
      entries: res.entries
    });
  } else if (res.status === 'conflict') {
    conflicts.push({
      id: q.id,
      title: q.title,
      ref: q.ref,
      decider: res.decider,
      reason: res.reason || '',
      entries: res.entries
    });
  } else {
    stillOpen.push({ id: q.id, title: q.title, ref: q.ref, decider: res.decider });
  }
}

const output = {
  spec: spec.spec?.file || spec.id,
  specId: baseSpecId,
  version: baseSpecVer,
  mergedFiles: files,
  warnings,
  summary: {
    resolved: resolved.length,
    suggested: suggested.length,
    conflicts: conflicts.length,
    moot: moot.length,
    open: stillOpen.length
  },
  resolved,
  suggested,
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
  prompt.push('Update the specification scenarios/requirements for every resolved item, remove moot items, and do NOT apply suggested, conflicted, or open items until the decider (A) confirms.');
  if (warnings.length > 0) {
    prompt.push('');
    prompt.push('## Warnings');
    for (const w of warnings) prompt.push(`- ${w}`);
  }
  prompt.push('');
  prompt.push('## Resolved Decisions to Apply');
  if (resolved.length === 0) prompt.push('- None.');
  for (const r of resolved) {
    prompt.push(`- \`${r.id}\` (${r.ref || '-'}): **${r.title}** -> ${r.answer} _(decided by ${r.by})_${r.note ? ` | Note: ${r.note}` : ''}`);
  }
  if (suggested.length > 0) {
    prompt.push('');
    prompt.push('## Suggested by Non-Deciders (Waiting for Decider — Do NOT Apply Yet)');
    for (const s of suggested) {
      const decName = partiesById.get(s.decider)?.name || s.decider;
      prompt.push(`- \`${s.id}\` (${s.ref || '-'}, waiting for **${decName}**): ${s.entries.map((e) => `${e.respondent} [${e.role || 'no role'}] suggested "${e.answer}"`).join('; ')}`);
    }
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
      prompt.push(`- \`${c.id}\`${c.reason ? ` (${c.reason})` : ''}: ${c.entries.map((e) => `${e.respondent} [${e.role || 'no role'}]=${e.answer}`).join(' vs. ')}`);
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
lines.push(`- **Source:** \`${output.spec}\` (id: \`${baseSpecId}\`, v${output.version})`);
lines.push(`- **Inputs:** ${files.join(', ')}`);
lines.push(`- **Counts:** ${resolved.length} resolved, ${suggested.length} suggested (waiting for decider), ${conflicts.length} conflicts, ${moot.length} moot, ${stillOpen.length} open`);
lines.push('');

if (warnings.length > 0) {
  lines.push('## Warnings');
  for (const w of warnings) lines.push(`- ${w}`);
  lines.push('');
}

lines.push('## Resolved Decisions');
if (resolved.length === 0) lines.push('- None yet.');
for (const r of resolved) {
  lines.push(`- **${r.id}** (${r.ref || '-'}, A=${partiesById.get(r.decider)?.name || r.decider}): ${r.title}`);
  lines.push(`  - Answer: ${r.answer} _(by ${r.by})_`);
  if (r.note) lines.push(`  - Note: ${r.note}`);
}
lines.push('');

if (suggested.length > 0) {
  lines.push('## Suggested by Non-Deciders (Waiting for Decider)');
  for (const s of suggested) {
    const decName = partiesById.get(s.decider)?.name || s.decider;
    lines.push(`- **${s.id}** (${s.ref || '-'}, waiting for **${decName}**): ${s.title}`);
    for (const e of s.entries) {
      lines.push(`  - Suggested: ${e.answer} _(by ${e.respondent} [${e.role || 'no role'}])_${e.note ? ` — Note: ${e.note}` : ''}`);
    }
  }
  lines.push('');
}

if (conflicts.length > 0) {
  lines.push('## Conflicts (Action Needed)');
  for (const c of conflicts) {
    lines.push(`- **${c.id}** (${c.ref || '-'}, A=${partiesById.get(c.decider)?.name || c.decider}): ${c.title}${c.reason ? ` — _${c.reason}_` : ''}`);
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
