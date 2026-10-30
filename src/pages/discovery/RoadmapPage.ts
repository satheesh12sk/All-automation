import { expect, Page } from '@playwright/test';
import { AppLanguage, languageByCode } from '../../utils/languages';
import { copyRe } from '../../utils/UiCopy';

/**
 * Page Object for the learning roadmap (/roadmap) and the milestone intro (/milestone-intro).
 *
 * /roadmap lists milestone tiles (M9..M1, F3..F1, Discovery); the learner's current stage is the
 * `.all-milestone-tile--active` tile, with "START <stage> ACTIVITY ➔" below.
 * /milestone-intro shows the stage name and "START <stage> ACTIVITY 🚀", which opens /learn.
 */
export class RoadmapPage {
    private page: Page;
    private readonly lang: AppLanguage;

    constructor(page: Page, lang: AppLanguage = languageByCode('english')) {
        this.page = page;
        this.lang = lang;
    }

    // ============================================
    // LOCATORS
    // ============================================

    tiles = () => this.page.locator('.all-milestone-tile');
    activeTile = () => this.page.locator('.all-milestone-tile--active');
    startActivityButton = (stage: string) => this.page.getByRole('button', {
        name: copyRe('startMilestoneActivity', this.lang, { vars: { milestone: stage } }),
    });

    // ============================================
    // ACTIONS
    // ============================================

    /** Roadmap → milestone intro → /learn for `stage` (e.g. 'F1'). */
    async startStageActivity(stage: string): Promise<void> {
        await this.startActivityButton(stage).click();
        await this.page.waitForURL(/\/milestone-intro/, { timeout: 30000 });
        await this.startActivityButton(stage).click();
        await this.page.waitForURL(/\/learn/, { timeout: 30000 });
    }

    // ============================================
    // ASSERTIONS
    // ============================================

    /** The active tile is `stage` (e.g. 'F1') and its START button is offered. */
    async expectActiveStage(stage: string): Promise<void> {
        await expect(this.page).toHaveURL(/\/roadmap/);
        await expect(this.activeTile()).toContainText(stage);
        await expect(this.startActivityButton(stage)).toBeVisible();
    }
}
