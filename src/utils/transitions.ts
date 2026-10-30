import type { Page } from '@playwright/test';
import type { UiCopyKey } from './UiCopy';

/** uiCopy keys for the screen-to-screen transition controls shared across page objects. */
export const TRANSITION_KEYS = {
  continue: 'continueLabel',
  startSet: 'startSet',
  setComplete: 'setComplete',
} as const satisfies Record<string, UiCopyKey>;

/** Waits for screen-to-screen transitions/animations to settle. */
export async function waitForTransition(page: Page, timeout = 10_000): Promise<void> {
  await page.waitForLoadState('domcontentloaded', { timeout }).catch(() => undefined);
}
