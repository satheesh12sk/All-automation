#!/usr/bin/env node
/** Runs the full-depth suite for English and Hindi in parallel. Extra args are forwarded. */
const { spawn } = require('node:child_process');
const path = require('node:path');

const LANGS = ['en', 'hi'];
const extra = process.argv.slice(2);
const runner = path.join(__dirname, 'run-e2e.js');

const runs = LANGS.map(
  (lang) =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, [runner, '--lang', lang, ...extra], {
        stdio: 'inherit',
        env: { ...process.env, PLAYWRIGHT_HTML_REPORT: `playwright-report-${lang}` },
      });
      child.on('exit', (code) => resolve({ lang, code: code ?? 1 }));
    }),
);

Promise.all(runs).then((results) => {
  for (const r of results) console.log(`[full-e2e] ${r.lang}: ${r.code === 0 ? 'PASS' : 'FAIL'}`);
  process.exit(results.some((r) => r.code !== 0) ? 1 : 0);
});
