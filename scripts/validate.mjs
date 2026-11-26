#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function validatePayload(payload, label = 'spec-data') {
  const errs = [];
  const ctx = payload?.context;
  const spec = payload?.spec;

  if (!ctx || typeof ctx !== 'object') {
    errs.push(`${label}: missing context object`);
    return { errs, stats: null };
  }
  if (!spec || typeof spec !== 'object') {
    errs.push(`${label}: missing spec object`);
    return { errs, stats: null };
  }

  if (!Array.isArray(ctx.parties) || ctx.parties.length === 0) {
    errs.push(`${label}: context.parties must be a non-empty array`);
    return { errs, stats: null };
  }

  const partyMap = new Map();
  for (const p of ctx.parties) {
    if (!p || typeof p.id !== 'string' || !p.id.trim()) {
      errs.push(`${label}: party missing id`);
      continue;
    }
    if (partyMap.has(p.id)) {
      errs.push(`${label}: duplicate party id "${p.id}"`);
    }
    partyMap.set(p.id, p);
    for (const field of ['name', 'color', 'role', 'job']) {
      if (typeof p[field] !== 'string' || !p[field].trim()) {
        errs.push(`${label}: party "${p.id}" missing "${field}"`);
      }
    }
  }

  if (!Array.isArray(spec.groups) || spec.groups.length === 0) {
    errs.push(`${label}: spec.groups must be a non-empty array`);
  }
  const groupIds = new Set((spec.groups || []).map((g) => g?.id).filter(Boolean));

  if (!Array.isArray(spec.questions) || spec.questions.length === 0) {
    errs.push(`${label}: spec.questions must be a non-empty array`);
    return { errs, stats: null };
  }

  const seenQ = new Set();
  const topicIds = new Set();
  let proposalCount = 0;
  let factCount = 0;

  for (const q of spec.questions) {
    if (!q || typeof q.id !== 'string' || !q.id.trim()) {
      errs.push(`${label}: question missing valid id`);
      continue;
    }
    if (seenQ.has(q.id)) {
      errs.push(`${label}: duplicate question id "${q.id}"`);
    }
    seenQ.add(q.id);
    topicIds.add(q.topic || q.id);

    if (typeof q.title !== 'string' || !q.title.trim()) {
      errs.push(`${label}: question "${q.id}" missing title`);
    }
    if (typeof q.question !== 'string' || !q.question.trim()) {
      errs.push(`${label}: question "${q.id}" missing question text`);
    }
    if (!groupIds.has(q.group)) {
      errs.push(`${label}: question "${q.id}" references unknown group "${q.group}"`);
    }
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) {
      errs.push(`${label}: question "${q.id}" must have 2..4 options`);
    }

    if (!q.raci || typeof q.raci !== 'object') {
      errs.push(`${label}: question "${q.id}" missing raci map`);
    } else {
      let deciders = 0;
      for (const [pid, role] of Object.entries(q.raci)) {
        const party = partyMap.get(pid);
        if (!party) {
          errs.push(`${label}: question "${q.id}" references unknown party "${pid}"`);
          continue;
        }
        if (typeof role !== 'string') {
          errs.push(`${label}: question "${q.id}" has non-string RACI value for "${pid}"`);
          continue;
        }
        if (role.includes('A')) deciders++;
        if (party.isPlatform && (role.includes('A') || role.includes('R'))) {
          errs.push(`${label}: platform party "${pid}" must not have A or R on "${q.id}"`);
        }
      }
      if (deciders !== 1) {
        errs.push(`${label}: question "${q.id}" must have exactly 1 deciding party (A), found ${deciders}`);
      }
    }

    if (q.proposal !== null && q.proposal !== undefined) {
      proposalCount++;
      if (!Number.isInteger(q.proposal) || q.proposal < 0 || q.proposal >= (q.options?.length || 0)) {
        errs.push(`${label}: question "${q.id}" has out-of-range proposal=${q.proposal}`);
      }
      if (typeof q.reason !== 'string' || !q.reason.trim()) {
        errs.push(`${label}: question "${q.id}" has proposal=${q.proposal} without reason`);
      }
    } else {
      factCount++;
    }
  }

  for (const q of spec.questions) {
    for (const depId of q.dependsOn || []) {
      if (!seenQ.has(depId)) {
        errs.push(`${label}: question "${q.id}" depends on unknown question "${depId}"`);
      }
    }
  }

  if (spec.keystone?.id && !seenQ.has(spec.keystone.id)) {
    errs.push(`${label}: keystone "${spec.keystone.id}" not found in spec.questions`);
  }

  const openCount = spec.spec?.openCount;
  const unprovableCount = spec.spec?.unprovableCount || 0;
  if (typeof openCount === 'number' && topicIds.size > openCount + unprovableCount) {
    errs.push(`${label}: topic count ${topicIds.size} exceeds spec limit ${openCount + unprovableCount}`);
  }

  return {
    errs,
    stats: {
      topics: topicIds.size,
      limit: typeof openCount === 'number' ? openCount + unprovableCount : null,
      questions: spec.questions.length,
      proposals: proposalCount,
      facts: factCount
    }
  };
}

export function extractJsonIsland(html, id) {
  const re = new RegExp(`<script\\s+type=["']application/json["']\\s+id=["']${id}["']>([\\s\\S]*?)<\\/script>`);
  const m = html.match(re);
  if (!m) return null;
  return JSON.parse(m[1]);
}

function runCli() {
  const root = process.cwd();
  const errors = [];

  const versionPath = path.join(root, 'VERSION');
  const skillPath = path.join(root, 'skills', 'open-points-overview', 'SKILL.md');
  const requiredFiles = ['README.md', 'CHANGELOG.md', 'LICENSE', 'template/overview.html'];

  let version = '';
  if (!fs.existsSync(versionPath)) {
    errors.push('Missing VERSION file');
  } else {
    version = fs.readFileSync(versionPath, 'utf8').trim();
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      errors.push(`VERSION must be SemVer (x.y.z), found "${version}"`);
    }
  }

  if (!fs.existsSync(skillPath)) {
    errors.push('Missing skills/open-points-overview/SKILL.md');
  } else {
    const skill = fs.readFileSync(skillPath, 'utf8');
    const fm = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) {
      errors.push('SKILL.md missing YAML frontmatter');
    } else {
      const vm = fm[1].match(/^version:\s*(.+)$/m);
      const skillVersion = vm ? vm[1].trim().replace(/^['"]|['"]$/g, '') : '';
      if (!skillVersion) {
        errors.push('SKILL.md frontmatter missing version');
      } else if (version && skillVersion !== version) {
        errors.push(`Version mismatch: VERSION is "${version}" but SKILL.md has "${skillVersion}"`);
      }
    }
  }

  for (const rel of requiredFiles) {
    if (!fs.existsSync(path.join(root, rel))) {
      errors.push(`Missing ${rel}`);
    }
  }

  const targets = process.argv.slice(2);
  const htmlFiles = targets.length > 0 ? targets : ['example.html', 'examples/generic-plan/open-points.html'];
  const summaries = [];

  for (const rel of htmlFiles) {
    const full = path.resolve(root, rel);
    if (!fs.existsSync(full)) {
      errors.push(`Missing HTML file: ${rel}`);
      continue;
    }
    const html = fs.readFileSync(full, 'utf8');
    if (/<script[^>]+src=["']https?:\/\//i.test(html)) {
      errors.push(`${rel}: external <script src="http..."> tag found`);
    }
    if (/<link[^>]+href=["']https?:\/\//i.test(html)) {
      errors.push(`${rel}: external <link href="http..."> tag found`);
    }
    let specData;
    try {
      specData = extractJsonIsland(html, 'spec-data');
    } catch (err) {
      errors.push(`${rel}: invalid #spec-data JSON (${err.message})`);
      continue;
    }
    if (!specData) {
      errors.push(`${rel}: missing <script type="application/json" id="spec-data">`);
      continue;
    }
    try {
      const saved = extractJsonIsland(html, 'saved');
      if (saved === null) errors.push(`${rel}: missing <script type="application/json" id="saved">`);
    } catch (err) {
      errors.push(`${rel}: invalid #saved JSON (${err.message})`);
    }

    const { errs, stats } = validatePayload(specData, rel);
    errors.push(...errs);
    if (errs.length === 0 && stats) {
      const lim = stats.limit !== null ? `${stats.topics}<=${stats.limit}` : `${stats.topics}`;
      summaries.push(`${rel} (${lim} topics, ${stats.questions} Qs, ${stats.proposals} proposals, ${stats.facts} facts)`);
    }
  }

  if (errors.length > 0) {
    for (const e of errors) console.error(`ERROR: ${e}`);
    process.exit(1);
  }

  console.log(`OK: version ${version} synced; validated ${summaries.join('; ')}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCli();
}
