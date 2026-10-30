import { expect, Page } from '@playwright/test';

/**
 * The app header's profile menu ("☰ Guest", top-left on /audio-check, /discover, /roadmap).
 * Opening it shows a dropdown (Instruction Language, Sign Out) over a full-screen backdrop;
 * tapping the backdrop closes it.
 */
export class AppHeader {
    private page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // ============================================
    // LOCATORS
    // ============================================

    menuTrigger = () => this.page.locator('.all-profile__trigger');
    menu = () => this.page.locator('.all-profile__menu');
    backdrop = () => this.page.locator('.all-profile__backdrop');
    signOut = () => this.page.locator('.all-profile__signout');

    // ============================================
    // ACTIONS
    // ============================================

    async openMenu(): Promise<void> {
        await this.menuTrigger().click();
        await expect(this.menu()).toBeVisible();
    }

    /** Close by tapping the backdrop away from the dropdown (bottom-right corner of the screen). */
    async closeMenu(): Promise<void> {
        const vp = this.page.viewportSize()!;
        await this.page.mouse.click(vp.width - 5, vp.height - 5);
        await expect(this.menu()).toBeHidden();
    }
}
