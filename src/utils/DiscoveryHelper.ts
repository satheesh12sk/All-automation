import type { Browser, BrowserContext, BrowserContextOptions, Page, TestInfo } from '@playwright/test';
import { installFakeSpeechRecognition } from './fakeMedia';

export interface GuestAccount {
  username: string;
  password: string;
}

/**
 * Fresh guest credentials, per TC-001: "testuser<1..1000000>", password = username.
 * Guest login accepts any User ID, so every run starts from an unplayed account.
 */
export function mintGuestCredentials(): GuestAccount {
  const username = `testuser${Math.floor(Math.random() * 1_000_000) + 1}`;
  return { username, password: username };
}

/**
 * One page shared by a serial suite (Discovery is a single journey: each TC continues where the
 * previous one stopped). Built from the project's `use` options so baseURL/viewport/permissions
 * match the normal `page` fixture, with the same fake speech recognition installed.
 */
export async function newSharedAppPage(
  browser: Browser,
  testInfo: TestInfo,
  storageState?: BrowserContextOptions['storageState'],
): Promise<{ context: BrowserContext; page: Page }> {
  const use = testInfo.project.use;
  const context = await browser.newContext({
    baseURL: use.baseURL,
    viewport: use.viewport,
    permissions: use.permissions,
    locale: use.locale,
    // device emulation, so responsive projects get the same phone/tablet as their `page`
    isMobile: browser.browserType().name() === 'firefox' ? undefined : use.isMobile,
    hasTouch: use.hasTouch,
    deviceScaleFactor: use.deviceScaleFactor,
    userAgent: use.userAgent,
    storageState,
  });
  await context.addInitScript(installFakeSpeechRecognition);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  return { context, page };
}
