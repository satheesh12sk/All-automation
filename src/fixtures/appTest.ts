import { test as base, expect } from '@playwright/test';
import { resolveLanguage } from '../../config/language';
import { languageByCode, type AppLanguage } from '../utils/languages';
import type { UiCopyKey } from '../utils/UiCopy';
import { copy } from '../utils/UiCopy';
import { installFakeSpeechRecognition } from '../utils/fakeMedia';

type AppFixtures = {
  lang: AppLanguage;
  ui: (key: UiCopyKey) => string;
};

export const test = base.extend<AppFixtures>({
  lang: async ({}, use) => {
    await use(languageByCode(resolveLanguage()));
  },
  ui: async ({ lang }, use) => {
    await use((key) => copy(key, lang)[0]);
  },
  page: async ({ page }, use) => {
    page.setDefaultTimeout(20_000);
    await page.addInitScript(installFakeSpeechRecognition);
    await use(page);
  },
});

export { expect };
