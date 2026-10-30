import { test, expect, runOn } from '../../fixtures/responsiveTest';
import { AppHeader } from '../../pages/common/AppHeader';
import { AssessmentPage } from '../../pages/discovery/AssessmentPage';
import { LanguagePicker } from '../../pages/discovery/LanguagePicker';
import { PlacementPage } from '../../pages/discovery/PlacementPage';
import { newSharedAppPage } from '../../utils/DiscoveryHelper';
import { authFile, completeDiscovery, mintGuestSession } from '../../utils/guestSession';
import { expectNoHorizontalOverflow, expectUsableWithoutScrolling, smallTapTargets } from '../../utils/layoutAudit';

/**
 * UI-04, UI-08..UI-10 — screens inside Discovery (UI/UX test plan §3).
 * Read-only cases share the guest from .auth/discover.json; cases that start the assessment
 * mint their own guest so parallel projects never step on each other's progress.
 */

test.describe('shared guest on /discover', () => {
  test.use({ storageState: authFile('discover') });

  test.beforeEach(async ({ page }) => {
    await page.goto('/discover');
    await new AssessmentPage(page).expectStartAssessmentVisible();
  });

  test('UI-08 modals: close control is visible and dismisses without covering the screen @responsive', async ({ page }) => {
    runOn('phone', 'tablet', 'laptop', 'desktop');
    const picker = new LanguagePicker(page);
    const assessment = new AssessmentPage(page);

    await picker.open();
    await expectUsableWithoutScrolling(picker.closeButton(), 'modal close (×)');
    await expectUsableWithoutScrolling(picker.doneButton(), 'modal DONE');
    for (const option of await picker.allOptions().all()) await expectUsableWithoutScrolling(option, 'language option');
    await expectNoHorizontalOverflow(page);

    await picker.close();
    await expect(page.locator('.all-language-modal-overlay')).toBeHidden();
    await expectUsableWithoutScrolling(assessment.startAssessmentButton(), 'START ASSESSMENT after closing the modal');

    const small = await smallTapTargets({ 'modal close (×)': picker.closeButton() });
    if (small.length) test.info().annotations.push({ type: 'tap-target < 44px', description: small.join(', ') });
  });

  test('UI-09 navigation menu (☰ Guest): opens, lists items and closes @responsive', async ({ page }) => {
    runOn('phone', 'tablet', 'laptop', 'desktop');
    const header = new AppHeader(page);
    const assessment = new AssessmentPage(page);

    await expectUsableWithoutScrolling(header.menuTrigger(), 'menu control');
    await header.openMenu();
    await expectUsableWithoutScrolling(header.menu(), 'menu');
    await expect(header.menu()).toContainText(/Instruction Language/i);
    await expectUsableWithoutScrolling(header.signOut(), 'Sign Out item');
    await expectNoHorizontalOverflow(page);

    await header.closeMenu();
    await expectUsableWithoutScrolling(assessment.startAssessmentButton(), 'START ASSESSMENT after closing the menu');
  });
});

test.describe('own guest (starts the assessment)', () => {
  test('UI-04 discovery result: the roadmap control is reachable and not covered @responsive', async ({ browser }, testInfo) => {
    runOn('phone', 'tablet', 'laptop', 'desktop');
    test.setTimeout(6 * 60_000);
    const { context, page } = await newSharedAppPage(browser, testInfo, await mintGuestSession('discover'));
    try {
      await page.goto('/discover');
      await completeDiscovery(page);
      const placement = new PlacementPage(page);

      await expectNoHorizontalOverflow(page);
      await expectUsableWithoutScrolling(placement.placementHeading(), 'result heading');
      // The old UI's "Let's Start" is "VIEW MY ROADMAP ➔" on the new UI.
      await expectUsableWithoutScrolling(placement.viewRoadmapButton(), 'VIEW MY ROADMAP');
      await placement.clickViewRoadmap();
    } finally {
      await context.close();
    }
  });

  test('UI-10 orientation change keeps the active screen and its controls @responsive', async ({ browser }, testInfo) => {
    runOn('tablet');
    test.setTimeout(3 * 60_000);
    const { context, page } = await newSharedAppPage(browser, testInfo, await mintGuestSession('discover'));
    const rotate = async () => {
      const { width, height } = page.viewportSize()!;
      await page.setViewportSize({ width: height, height: width });
    };
    try {
      const assessment = new AssessmentPage(page);
      await page.goto('/discover');
      await assessment.expectStartAssessmentVisible();

      await rotate(); // → landscape
      await expect(page).toHaveURL(/\/discover/);
      await expectNoHorizontalOverflow(page);
      await expectUsableWithoutScrolling(assessment.startAssessmentButton(), 'START ASSESSMENT (landscape)');

      await assessment.clickStartAssessment();
      await assessment.expectDemoItemVisible();
      await expectUsableWithoutScrolling(assessment.mikeButton(), 'mic (landscape)');

      // Rotate mid-recording: the recording state and its stop control must survive.
      await assessment.clickMike();
      await rotate(); // → portrait
      await expectNoHorizontalOverflow(page);
      await expectUsableWithoutScrolling(assessment.stopButton(), 'stop (portrait, while recording)');
      await assessment.clickStop();

      await rotate(); // → landscape
      await expect(assessment.sentenceText()).toHaveText(/This is how it works/i);
      await expectUsableWithoutScrolling(assessment.playButton(), 'play (landscape)');
      await expectUsableWithoutScrolling(assessment.retryButton(), 'retry (landscape)');
      await expectUsableWithoutScrolling(assessment.nextButton(), 'CONTINUE (landscape)');
    } finally {
      await context.close();
    }
  });
});
