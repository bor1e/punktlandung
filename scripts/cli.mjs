#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [cmd, ...rest] = process.argv.slice(2);

const COMMANDS = {
  init: 'init-case.mjs',
  build: 'build.mjs',
  merge: 'merge-answers.mjs',
  validate: 'validate.mjs'
};

if (!cmd || cmd === '-h' || cmd === '--help' || !COMMANDS[cmd]) {
  console.log([
    'punktlandung — Multiplayer /clarify for non-Git stakeholders',
    '',
    'Usage:',
    '  punktlandung init <plan.md|spec.md|proposal.md> [--context <context.json>] [--out-dir <dir>]',
    '  punktlandung build <context.json> <spec.json> -o <open-points.html>',
    '  punktlandung merge [--json|--copilot-prompt] <file.html|reply.txt> [--code "PKL1:..."]',
    '  punktlandung validate [file.html ...]'
  ].join('\n'));
  process.exit(cmd && !COMMANDS[cmd] && cmd !== '-h' && cmd !== '--help' ? 1 : 0);
}

const scriptPath = path.join(__dirname, COMMANDS[cmd]);
const res = spawnSync(process.execPath, [scriptPath, ...rest], { stdio: 'inherit' });
process.exit(res.status ?? 1);
