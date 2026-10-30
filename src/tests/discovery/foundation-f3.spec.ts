import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from '../../fixtures/appTest';
import { RoadmapPage } from '../../pages/discovery/RoadmapPage';
import { FoundationPage, describeSteps } from '../../pages/foundation/FoundationPage';
import { newSharedAppPage } from '../../utils/DiscoveryHelper';
import { mintGuestSession } from '../../utils/guestSession';
import { overrideStage } from '../../utils/stageOverride';

/**
 * Foundation F3 — TC-021, TC-022 (testcase/DiscoveryFullFlow.csv), on the new UI.
 *
 * F3 on this build: P1–P5 Letter Launcher, A1 (Letter Launcher + Memory Challenge),
 * P6–P10 Letter Launcher, A2 (Letter Launcher + Memory Challenge). There is no A3 any more,
 * and Memory Challenge only appears inside A1/A2 (the old sheet put it at P6).
 * A fresh guest is opened directly on F3 (stageOverride.ts) so runs are repeatable.
 */
test.describe.configure({ mode: 'serial' });

test.describe('Foundation F3', () => {
  let context: BrowserContext;
  let page: Page;
  let foundation: FoundationPage;

  test.beforeAll(async ({ browser, lang }, testInfo) => {
    test.setTimeout(8 * 60_000); // guest minting, incl. one retry
    ({ context, page } = await newSharedAppPage(browser, testInfo, await mintGuestSession('roadmap')));
    await overrideStage(context, { stage: 'F3' });
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

  test('TC-021 F3 opening: P1–P5 Letter Launcher and the A1 Apply (launcher + Memory Challenge) @regression', async ({ lang }) => {
    test.setTimeout(40 * 60_000);
    test.info().annotations.push({ type: 'setup', description: 'Fresh guest opened on F3 via stage override (stageOverride.ts).' });

    await page.goto('/roadmap');
    const roadmap = new RoadmapPage(page, lang);
    await roadmap.expectActiveStage('F3');
    await roadmap.startStageActivity('F3');
    await foundation.expectStepIntro('P1', /Letter Launcher/i);

    const steps = await foundation.playNodes(['P1', 'P2', 'P3', 'P4', 'P5', 'A1']);
    test.info().annotations.push({ type: 'nodes played', description: describeSteps(steps) });
    expect(steps.at(-1)!.stats['memory rounds'], 'A1 should include Memory Challenge rounds').toBeGreaterThan(0);
    expect(steps.at(-1)!.nextNode).toBe('P6');
  });

  test('TC-022 F3 from P6: P6–P10 Letter Launcher and the A2 Apply — F3 complete @regression', async () => {
    test.setTimeout(40 * 60_000);
    const steps = await foundation.playNodes(['P6', 'P7', 'P8', 'P9', 'P10', 'A2']);
    test.info().annotations.push({ type: 'nodes played', description: describeSteps(steps) });
    expect(steps.at(-1)!.stats['memory rounds'], 'A2 should include Memory Challenge rounds').toBeGreaterThan(0);
    expect(steps.at(-1)!.nextNode).toBe('COMPLETE');
  });
});
