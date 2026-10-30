import { test, expect, runOn } from '../../fixtures/responsiveTest';
import { RoadmapPage } from '../../pages/discovery/RoadmapPage';
import { FoundationPage } from '../../pages/foundation/FoundationPage';
import { authFile } from '../../utils/guestSession';
import { expectNoHorizontalOverflow, expectNoOverlap, expectReachable, expectUsableWithoutScrolling } from '../../utils/layoutAudit';

/**
 * UI-05..UI-07 — Foundation journey map and game screens (UI/UX test plan §3).
 * Starts from the shared F1 guest in .auth/roadmap.json.
 */
test.use({ storageState: authFile('roadmap') });

test('UI-05 Foundation journey map: level pills and Start buttons reflow without overlap @responsive', async ({ page }) => {
  runOn('phone', 'tablet');
  const roadmap = new RoadmapPage(page);
  const foundation = new FoundationPage(page);

  await page.goto('/roadmap');
  await expect(roadmap.tiles().first()).toBeVisible({ timeout: 30000 });
  await expectNoHorizontalOverflow(page);
  await expectNoOverlap(roadmap.tiles(), 'roadmap tiles');
  await expectReachable(roadmap.activeTile(), 'active stage tile (F1)');
  await expectUsableWithoutScrolling(roadmap.startActivityButton('F1'), 'START F1 ACTIVITY');

  await roadmap.startActivityButton('F1').click();
  await page.waitForURL(/\/milestone-intro/);
  await expectNoHorizontalOverflow(page);
  await expectUsableWithoutScrolling(roadmap.startActivityButton('F1'), 'START F1 ACTIVITY (intro)');

  await roadmap.startActivityButton('F1').click();
  await page.waitForURL(/\/learn/);
  await expect(foundation.stepPills().first()).toBeVisible({ timeout: 20000 });
  await expectNoHorizontalOverflow(page);
  await expectNoOverlap(foundation.stepPills(), 'level pills (L1 P1 … A3)');
  await expectUsableWithoutScrolling(foundation.stepPills().first(), 'first level pill');
  if (await foundation.anyStartStepButton().isVisible()) {
    await expectUsableWithoutScrolling(foundation.anyStartStepButton(), 'START <node>');
  }
});

test('UI-06 Letter Train: letter tiles and answer controls fit in the viewport @responsive', async ({ page }) => {
  runOn('phone', 'tablet', 'laptop');
  const roadmap = new RoadmapPage(page);
  const foundation = new FoundationPage(page);

  await page.goto('/roadmap');
  await roadmap.startStageActivity('F1');
  // The shared guest may already be inside L1 (resumed); otherwise start it from the UP NEXT card.
  await expect(foundation.anyStartStepButton().or(foundation.bigLetter())).toBeVisible({ timeout: 20000 });
  if (await foundation.anyStartStepButton().isVisible()) {
    await foundation.startCurrentStep();
  }
  await foundation.expectLetterTrainVisible();
  await expectNoHorizontalOverflow(page);

  await expectUsableWithoutScrolling(foundation.letterTrain(), 'train');
  await expectUsableWithoutScrolling(foundation.letterCard(), 'letter card');
  await expectUsableWithoutScrolling(foundation.bigLetter(), 'letter');
  await expectUsableWithoutScrolling(foundation.replayButton(), 'replay');
  // Disabled on the first letter (nothing to go back to) — placement is what matters here.
  await expectUsableWithoutScrolling(foundation.previousButton(), 'back arrow', { requireEnabled: false });
  await expectUsableWithoutScrolling(foundation.nextButton(), 'NEXT');
});

test('UI-07 Memory Challenge grid: all tiles visible and tappable at 44px or more @responsive', async () => {
  runOn('phone');
  // Memory Challenge is first reached at F3 P6.
  test.fixme(true, 'Blocked: needs an F3 test account on axl-test (UI/UX plan §6)');
});
