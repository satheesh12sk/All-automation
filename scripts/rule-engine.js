#!/usr/bin/env node
/**
 * Applies rules/framework-rule-engine.json: each rule forbids a regex in files under a directory.
 * A line containing `rule-allow: <rule id>` is exempt from that rule.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { rules } = JSON.parse(fs.readFileSync(path.join(root, 'rules/framework-rule-engine.json'), 'utf8'));

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

let violations = 0;
for (const rule of rules) {
  const re = new RegExp(rule.forbid);
  const files = walk(path.join(root, rule.dir)).filter((f) => !rule.ext || rule.ext.includes(path.extname(f)));
  for (const file of files) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (re.test(line) && !line.includes(`rule-allow: ${rule.id}`)) {
        violations++;
        console.log(`[${rule.id}] ${path.relative(root, file)}:${i + 1} ${rule.description}`);
      }
    });
  }
}
console.log(violations ? `${violations} violation(s)` : 'No rule violations');
process.exit(violations ? 1 : 0);
