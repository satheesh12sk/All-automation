import fs from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContextOptions, type Page } from '@playwright/test';
import { resolveBaseUrl } from '../../config/environments';
import { AssessmentPage } from '../pages/discovery/AssessmentPage';
import { DiscoveryLoginPage } from '../pages/discovery/LoginPage';
import { MicrophoneTestPage } from '../pages/discovery/MicTestPage';
import { PlacementPage } from '../pages/discovery/PlacementPage';
import { mintGuestCredentials } from './DiscoveryHelper';
import { chromiumFakeMediaArgs, installFakeSpeechRecognition } from './fakeMedia';
import { languageByCode } from './languages';

export type StorageState = Exclude<BrowserContextOptions['storageState'], string | undefined>;

/**
 * Where a minted guest is left:
 *   'discover' — passed the audio check, on /discover with Start Assessment (nothing recorded)
 *   'roadmap'  — finished Discovery (Letter Hunt failed on purpose), placed in F1, on /roadmap
 */
export type GuestStage = 'discover' | 'roadmap';

/** Shared sessions written by the responsive-setup project. */
export const AUTH_DIR = path.resolve(__dirname, '../../.auth');
export const authFile = (stage: GuestStage) => path.join(AUTH_DIR, `${stage}.json`);

/** Run Discovery on `page` (already on /discover) through to the placement result screen. */
export async function completeDiscovery(page: Page): Promise<void> {
  const english = languageByCode('english');
  const assessment = new AssessmentPage(page, english);
  const placement = new PlacementPage(page, english);
  await placement.trackLetterContent();
  await assessment.clickStartAssessment();
  for (const nextSet of [2, 3]) {
    // the first call also records the (non-counting) demo item
    await assessment.completeRemainingItemsInSet();
    await assessment.clickStartSet(nextSet);
  }
  await placement.failAllRounds();
  await placement.expectPlacementResult();
}

/**
 * Create a fresh guest in a throwaway Chromium (the only engine whose fake mic passes the
 * audio check) and return its session. Load it into any engine with
 * `browser.newContext({ storageState })` — the session is plain localStorage.
 */
export async function mintGuestSession(stage: GuestStage, attempts = 2): Promise<StorageState> {
  // Setup, not the thing under test: if the server stalls (e.g. a recording upload never
  // returns while several suites mint guests at once), start over with a brand-new guest.
  for (let attempt = 1; ; attempt++) {
    try {
      return await mintGuestSessionOnce(stage);
    } catch (error) {
      if (attempt >= attempts) throw error;
      console.warn(`[guestSession] minting a '${stage}' guest failed (attempt ${attempt}/${attempts}), retrying with a new guest: ${String(error).split('\n')[0]}`);
    }
  }
}

async function mintGuestSessionOnce(stage: GuestStage): Promise<StorageState> {
  const browser = await chromium.launch({ args: chromiumFakeMediaArgs() });
  try {
    const context = await browser.newContext({ baseURL: resolveBaseUrl(), permissions: ['microphone'], viewport: { width: 1280, height: 720 } });
    await context.addInitScript(installFakeSpeechRecognition);
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);

    const login = new DiscoveryLoginPage(page);
    const { username, password } = mintGuestCredentials();
    await login.navigate();
    await login.login(username, password);
    await new MicrophoneTestPage(page).waitForPass();
    await new AssessmentPage(page).expectStartAssessmentVisible();

    if (stage === 'roadmap') {
      await completeDiscovery(page);
      await new PlacementPage(page).clickViewRoadmap();
    }
    return await context.storageState();
  } finally {
    await browser.close();
  }
}

/** mintGuestSession + write it to .auth/<stage>.json. */
export async function saveGuestSession(stage: GuestStage): Promise<string> {
  const state = await mintGuestSession(stage);
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(authFile(stage), JSON.stringify(state, null, 2));
  return authFile(stage);
}
