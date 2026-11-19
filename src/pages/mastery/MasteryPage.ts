import { expect, Page } from '@playwright/test';
import { AppLanguage, LangCode, languageByCode } from '../../utils/languages';
import { SILENT_TRANSCRIPT } from '../../utils/fakeMedia';
import { copy, copyRe, UiCopyKey } from '../../utils/UiCopy';
import { FoundationPage, StepResult } from '../foundation/FoundationPage';

export type MasteryLevel = 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M9';

/** How the learner reads: the sentence itself, unrelated words, or nothing at all (mic times out). */
export type Reading = 'correct' | 'wrong' | 'silent';

/** Feedback after one reading: "0% Almost there. Let's try again. 0 of 5 words right…". */
export interface ReadingFeedback {
    percent: number | null;
    headline: string;
    sub: string;
    /** Next action offered: "NEXT", "TRY AGAIN", "READ ALONG", "CONTINUE". */
    action: string;
}

export interface MasteryStepResult extends StepResult {
    /** Showcase steps (S1/S2): the verdict screen — "pass" ("🏆 S1 passed!") or "fail" ("S1 not quite yet"). */
    outcome?: 'pass' | 'fail';
    /** End screen text when the step ended the milestone: "🎉 Milestone 4 Complete! M4 M5"; after M9 "🎉 Hurray!!! …" (en) or "🎉 You finished every milestone!" (te). */
    milestoneComplete?: string;
    /** Per-reading word scores (%), in order. */
    scores: number[];
}

export interface StepOptions {
    /** How practice items are read (showcase verdicts come from stubShowcaseVerdict()). */
    reading?: Reading;
    /** Fail when the screen has not changed for this long. */
    stallMs?: number;
    maxMs?: number;
}

/** Words that appear in no text of the language: every word of the item is marked wrong. */
const WRONG_TRANSCRIPT: Record<LangCode, string> = {
    en: 'zebra quantum violet',
    hi: 'ङञ झञ ढठथ',
    te: 'ఙఞ ఝఞ ఢఠథ',
    kn: 'ಙಞ ಝಞ ಢಠಥ',
};
/** Buttons that move a step along (feedback, transitions, self-paced controls). */
const ACTION_KEYS: UiCopyKey[] = ['masteryNext', 'masteryContinue', 'selfPacedStart', 'selfPacedFinish', 'masteryTryAgain', 'masteryReadAlong', 'masteryNowIRead'];
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Page Object for the Mastery journey at /learn (M4–M9) on the new UI (axl-test), in the run's
 * language: every label and message is matched through UiCopy (copied from the app's i18n).
 *
 * Every M4–M9 milestone has the same eight steps (app config, see docs/BUILD_HISTORY.md):
 *   P1-P2, P3-P4, P5-P6   practice  combined-read-aloud-and-self-paced-reading
 *   🏆 S1                  showcase  read-aloud-2.0 (checkpoint; fail → back to P1)
 *   P7-P8, P9-P10, P11-P12 practice
 *   🏆 S2                  showcase  (pass → "Milestone N Complete!", next milestone; after M9 the
 *                                    course-complete screen "🎉 Hurray!!!")
 * M4–M6 read sentences, M7–M9 short paragraphs.
 *
 * Practice pair, one UP NEXT card ("P1 · Read Aloud"), two parts:
 *   Read Aloud (odd P)   10 items: card + "⏱ 20s" + "TAP THE MIC, THEN READ". Wrong → TRY AGAIN (red words)
 *                        → READ ALONG (audio, "NOW I'LL READ") → FINAL TRY → NEXT. Summary "10 / 10 pieces read well".
 *                        Scored in the browser on the Web Speech transcript (window.__fakeTranscript).
 *   Self-paced (even P)  10 items: START, then NEXT reveals the next word(s), FINISH, then
 *                        "Did you see this word in the text? <word>" NO / YES.
 * Showcase: 10 items with 5 hearts ("You lost a heart"), scored on the server (showcaseVerdict.ts);
 * out of hearts or a "fail" set result → "S<n> not quite yet".
 */
export class MasteryPage {
    private page: Page;
    private readonly lang: AppLanguage;
    /** UP NEXT card and node strip are shared with the Foundation journey. */
    readonly steps: FoundationPage;
    private lastSentence = '';
    private readonly actionRe: RegExp;

    constructor(page: Page, lang: AppLanguage = languageByCode('english')) {
        this.page = page;
        this.lang = lang;
        this.steps = new FoundationPage(page, lang);
        this.actionRe = this.label(ACTION_KEYS);
    }

    /** A button label starting with any wording of `key`, e.g. label('masteryNext') matches "NEXT ➔" / "తర్వాత ➔". */
    label(key: UiCopyKey | UiCopyKey[]): RegExp {
        return new RegExp(`^\\s*${copyRe(key, this.lang, { apostrophe: 'any' }).source}`, 'i');
    }

    /** Any wording of `key` in the run's language (see copyRe). */
    text(key: UiCopyKey | UiCopyKey[], opts: Parameters<typeof copyRe>[2] = {}): RegExp {
        return copyRe(key, this.lang, { apostrophe: 'any', ...opts });
    }

    // ============================================
    // LOCATORS
    // ============================================

    /** The text to read (sentence, or paragraph on M7): a card of `_word_` spans. */
    readingCard = () => this.page.locator('[class*="_card_"]').filter({ has: this.page.locator('[class*="_word_"]') }).first();
    words = () => this.readingCard().locator('[class*="_word_"]');
    wrongWords = () => this.readingCard().locator('[class*="_wrong_"]');
    timerChip = () => this.page.locator('[class*="_timeChip_"]');
    hint = () => this.page.locator('[class*="_hint_"]');
    controlLabel = () => this.page.locator('[class*="_controlLabel_"]');
    micButton = () => this.page.getByRole('button', { name: this.text('masteryTapMic') });
    doneButton = () => this.page.getByRole('button', { name: this.text('masteryDoneReading') });
    countdown = () => this.page.locator('[class*="_countdown_"]');
    resultCard = () => this.page.locator('[class*="_resultCard_"]');
    resultPercent = () => this.page.locator('[class*="_resultPercent_"]');
    resultHeadline = () => this.page.locator('[class*="_resultHeadline_"]');
    resultSub = () => this.page.locator('[class*="_resultSub_"]');
    hearts = () => this.page.locator('[class*="_hearts_"]');
    lostHearts = () => this.page.locator('[class*="_heartLost_"], [class*="_heartEmpty_"]');
    actionButton = () => this.page.locator('button:not([disabled])').filter({ hasText: this.actionRe }).first();
    yesButton = () => this.page.getByRole('button', { name: this.text('selfPacedYes', { exact: true }) });
    noButton = () => this.page.getByRole('button', { name: this.text('selfPacedNo', { exact: true }) });

    /** Text below the node strip (the strip itself ends with "🏆 S2"). */
    async screenText(): Promise<string> {
        const body = await this.page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
        const i = body.indexOf('🏆 S2'); // first one: the strip (the S2 verdict also reads "🏆 S2 passed!")
        return (i >= 0 ? body.slice(i + '🏆 S2'.length) : body).trim();
    }

    // ============================================
    // ONE READING
    // ============================================

    /** On a Read Aloud item: the card, the "⏱ 20s" chip ("⏱ 20 సెకన్లు"), the hint and the mic are shown. */
    async expectReadingItem(): Promise<void> {
        await expect(this.readingCard()).toBeVisible({ timeout: 30000 });
        await expect(this.words().first()).toBeVisible();
        await expect(this.timerChip()).toHaveText(this.text('masteryTimeToRead', { patterns: { seconds: '\\d+' }, space: 'flexible' }));
        await expect(this.micButton()).toBeVisible();
    }

    /** The text on the reading card, as shown. */
    async cardText(): Promise<string> {
        return (await this.readingCard().innerText()).replace(/\s+/g, ' ').trim();
    }

    /**
     * Read the current item: tap the mic, "say" `reading`, stop, and return the feedback.
     * 'silent' leaves the mic open until the app gives up (recordingMaxSecs, 20 s).
     */
    async readCurrentItem(reading: Reading): Promise<ReadingFeedback> {
        const text = await this.cardText();
        const transcript = reading === 'correct' ? text : reading === 'wrong' ? WRONG_TRANSCRIPT[this.lang.code] : SILENT_TRANSCRIPT;
        await this.page.evaluate((t) => { (window as unknown as { __fakeTranscript: string }).__fakeTranscript = t; }, transcript);
        await this.micButton().click();
        if (reading !== 'silent') {
            // The recogniser answers after ~0.7 s; then end the recording like a learner would.
            await this.page.waitForTimeout(1500);
            await this.doneButton().click({ timeout: 3000 }).catch(() => undefined);
        }
        return this.waitForFeedback(reading === 'silent' ? 45000 : 30000);
    }

    /** Wait for the feedback after a reading ("CHECKING…" first on showcase steps). */
    async waitForFeedback(timeout = 30000): Promise<ReadingFeedback> {
        const noHear = this.page.getByText(this.text('masteryNoHear'));
        await expect(this.resultCard().or(noHear).first()).toBeVisible({ timeout });
        // "We couldn't hear that" has no result card: read what is there, without waiting for the rest.
        const read = async (locator: ReturnType<Page['locator']>) =>
            (await locator.count()) ? (await locator.first().innerText({ timeout: 2000 }).catch(() => '')).trim() : '';
        const percentText = await read(this.resultPercent());
        const action = (await this.actionButton().innerText({ timeout: 10000 }).catch(() => '')).replace(/➔/g, '').trim();
        const headline = (await read(this.resultHeadline())) || (await read(noHear));
        return {
            percent: /\d+/.test(percentText) ? Number(percentText.match(/\d+/)![0]) : null,
            headline,
            sub: await read(this.resultSub()),
            action,
        };
    }

    /** Click the feedback/transition button, e.g. label('masteryTryAgain') (waits until enabled). */
    async clickAction(name: RegExp): Promise<void> {
        const button = this.page.getByRole('button', { name });
        await expect(button).toBeEnabled({ timeout: 45000 }); // NOW I'LL READ unlocks when the read-along audio ends
        await button.click();
    }

    // ============================================
    // GAME ENGINE
    // ============================================

    /**
     * From the UP NEXT card, play the offered node until the next UP NEXT card (or the
     * milestone-complete screen). Practice readings use `reading`; self-paced questions are
     * answered right. Showcase verdicts come from stubShowcaseVerdict().
     */
    async playCurrentStep(opts: StepOptions = {}): Promise<MasteryStepResult> {
        const start = await this.steps.waitForUpNext();
        await this.steps.startCurrentStep();
        await expect(this.steps.stepIntroTitle()).toBeHidden({ timeout: 30000 });
        return this.runStep(start, opts);
    }

    /** Like playCurrentStep(), for a step already running (e.g. after checking its first item by hand). */
    async finishCurrentStep(opts: StepOptions = {}): Promise<MasteryStepResult> {
        const node = (await this.page.locator('.all-step-pill--current').first().innerText()).trim();
        const mechanic = (await this.screenText()).match(/^\S+ · (.+?) \d+ \/ \d+/)?.[1] ?? '';
        return this.runStep({ node, mechanic }, opts);
    }

    private async runStep(start: { node: string; mechanic: string }, { reading = 'correct', stallMs = 60000, maxMs = 15 * 60000 }: StepOptions): Promise<MasteryStepResult> {
        const t0 = Date.now();
        const result: MasteryStepResult = { node: start.node, mechanic: start.mechanic, nextNode: '', stats: {}, notes: [], durationMs: 0, scores: [] };
        const count = (key: string) => { result.stats[key] = (result.stats[key] ?? 0) + 1; };
        const finish = (nextNode: string) => { result.nextNode = nextNode; result.durationMs = Date.now() - t0; return result; };

        const s = (re: RegExp) => re.source;
        const passedRe = this.text('showcasePassed', { patterns: { step: 'S\\d' } });
        const verdictRe = new RegExp(`${s(passedRe)}|${s(this.text('showcaseNotYet', { patterns: { step: 'S\\d' } }))}`, 'i');
        // "✓ P1 · Read Aloud 10 / 10 pieces read well"
        const summaryRe = new RegExp(`✓\\s*(P\\d+) · [^0-9]*?(\\d+ \\/ \\d+ (?:${s(this.text(['masteryPiecesReadWell', 'selfPacedAnsweredRight']))}))`, 'i');
        // "… · READ IT, THEN TAP AGAIN <text> START ➔": the text to remember for the word question.
        const hintTail = copy('selfPacedHint', this.lang).map((h) => escapeRe(h.split('·').pop()!.trim())).join('|');
        const selfPacedRe = new RegExp(`(?:${hintTail})\\s+(.+?)\\s+(?:${s(this.text('selfPacedStart'))})`, 'i');
        const completeRe = new RegExp(`🎉\\s*(?:${s(this.text('milestoneComplete', { patterns: { number: '\\d+' } }))}|${s(this.text(['hurray', 'allMilestonesComplete']))}).*?(?=${s(this.text('returnToRoadmap'))}|$)`, 'i');
        const questionRe = new RegExp(`${s(this.text('selfPacedQuestion'))}\\s*(\\S+)\\s+${s(this.text('selfPacedNo'))}\\s+${s(this.text('selfPacedYes'))}`, 'i');
        const startNextRe = new RegExp(`^\\s*${s(this.text('startStep', { patterns: { step: '[PS]\\d+' } }))}`, 'i');

        // Record what a screen tells us (verdict, step summary, self-paced text). Called on every
        // read, including right before a click: screens can change between the loop's first read
        // and the click (e.g. the last item's feedback → "🏆 S2 passed!"), and must not be missed.
        const note = (screen: string) => {
            const verdict = screen.match(verdictRe);
            if (verdict && !result.outcome) {
                result.outcome = passedRe.test(verdict[0]) ? 'pass' : 'fail';
                result.notes.push(verdict[0]);
            }
            const summary = screen.match(summaryRe);
            if (summary && !result.notes.some((n) => n.startsWith(summary[1]))) result.notes.push(`${summary[1]}: ${summary[2].trim()}`);
            const selfPaced = screen.match(selfPacedRe);
            if (selfPaced) this.lastSentence = selfPaced[1];
        };

        let lastScreen = '';
        let lastChange = Date.now();
        while (Date.now() - t0 < maxMs) {
            const screen = await this.screenText();
            if (screen !== lastScreen) { lastScreen = screen; lastChange = Date.now(); }
            else if (Date.now() - lastChange > stallMs) throw new Error(`${start.node}: stuck for ${stallMs / 1000}s on "${screen.slice(0, 200)}"`);

            const next = await this.steps.upNext();
            if (next) return finish(next.node);

            const complete = screen.match(completeRe);
            if (complete) {
                result.milestoneComplete = complete[0].trim();
                return finish('COMPLETE');
            }

            note(screen);

            const question = screen.match(questionRe);
            if (question) {
                await this.answerWordQuestion(question[1]);
                count('questions');
                // Feedback: "<sentence> Correct Yes! “word” was in the text. CONTINUE ➔"
                await expect.poll(async () => this.text('selfPacedQuestion').test(await this.screenText()), { timeout: 10000 }).toBe(false);
                if (this.text('selfPacedCorrect').test(await this.screenText())) count('questions right');
                continue;
            }

            if (await this.micButton().isVisible().catch(() => false) && await this.micButton().isEnabled().catch(() => false)) {
                const feedback = await this.readCurrentItem(reading);
                count('readings');
                if (feedback.percent !== null) result.scores.push(feedback.percent);
                if (this.text('showcaseLostHeart').test(feedback.headline)) count('hearts lost');
                continue;
            }

            // One element handle, so the button whose label is checked is the one clicked.
            const action = await this.actionButton().elementHandle({ timeout: 500 }).catch(() => null);
            if (action && await action.isVisible().catch(() => false)) {
                const label = (await action.innerText().catch(() => '')).trim();
                // "START P11 ➔" is the next step's UP NEXT card, rendered after this step ended:
                // never start it here — the next loop turn sees the card and returns.
                if (startNextRe.test(label)) continue;
                note(await this.screenText()); // the screen this button belongs to

                if (this.label('masteryTryAgain').test(label)) count('retries');
                if (this.label('masteryReadAlong').test(label)) count('read alongs');
                await action.click({ timeout: 5000 }).catch(() => undefined);
            }
            await this.page.waitForTimeout(400);
        }
        throw new Error(`${start.node} (${start.mechanic}) did not finish within ${maxMs / 60000} min`);
    }

    /** Play exactly `nodes` in order (asserting each is the one offered); returns their results. */
    async playNodes(nodes: string[], opts?: StepOptions): Promise<MasteryStepResult[]> {
        const played: MasteryStepResult[] = [];
        for (const node of nodes) {
            await this.steps.expectStepIntro(node);
            played.push(await this.playCurrentStep(opts));
        }
        return played;
    }

    /** "Did you see this word in the text?" — YES when `word` was in the sentence just read. */
    private async answerWordQuestion(word: string): Promise<void> {
        // \p{M} keeps vowel signs (Telugu/Hindi/Kannada matras), which are part of the word.
        const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{M}\p{N}'\s]/gu, '').trim();
        const seen = norm(this.lastSentence).split(/\s+/).includes(norm(word));
        await (seen ? this.yesButton() : this.noButton()).click();
    }
}
