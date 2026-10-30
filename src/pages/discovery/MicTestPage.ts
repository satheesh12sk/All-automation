import { expect, Page } from '@playwright/test';
import { AppLanguage, languageByCode } from '../../utils/languages';
import { copyRe } from '../../utils/UiCopy';

/**
 * Page Object for the audio check at /audio-check (shown right after login).
 *
 * The screen cycles by itself: greeting ("Hi! What's your name?", spoken via TTS) → listening
 * (5 s, with a stop button) → "Nice to meet you!" → /discover. On failure it shows
 * "Didn't catch that!" and retries once, then "We can't hear you…" with TRY AGAIN.
 * There is NO Skip button on this build, so the test must actually pass the check — see
 * src/utils/fakeMedia.ts for the fake voice + speech-recognition stub that make that possible.
 *
 * Its copy follows the app UI language, which is English until the learner changes it.
 */
export class MicrophoneTestPage {
    private page: Page;
    private readonly lang: AppLanguage;

    constructor(page: Page, lang: AppLanguage = languageByCode('english')) {
        this.page = page;
        this.lang = lang;
    }

    // ============================================
    // LOCATORS
    // ============================================

    greeting = () => this.page.getByRole('heading', { name: copyRe('micGreeting', this.lang, { apostrophe: 'any' }) });
    listeningHeading = () => this.page.getByRole('heading', { name: copyRe('micListening', this.lang, { apostrophe: 'any' }) });
    stopButton = () => this.page.locator('[class*="_micButtonWrap_"] button');
    successHeading = () => this.page.getByRole('heading', { name: copyRe('micNiceToMeet', this.lang) });
    notCaughtHeading = () => this.page.getByRole('heading', { name: copyRe('micNotCaught', this.lang, { apostrophe: 'any' }) });
    micErrorHeading = () => this.page.getByRole('heading', { name: copyRe('micError', this.lang, { apostrophe: 'any' }) });
    tryAgainButton = () => this.page.getByRole('button', { name: copyRe('micTryAgain', this.lang) });

    // ============================================
    // ACTIONS / ASSERTIONS
    // ============================================

    async expectOnAudioCheck(): Promise<void> {
        await expect(this.page).toHaveURL(/\/audio-check/);
    }

    /** The prompt that opens the check. It is only on screen ~1.8 s, so call this right after login. */
    async expectGreetingVisible(): Promise<void> {
        await expect(this.greeting().or(this.listeningHeading())).toBeVisible({ timeout: 15000 });
    }

    async expectListening(): Promise<void> {
        await expect(this.listeningHeading()).toBeVisible({ timeout: 15000 });
    }

    /**
     * Wait for the check to pass and hand over to /discover. Fails fast with a pointed message
     * if the app gives up ("We can't hear you"), which means the fake mic is not being heard.
     */
    async waitForPass(): Promise<void> {
        const outcome = await Promise.race([
            this.successHeading().waitFor({ timeout: 40000 }).then(() => 'passed' as const),
            this.micErrorHeading().waitFor({ timeout: 40000 }).then(() => 'mic-error' as const),
        ]);
        expect(outcome, 'audio check reported "can\'t hear you" — is the fake voice WAV being used as the mic? (see fakeMedia.ts)').toBe('passed');
        await this.page.waitForURL(/\/(discover|roadmap)/, { timeout: 20000 });
    }
}
