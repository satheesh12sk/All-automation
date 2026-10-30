import 'dotenv/config';
import { defineConfig, devices, type Project } from '@playwright/test';
import { resolveBaseUrl } from './config/environments';
import { chromiumFakeMediaArgs, FIREFOX_FAKE_MEDIA_PREFS } from './src/utils/fakeMedia';

/** Per-engine launch/permission settings for the fake mic (see src/utils/fakeMedia.ts). */
const engine = {
  chromium: { browserName: 'chromium', permissions: ['microphone'], launchOptions: { args: chromiumFakeMediaArgs() } },
  firefox: { browserName: 'firefox', launchOptions: { firefoxUserPrefs: FIREFOX_FAKE_MEDIA_PREFS } },
  webkit: { browserName: 'webkit', permissions: ['microphone'] },
} as const;

/**
 * WebKit needs extra system libraries on Linux (`sudo npx playwright install-deps webkit`).
 * WEBKIT_FALLBACK=chromium runs the WebKit profiles (iPhone, iPad, laptop-webkit) in Chromium
 * with the same viewport/touch settings, so layouts can still be checked meanwhile.
 */
const webkitEngine = process.env.WEBKIT_FALLBACK === 'chromium' ? engine.chromium : engine.webkit;

/**
 * Responsive device matrix (UI/UX test plan §4). `metadata.profile` is what the
 * responsive specs use to decide which cases run where (src/fixtures/responsiveTest.ts).
 */
const responsiveProjects: Project[] = [
  { name: 'phone-android', metadata: { profile: 'phone' }, use: { ...devices['Pixel 5'], ...engine.chromium } },
  { name: 'phone-ios', metadata: { profile: 'phone' }, use: { ...devices['iPhone 13'], ...webkitEngine } },
  { name: 'tablet-ios', metadata: { profile: 'tablet' }, use: { ...devices['iPad (gen 7)'], ...webkitEngine } },
  { name: 'laptop-chromium', metadata: { profile: 'laptop' }, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, ...engine.chromium } },
  { name: 'laptop-firefox', metadata: { profile: 'laptop' }, use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 720 }, ...engine.firefox } },
  { name: 'laptop-webkit', metadata: { profile: 'laptop' }, use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 }, ...webkitEngine } },
  { name: 'desktop-chromium', metadata: { profile: 'desktop' }, use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 }, ...engine.chromium } },
].map((p) => ({ ...p, testMatch: /responsive\/.*\.spec\.ts$/, dependencies: ['responsive-setup'] }));

export default defineConfig({
  testDir: './src/tests',
  timeout: 5 * 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['./src/utils/CustomTTAReporter.ts'],
  ],
  use: {
    baseURL: resolveBaseUrl(),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    // Functional regression (Discovery, Foundation, Mastery).
    { name: 'chromium', testIgnore: /responsive\//, use: { ...devices['Desktop Chrome'], ...engine.chromium } },
    // Creates the shared guest sessions (.auth/*.json) the responsive projects start from.
    { name: 'responsive-setup', testMatch: /responsive\/.*\.setup\.ts$/, use: { ...devices['Desktop Chrome'], ...engine.chromium } },
    ...responsiveProjects,
  ],
});
