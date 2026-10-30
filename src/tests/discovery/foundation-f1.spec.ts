import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from '../../fixtures/appTest';
import { RoadmapPage } from '../../pages/discovery/RoadmapPage';
import { FoundationPage, type StepResult } from '../../pages/foundation/FoundationPage';
import { newSharedAppPage } from '../../utils/DiscoveryHelper';
import { mintGuestSession } from '../../utils/guestSession';

/**
 * Foundation F1 — TC-013..TC-019 (testcase/DiscoveryFullFlow.csv), on the new UI.
 *
 * One real learner journey: a fresh guest is put through Discovery (failing Letter Hunt, so it
 * is placed in F1), then plays every F1 node in order — L1 P1 L2 P2 L3 P3 A1 L4 … P9 A3 — and
 * finally checks that F2 unlocks. Serial and on one page, because each node depends on the last.
 * Expect ~30 min for the whole file.
 */
test.describe.configure({ mode: 'serial' });

/** One line per played node for the report, e.g. "L1 → P1 in 48s (train cards 12, speak right 4)". */
function describeSteps(steps: StepResult[]): string {
  return steps.map((s) => {
    const stats = Object.entries(s.stats).map(([k, v]) => `${k} ${v}`).join(', ');
    return `${s.node} → ${s.nextNode} in ${Math.round(s.durationMs / 1000)}s (${stats})${s.notes.length ? ` — ${s.notes.join('; ')}` : ''}`;
  }).join('\n');
}

test.describe('Foundation F1', () => {
  let context: BrowserContext;
  let page: Page;
  let foundation: FoundationPage;

  /** Play nodes until `nextNode` is offered; assert the exact node sequence on the way. */
  async function playThrough(expectedNodes: string[], nextNode: string): Promise<void> {
    const steps: StepResult[] = [];
    for (const node of expectedNodes) {
      await foundation.expectStepIntro(node);
      steps.push(await foundation.playCurrentStep());
    }
    test.info().annotations.push({ type: 'nodes played', description: describeSteps(steps) });
    expect(steps.map((s) => s.node)).toEqual(expectedNodes);
    expect(steps.at(-1)!.nextNode).toBe(nextNode);
  }

  test.beforeAll(async ({ browser, lang }, testInfo) => {
    test.setTimeout(8 * 60_000); // guest minting, incl. one retry
    ({ context, page } = await newSharedAppPage(browser, testInfo, await mintGuestSession('roadmap')));
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

  test('TC-013 Start F1 from the roadmap opens the F1 landing @regression', async ({ lang }) => {
    const roadmap = new RoadmapPage(page, lang);
    await page.goto('/roadmap');
    await roadmap.expectActiveStage('F1');
    await roadmap.startStageActivity('F1');
    await foundation.expectStepIntro('L1', /Letter Train/i);
  });

  test('TC-014 complete the L1 Letter Train and land on P1 @regression', async () => {
    test.setTimeout(10 * 60_000);
    await playThrough(['L1'], 'P1');
    await foundation.expectNodeCompleted('L1');
  });

  test('TC-015 pass the P1 Letter Hunt and land on L2 @regression', async () => {
    test.setTimeout(10 * 60_000);
    await playThrough(['P1'], 'L2');
    await foundation.expectNodeCompleted('P1');
  });

  test('TC-016 complete L2 Letter Train then P2 Letter Hunt and land on L3 @regression', async () => {
    test.setTimeout(15 * 60_000);
    await playThrough(['L2', 'P2'], 'L3');
  });

  test('TC-017 complete L3 and P3 and reach the A1 Apply challenge @regression', async () => {
    test.setTimeout(15 * 60_000);
    await playThrough(['L3', 'P3'], 'A1');
    await foundation.expectStepIntro('A1', /Letter Hunt/i);
  });

  test('TC-018 complete A1 then L4/P4, L5/P5, L6/P6 and reach A2 @regression', async () => {
    test.setTimeout(40 * 60_000);
    await playThrough(['A1', 'L4', 'P4', 'L5', 'P5', 'L6', 'P6'], 'A2');
  });

  test('TC-019 complete A2, L7/P7, L8/P8, L9/P9 and A3 — F1 done and F2 unlocked @regression', async ({ lang }) => {
    test.setTimeout(40 * 60_000);
    await playThrough(['A2', 'L7', 'P7', 'L8', 'P8', 'L9', 'P9', 'A3'], 'COMPLETE');

    // F1 → F2 transition (the part of TC-020 that needs a real learner): F2 is now the active stage.
    await page.goto('/roadmap');
    await new RoadmapPage(page, lang).expectActiveStage('F2');
  });
});
