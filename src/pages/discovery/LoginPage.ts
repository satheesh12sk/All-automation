import { expect, Page } from '@playwright/test';
import { gotoApp } from '../../utils/appNav';
import { AppLanguage, languageByCode } from '../../utils/languages';
import { copy, copyRe } from '../../utils/UiCopy';
import { LanguagePicker } from './LanguagePicker';

/**
 * Page Object for the ALL login page on the new UI (axl-test, 2026-10).
 * URL: <baseURL>/login
 *
 * Login flow:
 *   1. Open /login.
 *   2. Click the "GUEST" tab (a plain <button>, not role="tab" as on the old UAT build).
 *   3. Enter User ID and Password.
 *   4. Pick "Grade N" in the Grade <select> (options Grade 1..Grade 5; env GRADE, default 2).
 *   5. Click "LOGIN AS GUEST" → the app goes straight to /audio-check (no "Continue to ALL"
 *      portal and no iframe on this build).
 *
 * lab2 (AXL portal, 2026-11) differs: the STUDENT/GUEST switch is role="tab", grades are "1".."8",
 * a "Microphone Access Required" modal and an "App Ready" toast cover the form, and login lands on
 * /home — a card page (ALL, AML, ALL v3) where the FIRST card opens ALL at /learn/audio-check.
 *
 * The login page's own language pill defaults to English, so labels are matched in English
 * unless `shellLang` says the learner switched the pill first (picking Telugu relabels the
 * whole form, e.g. GUEST → "అతిథి").
 */
export class DiscoveryLoginPage {
    private page: Page;
    private readonly shellLang: AppLanguage;

    /** Grade selected during guest login (Grade 1..5). Config-driven; default "2". */
    static readonly DEFAULT_GRADE = process.env.GRADE || '2';

    constructor(page: Page, shellLang: AppLanguage = languageByCode('english')) {
        this.page = page;
        this.shellLang = shellLang;
    }

    // ============================================
    // LOCATORS
    // ============================================

    // A plain button on axl-test, role="tab" on lab2.
    guestTab = () => this.switchTab('guestTab');
    studentTab = () => this.switchTab('studentTab');
    private switchTab = (key: 'guestTab' | 'studentTab') => {
        const name = copyRe(key, this.shellLang, { exact: true });
        return this.page.getByRole('button', { name }).or(this.page.getByRole('tab', { name }));
    };
    activeTab = () => this.page.locator('[class*="_tabActive_"]');
    usernameInput = () => this.page.getByPlaceholder(copy('userIdPlaceholder', this.shellLang)[0]);
    passwordInput = () => this.page.getByPlaceholder(copy('passwordPlaceholder', this.shellLang)[0]);
    gradeSelect = () => this.page.locator('select');
    loginButton = () => this.page.getByRole('button', { name: copyRe('loginAsGuest', this.shellLang) });
    errorMessage = () => this.page.locator('[class*="error" i], [role="alert"]');
    // lab2 only: overlays on /login, and the card buttons on /home ("Continue to ALL" first).
    allowMicButton = () => this.page.getByRole('button', { name: 'Allow Microphone' });
    appReadyGotIt = () => this.page.getByRole('button', { name: 'Got it!' });
    portalCardButtons = () => this.page.locator('button').filter({ hasText: /^Continue to / });

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Open /login and switch its language pill to `lang`, as a learner of that language does
     * first; returns the page object for the relabelled form.
     */
    static async openIn(page: Page, lang: AppLanguage): Promise<DiscoveryLoginPage> {
        await new DiscoveryLoginPage(page).navigate();
        if (lang.code !== 'en') await new LanguagePicker(page).select(lang);
        return new DiscoveryLoginPage(page, lang);
    }

    /** Navigate to the login page of the CONFIGURED environment ('/login' resolves against baseURL). */
    async navigate(): Promise<void> {
        // lab2's modal and toast can appear at any point while on /login; clear them whenever they block.
        await this.page.addLocatorHandler(this.allowMicButton(), (b) => b.click(), { noWaitAfter: true });
        await this.page.addLocatorHandler(this.appReadyGotIt(), (b) => b.click(), { noWaitAfter: true });
        await this.page.goto('/login');
        await expect(this.guestTab()).toBeVisible({ timeout: 30000 });
    }

    /** Switch to the Guest tab; the Grade dropdown only exists on that tab. */
    async selectGuestTab(): Promise<void> {
        await this.guestTab().click();
        await expect(this.gradeSelect()).toBeVisible();
    }

    /** Select "Grade N" in the Grade dropdown (just "N" on lab2). */
    async selectGrade(grade: string): Promise<void> {
        const label = copy('gradeOption', this.shellLang)[0].replace('{number}', grade);
        const labels = (await this.gradeSelect().locator('option').allTextContents()).map((o) => o.trim());
        await this.gradeSelect().selectOption({ label: labels.includes(label) ? label : grade });
    }

    async enterUsername(username: string): Promise<void> {
        await this.usernameInput().fill(username);
    }

    async enterPassword(password: string): Promise<void> {
        await this.passwordInput().fill(password);
    }

    /** Click "LOGIN AS GUEST". */
    async clickLogin(): Promise<void> {
        await this.loginButton().click();
    }

    /**
     * Fill and submit the guest login form. Ends on the audio check (/audio-check, or
     * /learn/audio-check on lab2 after its card page); passing it is MicrophoneTestPage's job.
     */
    async login(username: string, password: string, grade: string = DiscoveryLoginPage.DEFAULT_GRADE): Promise<void> {
        await this.selectGuestTab();
        await this.enterUsername(username);
        await this.enterPassword(password);
        await this.selectGrade(grade);
        await this.clickLogin();
        await this.page.waitForURL(/\/(audio-check|home)(\?|$)/, { timeout: 30000 });
        if (/\/home(\?|$)/.test(new URL(this.page.url()).pathname)) await this.continueToAll();
    }

    /**
     * lab2's /home card page: open ALL from the first card. The portal shows ALL in a same-origin
     * iframe at /learn; it is then reopened top-level (gotoApp) so every page object drives ALL
     * directly — same session, since localStorage is shared.
     */
    async continueToAll(): Promise<void> {
        await expect(this.portalCardButtons().first()).toBeVisible({ timeout: 30000 });
        await this.portalCardButtons().first().click();
        await this.page.waitForURL(/\/learn(\?|$)/, { timeout: 30000 });
        await gotoApp(this.page, '/audio-check');
        await this.page.waitForURL(/\/audio-check/, { timeout: 30000 });
    }

    // ============================================
    // ASSERTIONS
    // ============================================

    async expectOnLoginPage(): Promise<void> {
        await expect(this.page).toHaveURL(/\/login/);
    }

    async expectUsernameFieldVisible(): Promise<void> {
        await expect(this.usernameInput()).toBeVisible();
    }

    async expectPasswordFieldVisible(): Promise<void> {
        await expect(this.passwordInput()).toBeVisible();
    }

    async expectLoginButtonVisible(): Promise<void> {
        await expect(this.loginButton()).toBeVisible();
    }
}
