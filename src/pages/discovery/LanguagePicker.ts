import { expect, Page } from '@playwright/test';
import { AppLanguage } from '../../utils/languages';
import { copyRe } from '../../utils/UiCopy';

/**
 * The "🌐 <Language>" pill in the app header and the "Select Language" modal it opens
 * (on /discover, /roadmap and /login). Options are buttons labelled "<native> <English>",
 * e.g. "हिन्दी Hindi"; the modal closes via DONE (Escape does not close it).
 */
export class LanguagePicker {
    private page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // ============================================
    // LOCATORS
    // ============================================

    pill = () => this.page.locator('.all-language-pill');
    modalTitle = () => this.page.locator('.all-language-modal__title');
    option = (lang: AppLanguage) => this.page.locator('.all-language-option').filter({ hasText: lang.englishLabel });
    selectedOption = () => this.page.locator('.all-language-option--selected');
    // DONE is labelled in the language currently shown, so match any language's wording.
    doneButton = () => this.page.locator('.all-language-modal__done');
    closeButton = () => this.page.locator('.all-language-modal__close');
    allOptions = () => this.page.locator('.all-language-option');

    // ============================================
    // ACTIONS
    // ============================================

    async open(): Promise<void> {
        await this.pill().click();
        await expect(this.modalTitle()).toBeVisible();
    }

    /** Open the modal, pick `lang`, confirm with DONE. */
    async select(lang: AppLanguage): Promise<void> {
        await this.open();
        await this.option(lang).click();
        await expect(this.selectedOption()).toContainText(lang.englishLabel);
        await this.doneButton().click();
        await expect(this.modalTitle()).toBeHidden();
    }

    /** Dismiss with the × button, keeping the current language. */
    async close(): Promise<void> {
        await this.closeButton().click();
        await expect(this.modalTitle()).toBeHidden();
    }

    // ============================================
    // ASSERTIONS
    // ============================================

    async expectCurrent(lang: AppLanguage): Promise<void> {
        await expect(this.pill()).toContainText(lang.nativeLabel);
    }

    async expectDoneLabel(lang: AppLanguage): Promise<void> {
        await expect(this.doneButton()).toHaveText(copyRe('languageModalDone', lang));
    }
}
