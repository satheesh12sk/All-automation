import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestError, TestResult, TestStep } from '@playwright/test/reporter';
import { resolveEnvName } from '../../config/environments';
import { resolveLanguage } from '../../config/language';
import { languageByCode } from './languages';

type Status = 'passed' | 'failed' | 'skipped';

interface Row {
  id: string;
  suite: string;
  title: string;
  titlePath: string;
  author: string;
  priority: string;
  tags: string[];
  file: string;
  start: Date;
  end: Date;
  durationMs: number;
  status: Status;
  retries: number;
  /** Why it was skipped: the reason given to test.skip()/test.fixme(). */
  skipReason?: string;
  /** Notes the test recorded (test.info().annotations), shown under "Details" for tests that did not fail. */
  notes: { type: string; description: string }[];
  failure?: Failure;
  screenshot?: string;
  video?: string;
  trace?: string;
}

/** Everything the "Failure details" panel shows for a failed test. */
interface Failure {
  type: string;
  summary: string;
  expected?: string;
  received?: string;
  /** Items listed in a received array (e.g. each low-contrast text or clipped element). */
  findings: string[];
  message: string;
  location?: string;
  snippet?: string;
  steps: { title: string; depth: number; durationMs: number; failed: boolean }[];
  notes: { type: string; description: string }[];
  environment: string;
  testCase?: TestCaseDoc;
}

/** One row of testcase/*.csv. */
interface TestCaseDoc {
  id: string;
  module: string;
  priority: string;
  scenario: string;
  precondition: string;
  steps: string;
  expected: string;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const stripAnsi = (s = '') => s.replace(/\u001b\[[0-9;]*m/g, '');

/** Minimal RFC 4180 CSV parser (quoted fields, "" escapes, newlines inside quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** TC-ID → test case, from every CSV under testcase/ (columns: TC_ID, Priority, Module, Test Scenario, Precondition, Steps, Expected Result). */
function loadTestCases(dir = path.resolve('testcase')): Map<string, TestCaseDoc> {
  const map = new Map<string, TestCaseDoc>();
  if (!fs.existsSync(dir)) return map;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.csv'))) {
    const [header, ...rows] = parseCsv(fs.readFileSync(path.join(dir, file), 'utf8'));
    const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
    // pri: the M4-M7 sheet header is spelled "Proirity".
    const c = { id: col('tc_id'), pri: Math.max(col('priority'), col('proirity')), mod: col('module'), sc: col('test scenario'), pre: col('precondition'), st: col('steps'), ex: col('expected result') };
    for (const r of rows) {
      const id = r[c.id]?.trim();
      if (id) map.set(id, { id, priority: r[c.pri] ?? '', module: r[c.mod] ?? '', scenario: r[c.sc] ?? '', precondition: r[c.pre] ?? '', steps: r[c.st] ?? '', expected: r[c.ex] ?? '' });
    }
  }
  return map;
}

/** Plain-language category for a Playwright error message. */
function classify(message: string): string {
  if (/low-contrast/i.test(message)) return 'Accessibility — colour contrast';
  if (/is covered by|outside the .* viewport|scrolls horizontally|overlap|cut off|clipped/i.test(message)) return 'Layout / responsive';
  if (/element\(s\) not found|element is not attached|strict mode violation/i.test(message)) return 'Element not found';
  if (/unexpected value|Expected:|Expected pattern:|Expected string:/.test(message)) return 'Assertion mismatch';
  if (/Test timeout|Timeout \d+ms exceeded/i.test(message)) return 'Timeout';
  if (/net::|ERR_|status code|5\d\d/i.test(message)) return 'Network / server';
  if (/expect\(|Expected|Received/.test(message)) return 'Assertion mismatch';
  return 'Error';
}

/**
 * User-facing steps (test.step, expect, page actions), with the failing ones marked.
 * Steps inside hooks/fixtures (browser launch, context setup, teardown) only appear if they failed.
 */
function flattenSteps(steps: TestStep[], depth = 0, out: Failure['steps'] = [], inSetup = false): Failure['steps'] {
  for (const s of steps) {
    const setup = inSetup || s.category === 'hook' || s.category === 'fixture';
    const relevant = setup ? Boolean(s.error) && s.category !== 'hook' && s.category !== 'fixture' : ['test.step', 'expect', 'pw:api'].includes(s.category);
    if (relevant) out.push({ title: s.title, depth, durationMs: s.duration, failed: Boolean(s.error) });
    if (depth < 2 && (s.category === 'test.step' || setup)) flattenSteps(s.steps, relevant ? depth + 1 : depth, out, setup);
  }
  return out;
}

function describeFailure(test: TestCase, result: TestResult, testCases: Map<string, TestCaseDoc>): Failure {
  const errors: TestError[] = result.errors.length ? result.errors : result.error ? [result.error] : [];
  const message = errors.map((e) => stripAnsi(e.message ?? e.value ?? '')).join('\n\n') || 'Failed without an error message';
  const first = errors[0];
  const lines = message.split('\n');
  const pick = (label: string) => lines.find((l) => new RegExp(`^\\s*${label}( string| pattern)?:`).test(l))?.replace(/^\s*\w+( string| pattern)?:\s*/, '');
  const use = test.parent.project()?.use ?? {};
  const all = flattenSteps(result.steps);
  const lastFail = all.map((s) => s.failed).lastIndexOf(true);
  const tcId = /\b(TC-\d+|UI-\d+|REG-\d+)\b/.exec(test.title)?.[1];
  return {
    type: classify(message),
    summary: lines.find((l) => l.trim() && !/^\s*(Call log|- )/.test(l))?.trim() ?? 'Failed',
    expected: pick('Expected'),
    findings: lines.filter((l) => /^\+\s{2,}\S/.test(l)).map((l) => l.replace(/^\+\s+/, '').replace(/,$/, '').replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"')),
    received: pick('Received'),
    message,
    location: first?.location ? `${path.relative(process.cwd(), first.location.file)}:${first.location.line}:${first.location.column}` : undefined,
    snippet: first?.snippet ? stripAnsi(first.snippet) : undefined,
    // keep the context around the failure, not hundreds of polling steps
    steps: all.slice(Math.max(0, (lastFail >= 0 ? lastFail : all.length) - 25), lastFail >= 0 ? lastFail + 3 : undefined),
    notes: test.annotations.filter((a) => a.description && !['skip', 'fixme'].includes(a.type)).map((a) => ({ type: a.type, description: a.description! })),
    environment: [
      `Project: ${test.parent.project()?.name ?? '—'}`,
      `Browser: ${use.browserName ?? use.defaultBrowserType ?? 'chromium'}`,
      use.viewport ? `Viewport: ${use.viewport.width}×${use.viewport.height}` : '',
      use.isMobile ? 'Mobile emulation' : '',
      `Attempt: ${result.retry + 1}`,
    ].filter(Boolean).join(' · '),
    testCase: tcId ? testCases.get(tcId) : undefined,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
const runIdOf = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
const fmtDate = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const fmtDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

/**
 * Writes the "Automation Report" HTML to tta-report/<runId>/index.html.
 *
 * Per test: suite (project), name, author, priority, tags, file:line, start/end, duration,
 * status, and links to its screenshot / video / trace. Those attachments are COPIED next to the
 * report (assets/), so the links keep working after Playwright cleans test-results/.
 *
 * Metadata sources:
 *   author   — annotation { type: 'author' }, else env REPORT_AUTHOR, else "TTA-QA"
 *   priority — tag @P0/@P1/@P2, else annotation { type: 'priority' }, else "—"
 *   smoke    — tag @smoke
 * Final status is the last attempt; a test that passed on retry is shown as passed with "(retry n)".
 */
export default class CustomTTAReporter implements Reporter {
  private rows = new Map<string, Row>();
  private config!: FullConfig;
  private started = new Date();
  private runId = runIdOf(this.started);
  // Two runs started in the same second must not overwrite each other's report.
  private outDir = (() => {
    let dir = path.resolve('tta-report', this.runId);
    for (let n = 2; fs.existsSync(dir); n++) dir = path.resolve('tta-report', `${this.runId}_${n}`);
    return dir;
  })();
  private browsers = new Set<string>();
  private testCases = new Map<string, TestCaseDoc>();

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    try { this.testCases = loadTestCases(); } catch { /* report still renders without test-case docs */ }
    for (const project of suite.suites) {
      const p = project.project();
      if (p && project.allTests().length) this.browsers.add(String(p.use.browserName ?? p.use.defaultBrowserType ?? 'chromium'));
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const project = test.parent.project();
    const annotation = (type: string) => test.annotations.find((a) => a.type === type)?.description;
    const priority = test.tags.map((t) => t.replace(/^@/, '').toUpperCase()).find((t) => /^P\d$/.test(t)) ?? annotation('priority') ?? '—';
    const status: Status = result.status === 'passed' ? 'passed' : result.status === 'skipped' ? 'skipped' : 'failed';
    const find = (pred: (name: string, type: string) => boolean) => result.attachments.find((a) => a.path && pred(a.name, a.contentType))?.path;

    this.rows.set(test.id, {
      id: test.id,
      suite: project?.name ?? '',
      title: test.title.replace(/\s*@\S+/g, '').trim(),
      titlePath: test.titlePath().slice(3, -1).join(' › '),
      author: annotation('author') ?? process.env.REPORT_AUTHOR ?? 'TTA-QA',
      priority,
      tags: test.tags,
      file: `${path.relative(process.cwd(), test.location.file)}:${test.location.line}`,
      start: result.startTime,
      end: new Date(result.startTime.getTime() + result.duration),
      durationMs: result.duration,
      status,
      retries: result.retry,
      skipReason: status === 'skipped'
        ? (test.annotations.find((a) => a.type === 'skip' || a.type === 'fixme')?.description ?? 'Skipped')
        : undefined,
      failure: status === 'failed' ? describeFailure(test, result, this.testCases) : undefined,
      notes: test.annotations.filter((a) => a.description && !['skip', 'fixme'].includes(a.type)).map((a) => ({ type: a.type, description: a.description! })),
      screenshot: find((_n, t) => t.startsWith('image/')),
      video: find((_n, t) => t.startsWith('video/')),
      trace: find((n) => n === 'trace'),
    });
  }

  onEnd(result: FullResult): void {
    const rows = [...this.rows.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
    fs.mkdirSync(path.join(this.outDir, 'assets'), { recursive: true });
    rows.forEach((row, index) => {
      // Unique per row: test ids share a per-file prefix, so naming by id prefix made every
      // failure in a file overwrite the previous one's screenshot/video.
      const base = `${String(index + 1).padStart(3, '0')}-${row.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 50).replace(/^-|-$/g, '')}`;
      for (const key of ['screenshot', 'video', 'trace'] as const) {
        const src = row[key];
        if (!src || !fs.existsSync(src)) {
          row[key] = undefined;
          continue;
        }
        const name = `${base}-${key}${path.extname(src)}`;
        fs.copyFileSync(src, path.join(this.outDir, 'assets', name));
        row[key] = `assets/${name}`;
      }
    });
    const file = path.join(this.outDir, 'index.html');
    fs.writeFileSync(file, this.render(rows, result));
    console.log(`\n[TTA report] ${path.relative(process.cwd(), file)}`);
  }

  /** The expandable "Failure details" panel for one failed test. */
  private renderFailure(r: Row, f: Failure): string {
    const tc = f.testCase;
    const testCase = tc ? `<section class="full"><h3>Test case ${esc(tc.id)} (${esc(tc.module)} · ${esc(tc.priority)})</h3><dl>
      <dt>Scenario</dt><dd>${esc(tc.scenario)}</dd>
      ${tc.precondition ? `<dt>Precondition</dt><dd>${esc(tc.precondition)}</dd>` : ''}
      <dt>Steps</dt><dd>${esc(tc.steps)}</dd>
      <dt>Expected</dt><dd>${esc(tc.expected)}</dd>
    </dl></section>` : '';
    const diff = f.expected || f.received ? `<section><h3>Expected vs received</h3><dl>
      ${f.expected ? `<dt>Expected</dt><dd class="exp">${esc(f.expected)}</dd>` : ''}
      ${f.received ? `<dt>Received</dt><dd class="rec">${esc(f.received)}</dd>` : ''}
    </dl></section>` : '';
    const findings = f.findings.length ? `<section><h3>What was found (${f.findings.length})</h3><ul class="findings">${f.findings.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : '';
    const where = f.location ? `<section><h3>Where it failed</h3><p class="mono" style="max-width:none;margin:0 0 8px">${esc(f.location)}</p>${f.snippet ? `<pre>${esc(f.snippet)}</pre>` : ''}</section>` : '';
    const steps = f.steps.length ? `<section><h3>Steps executed (last ${f.steps.length})</h3><ol class="steps">${f.steps.map((s) =>
      `<li class="${s.failed ? 'fail' : ''}" style="margin-left:${s.depth * 14}px">${s.failed ? '✗' : '✓'} ${esc(s.title)}<span class="ms">${s.durationMs}ms</span></li>`).join('')}</ol></section>` : '';
    const notes = f.notes.length ? `<section><h3>Notes recorded by the test</h3><dl>${f.notes.map((n) => `<dt>${esc(n.type)}</dt><dd>${esc(n.description)}</dd>`).join('')}</dl></section>` : '';
    const evidence = `<div class="side"><h3>Evidence</h3>${r.screenshot ? `<a href="${esc(r.screenshot)}" target="_blank"><img src="${esc(r.screenshot)}" alt="Screenshot at failure: ${esc(r.title)}" loading="lazy"></a>` : '<p class="none">No screenshot</p>'}
      ${r.video ? `<a class="art video" href="${esc(r.video)}" target="_blank">▶️ Play video</a>` : ''}${r.trace ? `<a class="art trace" href="${esc(r.trace)}" target="_blank">📁 Trace</a>` : ''}</div>`;
    return `<div class="fd">
  <div>
    <span class="type">${esc(f.type)}</span>
    <p class="summary">${esc(f.summary)}</p>
    <p class="muted" style="font-size:13px;margin:8px 0 0">${esc(f.environment)}</p>
    ${findings}${diff}${where}${steps}${notes}
    <section><h3>Full error</h3><pre>${esc(f.message.slice(0, 6000))}</pre></section>
  </div>
  ${evidence}
  ${testCase}
</div>`;
  }

  private render(rows: Row[], result: FullResult): string {
    const count = (s: Status) => rows.filter((r) => r.status === s).length;
    const total = rows.length;
    const passed = count('passed');
    const failed = count('failed');
    const skipped = count('skipped');
    const passRate = total ? ((passed / total) * 100).toFixed(1) : '0.0';
    const headed = this.config.projects.some((p) => p.use.headless === false) || process.env.HEADED === '1';
    let env = 'UNKNOWN';
    let lang = 'UNKNOWN';
    try { env = resolveEnvName(); } catch { /* reported as UNKNOWN */ }
    try { lang = languageByCode(resolveLanguage()).name; } catch { /* reported as UNKNOWN */ }

    const card = (value: string, label: string, cls: string) =>
      `<div class="card ${cls}"><div class="value">${esc(value)}</div><div class="label">${esc(label)}</div></div>`;
    const meta = (label: string, value: string, pill = false) =>
      `<div class="meta-item"><span class="meta-label">${esc(label)}</span>${pill ? `<span class="pill">${value}</span>` : `<span class="meta-value">${value}</span>`}</div>`;
    const link = (href: string | undefined, icon: string, text: string, cls: string, title = '') =>
      href ? `<a class="art ${cls}" href="${esc(href)}" target="_blank" title="${esc(title)}"><span>${icon}</span>${text}</a>` : '<span class="none">—</span>';

    const body = rows.map((r, i) => {
      const smoke = r.tags.includes('@smoke');
      const tags = r.tags.map((t) => `<span class="tag">${esc(t.toUpperCase())}</span>`).join('');
      const retry = r.retries ? ` <span class="retry">(retry ${r.retries})</span>` : '';
      const reason = r.skipReason ? `<div class="skip-reason">${esc(r.skipReason)}</div>` : '';
      const hasNotes = !r.failure && r.notes.length > 0;
      const toggle = r.failure
        ? `<button class="toggle" type="button" aria-expanded="false" data-target="d${i}" data-label="Failure details">▸ Failure details</button>`
        : hasNotes ? `<button class="toggle info" type="button" aria-expanded="false" data-target="d${i}" data-label="Details">▸ Details</button>` : '';
      return `<tr data-status="${r.status}" data-priority="${esc(r.priority)}" data-smoke="${smoke}" data-row="d${i}">
  <td class="muted">${i + 1}</td>
  <td>${esc(r.suite)}</td>
  <td class="name" title="${esc(r.titlePath)}">${esc(r.title)}${toggle}</td>
  <td>${esc(r.author)}</td>
  <td>${esc(r.priority)}</td>
  <td><div class="tags">${tags}</div></td>
  <td class="mono">${esc(r.file).replace(/([/.\-])/g, '$1<wbr>')}</td>
  <td class="time">${esc(fmtDate(r.start))}</td>
  <td class="time">${esc(fmtDate(r.end))}</td>
  <td class="dur">${fmtDuration(r.durationMs)}</td>
  <td><span class="status ${r.status}">${r.status.toUpperCase()}</span>${retry}${reason}</td>
  <td>${link(r.screenshot, '📷', ' View', 'shot')}</td>
  <td>${link(r.video, '▶️', 'Play', 'video')}</td>
  <td>${link(r.trace, '📁', 'View', 'trace', 'Trace zip: open with npx playwright show-trace <file>, or drop it on trace.playwright.dev')}</td>
</tr>${r.failure ? `\n<tr class="detail-row" id="d${i}" data-detail-for="d${i}" hidden><td colspan="14">${this.renderFailure(r, r.failure)}</td></tr>` : ''}${hasNotes ? `\n<tr class="detail-row info" id="d${i}" data-detail-for="d${i}" hidden><td colspan="14"><div class="nd">${r.notes.map((n) => `<h3>${esc(n.type)}</h3><pre>${esc(n.description)}</pre>`).join('')}</div></td></tr>` : ''}`;
    }).join('\n');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Automation Report ${esc(this.runId)}</title>
<style>
  :root { --green: #10b981; --green-dark: #047857; --teal: #0d9488; --red: #ef4444; --grey: #94a3b8; --ink: #1e293b; --muted: #64748b; --line: #e2e8f0; --bg: #ecfdf5; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, "Segoe UI", system-ui, -apple-system, sans-serif; color: var(--ink); background: var(--bg); }
  header { background: linear-gradient(120deg, #059669, #14b8a6 45%, #047857); color: #fff; text-align: center; padding: 44px 16px 40px; }
  header h1 { margin: 0; font-size: 34px; font-weight: 800; }
  header p { margin: 12px 0 0; opacity: .92; font-size: 16px; }
  main { max-width: 1560px; margin: 0 auto; padding: 30px 24px 70px; }
  .cards { display: grid; grid-template-columns: repeat(6, 1fr); gap: 20px; }
  .card { background: #fff; border-radius: 14px; padding: 22px 26px; box-shadow: 0 4px 14px rgba(15, 23, 42, .06); border-left: 4px solid var(--green); }
  .card.failed { border-left-color: var(--red); } .card.skipped { border-left-color: var(--grey); } .card.total, .card.rate, .card.duration { border-left-color: var(--green-dark); }
  .card .value { font-size: 36px; font-weight: 800; } .card .label { margin-top: 6px; font-size: 13px; letter-spacing: .08em; color: var(--muted); text-transform: uppercase; }
  .panel { background: #fff; border-radius: 14px; box-shadow: 0 4px 14px rgba(15, 23, 42, .06); padding: 18px 24px; margin-top: 26px; display: flex; flex-wrap: wrap; align-items: center; gap: 14px 20px; }
  .meta-item { display: flex; align-items: center; gap: 8px; font-size: 15px; }
  .meta-label { font-size: 12px; font-weight: 700; letter-spacing: .05em; color: var(--muted); text-transform: uppercase; }
  .meta-value { font-weight: 600; }
  .pill { background: var(--green); color: #fff; border-radius: 999px; padding: 6px 16px; font-size: 13px; font-weight: 700; text-transform: uppercase; }
  .pill.light { background: #f1f5f9; color: var(--ink); border: 1px solid var(--line); }
  .filters { gap: 12px; }
  .filters .group-label { font-weight: 800; font-size: 14px; letter-spacing: .04em; margin-right: 4px; }
  .filters .gap { width: 22px; }
  .chk { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--line); border-radius: 999px; padding: 8px 16px; cursor: pointer; font-size: 14px; user-select: none; }
  .chk:has(input:checked) { border-color: var(--green); color: var(--green-dark); background: #f0fdf9; }
  .chk input { width: 16px; height: 16px; accent-color: var(--green); margin: 0; }
  .table-wrap { margin-top: 26px; border-radius: 14px; overflow: auto; box-shadow: 0 4px 14px rgba(15, 23, 42, .06); background: #fff; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  thead th { background: #1e293b; color: #fff; text-align: left; font-size: 12px; letter-spacing: .06em; padding: 18px 12px; white-space: nowrap; text-transform: uppercase; }
  tbody td { padding: 16px 12px; border-top: 1px solid var(--line); vertical-align: middle; }
  tbody tr:hover { background: #f8fafc; }
  .muted { color: var(--muted); } .name { font-weight: 600; min-width: 220px; } .mono { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: var(--muted); max-width: 190px; }
  .time { font-size: 13px; color: var(--muted); max-width: 120px; } .dur { font-weight: 700; text-align: center; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag { border: 1.5px solid var(--green); color: var(--green-dark); border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 700; white-space: nowrap; }
  .status { border-radius: 999px; padding: 7px 14px; font-size: 12px; font-weight: 800; white-space: nowrap; }
  .status.passed { background: #d1fae5; color: #047857; } .status.failed { background: #fee2e2; color: #b91c1c; } .status.skipped { background: #e2e8f0; color: #334155; }
  .retry { font-size: 11px; color: var(--muted); }
  .skip-reason { margin-top: 8px; max-width: 220px; font-size: 12px; line-height: 1.35; color: var(--muted); }
  .art { display: inline-flex; flex-direction: column; align-items: center; text-decoration: none; border-radius: 8px; padding: 7px 12px; font-size: 13px; font-weight: 600; white-space: nowrap; }
  .art.shot { flex-direction: row; background: #f0fdf4; color: #047857; } .art.video { background: #fef3c7; color: #b45309; } .art.trace { background: #ede9fe; color: #7c3aed; }
  .none { color: var(--grey); }
  .toggle { display: block; margin-top: 8px; border: 1px solid #fecaca; background: #fef2f2; color: #b91c1c; border-radius: 999px; padding: 4px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
  .toggle[aria-expanded="true"] { background: #b91c1c; color: #fff; }
  .toggle.info { border-color: #a7f3d0; background: #f0fdf4; color: #047857; } .toggle.info[aria-expanded="true"] { background: #047857; color: #fff; }
  .detail-row.info > td { background: #f6fefb; }
  .nd { border: 1px solid #a7f3d0; border-left: 4px solid var(--green); border-radius: 12px; background: #fff; padding: 16px 22px; }
  .nd h3 { margin: 12px 0 6px; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); } .nd h3:first-child { margin-top: 0; }
  .nd pre { margin: 0; white-space: pre-wrap; font-size: 13px; line-height: 1.6; }
  tbody tr.detail-row:hover { background: transparent; }
  .detail-row > td { background: #fff7f7; border-top: 0; padding: 0 12px 22px; }
  .fd { border: 1px solid #fecaca; border-left: 4px solid var(--red); border-radius: 12px; background: #fff; padding: 20px 24px; display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 22px 28px; }
  .fd h3 { margin: 0 0 8px; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  .fd .type { display: inline-block; background: #fee2e2; color: #b91c1c; border-radius: 999px; padding: 4px 12px; font-size: 12px; font-weight: 800; margin-bottom: 8px; }
  .fd .summary { font-size: 16px; font-weight: 700; line-height: 1.4; margin: 0; }
  .fd dl { display: grid; grid-template-columns: 110px 1fr; gap: 6px 14px; margin: 0; font-size: 13px; }
  .fd dt { color: var(--muted); font-weight: 700; } .fd dd { margin: 0; white-space: pre-wrap; }
  .fd .exp { color: #047857; } .fd .rec { color: #b91c1c; }
  .fd pre { margin: 0; white-space: pre-wrap; font-size: 12px; background: #f8fafc; border: 1px solid var(--line); padding: 12px; border-radius: 8px; max-height: 300px; overflow: auto; }
  .fd ol.steps { margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; max-height: 300px; overflow: auto; }
  .fd ol.steps li.fail { color: #b91c1c; font-weight: 700; } .fd ol.steps .ms { color: var(--grey); font-size: 11px; margin-left: 6px; }
  .fd .side img { width: 100%; border: 1px solid var(--line); border-radius: 8px; display: block; }
  .fd .side .art { margin: 10px 8px 0 0; }
  .fd .full { grid-column: 1 / -1; } .fd section { margin-top: 18px; } .fd .full { margin-top: 0; }
  .fd ul.findings { margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #b91c1c; }
  @media (max-width: 1100px) { .fd { grid-template-columns: 1fr; } }
  tr.hidden { display: none; }
  .empty { padding: 30px; text-align: center; color: var(--muted); }
  footer { background: linear-gradient(90deg, #1e293b, #334155); color: #fff; text-align: center; padding: 36px 16px; font-size: 15px; }
  @media (max-width: 1100px) { .cards { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 640px) { .cards { grid-template-columns: repeat(2, 1fr); } main { padding: 20px 16px 50px; } }
</style>
</head>
<body>
<header>
  <h1>🎭 Automation Report</h1>
  <p>Playwright Framework</p>
</header>
<main>
  <section class="cards">
    ${card(String(total), 'Total Tests', 'total')}
    ${card(String(passed), 'Passed', 'passed')}
    ${card(String(failed), 'Failed', 'failed')}
    ${card(String(skipped), 'Skipped', 'skipped')}
    ${card(`${passRate}%`, 'Pass Rate', 'rate')}
    ${card(fmtDuration(result.duration), 'Duration', 'duration')}
  </section>

  <section class="panel">
    ${meta('Environment', `🌐 ${esc(env)}`, true)}
    ${meta('Language', `🗣️ ${esc(lang)}`, true)}
    ${meta('Mode', headed ? '🖥️ Headed' : '⚙️ Headless', true)}
    ${meta('Browser', [...this.browsers].map((b) => `<span class="pill light">🌍 ${esc(b.toUpperCase())}</span>`).join(' ') || '—')}
    ${meta('Platform', esc(os.type() === 'Darwin' ? 'macOS' : os.type() === 'Windows_NT' ? 'Windows' : os.type()))}
    ${meta('Workers', String(this.config.workers))}
    ${meta('Run ID', `<span class="mono" style="color:var(--ink);font-size:13px">${esc(this.runId)}</span>`)}
    ${meta('Started', esc(fmtDate(this.started)))}
  </section>

  <section class="panel filters">
    <span class="group-label">🏷️ PRIORITY:</span>
    <label class="chk"><input type="checkbox" data-group="priority" value="all" checked>All</label>
    <label class="chk"><input type="checkbox" data-group="priority" value="P0">P0</label>
    <label class="chk"><input type="checkbox" data-group="priority" value="P1">P1</label>
    <label class="chk"><input type="checkbox" data-group="priority" value="smoke">Smoke</label>
    <span class="gap"></span>
    <span class="group-label">📊 STATUS:</span>
    <label class="chk"><input type="checkbox" data-group="status" value="all" checked>All</label>
    <label class="chk"><input type="checkbox" data-group="status" value="passed">✅ Passed</label>
    <label class="chk"><input type="checkbox" data-group="status" value="failed">❌ Failed</label>
    <label class="chk"><input type="checkbox" data-group="status" value="skipped">⏭️ Skipped</label>
  </section>

  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>S.No</th><th>Suite</th><th>Test Name</th><th>Author</th><th>Priority</th><th>Tags</th><th>File</th>
        <th>Start Time</th><th>End Time</th><th>Duration</th><th>Status</th><th>Screenshot</th><th>Video</th><th>Trace</th>
      </tr></thead>
      <tbody>
${body}
      </tbody>
    </table>
    <div class="empty" id="empty" ${rows.length ? 'hidden' : ''}>No tests match the selected filters.</div>
  </div>
</main>
<footer>Playwright Test Automation Framework</footer>
<script>
  // Filters: "All" in a group clears the others; unchecking everything falls back to "All".
  // Rows are shown when they match ANY selected value in EACH group.
  const boxes = [...document.querySelectorAll('input[data-group]')];
  const selected = (group) => boxes.filter((b) => b.dataset.group === group && b.checked).map((b) => b.value);
  function apply() {
    const pri = selected('priority'), st = selected('status');
    let shown = 0;
    for (const row of document.querySelectorAll('tbody tr[data-row]')) {
      const okP = pri.includes('all') || pri.includes(row.dataset.priority) || (pri.includes('smoke') && row.dataset.smoke === 'true');
      const okS = st.includes('all') || st.includes(row.dataset.status);
      row.classList.toggle('hidden', !(okP && okS));
      const detail = document.getElementById(row.dataset.row);
      if (detail) detail.classList.toggle('hidden', !(okP && okS));
      if (okP && okS) shown++;
    }
    document.getElementById('empty').hidden = shown > 0;
  }
  for (const btn of document.querySelectorAll('.toggle')) {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = (open ? '▾' : '▸') + ' ' + btn.dataset.label;
      document.getElementById(btn.dataset.target).hidden = !open;
    });
  }
  for (const box of boxes) {
    box.addEventListener('change', () => {
      const group = boxes.filter((b) => b.dataset.group === box.dataset.group);
      const all = group.find((b) => b.value === 'all');
      if (box.value === 'all' && box.checked) group.forEach((b) => { if (b !== all) b.checked = false; });
      else if (box.checked) all.checked = false;
      if (!group.some((b) => b.checked)) all.checked = true;
      apply();
    });
  }
  apply();
</script>
</body>
</html>
`;
  }
}
