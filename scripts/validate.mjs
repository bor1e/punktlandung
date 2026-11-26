#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const errors = [];

function fail(msg) {
  errors.push(msg);
}

// 1. Validate repo files and version sync
const versionPath = path.join(root, 'VERSION');
const skillPath = path.join(root, 'skills', 'open-points-overview', 'SKILL.md');
const readmePath = path.join(root, 'README.md');
const changelogPath = path.join(root, 'CHANGELOG.md');

let version = '';
if (!fs.existsSync(versionPath)) {
  fail('Missing VERSION file');
} else {
  version = fs.readFileSync(versionPath, 'utf8').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    fail(`VERSION must be SemVer (x.y.z), found: "${version}"`);
  }
}

if (!fs.existsSync(skillPath)) {
  fail('Missing skills/open-points-overview/SKILL.md');
} else {
  const skill = fs.readFileSync(skillPath, 'utf8');
  const match = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    fail('SKILL.md missing YAML frontmatter');
  } else {
    const verMatch = match[1].match(/^version:\s*(.+)$/m);
    const skillVersion = verMatch ? verMatch[1].trim().replace(/^['"]|['"]$/g, '') : '';
    if (!skillVersion) {
      fail('SKILL.md frontmatter missing version field');
    } else if (version && skillVersion !== version) {
      fail(`Version mismatch: VERSION is "${version}" but SKILL.md has "${skillVersion}"`);
    }
  }
}

if (!fs.existsSync(readmePath)) fail('Missing README.md');
if (!fs.existsSync(changelogPath)) fail('Missing CHANGELOG.md');

// 2. Validate HTML overview invariants
const htmlArg = process.argv[2] || 'example.html';
const htmlPath = path.resolve(root, htmlArg);

let summary = '';
if (!fs.existsSync(htmlPath)) {
  fail(`Missing HTML file: ${htmlArg}`);
} else {
  const html = fs.readFileSync(htmlPath, 'utf8');

  if (!/<script\s+type="application\/json"\s+id="saved">/.test(html)) {
    fail(`${htmlArg}: missing <script type="application/json" id="saved">`);
  }

  if (/<script[^>]+src=["']https?:\/\//i.test(html)) {
    fail(`${htmlArg}: external <script src="http..."> tag found`);
  }
  if (/<link[^>]+href=["']https?:\/\//i.test(html)) {
    fail(`${htmlArg}: external <link href="http..."> tag found`);
  }

  const startMarker = "'use strict';";
  const endMarker = '/* ---------- Zustand ---------- */';
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    fail(`${htmlArg}: could not locate JS data block between '${startMarker}' and '${endMarker}'`);
  } else {
    const dataBlock = html.slice(startIdx + startMarker.length, endIdx);
    const sandbox = {};
    try {
      vm.runInNewContext(dataBlock, sandbox, { filename: htmlArg });
    } catch (err) {
      fail(`${htmlArg}: failed to evaluate data block: ${err.message}`);
    }

    const { SPEC_OPEN, SPEC_NN, P, ORDER, Q, QI, ALLTP } = sandbox;

    if (typeof SPEC_OPEN !== 'number' || typeof SPEC_NN !== 'number') {
      fail(`${htmlArg}: SPEC_OPEN and SPEC_NN must be numbers`);
    } else if (!Array.isArray(ALLTP)) {
      fail(`${htmlArg}: ALLTP must be an array`);
    } else {
      const limit = SPEC_OPEN + SPEC_NN;
      if (ALLTP.length > limit) {
        fail(`${htmlArg}: topic count ${ALLTP.length} exceeds spec limit ${limit} (${SPEC_OPEN} + ${SPEC_NN})`);
      }
    }

    if (!P || typeof P !== 'object' || !Array.isArray(ORDER) || !Array.isArray(Q) || !QI) {
      fail(`${htmlArg}: missing P, ORDER, Q, or QI in data block`);
    } else {
      const seenIds = new Set();
      let proposalCount = 0;
      let factCount = 0;

      for (const q of Q) {
        if (!q || typeof q.id !== 'string' || !q.id.trim()) {
          fail(`${htmlArg}: question missing valid id`);
          continue;
        }
        if (seenIds.has(q.id)) {
          fail(`${htmlArg}: duplicate question id "${q.id}"`);
        }
        seenIds.add(q.id);

        if (typeof q.t !== 'string' || !q.t.trim()) {
          fail(`${htmlArg}: question "${q.id}" missing non-empty title (t)`);
        }
        if (typeof q.q !== 'string' || !q.q.trim()) {
          fail(`${htmlArg}: question "${q.id}" missing non-empty question text (q)`);
        }
        if (!Array.isArray(q.o) || q.o.length < 2 || q.o.length > 4) {
          fail(`${htmlArg}: question "${q.id}" must have 2..4 options, found ${Array.isArray(q.o) ? q.o.length : 'non-array'}`);
        }

        if (!q.r || typeof q.r !== 'object') {
          fail(`${htmlArg}: question "${q.id}" missing RACI map (r)`);
        } else {
          let deciders = 0;
          for (const [party, role] of Object.entries(q.r)) {
            if (!Object.hasOwn(P, party) || !ORDER.includes(party)) {
              fail(`${htmlArg}: question "${q.id}" references unknown party "${party}"`);
            }
            if (typeof role !== 'string') {
              fail(`${htmlArg}: question "${q.id}" has non-string RACI value for "${party}"`);
              continue;
            }
            if (role.includes('A')) {
              deciders++;
            }
            if (party === 'PLAT' && (role.includes('A') || role.includes('R'))) {
              fail(`${htmlArg}: platform team PLAT must not have A or R on "${q.id}"`);
            }
          }
          if (deciders !== 1) {
            fail(`${htmlArg}: question "${q.id}" must have exactly 1 deciding party (A), found ${deciders}`);
          }
        }

        if (q.rec !== null && q.rec !== undefined) {
          proposalCount++;
          if (!Number.isInteger(q.rec) || q.rec < 0 || q.rec >= (q.o ? q.o.length : 0)) {
            fail(`${htmlArg}: question "${q.id}" has out-of-range rec=${q.rec}`);
          }
          if (typeof q.why !== 'string' || !q.why.trim()) {
            fail(`${htmlArg}: question "${q.id}" has proposal rec=${q.rec} but empty why`);
          }
        } else {
          factCount++;
        }

        if (q.dep !== undefined) {
          if (!Array.isArray(q.dep)) {
            fail(`${htmlArg}: question "${q.id}" dep must be an array`);
          } else {
            for (const depId of q.dep) {
              if (!Object.hasOwn(QI, depId)) {
                fail(`${htmlArg}: question "${q.id}" depends on unknown question "${depId}"`);
              }
            }
          }
        }
      }

      if (errors.length === 0) {
        summary = `OK: version ${version} synced; ${htmlArg} validated (${ALLTP.length} topics <= ${SPEC_OPEN + SPEC_NN} limit, ${Q.length} questions, ${proposalCount} with proposal, ${factCount} fact questions, all RACI/dep checks passed).`;
      }
    }
  }
}

if (errors.length > 0) {
  for (const err of errors) {
    console.error(`ERROR: ${err}`);
  }
  process.exit(1);
}

console.log(summary);
