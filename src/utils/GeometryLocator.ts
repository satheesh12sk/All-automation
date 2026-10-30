import type { Locator, Page } from '@playwright/test';

/** Clicks the centre of an element's bounding box (for canvas/overlay targets that ignore normal clicks). */
export async function clickCentre(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Element has no bounding box (not visible?)');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
