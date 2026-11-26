import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
});
