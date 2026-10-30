import { expect, Page } from '@playwright/test';
import { AppLanguage, languageByCode } from '../../utils/languages';
import { copy, copyRe, lazyProp } from '../../utils/UiCopy';
import { TRANSITION_KEYS } from '../../utils/transitions';

/** The shape `assessmentPatterns` resolves, one key per on-screen string this page matches. */
export interface AssessmentCopy {
    startAssessment: RegExp;
    findStartingPoint: RegExp;
    demoBanner: RegExp;
    continueLabel: RegExp;
    setComplete: (n: number) => RegExp;
    startSet: (n: number) => RegExp;
    contentType: { sentences: string; words: string; letters: string };
}

/**
 * Every on-screen string this page object matches, resolved for one language.
 * Each key is lazy (`lazyProp`), so a language missing a translation only throws when something
 * actually reads that key.
 */
export function assessmentPatterns(lang: AppLanguage): AssessmentCopy {
    const K = TRANSITION_KEYS;
    const p = {} as AssessmentCopy;
    lazyProp(p, 'startAssessment', () => copyRe('startAssessment', lang));
    lazyProp(p, 'findStartingPoint', () => copyRe('findStartingPoint', lang, { apostrophe: 'any' }));
    lazyProp(p, 'demoBanner', () => copyRe('demoBanner', lang, { apostrophe: 'any' }));
    lazyProp(p, 'continueLabel', () => copyRe(K.continue, lang));
    lazyProp(p, 'setComplete', () => (n: number) => copyRe(K.setComplete, lang, { vars: { number: n } }));
    lazyProp(p, 'startSet', () => (n: number) => copyRe(K.startSet, lang, { vars: { number: n } }));
    lazyProp(p, 'contentType', () => ({
        sentences: copy('contentSentences', lang)[0],
        words: copy('contentWords', lang)[0],
        letters: copy('contentLetters', lang)[0],
    }));
    return p;
}

/** What the assessment screen is showing after a transition settles. */
export type AssessmentState = 'item' | 'setComplete' | 'letters' | 'evaluating';

/**
 * Page Object for the Discovery assessment at /discover (new UI, axl-test).
 *
 * Layout: a stepper (SET 1 / SET 2 / SET 3 pills, a content-type label such as SENTENCES and a
 * "n / total" counter) above a card holding the text to read and the controls:
 *   idle      → mic button                      ([class*="_micWrap_"] > button)
 *   recording → stop button (square icon)       ([class*="_controls_"] > button:has(svg rect))
 *   recorded  → play (triangle) + retry (arrow) ([class*="_reviewControls_"] > button)
 *              and a green "CONTINUE ➔" that moves to the next item (the old orange "next").
 * After the last item of a set: "Set N Complete" + "START SET N+1 ➔".
 *
 * NOTE ON LOCATORS: the new UI uses CSS modules (`_controls_j4bcx_221`). The hash suffix changes
 * per build, the readable prefix does not, so we match `[class*="_name_"]` and the icon shape.
 */
export class AssessmentPage {
    private page: Page;
    /** Every on-screen string this page matches, resolved for the run's language. */
    private readonly copy: ReturnType<typeof assessmentPatterns>;

    /** `lang` defaults to English so any call site not yet carrying the LANG axis still works. */
    constructor(page: Page, lang: AppLanguage = languageByCode('english')) {
        this.page = page;
        this.copy = assessmentPatterns(lang);
    }

    // ============================================
    // LOCATORS
    // ============================================

    startAssessmentButton = () => this.page.getByRole('button', { name: this.copy.startAssessment });
    findStartingPointHeading = () => this.page.getByRole('heading', { name: this.copy.findStartingPoint });
    demoBanner = () => this.page.locator('[class*="_demoBanner_"]');

    // Stepper
    activeSetPill = () => this.page.locator('[class*="_pillActive_"]');
    contentTypeLabel = () => this.page.locator('[class*="_stepperCategory_"]');
    progressLabel = () => this.page.locator('[class*="_stepperProgress_"]');

    // Item card
    sentenceText = () => this.page.locator('[class*="_wordText_"]').first();

    // ---- Recording controls ----
    mikeButton = () => this.page.locator('[class*="_micWrap_"] > button');
    stopButton = () => this.page.locator('[class*="_controls_"] > button:has(svg rect)');
    playButton = () => this.page.locator('[class*="_reviewControls_"] > button:has(svg polygon)');
    retryButton = () => this.page.locator('[class*="_reviewControls_"] > button:has(svg path)');
    // "CONTINUE ➔" — moves to the next item (replaces the old build's separate Next button).
    nextButton = () => this.page.locator('[class*="_controls_"] > button.all-btn').filter({ hasText: this.copy.continueLabel });

    // ---- Set transitions ----
    setCompleteHeading = (n?: number) => this.page.locator('[class*="_setHeading_"]')
        .filter(n === undefined ? {} : { hasText: this.copy.setComplete(n) });
    startSetButton = (n: number) => this.page.getByRole('button', { name: this.copy.startSet(n) });

    // Signals used to tell which state the screen settled in.
    private letterBubbles = () => this.page.locator('[class*="_bubble_"]');
    private decisionHeading = () => this.page.locator('[class*="_decisionHeading_"], [class*="_placementHeading_"]');

    // ============================================
    // ACTIONS
    // ============================================

    /** Click Start Assessment and wait for the first (demo) item. */
    async clickStartAssessment(): Promise<void> {
        await this.startAssessmentButton().click();
        await expect(this.mikeButton()).toBeVisible({ timeout: 30000 });
    }

    /** Start recording. */
    async clickMike(): Promise<void> {
        await this.mikeButton().click();
        await expect(this.stopButton()).toBeVisible();
    }

    /** Stop recording; the review controls (play / retry / continue) replace it. */
    async clickStop(): Promise<void> {
        // The app can end a recording by itself (seen while the server was slow); then there is no
        // stop button left to press, and the review controls below are what matters.
        await this.stopButton().click({ timeout: 5000 }).catch(() => undefined);
        await expect(this.nextButton()).toBeVisible({ timeout: 15000 });
    }

    async clickPlay(): Promise<void> {
        await this.playButton().click();
    }

    // ---- Playback verification ----------------------------------------------
    // "The Play button is still visible after clicking it" is true whether or not anything
    // played, so a replay test built on that proves nothing. These methods let a spec assert
    // that audio actually STARTED, via an <audio> element OR Web Audio.

    /** Install the playback probe. Must be called BEFORE the click that starts playback. */
    async installPlaybackProbe(): Promise<void> {
        await this.page.evaluate(() => {
            const w = window as unknown as { __playbackProbe?: { mediaPlays: number; webAudioStarts: number; maxTime: number } };
            if (w.__playbackProbe) {
                w.__playbackProbe.mediaPlays = 0;
                w.__playbackProbe.webAudioStarts = 0;
                w.__playbackProbe.maxTime = 0;
                return;
            }
            const probe = { mediaPlays: 0, webAudioStarts: 0, maxTime: 0 };
            w.__playbackProbe = probe;

            const origPlay = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function (this: HTMLMediaElement, ...args: unknown[]) {
                probe.mediaPlays++;
                this.addEventListener('timeupdate', () => {
                    if (this.currentTime > probe.maxTime) {
                        probe.maxTime = this.currentTime;
                    }
                });
                return origPlay.apply(this, args as []);
            };

            const BufferSource = (window as unknown as { AudioBufferSourceNode?: { prototype: { start: unknown } } }).AudioBufferSourceNode;
            if (BufferSource) {
                const proto = BufferSource.prototype as { start: (...a: unknown[]) => unknown };
                const origStart = proto.start;
                proto.start = function (this: unknown, ...args: unknown[]) {
                    probe.webAudioStarts++;
                    return origStart.apply(this, args);
                };
            }
        });
    }

    /** What the probe has observed since `installPlaybackProbe`. */
    async playbackObserved(): Promise<{ mediaPlays: number; webAudioStarts: number; maxTime: number }> {
        return await this.page.evaluate(() => {
            const w = window as unknown as { __playbackProbe?: { mediaPlays: number; webAudioStarts: number; maxTime: number } };
            return w.__playbackProbe || { mediaPlays: 0, webAudioStarts: 0, maxTime: 0 };
        });
    }

    async expectPlaybackStarted(): Promise<void> {
        await expect.poll(async () => {
            const o = await this.playbackObserved();
            return o.mediaPlays + o.webAudioStarts;
        }, {
            timeout: 10000,
            message: 'expected replay to start audio playback, but neither HTMLMediaElement.play() '
                + 'nor AudioBufferSourceNode.start() fired. Either the Play button is a no-op, or '
                + 'this build replays audio by a mechanism the probe does not hook '
                + '(see AssessmentPage.installPlaybackProbe)',
        }).toBeGreaterThan(0);
    }

    /** Discard the recording; the mic button comes back. */
    async clickRetry(): Promise<void> {
        await this.retryButton().click();
        await expect(this.mikeButton()).toBeVisible();
    }

    /** CONTINUE ➔ to the next item (or to the set-complete screen after the last one). */
    async clickNext(): Promise<void> {
        await this.nextButton().click();
    }

    /** Alias kept for older call sites: the completion "continue" is now START SET N. */
    async clickContinue(): Promise<void> {
        await this.clickNext();
    }

    /** Record the current item: mic → speak (the fake voice plays) → stop. */
    async recordSentence(recordMs = 2000): Promise<void> {
        await this.clickMike();
        await this.page.waitForTimeout(recordMs); // rule-allow: no-hard-waits — recording length, not a sync wait
        await this.clickStop();
    }

    async getSentenceText(): Promise<string> {
        return ((await this.sentenceText().textContent()) || '').trim();
    }

    async getProgress(): Promise<string> {
        return ((await this.progressLabel().textContent()) || '').trim();
    }

    /**
     * After CONTINUE, wait until the screen settles on the next item (counter changed),
     * the set-complete screen, Letter Hunt, or the evaluation screen. The app shows
     * "ONE MOMENT..." while it uploads the recording, so this polls rather than sleeps.
     */
    async waitForNextState(previousProgress: string, timeout = 45000): Promise<AssessmentState> {
        let state: AssessmentState | undefined;
        await expect.poll(async () => {
            if (await this.setCompleteHeading().isVisible()) return (state = 'setComplete');
            if (await this.letterBubbles().first().isVisible()) return (state = 'letters');
            if (await this.decisionHeading().isVisible()) return (state = 'evaluating');
            if (await this.mikeButton().isVisible() && (await this.getProgress()) !== previousProgress) return (state = 'item');
            return 'pending';
        }, { timeout, intervals: [500], message: `assessment did not move past item "${previousProgress}"` }).not.toBe('pending');
        return state!;
    }

    /** Record the current item and CONTINUE; returns where the screen settled. */
    async completeCurrentItem(): Promise<AssessmentState> {
        const before = await this.getProgress();
        await this.recordSentence();
        await this.clickNext();
        return this.waitForNextState(before);
    }

    /** Record items until the set-complete screen; returns the item texts seen. */
    async completeRemainingItemsInSet(maxItems = 20): Promise<string[]> {
        const seen: string[] = [];
        for (let i = 0; i < maxItems; i++) {
            seen.push(await this.getSentenceText());
            if ((await this.completeCurrentItem()) !== 'item') return seen;
        }
        throw new Error(`set did not complete within ${maxItems} items`);
    }

    /** Kept for older call sites: completes the current set regardless of `sentenceCount`. */
    async completeAllSentences(_sentenceCount: number = 5): Promise<void> {
        await this.completeRemainingItemsInSet();
    }

    async clickStartSet(n: number): Promise<void> {
        await this.startSetButton(n).click();
    }

    // ============================================
    // ASSERTIONS
    // ============================================

    async expectStartAssessmentVisible(): Promise<void> {
        await expect(this.startAssessmentButton()).toBeVisible({ timeout: 15000 });
    }

    async expectDemoItemVisible(): Promise<void> {
        await expect(this.demoBanner()).toBeVisible({ timeout: 20000 });
        await expect(this.demoBanner()).toHaveText(this.copy.demoBanner);
    }

    /** Text to read is populated (the card renders empty during the "GET READY" countdown). */
    async expectSentenceVisible(): Promise<void> {
        await expect(this.sentenceText()).toBeVisible({ timeout: 20000 });
        await expect(this.sentenceText()).toHaveText(/\S/, { timeout: 20000 });
    }

    async expectProgress(pattern: RegExp): Promise<void> {
        await expect(this.progressLabel()).toHaveText(pattern);
    }

    async expectContentType(kind: keyof AssessmentCopy['contentType']): Promise<void> {
        await expect(this.contentTypeLabel()).toHaveText(this.copy.contentType[kind], { ignoreCase: true });
    }

    async expectActiveSet(n: number): Promise<void> {
        await expect(this.activeSetPill()).toContainText(String(n));
    }

    async expectMikeButtonVisible(): Promise<void> {
        await expect(this.mikeButton()).toBeVisible({ timeout: 15000 });
    }

    async expectPlayButtonVisible(): Promise<void> {
        await expect(this.playButton()).toBeVisible();
    }

    async expectRetryButtonVisible(): Promise<void> {
        await expect(this.retryButton()).toBeVisible();
    }

    async expectNextButtonVisible(): Promise<void> {
        await expect(this.nextButton()).toBeVisible();
    }

    async expectSetComplete(n: number): Promise<void> {
        await expect(this.setCompleteHeading(n)).toBeVisible({ timeout: 30000 });
        await expect(this.startSetButton(n + 1)).toBeVisible();
    }
}
