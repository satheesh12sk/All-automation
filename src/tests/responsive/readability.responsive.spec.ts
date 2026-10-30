import type { Locator, Page } from '@playwright/test';
import { test, expect, runOn } from '../../fixtures/responsiveTest';
import { AssessmentPage } from '../../pages/discovery/AssessmentPage';
import { DiscoveryLoginPage } from '../../pages/discovery/LoginPage';
import { LanguagePicker } from '../../pages/discovery/LanguagePicker';
import { RoadmapPage } from '../../pages/discovery/RoadmapPage';
import { authFile, type GuestStage } from '../../utils/guestSession';
import { expectNoHorizontalOverflow, expectReachable, findClippedText, findContrastIssues } from '../../utils/layoutAudit';

/**
 * UI-11 (browser zoom 200%) and UI-12 (typography and colour) on the main screens.
 *
 * Zoom: at 200% a 1280x720 laptop lays pages out in a 640x360 CSS-px viewport, so the zoom case
 * resizes the viewport to that — the same media queries and reflow a real 200% zoom triggers.
 */

interface Screen {
  name: string;
  session?: GuestStage;
  open: (page: Page) => Promise<void>;
  controls: (page: Page) => Record<string, Locator>;
}

const SCREENS: Screen[] = [
  {
    name: 'login',
    open: async (page) => {
      const login = new DiscoveryLoginPage(page);
      await login.navigate();
      await login.selectGuestTab();
    },
    controls: (page) => {
      const login = new DiscoveryLoginPage(page);
      return { 'STUDENT tab': login.studentTab(), 'User ID': login.usernameInput(), Password: login.passwordInput(), Grade: login.gradeSelect(), 'LOGIN AS GUEST': login.loginButton() };
    },
  },
  {
    name: 'discover',
    session: 'discover',
    open: async (page) => {
      await page.goto('/discover');
      await new AssessmentPage(page).expectStartAssessmentVisible();
    },
    controls: (page) => ({ 'language selector': new LanguagePicker(page).pill(), 'START ASSESSMENT': new AssessmentPage(page).startAssessmentButton() }),
  },
  {
    name: 'roadmap',
    session: 'roadmap',
    open: async (page) => {
      await page.goto('/roadmap');
      await expect(new RoadmapPage(page).activeTile()).toBeVisible({ timeout: 30000 });
    },
    controls: (page) => ({ 'active stage tile': new RoadmapPage(page).activeTile(), 'START F1 ACTIVITY': new RoadmapPage(page).startActivityButton('F1') }),
  },
];

for (const screen of SCREENS) {
  test.describe(`${screen.name} screen`, () => {
    if (screen.session) test.use({ storageState: authFile(screen.session) });

    test(`UI-11 browser zoom 200% (${screen.name}): text stays readable and no control is clipped @responsive`, async ({ page }) => {
      runOn('laptop');
      const { width, height } = page.viewportSize()!;
      await page.setViewportSize({ width: Math.round(width / 2), height: Math.round(height / 2) });
      await screen.open(page);

      await expectNoHorizontalOverflow(page);
      expect(await findClippedText(page), 'text cut off at 200% zoom').toEqual([]);
      for (const [name, control] of Object.entries(screen.controls(page))) await expectReachable(control, `${name} at 200% zoom`);
    });

    test(`UI-12 typography and colour (${screen.name}): text contrast meets WCAG AA and headings stand out @responsive`, async ({ page }) => {
      runOn('phone', 'tablet', 'laptop', 'desktop');
      await screen.open(page);

      const issues = await findContrastIssues(page);
      expect(issues.map((i) => `"${i.text}" ${i.ratio}:1 (needs ${i.required}:1) ${i.color} on ${i.background}`), 'low-contrast text').toEqual([]);

      // Headings must be larger than the page's base body text.
      const sizes = await page.evaluate(() => ({
        body: parseFloat(getComputedStyle(document.body).fontSize),
        headings: [...document.querySelectorAll('h1, h2')].filter((h) => h.getBoundingClientRect().width > 0)
          .map((h) => ({ text: (h as HTMLElement).innerText.trim().slice(0, 30), size: parseFloat(getComputedStyle(h).fontSize) })),
      }));
      for (const h of sizes.headings) {
        expect(h.size, `heading "${h.text}" (${h.size}px) should be larger than body text (${sizes.body}px)`).toBeGreaterThan(sizes.body);
      }
      test.info().annotations.push({ type: 'note', description: 'No design-token values supplied; checked WCAG AA contrast and heading/body size hierarchy only.' });
    });
  });
}
