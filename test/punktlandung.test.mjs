import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { validatePayload, extractJsonIsland } from '../scripts/validate.mjs';

const ROOT = process.cwd();

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

describe('extractJsonIsland', () => {
  it('parses both standard and browser-reordered script attributes', () => {
    const standard = '<script type="application/json" id="saved">{"ok":1}</script>';
    const reordered = '<script id="saved" type="application/json">{"ok":2}</script>';
    assert.deepEqual(extractJsonIsland(standard, 'saved'), { ok: 1 });
    assert.deepEqual(extractJsonIsland(reordered, 'saved'), { ok: 2 });
  });
});

describe('validatePayload invariants', () => {
  const baseCtx = {
    lang: 'en',
    parties: [
      { id: 'PO', name: 'Product Owner', short: 'PO', color: '#1c6dd0', role: 'PO', job: 'Decides scope', isPlatform: false },
      { id: 'PLAT', name: 'Platform', short: 'Plat', color: '#5c7a1f', role: 'Platform', job: 'Infra only', isPlatform: true }
    ]
  };
  const baseSpec = {
    id: 't',
    title: 'Test',
    spec: { file: 'plan.md', version: '0.1.0', openCount: 1, unprovableCount: 0 },
    groups: [{ id: 'g', title: 'General' }],
    questions: [
      {
        id: 'Q-1',
        group: 'g',
        title: 'Choice',
        question: 'Which choice?',
        options: ['Direct download', 'Async email'],
        proposal: 0,
        reason: 'Simpler.',
        raci: { PO: 'A', PLAT: 'C' }
      }
    ]
  };

  it('accepts a valid minimal payload', () => {
    const { errs } = validatePayload({ context: baseCtx, spec: baseSpec }, 'valid');
    assert.deepEqual(errs, []);
  });

  it('rejects platform party with A or R', () => {
    const bad = structuredClone(baseSpec);
    bad.questions[0].raci = { PO: 'A', PLAT: 'R' };
    const { errs } = validatePayload({ context: baseCtx, spec: bad }, 'plat');
    assert.ok(errs.some((e) => e.includes('platform party')));
  });

  it('rejects questions without exactly 1 deciding party (A)', () => {
    const bad = structuredClone(baseSpec);
    bad.questions[0].raci = { PO: 'R', PLAT: 'C' };
    const { errs } = validatePayload({ context: baseCtx, spec: bad }, 'no-a');
    assert.ok(errs.some((e) => e.includes('exactly 1 deciding party')));
  });

  it('rejects unknown mootWhen target', () => {
    const bad = structuredClone(baseSpec);
    bad.questions[0].mootWhen = { id: 'MISSING', eq: '0' };
    const { errs } = validatePayload({ context: baseCtx, spec: bad }, 'moot');
    assert.ok(errs.some((e) => e.includes('mootWhen references unknown question')));
  });

  it('rejects placeholder options unless allowDraft is true', () => {
    const draft = structuredClone(baseSpec);
    draft.questions[0].options = ['Option A (replace with concrete choice)', 'Option B (replace with concrete choice)'];
    const { errs } = validatePayload({ context: baseCtx, spec: draft }, 'draft');
    assert.ok(errs.some((e) => e.includes('placeholder text')));
    const { errs: allowed } = validatePayload({ context: baseCtx, spec: draft }, 'draft', { allowDraft: true });
    assert.deepEqual(allowed, []);
  });

  it('enforces schema rules: hex colors, non-empty string options, valid RACI letters, and non-negative openCount', () => {
    const badColor = structuredClone(baseCtx);
    badColor.parties[0].color = '#fff" onload="alert(1)';
    assert.ok(validatePayload({ context: badColor, spec: baseSpec }, 'color').errs.some((e) => e.includes('hex')));

    const badOpt = structuredClone(baseSpec);
    badOpt.questions[0].options = [123, 'Valid'];
    assert.ok(validatePayload({ context: baseCtx, spec: badOpt }, 'opt').errs.some((e) => e.includes('non-empty strings')));

    const badRaci = structuredClone(baseSpec);
    badRaci.questions[0].raci = { PO: 'AZ', PLAT: 'C' };
    assert.ok(validatePayload({ context: baseCtx, spec: badRaci }, 'raci').errs.some((e) => e.includes('invalid RACI')));

    const badCount = structuredClone(baseSpec);
    badCount.spec.openCount = -1;
    assert.ok(validatePayload({ context: baseCtx, spec: badCount }, 'count').errs.some((e) => e.includes('non-negative integer')));
  });

  it('accepts valid decision-governance fields (principles, defaultRule, consultWhen) and rejects invalid values', () => {
    const goodCtx = structuredClone(baseCtx);
    goodCtx.principles = ['Legal > Data > Sourcing', 'Standard platform over custom'];
    goodCtx.defaultRule = 'Deviations carry burden of proof.';
    goodCtx.parties[1].consultWhen = 'Queues or deployment config change.';
    assert.deepEqual(validatePayload({ context: goodCtx, spec: baseSpec }, 'gov-ok').errs, []);

    const badPrinciplesType = structuredClone(baseCtx);
    badPrinciplesType.principles = 'not-an-array';
    assert.ok(validatePayload({ context: badPrinciplesType, spec: baseSpec }, 'p-arr').errs.some((e) => e.includes('context.principles')));

    const badPrinciplesItem = structuredClone(baseCtx);
    badPrinciplesItem.principles = ['Valid', '   '];
    assert.ok(validatePayload({ context: badPrinciplesItem, spec: baseSpec }, 'p-blank').errs.some((e) => e.includes('context.principles')));

    const badDefault = structuredClone(baseCtx);
    badDefault.defaultRule = '  ';
    assert.ok(validatePayload({ context: badDefault, spec: baseSpec }, 'def').errs.some((e) => e.includes('context.defaultRule')));

    const badConsult = structuredClone(baseCtx);
    badConsult.parties[0].consultWhen = '';
    assert.ok(validatePayload({ context: badConsult, spec: baseSpec }, 'cw').errs.some((e) => e.includes('consultWhen')));
  });

  it('validates a standalone HTML file outside repository root', () => {
    const out = execFileSync('node', [
      path.join(ROOT, 'scripts', 'validate.mjs'),
      path.join(ROOT, 'examples', 'generic-plan', 'open-points.html')
    ], { cwd: os.tmpdir(), encoding: 'utf8' });
    assert.ok(out.includes('OK: validated'));
  });
});

describe('build.mjs & init-case.mjs', () => {
  it('builds cleanly even when invoked outside repository root', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-build-'));
    try {
      const outHtml = path.join(tmpDir, 'out.html');
      execFileSync('node', [
        path.join(ROOT, 'scripts', 'build.mjs'),
        path.join(ROOT, 'examples', 'generic-plan', 'context.json'),
        path.join(ROOT, 'examples', 'generic-plan', 'spec.json'),
        '-o',
        outHtml
      ], { cwd: tmpDir, encoding: 'utf8' });
      const html = fs.readFileSync(outHtml, 'utf8');
      assert.ok(html.includes('id="spec-data"'));
      assert.ok(!/<script[^>]+src=["']https?:\/\//i.test(html));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('scaffolds valid spec.json from Spec Kit markers and fails build without --draft', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-init-'));
    try {
      execFileSync('node', [
        path.join(ROOT, 'scripts', 'init-case.mjs'),
        path.join(ROOT, 'examples', 'speckit-sso', 'spec.md'),
        '--out-dir',
        tmpDir
      ], { cwd: ROOT, encoding: 'utf8' });
      const ctx = JSON.parse(fs.readFileSync(path.join(tmpDir, 'context.json'), 'utf8'));
      const spec = JSON.parse(fs.readFileSync(path.join(tmpDir, 'spec.json'), 'utf8'));
      assert.equal(spec.questions.length, 5);
      const { errs } = validatePayload({ context: ctx, spec }, 'scaffolded', { allowDraft: true });
      assert.deepEqual(errs, []);

      let buildFailed = false;
      try {
        execFileSync('node', [
          path.join(ROOT, 'scripts', 'build.mjs'),
          path.join(tmpDir, 'context.json'),
          path.join(tmpDir, 'spec.json'),
          '-o',
          path.join(tmpDir, 'out.html')
        ], { cwd: ROOT, stdio: 'pipe' });
      } catch (e) {
        buildFailed = e.status !== 0 && String(e.stderr).includes('placeholder text');
      }
      assert.ok(buildFailed, 'Expected build without --draft to reject scaffold placeholders');

      execFileSync('node', [
        path.join(ROOT, 'scripts', 'build.mjs'),
        path.join(tmpDir, 'context.json'),
        path.join(tmpDir, 'spec.json'),
        '-o',
        path.join(tmpDir, 'out.html'),
        '--draft'
      ], { cwd: ROOT, stdio: 'pipe' });
      assert.ok(fs.existsSync(path.join(tmpDir, 'out.html')));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('extracts plain bullets under ## Open Questions and ignores User Stories (US-1)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-plain-'));
    try {
      const planPath = path.join(tmpDir, 'plan.md');
      fs.writeFileSync(planPath, [
        '# Feature Plan: Invoice Export',
        '',
        '## User Stories',
        '- US-1: As an accountant, I want monthly PDF invoices.',
        '- FR-1: System must support EU VAT rates.',
        '',
        '## Open Questions',
        '- Which VAT rounding mode applies per line or per invoice?',
        '- Should cancelled invoices appear in the export?',
        '- What retention period applies to exported files?'
      ].join('\n'));
      execFileSync('node', [
        path.join(ROOT, 'scripts', 'init-case.mjs'),
        planPath,
        '--out-dir',
        tmpDir
      ], { cwd: ROOT, encoding: 'utf8' });
      const spec = JSON.parse(fs.readFileSync(path.join(tmpDir, 'spec.json'), 'utf8'));
      assert.equal(spec.questions.length, 3);
      assert.ok(spec.questions.every((q) => !q.id.startsWith('US-') && !q.question.includes('accountant')));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('refuses to overwrite existing spec.json unless --force is passed, and extracts multiple markers per line', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-overwrite-'));
    try {
      const mdPath = path.join(tmpDir, 'spec.md');
      fs.writeFileSync(mdPath, '# Multi Marker\n- [NEEDS CLARIFICATION: First?] and [NEEDS CLARIFICATION: Second?]\n');

      execFileSync('node', [path.join(ROOT, 'scripts', 'init-case.mjs'), mdPath, '--out-dir', tmpDir], { cwd: ROOT });
      const spec = JSON.parse(fs.readFileSync(path.join(tmpDir, 'spec.json'), 'utf8'));
      assert.equal(spec.questions.length, 2);

      let overwriteBlocked = false;
      try {
        execFileSync('node', [path.join(ROOT, 'scripts', 'init-case.mjs'), mdPath, '--out-dir', tmpDir], { cwd: ROOT, stdio: 'pipe' });
      } catch (err) {
        overwriteBlocked = err.status === 1 && String(err.stderr).includes('already exists');
      }
      assert.ok(overwriteBlocked);

      execFileSync('node', [path.join(ROOT, 'scripts', 'init-case.mjs'), mdPath, '--out-dir', tmpDir, '--force'], { cwd: ROOT });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('merge-answers.mjs', () => {
  const genericHtml = fs.readFileSync(path.join(ROOT, 'examples', 'generic-plan', 'open-points.html'), 'utf8');
  const ssoHtml = fs.readFileSync(path.join(ROOT, 'examples', 'speckit-sso', 'open-points.html'), 'utf8');

  function withSaved(baseHtml, savedObj) {
    return baseHtml.replace(
      '<script type="application/json" id="saved">{}</script>',
      `<script type="application/json" id="saved">${JSON.stringify(savedObj)}</script>`
    );
  }

  it('enforces single-decider authority: non-deciders only suggest and cannot trigger mootWhen', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-decider-'));
    try {
      // On SSO: SC-1 (A=PO), SC-5 (A=ARCH). Business (BIZ) is NOT the decider for either!
      const bizOnly = path.join(tmpDir, 'biz.html');
      fs.writeFileSync(bizOnly, withSaved(ssoHtml, {
        id: 'b1',
        specId: 'enterprise-sso-login',
        S: { role: 'BIZ', name: 'Bea Business', a: { 'SC-1': { o: '0', t: '', n: '' }, 'SC-5': { o: '0', t: '', n: '' } } }
      }));

      const res1 = JSON.parse(execFileSync('node', [path.join(ROOT, 'scripts', 'merge-answers.mjs'), '--json', bizOnly], { encoding: 'utf8' }));
      assert.equal(res1.summary.resolved, 0);
      assert.equal(res1.summary.suggested, 2);
      assert.equal(res1.summary.moot, 0);

      const prompt = execFileSync('node', [path.join(ROOT, 'scripts', 'merge-answers.mjs'), '--copilot-prompt', bizOnly], { encoding: 'utf8' });
      assert.ok(prompt.includes('Suggested by Non-Deciders (Waiting for Decider — Do NOT Apply Yet)'));
      assert.ok(!prompt.includes('## Moot'));

      // Now PO (the actual decider of SC-1) answers SC-1 = '0' -> SC-1 resolves AND SC-2 becomes moot
      const poReply = path.join(tmpDir, 'po.html');
      fs.writeFileSync(poReply, withSaved(ssoHtml, {
        id: 'p1',
        specId: 'enterprise-sso-login',
        S: { role: 'PO', name: 'Paul PO', a: { 'SC-1': { o: '0', t: '', n: '' } } }
      }));
      const res2 = JSON.parse(execFileSync('node', [path.join(ROOT, 'scripts', 'merge-answers.mjs'), '--json', bizOnly, poReply], { encoding: 'utf8' }));
      assert.equal(res2.summary.resolved, 1);
      assert.equal(res2.resolved[0].id, 'SC-1');
      assert.equal(res2.summary.moot, 1);
      assert.equal(res2.moot[0].id, 'SC-2');
      assert.equal(res2.summary.suggested, 1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('refuses stale answers when option order changed since reply was generated', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-stale-'));
    try {
      const ssoSpec = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'speckit-sso', 'spec.json'), 'utf8'));
      const sc3 = ssoSpec.questions.find((q) => q.id === 'SC-3');
      const oldHash = optHash(sc3.options);

      // Swap options of SC-3 and rebuild HTML
      sc3.options = [sc3.options[1], sc3.options[0]];
      const swappedSpecPath = path.join(tmpDir, 'spec.json');
      fs.writeFileSync(swappedSpecPath, JSON.stringify(ssoSpec, null, 2));
      const rebuiltHtml = path.join(tmpDir, 'rebuilt.html');
      execFileSync('node', [
        path.join(ROOT, 'scripts', 'build.mjs'),
        path.join(ROOT, 'examples', 'generic-plan', 'context.json'),
        swappedSpecPath,
        '-o',
        rebuiltHtml
      ], { cwd: ROOT });

      const staleCode = 'PKL1:' + Buffer.from(JSON.stringify({
        v: 1,
        id: 'enterprise-sso-login',
        ver: '0.1.0',
        role: 'BIZ',
        name: 'Bea Business',
        a: { 'SC-3': { o: '0', t: '', n: '', oh: oldHash } }
      }), 'utf8').toString('base64url');

      let exitCode = 0;
      try {
        execFileSync('node', [path.join(ROOT, 'scripts', 'merge-answers.mjs'), '--json', rebuiltHtml, '--code', staleCode], { encoding: 'utf8', stdio: 'pipe' });
      } catch (err) {
        exitCode = err.status;
        const parsed = JSON.parse(err.stdout);
        assert.equal(parsed.summary.conflicts, 1);
        assert.equal(parsed.summary.resolved, 0);
        assert.ok(parsed.conflicts[0].reason.includes('stale'));
      }
      assert.equal(exitCode, 2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('refuses answer codes from a different spec with non-zero exit', () => {
    const ssoCode = 'PKL1:' + Buffer.from(JSON.stringify({
      v: 1,
      id: 'enterprise-sso-login',
      ver: '0.1.0',
      role: 'BIZ',
      name: 'Bea Business',
      a: { 'SC-3': { o: '0', t: '', n: '' } }
    }), 'utf8').toString('base64url');

    let exitCode = 0;
    let stderr = '';
    try {
      execFileSync('node', [
        path.join(ROOT, 'scripts', 'merge-answers.mjs'),
        path.join(ROOT, 'examples', 'generic-plan', 'open-points.html'),
        '--code',
        ssoCode
      ], { encoding: 'utf8', stdio: 'pipe' });
    } catch (err) {
      exitCode = err.status;
      stderr = String(err.stderr);
    }
    assert.equal(exitCode, 1);
    assert.ok(stderr.includes('Spec mismatch'));
  });

  it('merges PKL1 paste-back codes from email replies and applies mootWhen when decider votes', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-merge-'));
    try {
      const f1 = path.join(tmpDir, 'arch.html');
      const f2 = path.join(tmpDir, 'biz.html');
      fs.writeFileSync(f1, withSaved(genericHtml, { id: 'a1', specId: 'order-csv-export', S: { role: 'ARCH', name: 'Bob', a: { 'OQ-1': { o: '1', t: '', n: '' }, 'OQ-3': { o: '1', t: '', n: '' } } } }));
      fs.writeFileSync(f2, withSaved(genericHtml, { id: 'b1', specId: 'order-csv-export', S: { role: 'BIZ', name: 'Alice', a: { 'OQ-3': { o: '0', t: '', n: 'GDPR' } } } }));

      const jsonOut = execFileSync('node', [path.join(ROOT, 'scripts', 'merge-answers.mjs'), '--json', f1, f2], { encoding: 'utf8' });
      const res = JSON.parse(jsonOut);
      assert.equal(res.summary.resolved, 2);
      assert.equal(res.summary.moot, 1);
      assert.equal(res.moot[0].id, 'OQ-2');
      assert.equal(res.summary.conflicts, 0);

      const pklPayload = { v: 1, id: 'order-csv-export', ver: '0.1.0', role: 'BIZ', name: 'Alice', a: { 'OQ-4': { o: '0', t: '', n: 'German Excel' } } };
      const pklToken = 'PKL1:' + Buffer.from(JSON.stringify(pklPayload), 'utf8').toString('base64url');
      const replyTxt = path.join(tmpDir, 'email-reply.txt');
      fs.writeFileSync(replyTxt, `Hi team, here are my answers:\n\n${pklToken}\n\nThanks!`);

      const mergedCode = JSON.parse(execFileSync('node', [
        path.join(ROOT, 'scripts', 'merge-answers.mjs'),
        '--json',
        path.join(ROOT, 'examples', 'generic-plan', 'open-points.html'),
        replyTxt
      ], { encoding: 'utf8' }));
      assert.equal(mergedCode.summary.resolved, 1);
      assert.equal(mergedCode.resolved[0].id, 'OQ-4');
      assert.equal(mergedCode.resolved[0].note, 'German Excel');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('exits with code 2 when non-deciders disagree without decider vote', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-conf-'));
    try {
      const f1 = path.join(tmpDir, 'a.html');
      const f2 = path.join(tmpDir, 'b.html');
      fs.writeFileSync(f1, withSaved(genericHtml, { id: '1', specId: 'order-csv-export', S: { role: 'ARCH', name: 'Bob', a: { 'OQ-4': { o: '0', t: '', n: '' } } } }));
      fs.writeFileSync(f2, withSaved(genericHtml, { id: '2', specId: 'order-csv-export', S: { role: 'PO', name: 'Carol', a: { 'OQ-4': { o: '1', t: '', n: '' } } } }));

      let exitCode = 0;
      try {
        execFileSync('node', [path.join(ROOT, 'scripts', 'merge-answers.mjs'), '--json', f1, f2], { encoding: 'utf8' });
      } catch (err) {
        exitCode = err.status;
        const parsed = JSON.parse(err.stdout);
        assert.equal(parsed.summary.conflicts, 1);
        assert.equal(parsed.conflicts[0].id, 'OQ-4');
      }
      assert.equal(exitCode, 2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('embeds PKL1 answer code in summaryText and mailto bodies', () => {
    assert.ok(genericHtml.includes('T.codeLabel'));
    assert.ok(genericHtml.includes('answerCode()'));
  });

  it('handles 76-col line-wrapped PKL1 codes and rejects corrupt tokens cleanly', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-wrap-'));
    try {
      const pklPayload = { v: 1, id: 'order-csv-export', ver: '0.1.0', role: 'BIZ', name: 'Alice', a: { 'OQ-4': { o: '0', t: '', n: 'Wrapped reply' } } };
      const rawCode = 'PKL1:' + Buffer.from(JSON.stringify(pklPayload), 'utf8').toString('base64url') + ':PKL';
      const wrapped = rawCode.match(/.{1,76}/g).map((line) => `> ${line}`).join('\n');
      const replyPath = path.join(tmpDir, 'wrapped.txt');
      fs.writeFileSync(replyPath, `Forwarded reply:\n\n${wrapped}\n\nBest,\nAlice`);

      const merged = JSON.parse(execFileSync('node', [
        path.join(ROOT, 'scripts', 'merge-answers.mjs'),
        '--json',
        path.join(ROOT, 'examples', 'generic-plan', 'open-points.html'),
        replyPath
      ], { encoding: 'utf8' }));
      assert.equal(merged.summary.resolved, 1);
      assert.equal(merged.resolved[0].id, 'OQ-4');

      let badExit = 0;
      let badErr = '';
      try {
        execFileSync('node', [
          path.join(ROOT, 'scripts', 'merge-answers.mjs'),
          path.join(ROOT, 'examples', 'generic-plan', 'open-points.html'),
          '--code',
          'PKL1:!!!not-valid-base64:PKL'
        ], { encoding: 'utf8', stdio: 'pipe' });
      } catch (err) {
        badExit = err.status;
        badErr = String(err.stderr);
      }
      assert.equal(badExit, 1);
      assert.ok(badErr.includes('Invalid or truncated PKL1'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('runs template JS end-to-end: blocks bulk-accept without role, applies PO proposals + mootWhen, and exports valid PKL1 code', () => {
    const specData = extractJsonIsland(ssoHtml, 'spec-data');
    const savedData = extractJsonIsland(ssoHtml, 'saved');
    const scripts = [...ssoHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
    const appScript = scripts[scripts.length - 1][1];

    const listeners = {};
    const makeEl = (id) => {
      const classes = new Set();
      return {
        id,
        innerHTML: '',
        textContent: id === 'spec-data' ? JSON.stringify(specData) : id === 'saved' ? JSON.stringify(savedData) : '',
        value: '',
        classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) },
        addEventListener: (ev, fn) => { (listeners[`${id}:${ev}`] ||= []).push(fn); },
        querySelector: () => null,
        querySelectorAll: () => []
      };
    };
    const els = { logo: makeEl('logo'), brandName: makeEl('brandName'), brandSub: makeEl('brandSub'), roleLabel: makeEl('roleLabel'), btnSave: makeEl('btnSave'), btnCopyCode: makeEl('btnCopyCode'), saveState: makeEl('saveState'), role: makeEl('role'), nav: makeEl('nav'), main: makeEl('main'), 'spec-data': makeEl('spec-data'), saved: makeEl('saved') };

    const alerts = [];
    let copied = '';
    const storage = new Map();
    const docListeners = {};
    const context = {
      JSON, String, Number, Boolean, Array, Object, Math, Date, RegExp, Error,
      encodeURIComponent, decodeURIComponent, unescape, escape,
      btoa: (s) => Buffer.from(s, 'latin1').toString('base64'),
      setTimeout, clearTimeout,
      alert: (m) => alerts.push(m),
      confirm: () => true,
      location: { hash: '#fragen' },
      history: { pushState: () => {} },
      localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)) },
      navigator: { clipboard: { writeText: (s) => { copied = s; return Promise.resolve(); } } },
      window: null,
      document: {
        getElementById: (id) => els[id] || makeEl(id),
        addEventListener: (ev, fn) => { (docListeners[ev] ||= []).push(fn); },
        createElement: () => ({ style: {}, select: () => {}, remove: () => {}, setAttribute: () => {} }),
        body: { appendChild: () => {} },
        documentElement: { cloneNode: () => ({ querySelector: () => ({ innerHTML: '', textContent: '' }), querySelectorAll: () => [], outerHTML: '' }) }
      }
    };
    context.window = { scrollY: 0, scrollTo: () => {}, addEventListener: () => {} };

    vm.runInNewContext(appScript, context);
    assert.ok(els.main.innerHTML.includes('Open Questions'));

    // 1. Clicking Accept Proposals in "All roles" view alerts and sets 0 answers
    const makeBtn = (attr, val = '') => ({ closest: (sel) => (sel === 'button' ? makeBtn(attr, val) : null), hasAttribute: (a) => a === attr, getAttribute: (a) => (a === attr ? val : null) });
    listeners['main:click'].forEach((fn) => fn({ target: makeBtn('data-recs') }));
    assert.equal(alerts.length, 1);
    assert.ok(alerts[0].includes('select your role'));

    // 2. Select PO role, click Accept Proposals -> only PO's SC-1 is answered, and copied PKL1 carries role='PO'
    els.role.value = 'PO';
    listeners['role:change'].forEach((fn) => fn({ target: els.role }));
    listeners['main:click'].forEach((fn) => fn({ target: makeBtn('data-recs') }));
    listeners['btnCopyCode:click'].forEach((fn) => fn.call(els.btnCopyCode, {}));

    // Switching back to All roles confirms SC-2 renders dimmed as moot
    els.role.value = '';
    listeners['role:change'].forEach((fn) => fn({ target: els.role }));
    assert.ok(els.main.innerHTML.includes('class="q moot" data-q="SC-2"'));

    // 3. Copied PKL1:...:PKL resolves SC-1 and mutes SC-2 in merge-answers.mjs
    assert.ok(copied.startsWith('PKL1:') && copied.endsWith(':PKL'));

    const merged = JSON.parse(execFileSync('node', [
      path.join(ROOT, 'scripts', 'merge-answers.mjs'),
      '--json',
      path.join(ROOT, 'examples', 'speckit-sso', 'open-points.html'),
      '--code',
      copied
    ], { encoding: 'utf8' }));
    assert.equal(merged.summary.resolved, 1);
    assert.equal(merged.resolved[0].id, 'SC-1');
    assert.equal(merged.summary.moot, 1);
    assert.equal(merged.moot[0].id, 'SC-2');
  });

  it('renders principles, defaultRule, and escaped consultWhen on #raci without altering question cards', () => {
    const html = fs.readFileSync(path.join(ROOT, 'examples', 'generic-plan', 'open-points.html'), 'utf8');
    const specData = structuredClone(extractJsonIsland(html, 'spec-data'));
    specData.context.principles = ['<script>alert(1)</script> Legal first', 'Data platform second'];
    const savedData = extractJsonIsland(html, 'saved');
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
    const appScript = scripts[scripts.length - 1][1];

    const makeEl = (id) => ({
      id,
      innerHTML: '',
      textContent: id === 'spec-data' ? JSON.stringify(specData) : id === 'saved' ? JSON.stringify(savedData) : '',
      value: '',
      classList: { toggle: () => {}, contains: () => false },
      addEventListener: () => {},
      querySelector: () => null,
      querySelectorAll: () => []
    });
    const els = { logo: makeEl('logo'), brandName: makeEl('brandName'), brandSub: makeEl('brandSub'), roleLabel: makeEl('roleLabel'), btnSave: makeEl('btnSave'), btnCopyCode: makeEl('btnCopyCode'), saveState: makeEl('saveState'), role: makeEl('role'), nav: makeEl('nav'), main: makeEl('main'), 'spec-data': makeEl('spec-data'), saved: makeEl('saved') };
    const context = {
      JSON, String, Number, Boolean, Array, Object, Math, Date, RegExp, Error,
      encodeURIComponent, decodeURIComponent, unescape, escape,
      btoa: (s) => Buffer.from(s, 'latin1').toString('base64'),
      setTimeout, clearTimeout,
      alert: () => {},
      confirm: () => true,
      location: { hash: '#raci' },
      history: { pushState: () => {} },
      localStorage: { getItem: () => null, setItem: () => {} },
      navigator: { clipboard: { writeText: () => Promise.resolve() } },
      window: { scrollY: 0, scrollTo: () => {}, addEventListener: () => {} },
      document: {
        getElementById: (id) => els[id] || makeEl(id),
        addEventListener: () => {},
        createElement: () => ({ style: {}, select: () => {}, remove: () => {}, setAttribute: () => {} }),
        body: { appendChild: () => {} },
        documentElement: { cloneNode: () => ({ querySelector: () => ({ innerHTML: '', textContent: '' }), querySelectorAll: () => [], outerHTML: '' }) }
      }
    };

    vm.runInNewContext(appScript, context);
    assert.ok(els.main.innerHTML.includes('Decision Principles (Priority Order)'));
    assert.ok(els.main.innerHTML.includes('Default / Burden-of-Proof Rule'));
    assert.ok(els.main.innerHTML.includes('Consult when:'));
    assert.ok(els.main.innerHTML.includes('&lt;script&gt;alert(1)&lt;/script&gt; Legal first'));
    assert.ok(!els.main.innerHTML.includes('<script>alert(1)</script>'));
  });

  it('extracts sub-headings under ## Open Questions and ignores ## Decisions in init-case', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-init-nested-'));
    try {
      const planPath = path.join(tmpDir, 'plan.md');
      const outDir = path.join(tmpDir, 'out');
      fs.writeFileSync(planPath, [
        '# Service Plan',
        '',
        '## Decisions',
        '- We use PostgreSQL (decided 2026-11-20)',
        '- Region is eu-central-1 (locked)',
        '',
        '## Open Questions',
        '### Security',
        '- Require MFA for admins?',
        '- Session timeout duration?',
        '',
        '## Implementation Notes',
        '- Refactor worker queue'
      ].join('\n'));
      execFileSync('node', [path.join(ROOT, 'scripts', 'init-case.mjs'), planPath, '--out-dir', outDir], { encoding: 'utf8' });
      const spec = JSON.parse(fs.readFileSync(path.join(outDir, 'spec.json'), 'utf8'));
      const titles = spec.questions.map((q) => q.question);
      assert.equal(spec.questions.length, 2);
      assert.deepEqual(titles, ['Require MFA for admins?', 'Session timeout duration?']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects unschema\'d properties via Draft 2020-12 JSON Schema checks in validatePayload', () => {
    const html = fs.readFileSync(path.join(ROOT, 'examples', 'generic-plan', 'open-points.html'), 'utf8');
    const bad = structuredClone(extractJsonIsland(html, 'spec-data'));
    bad.context.unexpectedCtxField = 'nope';
    bad.spec.questions[0].unexpectedQField = 123;
    const { errs } = validatePayload(bad, 'schema-test');
    assert.ok(errs.some((e) => e.includes('unexpected additional property "unexpectedCtxField"')));
    assert.ok(errs.some((e) => e.includes('unexpected additional property "unexpectedQField"')));
  });

  it('resolves latest reply from the same decider via timestamp while flagging distinct decider conflicts', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-latest-'));
    try {
      const encode = (obj) => 'PKL1:' + Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url') + ':PKL';
      const first = encode({ v: 1, id: 'order-csv-export', ver: '0.1.0', role: 'BIZ', name: 'Alice', at: '2026-11-26T10:00:00.000Z', a: { 'OQ-4': { o: '0', t: '', n: 'Initial choice' } } });
      const second = encode({ v: 1, id: 'order-csv-export', ver: '0.1.0', role: 'BIZ', name: 'Alice', at: '2026-11-26T11:00:00.000Z', a: { 'OQ-4': { o: '1', t: '', n: 'Corrected choice' } } });

      const merged = JSON.parse(execFileSync('node', [
        path.join(ROOT, 'scripts', 'merge-answers.mjs'),
        '--json',
        path.join(ROOT, 'examples', 'generic-plan', 'open-points.html'),
        '--code', first,
        '--code', second
      ], { encoding: 'utf8' }));
      assert.equal(merged.summary.resolved, 1);
      assert.equal(merged.summary.conflicts, 0);
      assert.ok(merged.resolved[0].answer.startsWith('B:'));
      assert.ok(merged.warnings.some((w) => w.includes('superseded') && w.includes('Alice')));

      const rival = encode({ v: 1, id: 'order-csv-export', ver: '0.1.0', role: 'BIZ', name: 'Bob', at: '2026-11-26T12:00:00.000Z', a: { 'OQ-4': { o: '2', t: '', n: 'Different decider' } } });
      let conflictExit = 0;
      let conflictJson = null;
      try {
        execFileSync('node', [
          path.join(ROOT, 'scripts', 'merge-answers.mjs'),
          '--json',
          path.join(ROOT, 'examples', 'generic-plan', 'open-points.html'),
          '--code', second,
          '--code', rival
        ], { encoding: 'utf8', stdio: 'pipe' });
      } catch (err) {
        conflictExit = err.status;
        conflictJson = JSON.parse(String(err.stdout));
      }
      assert.equal(conflictExit, 2);
      assert.equal(conflictJson.summary.conflicts, 1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('Spec Kit extension manifest', () => {
  it('defines schema_version 1.0, after_clarify hook, and existing command/config files matching VERSION', () => {
    const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
    const yml = fs.readFileSync(path.join(ROOT, 'extension.yml'), 'utf8');
    assert.match(yml, /^schema_version:\s*["']?1\.0["']?\s*$/m);
    assert.match(yml, /^\s*id:\s*["']?punktlandung["']?\s*$/m);
    assert.match(yml, new RegExp(`^\\s*version:\\s*["']?${version.replace(/\./g, '\\.')}["']?\\s*$`, 'm'));
    assert.match(yml, /after_clarify:[\s\S]*?command:\s*["']?speckit\.punktlandung\.clarify["']?/m);
    for (const rel of [
      'config-template.yml',
      'commands/speckit.punktlandung.clarify.md',
      'commands/speckit.punktlandung.merge.md'
    ]) {
      const content = fs.readFileSync(path.join(ROOT, rel), 'utf8').trim();
      assert.ok(content.length > 20, `${rel} must be non-empty`);
    }
  });
});
