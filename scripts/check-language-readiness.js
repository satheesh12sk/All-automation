#!/usr/bin/env node
/** Reports missing uiCopy keys per language. Run via tsx (npm run lang:check) so the TS registry can be loaded. */
const { UI_COPY_DATA } = require('../src/utils/UiCopyData');
const { LANGUAGES } = require('../src/utils/languages');

const keys = Object.keys(UI_COPY_DATA);
let incomplete = false;
for (const code of Object.keys(LANGUAGES)) {
  const missing = keys.filter((k) => !UI_COPY_DATA[k][code] && !UI_COPY_DATA[k].englishOnly);
  console.log(`${code.padEnd(4)} ${keys.length - missing.length}/${keys.length} keys`);
  for (const k of missing) console.log(`       missing: ${k}`);
  if (missing.length) incomplete = true;
}
process.exit(process.argv.includes('--strict') && incomplete ? 1 : 0);
