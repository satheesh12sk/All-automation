import { expect, Page, Response } from '@playwright/test';
import { AppLanguage, languageByCode } from '../../utils/languages';
import { copy, copyRe, lazyProp } from '../../utils/UiCopy';

export interface PlacementCopy {
    lettersLabel: string;
    evaluating: RegExp;
    placementComplete: RegExp;
    placementHeading: RegExp;
    viewMyRoadmap: RegExp;
}

export function placementPatterns(lang: AppLanguage): PlacementCopy {
    const p = {} as PlacementCopy;
    lazyProp(p, 'lettersLabel', () => copy('contentLetters', lang)[0]);
    lazyProp(p, 'evaluating', () => copyRe('evaluating', lang));
    lazyProp(p, 'placementComplete', () => copyRe('placementComplete', lang));
    lazyProp(p, 'placementHeading', () => copyRe('placementHeading', lang, { apostrophe: 'any' }));
    lazyProp(p, 'viewMyRoadmap', () => copyRe('viewMyRoadmap', lang));
    return p;
}

/**
 * Page Object for Discovery Set 3 ("SOUNDS & LETTERS" Letter Hunt) and the placement result.
 *
 * Letter Hunt (10 rounds): a cluster of letter bubbles ([class*="_bubble_"]) and a listen
 * button ([class*="_listenControl_"] > button) that plays the target letter. Any tap moves to
 * the next round; there is no per-round feedback and (on this build) no demo/Skip Demo step.
 *
 * Finding the target letter: the round's audio is <s3>/all-audio-files/<lang>/<contentId>.wav,
 * and the set's items come from GET content-service/.../content/pagination, where each Char
 * item carries that contentId and its text. `trackLetterContent()` records that map; the
 * listen click's played URL is then looked up in it.
 *
 * Result: "Evaluating your responses..." → "ASSESSMENT COMPLETE / You're ready to begin! /
 * Your starting stage: <Foundation|Milestone N>" → "VIEW MY ROADMAP ➔" (/roadmap).
 */
export class PlacementPage {
    private page: Page;
    private readonly copy: PlacementCopy;
    private readonly letterByContentId = new Map<string, string>();
    private tracking = false;

    constructor(page: Page, lang: AppLanguage = languageByCode('english')) {
        this.page = page;
        this.copy = placementPatterns(lang);
    }

    // ============================================
    // LOCATORS
    // ============================================

    contentTypeLabel = () => this.page.locator('[class*="_stepperCategory_"]');
    progressLabel = () => this.page.locator('[class*="_stepperProgress_"]');
    letterBubbles = () => this.page.locator('[class*="_bubble_"]');
    listenButton = () => this.page.locator('[class*="_listenControl_"] > button');
    evaluatingHeading = () => this.page.locator('[class*="_decisionHeading_"]');
    placementHeading = () => this.page.locator('[class*="_placementHeading_"]');
    viewRoadmapButton = () => this.page.getByRole('button', { name: this.copy.viewMyRoadmap });

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Start recording Letter Hunt items from the content API, and hook media playback so the
     * listen click's URL can be read back. Call BEFORE Set 3 loads (i.e. before START SET 3).
     */
    async trackLetterContent(): Promise<void> {
        if (this.tracking) return;
        this.tracking = true;
        this.page.on('response', (r) => void this.recordLetters(r));
        await this.page.evaluate(() => {
            const w = window as unknown as { __playedMedia?: string[] };
            if (w.__playedMedia) return;
            w.__playedMedia = [];
            const orig = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function (this: HTMLMediaElement, ...args: unknown[]) {
                w.__playedMedia!.push(this.currentSrc || this.src);
                return orig.apply(this, args as []);
            };
        });
    }

    private async recordLetters(response: Response): Promise<void> {
        if (!/\/content\/pagination/.test(response.url())) return;
        try {
            const body = await response.json() as { data?: { contentId: string; contentType: string; contentSourceData: { text: string }[] }[] };
            for (const item of body.data ?? []) {
                if (item.contentType === 'Char') this.letterByContentId.set(item.contentId, item.contentSourceData[0].text.trim());
            }
        } catch {
            // non-JSON / aborted responses are irrelevant here
        }
    }

    /** Play the round's prompt and return the target letter (undefined if it can't be resolved). */
    async listenForTarget(): Promise<string | undefined> {
        await this.page.evaluate(() => { (window as unknown as { __playedMedia: string[] }).__playedMedia.length = 0; });
        await this.listenButton().click();
        let url = '';
        await expect.poll(async () => (url = await this.page.evaluate(
            () => (window as unknown as { __playedMedia: string[] }).__playedMedia.at(-1) ?? '',
        )), { timeout: 5000, message: 'listen button did not play any audio' }).not.toBe('');
        const id = /([0-9a-f-]{36})\.\w+(?:\?|$)/i.exec(url)?.[1];
        return id ? this.letterByContentId.get(id) : undefined;
    }

    /** Tap a bubble that is NOT `target`; returns the letter tapped. */
    async tapWrongLetter(target: string | undefined): Promise<string> {
        const letters = (await this.letterBubbles().allInnerTexts()).map((l) => l.trim());
        const index = letters.findIndex((l) => l !== target);
        await this.letterBubbles().nth(index).click();
        return letters[index];
    }

    /**
     * Play every round and tap a wrong letter each time, until the bubbles go away.
     * Returns one record per round. Throws if a target could not be resolved, since then a
     * "wrong" tap might have been correct.
     */
    async failAllRounds(maxRounds = 20): Promise<{ round: string; target: string; tapped: string }[]> {
        const rounds: { round: string; target: string; tapped: string }[] = [];
        await expect(this.letterBubbles().first(), 'Letter Hunt did not start').toBeVisible({ timeout: 30000 });
        for (let i = 0; i < maxRounds; i++) {
            if (!(await this.letterBubbles().first().isVisible())) return rounds;
            const round = ((await this.progressLabel().textContent()) || '').trim();
            const target = await this.listenForTarget();
            if (!target) throw new Error(`Letter Hunt ${round}: could not resolve the target letter from the played audio`);
            const tapped = await this.tapWrongLetter(target);
            rounds.push({ round, target, tapped });
            // Next round (counter changes) or end of set (bubbles disappear).
            await expect.poll(async () => !(await this.letterBubbles().first().isVisible())
                || ((await this.progressLabel().textContent()) || '').trim() !== round, { timeout: 15000 }).toBe(true);
        }
        throw new Error(`Letter Hunt did not end within ${maxRounds} rounds`);
    }

    async clickViewRoadmap(): Promise<void> {
        await this.viewRoadmapButton().click();
        await this.page.waitForURL(/\/roadmap/, { timeout: 30000 });
    }

    // ============================================
    // ASSERTIONS
    // ============================================

    async expectLetterHuntVisible(): Promise<void> {
        await expect(this.contentTypeLabel()).toHaveText(this.copy.lettersLabel, { ignoreCase: true, timeout: 20000 });
        await expect(this.letterBubbles().first()).toBeVisible();
        await expect(this.listenButton()).toBeVisible();
    }

    /** Result screen, optionally checking the starting stage text (e.g. /Foundation/). */
    async expectPlacementResult(stage?: RegExp): Promise<void> {
        await expect(this.placementHeading()).toHaveText(this.copy.placementHeading, { timeout: 60000 });
        await expect(this.page.getByText(this.copy.placementComplete)).toBeVisible();
        if (stage) await expect(this.page.getByText(stage)).toBeVisible();
        await expect(this.viewRoadmapButton()).toBeVisible();
    }
}
