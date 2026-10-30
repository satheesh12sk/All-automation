import type { Page } from '@playwright/test';

/** Detects whether the app resumed a previous session rather than starting fresh. */
export async function isResumedSession(page: Page): Promise<boolean> {
  // TODO: implement once the resume indicator is known
  void page;
  return false;
}
