import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validatePayload, extractJsonIsland } from '../scripts/validate.mjs';

const ROOT = process.cwd();

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
        options: ['A', 'B'],
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

  it('scaffolds valid spec.json and context.json from Spec Kit markers', () => {
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
      const { errs } = validatePayload({ context: ctx, spec }, 'scaffolded');
      assert.deepEqual(errs, []);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('merge-answers.mjs', () => {
  const htmlBase = fs.readFileSync(path.join(ROOT, 'examples', 'generic-plan', 'open-points.html'), 'utf8');

  function withSaved(savedObj) {
    return htmlBase.replace(
      '<script type="application/json" id="saved">{}</script>',
      `<script type="application/json" id="saved">${JSON.stringify(savedObj)}</script>`
    );
  }

  it('gives decider (A) authority over non-decider disagreement and applies mootWhen', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-merge-'));
    try {
      const f1 = path.join(tmpDir, 'arch.html');
      const f2 = path.join(tmpDir, 'biz.html');
      fs.writeFileSync(f1, withSaved({ id: 'a1', S: { role: 'ARCH', name: 'Bob', a: { 'OQ-1': { o: '1', t: '', n: '' }, 'OQ-3': { o: '1', t: '', n: '' } } } }));
      fs.writeFileSync(f2, withSaved({ id: 'b1', S: { role: 'BIZ', name: 'Alice', a: { 'OQ-3': { o: '0', t: '', n: 'GDPR' } } } }));

      const jsonOut = execFileSync('node', [path.join(ROOT, 'scripts', 'merge-answers.mjs'), '--json', f1, f2], { encoding: 'utf8' });
      const res = JSON.parse(jsonOut);
      assert.equal(res.summary.resolved, 2);
      assert.equal(res.summary.moot, 1);
      assert.equal(res.moot[0].id, 'OQ-2');
      assert.equal(res.summary.conflicts, 0);

      const copilotOut = execFileSync('node', [path.join(ROOT, 'scripts', 'merge-answers.mjs'), '--copilot-prompt', f1, f2], { encoding: 'utf8' });
      assert.ok(copilotOut.includes('## Resolved Decisions to Apply'));
      assert.ok(copilotOut.includes('OQ-2'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('exits with code 2 when non-deciders disagree without decider vote', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-conf-'));
    try {
      const f1 = path.join(tmpDir, 'a.html');
      const f2 = path.join(tmpDir, 'b.html');
      fs.writeFileSync(f1, withSaved({ id: '1', S: { role: 'ARCH', name: 'Bob', a: { 'OQ-4': { o: '0', t: '', n: '' } } } }));
      fs.writeFileSync(f2, withSaved({ id: '2', S: { role: 'PO', name: 'Carol', a: { 'OQ-4': { o: '1', t: '', n: '' } } } }));

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
});
