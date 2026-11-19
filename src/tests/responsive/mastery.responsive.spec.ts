import { gotoApp } from '../../utils/appNav';
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect, runOn } from '../../fixtures/responsiveTest';
import { RoadmapPage } from '../../pages/discovery/RoadmapPage';
import { describeSteps } from '../../pages/foundation/FoundationPage';
import { MasteryLevel, MasteryPage } from '../../pages/mastery/MasteryPage';
import { authFile } from '../../utils/guestSession';
import type { AppLanguage } from '../../utils/languages';
import {
  expectNoHorizontalOverflow, expectNoOverlap, expectReachable, expectUsableWithoutScrolling,
  findClippedText, findContrastIssues, smallTapTargets,
} from '../../utils/layoutAudit';
import { ShowcaseVerdict, stubShowcaseVerdict } from '../../utils/showcaseVerdict';
import { overrideStage } from '../../utils/stageOverride';

/**
 * UI-13..UI-17 — Mastery (M4–M7) screens on the device matrix, with the same checks as UI-01..UI-12:
 * no sideways scroll, controls usable without scrolling, tap targets ≥ 44 px, no clipped text,
 * WCAG AA contrast.
 *
 * Starts from the shared guest in .auth/roadmap.json (roadmap-<lang>.json for other languages), opened on an M-level step via stageOverride.ts.
 * Progress saves (POST …/lesson/addLesson) are answered in the browser and never reach the server,
 * so these checks do not move the shared guest (UI-05/UI-06 rely on it being in F1).
 */
test.use({ storageState: authFile('roadmap') });

/** Open `level` on step `lesson` (0 = P1-P2, 3 = S1, 7 = S2) and show its UP NEXT card. */
async function openMastery(context: BrowserContext, page: Page, lang: AppLanguage, level: MasteryLevel, lesson: number, verdict: ShowcaseVerdict = 'pass') {
  await overrideStage(context, { stage: level, lesson, followPromotion: true });
  await stubShowcaseVerdict(context, verdict);
  await context.route('**/lesson/addLesson', async (route) => {
    const body = route.request().postDataJSON() ?? {};
    await route.fulfill({ json: { query: null, result: body, error: null, message: 'Lesson added' } });
  });
  await gotoApp(page, '/roadmap');
  await new RoadmapPage(page, lang).startStageActivity(level);
  const mastery = new MasteryPage(page, lang);
  await mastery.steps.waitForUpNext();
  return mastery;
}

async function expectReadableAndContrasted(page: Page, where: string) {
  expect(await findClippedText(page), `text cut off (${where})`).toEqual([]);
  const issues = await findContrastIssues(page);
  expect(issues.map((i) => `"${i.text}" ${i.ratio}:1 (needs ${i.required}:1) ${i.color} on ${i.background}`), `low-contrast text (${where})`).toEqual([]);
}

test('UI-13 Mastery journey map: M4 tile, node strip (P1 … 🏆 S2) and Start buttons reflow without overlap @responsive', async ({ context, page, lang }) => {
  runOn('phone', 'tablet');
  await overrideStage(context, { stage: 'M4' });
  const roadmap = new RoadmapPage(page, lang);
  const mastery = new MasteryPage(page, lang);

  await gotoApp(page, '/roadmap');
  await expect(roadmap.tiles().first()).toBeVisible({ timeout: 30000 });
  await expectNoHorizontalOverflow(page);
  await expectNoOverlap(roadmap.tiles(), 'roadmap tiles');
  await expectReachable(roadmap.activeTile(), 'active stage tile (M4)');
  await expectUsableWithoutScrolling(roadmap.startActivityButton('M4'), 'START M4 ACTIVITY');

  await roadmap.startStageActivity('M4');
  await mastery.steps.waitForUpNext();
  await expectNoHorizontalOverflow(page);
  await expect(mastery.steps.stepPills()).toHaveCount(14);
  await expectNoOverlap(mastery.steps.stepPills(), 'node strip (P1 … 🏆 S2)');
  await expectUsableWithoutScrolling(mastery.steps.anyStartStepButton(), 'START P1');
});

for (const { level, kind } of [{ level: 'M4' as const, kind: 'sentence' }, { level: 'M7' as const, kind: 'paragraph' }]) {
  test(`UI-14 Read Aloud (${level} ${kind}): text, timer, mic and feedback fit the screen @responsive`, async ({ context, page, lang }) => {
    runOn('phone', 'tablet', 'laptop', 'desktop');
    const mastery = await openMastery(context, page, lang, level, 0, 'fail');
    await mastery.steps.startCurrentStep();
    await mastery.expectReadingItem();

    await expectNoHorizontalOverflow(page);
    await expectUsableWithoutScrolling(mastery.readingCard(), `${kind} card`);
    await expectUsableWithoutScrolling(mastery.timerChip(), 'timer');
    await expectUsableWithoutScrolling(mastery.micButton(), 'mic');
    expect(await smallTapTargets({ mic: mastery.micButton() }), 'tap targets under 44px').toEqual([]);
    await expectReadableAndContrasted(page, 'reading item');

    // Misread: red words and the feedback card with TRY AGAIN.
    const feedback = await mastery.readCurrentItem('wrong');
    expect(feedback.action).toMatch(mastery.label('masteryTryAgain'));
    await expectNoHorizontalOverflow(page);
    await expectReachable(mastery.resultCard(), 'feedback card');
    const tryAgain = page.getByRole('button', { name: mastery.label('masteryTryAgain') });
    await expectReachable(tryAgain, 'TRY AGAIN');
    expect(await smallTapTargets({ 'TRY AGAIN': tryAgain }), 'tap targets under 44px').toEqual([]);
    await expectReadableAndContrasted(page, 'feedback');
  });
}

test('UI-15 Self-paced reading: START / NEXT / FINISH and the YES / NO question fit the screen @responsive', async ({ context, page, lang }) => {
  runOn('phone', 'tablet', 'laptop');
  test.setTimeout(4 * 60_000);
  const mastery = await openMastery(context, page, lang, 'M4', 0);
  await mastery.steps.startCurrentStep();

  // P1 (10 readings) leads into P2 within the same step.
  for (let item = 0; item < 10; item++) {
    await mastery.expectReadingItem();
    await mastery.readCurrentItem('correct');
    await mastery.clickAction(mastery.label('masteryNext'));
  }
  await mastery.clickAction(mastery.label('masteryContinue'));

  const start = page.getByRole('button', { name: mastery.label('selfPacedStart') });
  await expect(start).toBeVisible({ timeout: 20000 });
  await expectNoHorizontalOverflow(page);
  await expectUsableWithoutScrolling(start, 'START');
  await expectReadableAndContrasted(page, 'self-paced start');

  await start.click();
  const next = page.getByRole('button', { name: mastery.label('masteryNext') });
  await expectUsableWithoutScrolling(next, 'NEXT (reveal word)');
  expect(await smallTapTargets({ NEXT: next }), 'tap targets under 44px').toEqual([]);
  for (let i = 0; i < 30 && await next.isVisible(); i++) await next.click();
  const finish = page.getByRole('button', { name: mastery.label('selfPacedFinish') });
  await expectUsableWithoutScrolling(finish, 'FINISH');
  await finish.click();

  await expect(mastery.yesButton()).toBeVisible({ timeout: 10000 });
  await expectNoHorizontalOverflow(page);
  await expectUsableWithoutScrolling(mastery.yesButton(), 'YES');
  await expectUsableWithoutScrolling(mastery.noButton(), 'NO');
  expect(await smallTapTargets({ YES: mastery.yesButton(), NO: mastery.noButton() }), 'tap targets under 44px').toEqual([]);
  await expectNoOverlap(page.getByRole('button', { name: mastery.text(['selfPacedYes', 'selfPacedNo'], { exact: true }) }), 'YES / NO');
  await expectReadableAndContrasted(page, 'word question');
});

test('UI-16 Showcase S1: hearts, text and mic fit the screen; a lost heart is shown @responsive', async ({ context, page, lang }) => {
  runOn('phone', 'tablet', 'laptop');
  const mastery = await openMastery(context, page, lang, 'M4', 3, 'fail');
  await mastery.steps.expectStepIntro('S1');
  await mastery.steps.startCurrentStep();
  await mastery.expectReadingItem();

  await expectNoHorizontalOverflow(page);
  await expectUsableWithoutScrolling(mastery.hearts(), 'hearts');
  await expect(mastery.hearts()).toHaveAttribute('aria-label', mastery.text('showcaseHeartsLeft', { vars: { count: 5 } }));
  await expectUsableWithoutScrolling(mastery.readingCard(), 'sentence card');
  await expectUsableWithoutScrolling(mastery.micButton(), 'mic');

  const feedback = await mastery.readCurrentItem('wrong');
  expect(feedback.headline).toMatch(mastery.text('showcaseLostHeart'));
  await expect(mastery.hearts()).toHaveAttribute('aria-label', mastery.text('showcaseHeartsLeft', { vars: { count: 4 } }));
  await expect(mastery.lostHearts()).toHaveCount(1);
  await expectReachable(page.getByRole('button', { name: mastery.label('masteryNext') }), 'NEXT');
  await expectReadableAndContrasted(page, 'showcase feedback');
});

test('UI-17 Milestone complete: heading, M4 → M5 and RETURN TO ROADMAP fit the screen @responsive', async ({ context, page, lang }) => {
  runOn('phone', 'tablet');
  test.setTimeout(4 * 60_000);
  const mastery = await openMastery(context, page, lang, 'M4', 7, 'pass');
  await mastery.steps.expectStepIntro('S2');
  const s2 = await mastery.playCurrentStep();
  test.info().annotations.push({ type: 'S2 played', description: describeSteps([s2]) });
  expect(s2.nextNode).toBe('COMPLETE');

  await expect(page.getByRole('heading', { name: mastery.text('milestoneComplete', { vars: { number: 4 } }) })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const back = page.getByRole('button', { name: mastery.text('returnToRoadmap') });
  await expectUsableWithoutScrolling(back, 'RETURN TO ROADMAP');
  expect(await smallTapTargets({ 'RETURN TO ROADMAP': back }), 'tap targets under 44px').toEqual([]);
  await expectReadableAndContrasted(page, 'milestone complete');
});
