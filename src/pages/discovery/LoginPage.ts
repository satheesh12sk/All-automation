import { expect, Page } from '@playwright/test';
import { AppLanguage, languageByCode } from '../../utils/languages';
import { copy, copyRe } from '../../utils/UiCopy';

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
 * The login page is rendered before the learner picks a learning language, so its labels are
 * matched in English (the login page's own language pill defaults to English) regardless of
 * the run's `lang`.
 */
export class DiscoveryLoginPage {
    private page: Page;
    private readonly shellLang: AppLanguage = languageByCode('english');

    /** Grade selected during guest login (Grade 1..5). Config-driven; default "2". */
    static readonly DEFAULT_GRADE = process.env.GRADE || '2';

    constructor(page: Page) {
        this.page = page;
    }

    // ============================================
    // LOCATORS
    // ============================================

    guestTab = () => this.page.getByRole('button', { name: copyRe('guestTab', this.shellLang, { exact: true }) });
    studentTab = () => this.page.getByRole('button', { name: copyRe('studentTab', this.shellLang, { exact: true }) });
    activeTab = () => this.page.locator('[class*="_tabActive_"]');
    usernameInput = () => this.page.getByPlaceholder(copy('userIdPlaceholder', this.shellLang)[0]);
    passwordInput = () => this.page.getByPlaceholder(copy('passwordPlaceholder', this.shellLang)[0]);
    gradeSelect = () => this.page.locator('select');
    loginButton = () => this.page.getByRole('button', { name: copyRe('loginAsGuest', this.shellLang) });
    errorMessage = () => this.page.locator('[class*="error" i], [role="alert"]');

    // ============================================
    // ACTIONS
    // ============================================

    /** Navigate to the login page of the CONFIGURED environment ('/login' resolves against baseURL). */
    async navigate(): Promise<void> {
        await this.page.goto('/login');
        await expect(this.guestTab()).toBeVisible({ timeout: 30000 });
    }

    /** Switch to the Guest tab; the Grade dropdown only exists on that tab. */
    async selectGuestTab(): Promise<void> {
        await this.guestTab().click();
        await expect(this.gradeSelect()).toBeVisible();
    }

    /** Select "Grade N" in the Grade dropdown. */
    async selectGrade(grade: string): Promise<void> {
        const label = copy('gradeOption', this.shellLang)[0].replace('{number}', grade);
        await this.gradeSelect().selectOption({ label });
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
     * Fill and submit the guest login form. Ends on /audio-check; passing the audio check is
     * MicrophoneTestPage's job.
     */
    async login(username: string, password: string, grade: string = DiscoveryLoginPage.DEFAULT_GRADE): Promise<void> {
        await this.selectGuestTab();
        await this.enterUsername(username);
        await this.enterPassword(password);
        await this.selectGrade(grade);
        await this.clickLogin();
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
