# ALL App — UI Automation (Playwright + TypeScript)

End-to-end tests for the **ALL** learning app (new UI), covering:

| Area | Test cases | Where |
|---|---|---|
| Discovery (login, mic check, assessment, placement) | TC-001 … TC-013 | `src/tests/discovery/discovery.spec.ts` |
| Foundation F1 / F2 / F3 (Letter Train, Letter Hunt, Letter Launcher, Memory Challenge) | TC-013 … TC-022 | `src/tests/discovery/foundation-f1/f2/f3.spec.ts` |
| Mastery M4 – M7 (Read Aloud, Self-Paced Reading, S1/S2 showcases) | REG-054 … REG-072 | `src/tests/discovery/mastery-m4…m7.spec.ts` |
| Mastery M8 – M9 (paragraph reading, network failures, course complete) | REG-073 … REG-080 | `src/tests/discovery/mastery-m8/m9.spec.ts` |
| Responsive / UI-UX checks on 7 device profiles | UI-01 … UI-17 | `src/tests/responsive/*.spec.ts` |

The test-case sheets (CSV) are in `testcase/`. The HTML report pulls each test's scenario, steps and expected result from them, matched by the ID in the test title (`TC-…`, `UI-…`, `REG-…`).

Default environment: **https://axl-test.the-axl.ai** (English).

---

## 1. One-time setup

Requirements: **Node.js 18+** and npm, on Linux, macOS or Windows.

```bash
cd /home/nd/New-ui-automation/All

# 1. Install the project's packages
npm install

# 2. Install the browsers Playwright drives
npx playwright install chromium firefox webkit

# 3. (Linux, optional) system libraries WebKit needs — needs sudo, run once.
#    Without this, run the WebKit profile in Chromium instead (WEBKIT_FALLBACK=chromium, see §5).
sudo npx playwright install-deps webkit

# 4. Settings file
cp .env.example .env        # defaults already point at axl-test, English

# 5. Check the code compiles
npm run typecheck
```

No login details are needed: every run creates fresh **guest** learners itself.

---

## 2. Quick reference — commands

Run all commands from the project folder (`/home/nd/New-ui-automation/All`).

| What | Command | Approx. time |
|---|---|---|
| **Everything functional** (Discovery + Foundation + Mastery) in desktop Chromium | `npm test` | 2 h + |
| Only tests tagged `@regression` | `npm run regression` | 2 h + |
| Discovery only | `npx playwright test --project=chromium src/tests/discovery/discovery.spec.ts` | 10 min |
| Foundation F1–F3 | `npm run foundation` | 35 min |
| **Mastery M4–M9** (27 cases) | `npm run mastery` | 60 min |
| Mastery responsive (UI-13 … UI-17, 7 devices) | `npm run mastery:responsive` | 7 min |
| **Mastery functional + responsive, one report** | `npm run mastery:full` | 70–80 min |
| All responsive checks (UI-01 … UI-17, 7 devices) | `npm run responsive` | 15 min |
| Responsive without WebKit system libraries | `npm run responsive:no-webkit-deps` | 15 min |
| Watch the browser while it runs | add `--headed`, e.g. `npm run mastery -- --headed` | — |
| Open Playwright's own report | `npm run report` | — |
| Type-check the code | `npm run typecheck` | 10 s |

Add Playwright options after `--`, for example:

```bash
npm run mastery -- --headed                         # show the browser
npm run mastery -- -g "REG-055"                     # only tests whose title contains REG-055
npm run mastery -- src/tests/discovery/mastery-m8.spec.ts   # one milestone only
```

---

## 3. Running one test case or one file

```bash
# One file
npx playwright test --project=chromium src/tests/discovery/mastery-m4.spec.ts --workers=1

# One test case by its ID (anything in the title works with -g)
npx playwright test --project=chromium -g "REG-059" --workers=1
npx playwright test --project=chromium -g "TC-005"

# Several IDs
npx playwright test --project=chromium -g "REG-068|REG-072" --workers=1

# List the tests a command would run, without running them
npx playwright test --project=chromium src/tests/discovery/mastery-m --list
```

`--project=chromium` is required for functional tests (the device projects only run responsive specs).
Use `--workers=1` for Foundation and Mastery: their tests within a file depend on each other (serial journey).

---

## 4. Environment and language

Set in `.env`, or on the command line in front of the command.

| Variable | Values | Default | Meaning |
|---|---|---|---|
| `ENV` (or `TEST_ENV`) | `axl-test`, `UAT`, `LAB`, `LAB2` | `axl-test` | Which server to test (`config/environments.ts`, case-insensitive) |
| `BASE_URL` | any URL | — | Overrides `ENV` |
| `TEST_LANG` (or `APP_LANG`) | `en`, `hi`, `te`, `kn` | `en` | App language for the run |
| `WEBKIT_FALLBACK` | `chromium` | — | Run the "laptop-webkit" profile in Chromium when WebKit libraries are missing |
| `CI` | any | — | Set by CI: 1 retry and 1 worker |

| Environment | URL |
|---|---|
| AXL-TEST (default) | https://axl-test.the-axl.ai |
| UAT | https://all-uat.theall.ai |
| LAB / LAB2 | placeholders — set the real URLs in `config/environments.ts` (or use `BASE_URL`) |

```bash
ENV=UAT npm run regression            # another environment
npm run e2e:uat                       # same, via the wrapper script
TEST_LANG=hi npm run e2e              # Hindi
npm run e2e -- --env LAB --lang te    # wrapper: any env + language
```

Mastery tests check English reading content and skip themselves for other languages.

---

## 5. Responsive (UI/UX) checks

Responsive specs run on 7 device profiles (Playwright "projects"):

| Project | Device | Engine |
|---|---|---|
| `phone-android` | Pixel 5 | Chromium |
| `phone-ios` | iPhone 13 | WebKit* |
| `tablet-ios` | iPad (gen 7) | WebKit* |
| `laptop-chromium` / `laptop-firefox` / `laptop-webkit` | Laptop 1280×720 | Chromium / Firefox / WebKit* |
| `desktop-chromium` | Desktop 1920×1080 | Chromium |

\* If WebKit's system libraries are not installed, run with `WEBKIT_FALLBACK=chromium` (keeps the device size, touch and user agent; uses Chromium to render).

```bash
npm run responsive                                   # all UI-01 … UI-17
WEBKIT_FALLBACK=chromium npm run responsive          # same, without WebKit libraries
npm run responsive -- --project=phone-android        # one device only
npm run mastery:responsive                           # only the Mastery screens (UI-13 … UI-17)
```

Checks: no sideways scrolling, controls usable without scrolling, tap targets ≥ 44 px, no overlapping or clipped text, WCAG AA text contrast. A test skipped with "Runs on phone, tablet only" is intentional — each check runs on the devices the UI/UX test plan lists for it.

The `responsive-setup` project runs first automatically and saves two guest sessions to `.auth/` (they expire after about a day; every run makes new ones).

---

## 6. Reports

Every run writes a **new** report folder (nothing is overwritten):

```
tta-report/<YYYYMMDD_HHMMSS>/index.html
```

Open it in a browser (or from VS Code: right-click → *Open with Live Server* / *Reveal in File Explorer*). The path is also printed at the end of each run: `[TTA report] tta-report/…/index.html`.

What it contains:

- Summary cards (total / passed / failed / skipped) and run details (environment, browser, duration).
- Filters by **Priority** and **Status**.
- One row per test: ID, title, project/device, duration, status, and **Screenshot / Video / Trace** links (kept for failed tests; each test has its own files under `assets/`).
- **▸ Failure details** on failed rows: plain-language summary, expected vs received, where it failed (code snippet), the steps executed, and the test case from the CSV sheet.
- **▸ Details** on passed rows: what was played/checked, and **sheet mismatch** notes where the app intentionally differs from the sheet.
- Skipped rows show the reason.

Playwright's standard report is also written to `playwright-report/` (`npm run report` opens it).
To inspect a failure step by step: `npx playwright show-trace <path to trace.zip>` (the path is in the report row).

---

## 7. How the tests work (what to know before reading results)

- **Fresh guest learners.** Discovery and each Foundation/Mastery file create a new guest on the server, so runs never depend on a shared account. Creating a guest takes 1–2 minutes.
- **Fake microphone and speech.** Chromium uses a generated voice-like WAV (`src/testdata/audio/fake-voice.wav`, created automatically) as the microphone, and the browser's speech recogniser is replaced by a stub that "hears" what the test sets (the correct sentence, wrong words, or nothing). See `src/utils/fakeMedia.ts`.
- **Starting at a stage.** Foundation F2/F3 and Mastery M4–M9 open the new guest directly on that stage by adjusting two server answers inside the test browser only (`src/utils/stageOverride.ts`). The server's real data is untouched.
- **S1 / S2 verdicts are stubbed.** Showcase steps are scored by the server from the recorded audio, which the fake voice cannot pass. The tests set the server's verdict (pass/fail) and check how the app reacts: screens, routing, hearts, saved progress (`src/utils/showcaseVerdict.ts`). The server's speech scoring itself is not tested here.
- **Serial journeys.** Inside a Foundation/Mastery file, tests run in order on one learner (P1 → … → S2). If one fails, the remaining tests in that journey are skipped.

### Where the app and the sheets differ (tests check the app; the report notes the difference)

| Sheet | Sheet says | This build |
|---|---|---|
| REG-056/062/065/070 | S1 FAIL → P5 | S1 FAIL → **P1** (app config `failRedirectStepId: "p1-p2"`) |
| REG-059/063/066/071 | P1 → S1 → next milestone | S1 pass → P7; **S2** completes the milestone |
| REG-057 | Word Wall after S1 | No Word Wall step in M4–M8 (test skipped with reason) |
| REG-067 | M7 text moves bottom-to-top | Static paragraph |
| REG-077 | M9 image with highlighted paragraph | Plain text paragraph |
| REG-079 | Reach M10 | No M10; M9 ends with the course-complete screen |
| TC-002 | Help-language popup | Removed from the new UI (skipped) |

### Known app defects the tests report as failures

- **REG-079** — course-complete screen shows the raw key `COURSE_COMPLETE_SUBTITLE` and has no button to leave it.
- **REG-080** — when speech evaluation fails because of the network, S1 counts it as a misread ("You lost a heart") instead of showing a network message.
- **UI-12 / UI-14 / UI-15 / UI-16** — text contrast below WCAG AA (grey hint text such as "Read this aloud", upcoming step pills).

---

## 8. Project layout

```
All/
├── config/                 environments.ts (ENV → URL), language.ts (TEST_LANG)
├── testcase/               test-case sheets (CSV) — source of IDs shown in the report
├── src/
│   ├── fixtures/           appTest (language + fake speech), responsiveTest (device profile, runOn)
│   ├── pages/              page objects
│   │   ├── discovery/      LoginPage, MicTestPage, AssessmentPage, PlacementPage, RoadmapPage, LanguagePicker
│   │   ├── foundation/     FoundationPage — game engine for F1–F3
│   │   ├── mastery/        MasteryPage — reading engine for M4–M9
│   │   └── common/         AppHeader
│   ├── tests/
│   │   ├── discovery/      discovery, foundation-f1..f3, mastery-m4..m9 specs (+ masterySuite.ts, shared)
│   │   └── responsive/     UI-01 … UI-17 + guest-sessions.setup.ts
│   ├── utils/              guestSession, stageOverride, showcaseVerdict, fakeMedia, layoutAudit,
│   │                       UiCopy (on-screen text per language), CustomTTAReporter (HTML report)
│   └── testdata/           audio + per-language data
├── scripts/                run-e2e.js (env/lang wrapper), run-full-e2e-parallel.js, language checks
├── docs/                   BUILD_HISTORY.md, architecture notes, language onboarding
├── .github/workflows/      CI (playwright.yml, smoke-tests.yml)
├── playwright.config.ts    projects (chromium + 7 devices), reporters, timeouts
└── tta-report/             generated reports (one folder per run)
```

Generated folders you can delete at any time: `tta-report/`, `playwright-report/`, `test-results*/`, `.auth/`.

---

## 9. CI (GitHub Actions)

`.github/workflows/playwright.yml` installs dependencies and Chromium, type-checks, then runs the `@regression` suite against `ENV` (repository variable, default `axl-test`). In CI, tests retry once and run on one worker.

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| `browserType.launch: Executable doesn't exist` | `npx playwright install chromium firefox webkit` |
| WebKit fails to start (missing libraries) | `sudo npx playwright install-deps webkit`, or run with `WEBKIT_FALLBACK=chromium` |
| `401` / guest suddenly logged out | Saved sessions expired — just rerun; new guests are created automatically. Delete `.auth/` if it persists. |
| Guest creation times out | Server busy — rerun; avoid running several suites in parallel (use `--workers=1`). |
| A whole Mastery file skipped after one failure | Expected: the journey is serial. Fix/inspect the first failure (trace link in the report). |
| Report shows an old run | Each run makes a new `tta-report/<timestamp>/` folder — open the newest one. |
| Want to see what the test does | Add `--headed` (and `--workers=1`), or open the trace: `npx playwright show-trace <trace.zip>`. |
