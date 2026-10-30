import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from '../../fixtures/appTest';
import { RoadmapPage } from '../../pages/discovery/RoadmapPage';
import { FoundationPage, describeSteps } from '../../pages/foundation/FoundationPage';
import { newSharedAppPage } from '../../utils/DiscoveryHelper';
import { mintGuestSession } from '../../utils/guestSession';
import { overrideStage } from '../../utils/stageOverride';

/**
 * Foundation F2 — TC-020 (testcase/DiscoveryFullFlow.csv), on the new UI.
 *
 * F2 uses the same games as F1 with WORDS instead of letters (Letter Train "me, be, he, the…",
 * Letter Hunt options are words). A fresh guest is opened directly on F2 (stageOverride.ts), so the
 * run is repeatable and never consumes the shared parked account. The F1 → F2 transition itself is
 * verified for real at the end of foundation-f1.spec.ts (TC-019).
 */
test.describe.configure({ mode: 'serial' });

test.describe('Foundation F2', () => {
  let context: BrowserContext;
  let page: Page;
  let foundation: FoundationPage;

  test.beforeAll(async ({ browser, lang }, testInfo) => {
    test.setTimeout(8 * 60_000); // guest minting, incl. one retry
    ({ context, page } = await newSharedAppPage(browser, testInfo, await mintGuestSession('roadmap')));
    await overrideStage(context, { stage: 'F2' });
    foundation = new FoundationPage(page, lang);
  });

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' });
    }
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('TC-020 F2 opening: L1–L3 Letter Train, P1–P3 Letter Hunt (words) and the A1 Apply @regression', async ({ lang }) => {
    test.setTimeout(45 * 60_000);
    test.info().annotations.push({ type: 'setup', description: 'Fresh guest opened on F2 via stage override (stageOverride.ts); F1→F2 transition is checked in TC-019.' });

    await page.goto('/roadmap');
    const roadmap = new RoadmapPage(page, lang);
    await roadmap.expectActiveStage('F2');
    await roadmap.startStageActivity('F2');
    await foundation.expectStepIntro('L1', /Letter Train/i);

    const steps = await foundation.playNodes(['L1', 'P1', 'L2', 'P2', 'L3', 'P3', 'A1']);
    test.info().annotations.push({ type: 'nodes played', description: describeSteps(steps) });
    expect(steps.at(-1)!.nextNode).toBe('L4');
    await foundation.expectNodeCompleted('A1');
  });
});
