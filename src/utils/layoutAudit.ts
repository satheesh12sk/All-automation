import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Layout assertions for the responsive specs. All measurements are in CSS px of the current
 * viewport, taken from the live DOM (getBoundingClientRect / elementFromPoint / computed style).
 */

/** The page itself must not scroll sideways (inner carousels may). */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `page scrolls horizontally: content ${scrollWidth}px wide in a ${clientWidth}px viewport`).toBeLessThanOrEqual(clientWidth + 1);
}

interface Placement {
  inViewport: boolean;
  covered: string | null;
  box: { x: number; y: number; width: number; height: number };
  viewport: { width: number; height: number };
}

async function placement(locator: Locator): Promise<Placement> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const inViewport = r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1;
    let covered: string | null = null;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (cx >= 0 && cx < vw && cy >= 0 && cy < vh) {
      const hit = document.elementFromPoint(cx, cy);
      if (hit && !el.contains(hit) && !hit.contains(el)) {
        covered = `${hit.tagName.toLowerCase()}.${String((hit as HTMLElement).className || '').split(' ')[0]}`;
      }
    }
    return { inViewport, covered, box: { x: r.x, y: r.y, width: r.width, height: r.height }, viewport: { width: vw, height: vh } };
  });
}

/**
 * The control is visible, enabled, fully inside the viewport WITHOUT scrolling, and the topmost
 * element at its centre (i.e. a tap would land on it).
 */
export async function expectUsableWithoutScrolling(locator: Locator, name: string, opts: { requireEnabled?: boolean } = {}): Promise<void> {
  await expect(locator, `${name} should be visible`).toBeVisible();
  if (opts.requireEnabled ?? true) await expect(locator, `${name} should be enabled`).toBeEnabled();
  const p = await placement(locator);
  expect(p.inViewport, `${name} is outside the ${p.viewport.width}x${p.viewport.height} viewport at ${JSON.stringify(p.box)}`).toBe(true);
  expect(p.covered, `${name} is covered by ${p.covered}`).toBeNull();
}

/**
 * Like expectUsableWithoutScrolling, but scrolling the control into view first is allowed.
 * Scrolls it to the CENTRE of its scroll container, as a user would — scrolling it flush to the
 * top would park it under the sticky header and report a false "covered".
 */
export async function expectReachable(locator: Locator, name: string, opts: { requireEnabled?: boolean } = {}): Promise<void> {
  await expect(locator, `${name} should be visible`).toBeVisible();
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await expectUsableWithoutScrolling(locator, name, opts);
}

/** Smallest side of the control's box, in CSS px. */
export async function tapTargetSize(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('tapTargetSize: element has no box (not visible?)');
  return Math.min(box.width, box.height);
}

/**
 * Controls whose smaller side is under `min` px (WCAG 2.5.5 / platform guidance: 44px).
 * Returned, not asserted: the test plan only makes 44px a pass/fail rule for UI-07.
 */
export async function smallTapTargets(controls: Record<string, Locator>, min = 44): Promise<string[]> {
  const small: string[] = [];
  for (const [name, locator] of Object.entries(controls)) {
    if (!(await locator.isVisible())) continue;
    const size = await tapTargetSize(locator);
    if (size < min) small.push(`${name} ${Math.round(size)}px`);
  }
  return small;
}

/** No two of the elements overlap by more than `tolerancePx` in both directions. */
export async function expectNoOverlap(items: Locator, name: string, tolerancePx = 1): Promise<void> {
  const boxes = (await items.evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    return { label: (e as HTMLElement).innerText.trim().replace(/\s+/g, ' ').slice(0, 30), left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width };
  }))).filter((b) => b.w > 0);
  const clashes: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (dx > tolerancePx && dy > tolerancePx) clashes.push(`"${a.label}" × "${b.label}"`);
    }
  }
  expect(clashes, `${name} overlap`).toEqual([]);
}

export interface ContrastIssue {
  text: string;
  ratio: number;
  required: number;
  color: string;
  background: string;
}

/**
 * WCAG 2.x contrast of every visible text node's element against its effective background.
 * Large text (≥ 24px, or ≥ 18.66px bold) needs 3:1, other text 4.5:1. Elements that are
 * disabled / locked are exempt (WCAG 1.4.3 excludes inactive components), as is text over a
 * gradient or image, whose background cannot be computed reliably.
 */
export async function findContrastIssues(page: Page): Promise<ContrastIssue[]> {
  return page.evaluate(() => {
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r, g, b, a };
    };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    };
    const background = (el: Element): { r: number; g: number; b: number } | 'complex' => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.backgroundImage && s.backgroundImage !== 'none') return 'complex';
        const c = parse(s.backgroundColor);
        if (c && c.a >= 0.9) return c;
      }
      return { r: 255, g: 255, b: 255 };
    };
    const issues: { text: string; ratio: number; required: number; color: string; background: string }[] = [];
    const seen = new Set<Element>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el) || !n.textContent || !/[\p{L}\p{N}]/u.test(n.textContent)) continue;
      seen.add(el);
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
      if (el.closest('[disabled], [aria-disabled="true"], [class*="locked" i]')) continue;
      const fg = parse(s.color);
      const bg = background(el);
      if (!fg || bg === 'complex') continue;
      const l1 = lum(fg);
      const l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = parseFloat(s.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
      const required = large ? 3 : 4.5;
      if (ratio + 0.01 < required) {
        issues.push({ text: n.textContent.trim().slice(0, 40), ratio: Math.round(ratio * 100) / 100, required, color: s.color, background: `rgb(${bg.r}, ${bg.g}, ${bg.b})` });
      }
    }
    return issues;
  });
}

/**
 * Text that is cut off: an element with text whose content is wider/taller than its box while
 * its overflow is hidden/clipped (or uses text-overflow: ellipsis).
 */
export async function findClippedText(page: Page): Promise<string[]> {
  return page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => {
    const e = el as HTMLElement;
    if (!e.innerText || !e.innerText.trim() || e.getBoundingClientRect().width === 0) return false;
    const s = getComputedStyle(e);
    const clipsX = /(hidden|clip)/.test(s.overflowX) || s.textOverflow === 'ellipsis';
    const clipsY = /(hidden|clip)/.test(s.overflowY);
    return (clipsX && e.scrollWidth > e.clientWidth + 1) || (clipsY && e.scrollHeight > e.clientHeight + 1 && s.display !== 'inline');
  }).map((e) => `${e.tagName.toLowerCase()}.${String((e as HTMLElement).className).split(' ')[0]} "${(e as HTMLElement).innerText.trim().replace(/\s+/g, ' ').slice(0, 30)}"`));
}

/** Smallest computed font size (px) among visible text. */
export async function minVisibleFontSize(page: Page): Promise<{ size: number; text: string }> {
  return page.evaluate(() => {
    let min = { size: Infinity, text: '' };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent || !/[\p{L}\p{N}]/u.test(n.textContent)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < min.size) min = { size, text: n.textContent.trim().slice(0, 30) };
    }
    return min;
  });
}
