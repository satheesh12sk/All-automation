#!/usr/bin/env node
/**
 * Wrapper around `playwright test`.
 *   node scripts/run-e2e.js [--env UAT|LAB|LAB2] [--lang en|hi|te] [--regression] [-- extra playwright args]
 */
const { spawn } = require('node:child_process');

const argv = process.argv.slice(2);
const env = { ...process.env };
const pwArgs = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--env') env.ENV = argv[++i];
  else if (a === '--lang') env.TEST_LANG = argv[++i];
  else if (a === '--regression') pwArgs.push('--grep', '@regression');
  else if (a === '--smoke') pwArgs.push('--grep', '@smoke');
  else if (a === '--') pwArgs.push(...argv.slice(i + 1)), (i = argv.length);
  else pwArgs.push(a);
}

// Functional suites live in the 'chromium' project; responsive checks have their own script.
if (!pwArgs.some((a) => a.startsWith('--project'))) pwArgs.push('--project=chromium');

console.log(`[run-e2e] ENV=${env.ENV || env.TEST_ENV || 'UAT'} LANG=${env.TEST_LANG || env.APP_LANG || 'en'} args=${pwArgs.join(' ')}`);

const child = spawn('npx', ['playwright', 'test', ...pwArgs], { env, stdio: 'inherit', shell: process.platform === 'win32' });
child.on('exit', (code) => process.exit(code ?? 1));
