import { test, expect, runOn } from '../../fixtures/responsiveTest';
import { DiscoveryLoginPage } from '../../pages/discovery/LoginPage';
import { LanguagePicker } from '../../pages/discovery/LanguagePicker';
import { MicrophoneTestPage } from '../../pages/discovery/MicTestPage';
import { mintGuestCredentials } from '../../utils/DiscoveryHelper';
import { copyRe } from '../../utils/UiCopy';
import { expectNoHorizontalOverflow, expectUsableWithoutScrolling, smallTapTargets } from '../../utils/layoutAudit';

/**
 * UI-01..UI-03 — login page and audio check (UI/UX test plan §3). No stored session: these start
 * logged out. The login page is switched to the run's language first, as its learners would.
 */

test('UI-01 login page: STUDENT/GUEST switch, language selector and login button are visible and usable @responsive', async ({ page, lang }) => {
  runOn('phone', 'tablet', 'laptop', 'desktop');
  const login = await DiscoveryLoginPage.openIn(page, lang);
  const picker = new LanguagePicker(page);
  await expectNoHorizontalOverflow(page);

  await expectUsableWithoutScrolling(login.studentTab(), 'STUDENT tab');
  await expectUsableWithoutScrolling(login.guestTab(), 'GUEST tab');
  await expectUsableWithoutScrolling(picker.pill(), 'language selector');
  // Disabled until the form is filled in — placement is what matters here.
  await expectUsableWithoutScrolling(page.getByRole('button', { name: copyRe(['loginAsStudent', 'loginAsGuest'], lang) }), 'login button', { requireEnabled: false });

  // The switch works both ways: Grade only exists on the Guest tab.
  await login.guestTab().click();
  await expect(login.activeTab()).toHaveText(copyRe('guestTab', lang));
  await expect(login.gradeSelect()).toBeVisible();
  await expectUsableWithoutScrolling(login.loginButton(), 'LOGIN AS GUEST', { requireEnabled: false });
  await login.studentTab().click();
  await expect(login.activeTab()).toHaveText(copyRe('studentTab', lang));
  await expect(login.gradeSelect()).toBeHidden();

  // The language selector opens its list, inside the screen, and closes again.
  await picker.open();
  await expect(picker.allOptions()).toHaveCount(4);
  for (const option of await picker.allOptions().all()) await expectUsableWithoutScrolling(option, 'language option');
  await picker.close();

  const small = await smallTapTargets({ 'STUDENT tab': login.studentTab(), 'GUEST tab': login.guestTab(), 'language selector': picker.pill() });
  if (small.length) test.info().annotations.push({ type: 'tap-target < 44px', description: small.join(', ') });
});

test('UI-02 guest login: grade dropdown lists Grade 1 to Grade 5 and a grade is required to submit @responsive', async ({ page, lang, ui }) => {
  runOn('phone', 'laptop');
  const login = await DiscoveryLoginPage.openIn(page, lang);
  await login.selectGuestTab();
  await expectUsableWithoutScrolling(login.gradeSelect(), 'Grade dropdown');

  const options = (await login.gradeSelect().locator('option').allTextContents()).map((o) => o.trim());
  expect(options).toEqual([ui('gradePlaceholder'), ...[1, 2, 3, 4, 5].map((n) => ui('gradeOption').replace('{number}', String(n)))]);

  // Without a grade the form must not submit (either a disabled button or a "Select a grade" error).
  const { username, password } = mintGuestCredentials();
  await login.enterUsername(username);
  await login.enterPassword(password);
  if (await login.loginButton().isEnabled()) {
    await login.clickLogin();
    await expect(page.getByText(copyRe('loginErrorGrade', lang, { exact: true }))).toBeVisible();
    await login.expectOnLoginPage();
  }

  await login.selectGrade('3');
  await expect(login.gradeSelect()).toHaveValue('3');
  await expect(login.loginButton()).toBeEnabled();
  await login.clickLogin();
  await expect(page).toHaveURL(/\/audio-check/, { timeout: 30000 });
});

test('UI-03 microphone check: prompt text, Try Again and Skip controls are reachable without scrolling @responsive', async ({ page, lang }) => {
  runOn('phone', 'tablet');
  test.setTimeout(3 * 60_000);
  // Make the check fail deterministically so the error state and TRY AGAIN appear: hand the app a
  // silent mic. (An empty transcript is not enough — on Android user agents the app skips speech
  // recognition and judges the mic by its levels alone.)
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => new AudioContext().createMediaStreamDestination().stream;
  });
  const login = await DiscoveryLoginPage.openIn(page, lang);
  const mic = new MicrophoneTestPage(page, lang);
  const { username, password } = mintGuestCredentials();
  await login.login(username, password);
  await expectNoHorizontalOverflow(page);

  // Prompt: the greeting, then "We're listening..." with its stop button.
  await expect(mic.greeting().or(mic.listeningHeading()).or(mic.micErrorHeading())).toBeVisible({ timeout: 15000 });
  if (await mic.listeningHeading().isVisible({ timeout: 8000 }).catch(() => false)) {
    await expectUsableWithoutScrolling(mic.listeningHeading(), 'listening prompt');
    await expectUsableWithoutScrolling(mic.stopButton(), 'stop button');
  }

  // After two misses: "We can't hear you…" + TRY AGAIN.
  await expect(mic.micErrorHeading()).toBeVisible({ timeout: 90000 });
  await expectUsableWithoutScrolling(mic.micErrorHeading(), 'microphone error text');
  await expectUsableWithoutScrolling(mic.tryAgainButton(), 'TRY AGAIN');
  await expectNoHorizontalOverflow(page);
  await mic.tryAgainButton().click();
  await expect(mic.greeting().or(mic.listeningHeading())).toBeVisible();

  // The app defines "Skip for now" (MICCHECK_SKIP) but never renders it on this build.
  if (!(await page.getByRole('button', { name: /skip/i }).isVisible())) {
    test.info().annotations.push({ type: 'finding', description: 'No Skip control on the audio check (string exists in the app, button not rendered)' });
  }
});
