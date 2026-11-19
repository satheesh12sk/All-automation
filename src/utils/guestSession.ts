import fs from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContextOptions, type Page } from '@playwright/test';
import { DEFAULT_ENV, resolveBaseUrl, resolveEnvName, serviceWorkerPolicy } from '../../config/environments';
import { resolveLanguage } from '../../config/language';
import { AssessmentPage } from '../pages/discovery/AssessmentPage';
import { DiscoveryLoginPage } from '../pages/discovery/LoginPage';
import { MicrophoneTestPage } from '../pages/discovery/MicTestPage';
import { PlacementPage } from '../pages/discovery/PlacementPage';
import { mintGuestCredentials } from './DiscoveryHelper';
import { chromiumFakeMediaArgs, installFakeSpeechRecognition } from './fakeMedia';
import { AppLanguage, languageByCode } from './languages';

export type StorageState = Exclude<BrowserContextOptions['storageState'], string | undefined>;

/**
 * Where a minted guest is left:
 *   'discover' — passed the audio check, on /discover with Start Assessment (nothing recorded)
 *   'roadmap'  — finished Discovery (Letter Hunt failed on purpose), placed in F1, on /roadmap
 */
export type GuestStage = 'discover' | 'roadmap';

/** The run's language (TEST_LANG): guests are created in it, so the app shows it everywhere. */
const runLanguage = (): AppLanguage => languageByCode(resolveLanguage());

/** Shared sessions written by the responsive-setup project: .auth/<stage>.json (English) or .auth/<stage>-<code>.json. */
export const AUTH_DIR = path.resolve(__dirname, '../../.auth');
// Sessions belong to one environment: lab2 guests are saved apart from axl-test ones.
export const authFile = (stage: GuestStage, lang: AppLanguage = runLanguage()) => {
  const env = resolveEnvName() === DEFAULT_ENV ? '' : `-${resolveEnvName().toLowerCase()}`;
  return path.join(AUTH_DIR, `${stage}${env}${lang.code === 'en' ? '' : `-${lang.code}`}.json`);
};

/** Run Discovery on `page` (already on /discover) through to the placement result screen. */
export async function completeDiscovery(page: Page, lang: AppLanguage = runLanguage()): Promise<void> {
  const assessment = new AssessmentPage(page, lang);
  const placement = new PlacementPage(page, lang);
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
 *
 * The guest learns in `lang`: it is picked on the login page before logging in, as a learner
 * would, and the app keeps it in the session (all-session.language).
 */
export async function mintGuestSession(stage: GuestStage, lang: AppLanguage = runLanguage(), attempts = 2): Promise<StorageState> {
  // Setup, not the thing under test: if the server stalls (e.g. a recording upload never
  // returns while several suites mint guests at once), start over with a brand-new guest.
  for (let attempt = 1; ; attempt++) {
    try {
      return await mintGuestSessionOnce(stage, lang);
    } catch (error) {
      if (attempt >= attempts) throw error;
      console.warn(`[guestSession] minting a '${stage}' guest failed (attempt ${attempt}/${attempts}), retrying with a new guest: ${String(error).split('\n')[0]}`);
    }
  }
}

async function mintGuestSessionOnce(stage: GuestStage, lang: AppLanguage): Promise<StorageState> {
  const browser = await chromium.launch({ args: chromiumFakeMediaArgs() });
  try {
    const context = await browser.newContext({ baseURL: resolveBaseUrl(), serviceWorkers: serviceWorkerPolicy(), permissions: ['microphone'], viewport: { width: 1280, height: 720 } });
    await context.addInitScript(installFakeSpeechRecognition);
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);

    const { username, password } = mintGuestCredentials();
    await (await DiscoveryLoginPage.openIn(page, lang)).login(username, password);
    await new MicrophoneTestPage(page, lang).waitForPass();
    await new AssessmentPage(page, lang).expectStartAssessmentVisible();

    if (stage === 'roadmap') {
      await completeDiscovery(page, lang);
      await new PlacementPage(page, lang).clickViewRoadmap();
    }
    return await context.storageState();
  } finally {
    await browser.close();
  }
}

/** mintGuestSession + write it to authFile(stage), both in the run's language. */
export async function saveGuestSession(stage: GuestStage): Promise<string> {
  const state = await mintGuestSession(stage);
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(authFile(stage), JSON.stringify(state, null, 2));
  return authFile(stage);
}
