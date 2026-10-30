import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from '../../fixtures/appTest';
import { RoadmapPage } from '../../pages/discovery/RoadmapPage';
import { describeSteps } from '../../pages/foundation/FoundationPage';
import type { AppLanguage } from '../../utils/languages';
import { MasteryLevel, MasteryPage, MasteryStepResult } from '../../pages/mastery/MasteryPage';
import { newSharedAppPage } from '../../utils/DiscoveryHelper';
import { mintGuestSession, StorageState } from '../../utils/guestSession';
import { stubShowcaseVerdict } from '../../utils/showcaseVerdict';
import { overrideStage, StageHandle } from '../../utils/stageOverride';

/**
 * Mastery M4–M9 regression (testcase/M4-M7 - Sheet1.csv, testcase/M8-M9 - Sheet1.csv), shared by mastery-m4…m9.spec.ts.
 *
 * Each file mints ONE fresh guest and opens it on its milestone (stageOverride.ts), so runs are
 * repeatable. Three journeys, each in its own browser context:
 *   journey     P1 → … → S2 → "Milestone N Complete!" → roadmap on the next milestone
 *   S1 fail     opened on S1, the learner misreads every item (5 hearts) → back to practice
 *   P1 errors   (M7) wrong reading and a silent mic on P1 items
 *   network     (M8/M9) offline during practice, failed speech evaluation during S1
 * Showcase (S1/S2) verdicts are decided by the server from the audio, which the fake voice cannot
 * pass, so they are stubbed (showcaseVerdict.ts); everything else is the real app and content.
 *
 * Where the sheet and this build disagree, tests check the BUILD and say so in an annotation:
 *   - S1 FAIL returns to P1 (config failRedirectStepId "p1-p2"); the sheet says P5.
 *   - S1 PASS continues to P7; the next milestone needs S2 too (sheet: "P1 → S1 → M5").
 *   - No Word Wall step exists in M4–M8; M7 paragraphs do not move bottom-to-top.
 *   - M9 P1 is a plain paragraph (no image, no highlighting); there is no M10 — M9 ends the course.
 */
export interface MasterySheetCases {
  level: MasteryLevel;
  /** Milestone reached after S2, or null when this is the last one (course-complete screen). */
  next: string | null;
  /** P1 Read Aloud: text shown with the timer, read within time (REG-054/061/064/067). */
  readP1: string;
  /** M7–M9: the text is a paragraph (REG-067/073/077). */
  paragraph?: boolean;
  /** What the sheet expects of P1 that this build does not have: title suffix + report note. */
  readP1Mismatch?: { title: string; note: string };
  /** M4: modules cannot be skipped (REG-060). */
  noSkip?: string;
  /** S1 pass (REG-055/069). Without it, the full-pass test plays S1 itself. */
  s1Pass?: string;
  /** M4: Word Wall after S1 (REG-057) — not in this build. */
  wordWall?: string;
  /** S2 pass (REG-058). Without it, the full-pass test plays S2 itself. */
  s2Pass?: string;
  /** Full pass → next milestone (REG-059/063/066/071). */
  fullPass: string;
  /** S1 FAIL → back to practice (REG-056/062/065/070). */
  s1Fail?: string;
  /** M7: incorrect pronunciation is rejected in P1 (REG-068). */
  wrongReading?: string;
  /** M7: timeout while speaking (REG-072). */
  speakTimeout?: string;
  /** M8: network lost during practice reading (REG-076). */
  networkPractice?: string;
  /** M9: network lost during S1 speech evaluation (REG-080). */
  networkShowcase?: string;
}

const S1_ROUTE_NOTE = 'Sheet expects P5; this build sends S1 FAIL back to P1 (app config failRedirectStepId "p1-p2").';

export function defineMasterySuite(cases: MasterySheetCases): void {
  const { level, next } = cases;
  let guest: StorageState;

  test.beforeAll(async () => {
    test.setTimeout(8 * 60_000); // guest minting, incl. one retry
    guest = await mintGuestSession('roadmap');
  });

  test.beforeEach(async ({ lang }) => {
    test.skip(lang.code !== 'en', 'Mastery reading content and copy are checked in English');
  });

  /** Fresh context for the guest, opened on `lesson` of this milestone. */
  async function openOnMilestone(browser: Parameters<typeof newSharedAppPage>[0], testInfo: Parameters<typeof newSharedAppPage>[1], lesson = 0) {
    const { context, page } = await newSharedAppPage(browser, testInfo, guest);
    const stage = await overrideStage(context, { stage: level, lesson, followPromotion: true });
    return { context, page, stage };
  }

  async function startMilestone(page: Page, lang: AppLanguage) {
    await page.goto('/roadmap');
    const roadmap = new RoadmapPage(page, lang);
    await roadmap.expectActiveStage(level);
    await roadmap.startStageActivity(level);
  }

  function attachSteps(steps: MasteryStepResult[]) {
    test.info().annotations.push({ type: 'nodes played', description: describeSteps(steps) });
  }

  // ------------------------------------------------------------------
  // P1 error handling (M7)
  // ------------------------------------------------------------------
  if (cases.wrongReading || cases.speakTimeout) {
    test.describe(`${level} P1 reading errors`, () => {
      test.describe.configure({ mode: 'serial' });
      let context: BrowserContext;
      let page: Page;
      let mastery: MasteryPage;

      test.beforeAll(async ({ browser, lang }, testInfo) => {
        ({ context, page } = await openOnMilestone(browser, testInfo));
        mastery = new MasteryPage(page, lang);
        await startMilestone(page, lang);
        await mastery.steps.expectStepIntro('P1', /Read Aloud/i);
        await mastery.steps.startCurrentStep();
      });

      test.afterEach(async ({}, testInfo) => {
        if (testInfo.status !== testInfo.expectedStatus) {
          await testInfo.attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' });
        }
      });

      test.afterAll(async () => {
        await context?.close();
      });

      if (cases.wrongReading) {
        test(`${cases.wrongReading} ${level} P1 rejects an incorrect reading: try again, read along, final try @regression`, async () => {
          await mastery.expectReadingItem();
          const text = await mastery.cardText();
          test.info().annotations.push({ type: 'item', description: text });

          const first = await mastery.readCurrentItem('wrong');
          expect(first.percent, 'a wrong reading scores 0%').toBe(0);
          expect(first.action).toMatch(/try again/i);
          await expect(mastery.wrongWords(), 'misread words are marked red').toHaveCount(await mastery.words().count());

          await mastery.clickAction(/try again/i);
          await expect(page.locator('body')).toContainText(/try 2/i);
          await expect(mastery.hint()).toHaveText(/watch the red words/i);
          const second = await mastery.readCurrentItem('wrong');
          expect(second.percent).toBe(0);
          expect(second.action).toMatch(/read along/i);

          await mastery.clickAction(/read along/i);
          await expect(page.locator('body')).toContainText(/read along/i);
          await mastery.clickAction(/now i'?ll read/i);
          await expect(page.locator('body')).toContainText(/final try/i);
          const last = await mastery.readCurrentItem('wrong');
          expect(last.percent).toBe(0);
          expect(last.action, 'after the final try the learner moves on').toMatch(/next/i);
          test.info().annotations.push({ type: 'feedback', description: [first, second, last].map((f) => `${f.percent}% ${f.headline} → ${f.action}`).join('\n') });

          await mastery.clickAction(/^\s*next/i);
          await expect(page.locator('body')).toContainText(/2 \/ 10/);
          expect(await mastery.cardText(), 'next item is a new text').not.toBe(text);
        });
      }

      if (cases.speakTimeout) {
        test(`${cases.speakTimeout} ${level} P1 handles a timeout while speaking (mic hears nothing) @regression`, async () => {
          await mastery.expectReadingItem();
          const started = Date.now();
          const pending = mastery.readCurrentItem('silent');
          await expect(mastery.countdown(), 'recording countdown is shown').toHaveText(/00:\d\d/);
          const feedback = await pending;
          const seconds = Math.round((Date.now() - started) / 1000);
          test.info().annotations.push({ type: 'timeout', description: `"${feedback.headline}" after ${seconds}s → ${feedback.action}` });

          expect(seconds, 'recording stops at the 20 s limit').toBeGreaterThanOrEqual(15);
          await expect(page.locator('body')).toContainText(/couldn.t hear/i);
          expect(feedback.action).toMatch(/try again/i);

          await mastery.clickAction(/try again/i);
          await expect(mastery.micButton(), 'the learner can read again').toBeEnabled();
          const retry = await mastery.readCurrentItem('correct');
          expect(retry.percent).toBe(100);
        });
      }
    });
  }

  // ------------------------------------------------------------------
  // Journey: P1 → S2 → next milestone
  // ------------------------------------------------------------------
  test.describe(`${level} journey`, () => {
    test.describe.configure({ mode: 'serial' });
    let context: BrowserContext;
    let page: Page;
    let stage: StageHandle;
    let mastery: MasteryPage;
    let showcase: Awaited<ReturnType<typeof stubShowcaseVerdict>>;
    const played = new Set<string>();

    test.beforeAll(async ({ browser, lang }, testInfo) => {
      ({ context, page, stage } = await openOnMilestone(browser, testInfo));
      showcase = await stubShowcaseVerdict(context, 'pass');
      mastery = new MasteryPage(page, lang);
    });

    test.afterEach(async ({}, testInfo) => {
      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' });
      }
    });

    test.afterAll(async () => {
      await context?.close();
    });

    async function play(nodes: string[]): Promise<MasteryStepResult[]> {
      const steps = await mastery.playNodes(nodes);
      nodes.forEach((n) => played.add(n));
      attachSteps(steps);
      return steps;
    }

    async function expectShowcasePassed(step: MasteryStepResult, node: 'S1' | 'S2') {
      expect(step.node).toBe(node);
      expect(step.outcome, `${node} verdict`).toBe('pass');
      expect(step.notes.join(' ')).toContain(`${node} passed`);
      expect(Math.min(...step.scores), `every ${node} item ≥ 80%`).toBeGreaterThanOrEqual(80);
    }

    const readTitle = `${cases.readP1} ${level} P1 shows the ${cases.paragraph ? 'paragraph' : 'sentence'} with the timer and the learner reads it in time`
      + `${cases.readP1Mismatch ? ` (${cases.readP1Mismatch.title})` : ''} @regression`;

    test(readTitle, async ({ lang }) => {
      test.setTimeout(15 * 60_000);
      test.info().annotations.push({ type: 'setup', description: `Fresh guest opened on ${level} via stage override (stageOverride.ts).` });
      await startMilestone(page, lang);
      await mastery.steps.expectStepIntro('P1', /Read Aloud/i);
      await mastery.steps.startCurrentStep();

      await mastery.expectReadingItem();
      await expect(mastery.hint()).toHaveText(/read this aloud/i);
      await expect(mastery.controlLabel()).toHaveText(/tap the mic, then read/i);
      const text = await mastery.cardText();
      const timer = (await mastery.timerChip().innerText()).trim();
      test.info().annotations.push({ type: 'item', description: `${text} (${timer})` });
      if (cases.paragraph) {
        expect(text.split(/(?<=[.!?]["”]?)\s+/).length, `${level} shows a paragraph (several sentences)`).toBeGreaterThan(1);
      } else {
        expect(await mastery.words().count(), 'a sentence of several words').toBeGreaterThan(2);
      }
      if (cases.readP1Mismatch) {
        const card = await mastery.readingCard().evaluate((el) => {
          const style = getComputedStyle(el);
          return `animation ${style.animationName}, transform ${style.transform}, images ${el.querySelectorAll('img, picture, canvas').length}, highlights ${el.querySelectorAll('mark, [class*="ighlight"]').length}`;
        });
        test.info().annotations.push({ type: 'sheet mismatch', description: `${cases.readP1Mismatch.note} Card: ${card}.` });
      }

      const feedback = await mastery.readCurrentItem('correct');
      expect(feedback.percent).toBe(100);
      expect(feedback.headline).toMatch(/excellent/i);
      expect(feedback.headline, 'read before the time ran out').not.toMatch(/time.s up/i);
      expect(feedback.action).toMatch(/next/i);

      // Rest of the P1-P2 pair: 9 more readings, then 10 self-paced texts with a word question each.
      const pair = await mastery.finishCurrentStep();
      played.add('P1');
      attachSteps([pair]);
      expect(pair.nextNode).toBe('P3');
      expect(pair.notes.join('\n')).toMatch(/P1: 10 \/ 10 pieces read well/);
      expect(pair.notes.join('\n')).toMatch(/P2: 10 \/ 10 questions answered right/);
    });

    if (cases.noSkip) {
      test(`${cases.noSkip} ${level} the learner cannot skip ahead to later steps or milestones @regression`, async ({ lang }) => {
        await mastery.steps.expectStepIntro('P3');
        await mastery.steps.expectNodeCompleted('P1');
        await mastery.steps.expectNodeCompleted('P2');

        const s1 = mastery.steps.stepPills().filter({ hasText: 'S1' });
        await expect(s1).toHaveClass(/checkpoint-upcoming/);
        expect(await s1.evaluate((el) => el.tagName), 'step pills are not buttons').toBe('SPAN');
        await s1.click({ force: true });
        await mastery.steps.expectStepIntro('P3');

        await page.goto('/learn?step=s1');
        await mastery.steps.expectStepIntro('P3');

        await page.goto('/roadmap');
        const locked = page.locator('.all-milestone-tile--locked');
        await expect(locked.filter({ hasText: next! })).toHaveCount(1);
        await expect(page.getByRole('button', { name: new RegExp(`start ${next} activity`, 'i') })).toHaveCount(0);
        await locked.filter({ hasText: next! }).click({ force: true });
        await expect(page).toHaveURL(/\/roadmap/);
        await expect(new RoadmapPage(page, lang).activeTile()).toContainText(level);

        // Coming back resumes where the learner left off.
        await new RoadmapPage(page, lang).startStageActivity(level);
        await mastery.steps.expectStepIntro('P3');
      });
    }

    if (cases.s1Pass) {
      test(`${cases.s1Pass} ${level} S1 is passed when the readings meet the 80% threshold @regression`, async () => {
        test.setTimeout(30 * 60_000);
        const steps = await play(['P3', 'P5', 'S1']);
        await expectShowcasePassed(steps.at(-1)!, 'S1');
        expect(steps.at(-1)!.nextNode, 'S1 pass continues to the next practice').toBe('P7');
        expect(stage.saved.at(-1), 'progress saved at P7 (lesson 4, 50%)').toMatchObject({ milestoneLevel: level.toLowerCase(), lesson: '4', progress: 50 });
        test.info().annotations.push({ type: 'set result', description: JSON.stringify(showcase.results.at(-1)) });
        if (level === 'M7') test.info().annotations.push({ type: 'sheet mismatch', description: 'Sheet expects S1 pass → next milestone; this build continues to P7, and S2 completes the milestone (see full-flow test).' });
        test.info().annotations.push({ type: 'pass rule', description: 'The S1 verdict is the server\'s (getSetResult), stubbed to "pass" (showcaseVerdict.ts); every item read correctly (100%).' });
      });
    }

    if (cases.wordWall) {
      test(`${cases.wordWall} ${level} Word Wall loads after S1 @regression`, async () => {
        test.fixme(true, 'Not in this build: no Word Wall step in the M4–M8 config; after S1 the app goes straight to P7 (checked in the S1 test).');
      });
    }

    if (cases.s2Pass) {
      test(`${cases.s2Pass} ${level} S2 is passed when the readings meet the 80% threshold @regression`, async () => {
        test.setTimeout(30 * 60_000);
        const steps = await play(['P7', 'P9', 'P11', 'S2']);
        await expectShowcasePassed(steps.at(-1)!, 'S2');
        expect(steps.at(-1)!.nextNode).toBe('COMPLETE');
      });
    }

    const fullTitle = next
      ? `${cases.fullPass} ${level} full PASS flow: P1 → S1 → S2 → ${next} @regression`
      : `${cases.fullPass} ${level} full PASS flow: P1 → S1 → S2 → course complete (sheet: M10 — no M10 in this build) @regression`;

    test(fullTitle, async ({ lang }) => {
      test.setTimeout(45 * 60_000);
      const remaining = ['P3', 'P5', 'S1', 'P7', 'P9', 'P11', 'S2'].filter((n) => !played.has(n));
      const steps = remaining.length ? await play(remaining) : [];
      for (const s of steps.filter((x) => /^S\d$/.test(x.node))) await expectShowcasePassed(s, s.node as 'S1' | 'S2');

      if (!next) {
        // Last milestone: the course-complete screen replaces "Milestone N Complete!".
        test.info().annotations.push({ type: 'sheet mismatch', description: `Sheet expects ${level} → M10; the app has no M10 (M9 is the last milestone) and shows the course-complete screen.` });
        await expect(page.getByText(/Hurray/i).first(), 'course-complete screen').toBeVisible();
        const screen = await mastery.screenText();
        test.info().annotations.push({ type: 'end screen', description: screen.slice(0, 200) });
        expect.soft(screen, 'no untranslated copy keys (e.g. COURSE_COMPLETE_SUBTITLE) on the course-complete screen').not.toMatch(/\b[A-Z]{2,}(_[A-Z]+)+\b/);
        await expect.soft(page.getByRole('button').first(), 'the course-complete screen offers a way to continue (e.g. back to the roadmap)').toBeVisible({ timeout: 5000 });
        return;
      }

      const n = level.slice(1);
      await expect(page.getByText(new RegExp(`Milestone ${n} Complete!`, 'i'))).toBeVisible();
      await expect(page.getByText(next, { exact: true }).first()).toBeVisible();
      expect(stage.saved.at(-1), `progress saved on ${next}`).toMatchObject({ milestoneLevel: next.toLowerCase(), lesson: '0' });
      test.info().annotations.push({ type: 'route', description: `Sheet: "P1 → S1 → ${next}". Build: P1 → … → S1 → P7 → … → S2 → ${next}.` });

      await page.getByRole('button', { name: /return to roadmap/i }).click();
      const roadmap = new RoadmapPage(page, lang);
      await roadmap.expectActiveStage(next);
      await expect(page.locator('.all-milestone-tile--completed').filter({ hasText: `${level} ·` })).toHaveCount(1);
    });
  });

  // ------------------------------------------------------------------
  // Network failures (M8/M9)
  // ------------------------------------------------------------------
  if (cases.networkPractice || cases.networkShowcase) {
    test.describe(`${level} network`, () => {
      let context: BrowserContext;
      let page: Page;

      test.afterEach(async ({}, testInfo) => {
        if (page && testInfo.status !== testInfo.expectedStatus) {
          await testInfo.attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' });
        }
        await context?.close();
      });

      if (cases.networkPractice) {
        test(`${cases.networkPractice} ${level} P1 keeps working when the network drops during reading @regression`, async ({ browser, lang }, testInfo) => {
          ({ context, page } = await openOnMilestone(browser, testInfo));
          const mastery = new MasteryPage(page, lang);
          await startMilestone(page, lang);
          await mastery.steps.expectStepIntro('P1');
          await mastery.steps.startCurrentStep();
          await mastery.expectReadingItem();

          await context.setOffline(true);
          const offline = await mastery.readCurrentItem('correct');
          expect(offline.percent, 'reading is scored while offline').toBe(100);
          await mastery.clickAction(/^\s*next/i);
          await expect(page.locator('body')).toContainText(/2 \/ 10/);
          await mastery.expectReadingItem();
          const second = await mastery.readCurrentItem('correct');
          expect(second.percent).toBe(100);

          await context.setOffline(false);
          await mastery.clickAction(/^\s*next/i);
          await expect(page.locator('body')).toContainText(/3 \/ 10/);
          await mastery.expectReadingItem();
          test.info().annotations.push({ type: 'behaviour', description: `Offline: "${offline.headline}" (${offline.percent}%) → NEXT; items 1–2 read offline, item 3 after reconnecting. Practice is scored in the browser.` });
        });
      }

      if (cases.networkShowcase) {
        test(`${cases.networkShowcase} ${level} S1 handles a network failure during speech evaluation @regression`, async ({ browser, lang }, testInfo) => {
          ({ context, page } = await openOnMilestone(browser, testInfo, 3)); // lesson 3 = S1
          await stubShowcaseVerdict(context, 'pass');
          const mastery = new MasteryPage(page, lang);
          await startMilestone(page, lang);
          await mastery.steps.expectStepIntro('S1');
          await mastery.steps.startCurrentStep();
          await mastery.expectReadingItem();
          await expect(mastery.hearts()).toHaveAttribute('aria-label', /5 hearts left/i);

          // The evaluation request fails as if the connection dropped (registered last, so it wins over the stub).
          await context.route('**/scores/updateLearnerProfile/**', (route) => route.abort('internetdisconnected'));
          const failed = await mastery.readCurrentItem('correct');
          test.info().annotations.push({ type: 'behaviour', description: `Evaluation failed: "${failed.headline}" ${failed.sub} → ${failed.action}; hearts: ${await mastery.hearts().getAttribute('aria-label')}` });
          await expect.soft(mastery.hearts(), 'a network failure must not cost the learner a heart').toHaveAttribute('aria-label', /5 hearts left/i);
          expect.soft(`${failed.headline} ${failed.sub}`, 'the learner is told the check failed (network), not that they misread').toMatch(/network|connection|offline|internet|couldn.t (check|connect)|something went wrong/i);

          // Connection back: the learner can carry on and the next reading is evaluated normally.
          await context.unroute('**/scores/updateLearnerProfile/**');
          await stubShowcaseVerdict(context, 'pass');
          await mastery.clickAction(/^\s*(next|try again|retry)/i);
          await mastery.expectReadingItem();
          const after = await mastery.readCurrentItem('correct');
          expect(after.percent, 'evaluation works again once the network is back').toBe(100);
        });
      }
    });
  }

  // ------------------------------------------------------------------
  // S1 FAIL
  // ------------------------------------------------------------------
  if (cases.s1Fail) test.describe(`${level} S1 fail`, () => {
    let context: BrowserContext;
    let page: Page;

    test.afterEach(async ({}, testInfo) => {
      if (page && testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' });
      }
      await context?.close();
    });

    test(`${cases.s1Fail} ${level} S1 FAIL sends the learner back to practice (build: P1 · sheet: P5) @regression`, async ({ browser, lang }, testInfo) => {
      test.setTimeout(10 * 60_000);
      let stage: StageHandle;
      ({ context, page, stage } = await openOnMilestone(browser, testInfo, 3)); // lesson 3 = S1
      await stubShowcaseVerdict(context, 'fail');
      const mastery = new MasteryPage(page, lang);
      test.info().annotations.push({ type: 'setup', description: `Fresh context opened on ${level} S1 (lesson 3); the learner misreads every item.` });

      await startMilestone(page, lang);
      const [s1] = await mastery.playNodes(['S1'], { reading: 'wrong' });
      attachSteps([s1]);
      expect(s1.outcome, 'S1 verdict').toBe('fail');
      expect(s1.notes.join(' ')).toMatch(/S1 not quite yet/);
      expect(s1.nextNode, S1_ROUTE_NOTE).toBe('P1');
      expect(stage.saved.at(-1)).toMatchObject({ milestoneLevel: level.toLowerCase(), lesson: '0' });
      test.info().annotations.push({ type: 'sheet mismatch', description: S1_ROUTE_NOTE });
    });
  });
}
