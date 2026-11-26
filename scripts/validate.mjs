#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function isPlaceholderText(s) {
  return /replace with concrete choice|Review with AI\/team|^Option [A-D]\s*\(/i.test(String(s || ''));
}

export function validatePayload(payload, label = 'spec-data', opts = {}) {
  const { allowDraft = false } = opts;
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

  if (ctx.lang !== undefined && ctx.lang !== 'de' && ctx.lang !== 'en') {
    errs.push(`${label}: context.lang must be "de" or "en", found "${ctx.lang}"`);
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
    if (typeof p.color === 'string' && !/^#[0-9a-fA-F]{3,8}$/.test(p.color)) {
      errs.push(`${label}: party "${p.id}" color must be hex (#rgb..#rrggbbaa), found "${p.color}"`);
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
    } else if (q.options.some((o) => typeof o !== 'string' || !o.trim())) {
      errs.push(`${label}: question "${q.id}" options must all be non-empty strings`);
    } else if (!allowDraft && (q.options.some(isPlaceholderText) || isPlaceholderText(q.reason) || isPlaceholderText(q.title))) {
      errs.push(`${label}: question "${q.id}" contains draft placeholder text — fill concrete choices or pass --draft to preview`);
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
        if (typeof role !== 'string' || !/^[ARCI]+$/.test(role)) {
          errs.push(`${label}: question "${q.id}" has invalid RACI value "${role}" for "${pid}" (must match /^[ARCI]+$/)`);
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
    if (q.mootWhen !== undefined && q.mootWhen !== null) {
      const rules = Array.isArray(q.mootWhen) ? q.mootWhen : [q.mootWhen];
      if (!rules.length) {
        errs.push(`${label}: question "${q.id}" mootWhen array must not be empty`);
      }
      for (const rule of rules) {
        if (!rule || typeof rule !== 'object' || typeof rule.id !== 'string' || !seenQ.has(rule.id)) {
          errs.push(`${label}: question "${q.id}" mootWhen references unknown question "${rule?.id}"`);
        } else if (rule.eq === undefined && rule.neq === undefined) {
          errs.push(`${label}: question "${q.id}" mootWhen rule for "${rule.id}" needs eq or neq`);
        }
      }
    }
  }

  if (spec.keystone?.id && !seenQ.has(spec.keystone.id)) {
    errs.push(`${label}: keystone "${spec.keystone.id}" not found in spec.questions`);
  }

  const openCount = spec.spec?.openCount;
  const unprovableCount = spec.spec?.unprovableCount || 0;
  if (openCount !== undefined && (!Number.isInteger(openCount) || openCount < 0)) {
    errs.push(`${label}: spec.openCount must be a non-negative integer`);
  }
  if (spec.spec?.unprovableCount !== undefined && (!Number.isInteger(spec.spec.unprovableCount) || spec.spec.unprovableCount < 0)) {
    errs.push(`${label}: spec.unprovableCount must be a non-negative integer`);
  }
  if (Number.isInteger(openCount) && openCount >= 0 && topicIds.size > openCount + unprovableCount) {
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
  const re = new RegExp(`<script\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`, 'i');
  const m = html.match(re);
  if (!m) return null;
  return JSON.parse(m[1]);
}

function runCli() {
  const root = process.cwd();
  const errors = [];
  const targets = process.argv.slice(2);
  let version = '';

  if (targets.length === 0) {
    const versionPath = path.join(root, 'VERSION');
    const skillPath = path.join(root, 'skills', 'open-points-overview', 'SKILL.md');
    const requiredFiles = ['README.md', 'CHANGELOG.md', 'LICENSE', 'AGENTS.md', 'CLAUDE.md', 'package.json', 'template/overview.html'];
    const schemaFiles = ['schema/context.schema.json', 'schema/spec.schema.json'];

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

    const pkgPath = path.join(root, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (version && pkg.version !== version) {
          errors.push(`Version mismatch: VERSION is "${version}" but package.json has "${pkg.version}"`);
        }
      } catch (err) {
        errors.push(`Invalid JSON in package.json: ${err.message}`);
      }
    }

    for (const rel of schemaFiles) {
      const p = path.join(root, rel);
      if (!fs.existsSync(p)) {
        errors.push(`Missing ${rel}`);
      } else {
        try {
          JSON.parse(fs.readFileSync(p, 'utf8'));
        } catch (err) {
          errors.push(`Invalid JSON in ${rel}: ${err.message}`);
        }
      }
    }
  }

  const htmlFiles = targets.length > 0 ? targets : [
    'example.html',
    'examples/generic-plan/open-points.html',
    'examples/speckit-sso/open-points.html',
    'examples/openspec-webhooks/open-points.html'
  ];
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

  const prefix = targets.length === 0 ? `version ${version} synced; ` : '';
  console.log(`OK: ${prefix}validated ${summaries.join('; ')}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCli();
}
