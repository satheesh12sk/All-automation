import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from '../../fixtures/appTest';
import { AssessmentPage } from '../../pages/discovery/AssessmentPage';
import { LanguagePicker } from '../../pages/discovery/LanguagePicker';
import { DiscoveryLoginPage } from '../../pages/discovery/LoginPage';
import { MicrophoneTestPage } from '../../pages/discovery/MicTestPage';
import { PlacementPage } from '../../pages/discovery/PlacementPage';
import { RoadmapPage } from '../../pages/discovery/RoadmapPage';
import { FoundationPage } from '../../pages/foundation/FoundationPage';
import { mintGuestCredentials, newSharedAppPage } from '../../utils/DiscoveryHelper';

/**
 * Discovery + F1 entry — TC-001..TC-013 (testcase/DiscoveryFullFlow.csv), on the new UI.
 *
 * One continuous learner journey, so the tests are serial and share one page: each TC picks up
 * where the previous one stopped, and a failure skips the rest (they could not run anyway).
 */
test.describe.configure({ mode: 'serial' });

test.describe('Discovery + F1 entry', () => {
  let context: BrowserContext;
  let page: Page;
  let assessment: AssessmentPage;
  let placement: PlacementPage;

  test.beforeAll(async ({ browser, lang }, testInfo) => {
    ({ context, page } = await newSharedAppPage(browser, testInfo));
    assessment = new AssessmentPage(page, lang);
    placement = new PlacementPage(page, lang);
  });

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' });
    }
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('TC-001 guest login and audio check @smoke @regression', async () => {
    const login = new DiscoveryLoginPage(page);
    const mic = new MicrophoneTestPage(page);
    const { username, password } = mintGuestCredentials();
    test.info().annotations.push({ type: 'guest', description: username });

    await login.navigate();
    await login.login(username, password);

    // New UI: no "Skip" — the check greets, listens for a name, then moves on by itself.
    await mic.expectOnAudioCheck();
    await mic.expectGreetingVisible();
    await mic.waitForPass();
    await expect(page).toHaveURL(/\/discover/);
  });

  test('TC-002 choose help language', async () => {
    test.skip(true, 'The help-language popup does not exist on the new UI (axl-test): after the audio check the app goes straight to /discover. Test case needs updating.');
  });

  test('TC-003 choose the learning language @regression', async ({ lang }) => {
    const picker = new LanguagePicker(page);
    await picker.select(lang);
    await picker.expectCurrent(lang);
    await assessment.expectStartAssessmentVisible();
  });

  test('TC-004 start the assessment (demo, then first sentence) @regression', async () => {
    await assessment.clickStartAssessment();
    await assessment.expectDemoItemVisible();
    await assessment.expectSentenceVisible();

    // The demo item ("This is how it works.") does not count; recording it unlocks Set 1.
    expect(await assessment.completeCurrentItem()).toBe('item');
    await assessment.expectActiveSet(1);
    await assessment.expectContentType('sentences');
    await assessment.expectProgress(/^1\s*\/\s*\d+$/);
    await assessment.expectSentenceVisible();
  });

  test('TC-005 record the sentence @regression', async () => {
    await assessment.expectMikeButtonVisible();
    await assessment.recordSentence(3000);
    await assessment.expectPlayButtonVisible();
    await assessment.expectRetryButtonVisible();
    await assessment.expectNextButtonVisible();
  });

  test('TC-006 replay the recorded audio @regression', async () => {
    const sentence = await assessment.getSentenceText();
    await assessment.installPlaybackProbe();
    await assessment.clickPlay();
    await assessment.expectPlaybackStarted();
    await expect(assessment.sentenceText()).toHaveText(sentence);
  });

  test('TC-007 re-record the audio @regression', async () => {
    await assessment.expectRetryButtonVisible();
    await assessment.clickRetry();
    await assessment.recordSentence(3000);
    await assessment.expectNextButtonVisible();
  });

  test('TC-008 move to the next sentence @regression', async () => {
    const before = { text: await assessment.getSentenceText(), progress: await assessment.getProgress() };
    await assessment.clickNext();
    expect(await assessment.waitForNextState(before.progress)).toBe('item');
    await assessment.expectSentenceVisible();
    expect(await assessment.getSentenceText()).not.toBe(before.text);
  });

  test('TC-009 complete Set 1 (sentences) and move to Set 2 @regression', async () => {
    await assessment.completeRemainingItemsInSet();
    await assessment.expectSetComplete(1);
    await assessment.clickStartSet(2);
    await assessment.expectActiveSet(2);
    await assessment.expectContentType('words');
    await assessment.expectSentenceVisible();
  });

  test('TC-010 complete Set 2 (words) and move to Set 3 @regression', async () => {
    await assessment.completeRemainingItemsInSet();
    await assessment.expectSetComplete(2);
    await placement.trackLetterContent(); // must be listening before Set 3's items load
    await assessment.clickStartSet(3);
  });

  test('TC-011 Letter Hunt (Set 3) loads @regression', async () => {
    // New UI: Set 3 opens directly on the first round — there is no demo / "Skip Demo".
    await placement.expectLetterHuntVisible();
    await assessment.expectProgress(/^1\s*\/\s*\d+$/);
  });

  test('TC-012 failing Letter Hunt places the student in Foundation @regression', async () => {
    const rounds = await placement.failAllRounds();
    test.info().annotations.push({ type: 'letter-hunt', description: rounds.map((r) => `${r.target}→${r.tapped}`).join(' ') });
    expect(rounds.length).toBeGreaterThan(0);
    for (const r of rounds) expect(r.tapped).not.toBe(r.target);

    await placement.expectPlacementResult(/Foundation/i);
    await placement.clickViewRoadmap();
  });

  test('TC-013 Start F1 from the roadmap opens the F1 landing @regression', async ({ lang }) => {
    const roadmap = new RoadmapPage(page, lang);
    await roadmap.expectActiveStage('F1');
    await roadmap.startStageActivity('F1');
    await new FoundationPage(page, lang).expectStepIntro('L1', /Letter Train/i);
  });
});
