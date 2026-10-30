import { expect, Page } from '@playwright/test';
import { AppLanguage, languageByCode } from '../../utils/languages';
import { copyRe } from '../../utils/UiCopy';

export type FoundationLevel = 'F1' | 'F2' | 'F3';

/** Outcome of playing one journey step (one node: L1, P1, A1, …). */
export interface StepResult {
    /** Node that was played, e.g. "L1". */
    node: string;
    /** Mechanic shown on the step card, e.g. "Letter Train". */
    mechanic: string;
    /** Node offered next ("P1"), or "COMPLETE" when the stage finished. */
    nextNode: string;
    /** Per-game counts, for the report. */
    stats: Record<string, number>;
    /** Non-fatal things worth knowing (a failed level that was replayed, wrong SPEAK answers, …). */
    notes: string[];
    durationMs: number;
}

/**
 * Page Object for the Foundation journey at /learn (F1, F2, F3) on the new UI (axl-test).
 *
 * The page shows the node strip (L1 P1 … 🏆 A1 …) and either an "UP NEXT" card
 * ("<node> · <mechanic>" + "START <node> ➔") or the running game. Games, by mechanic id:
 *   letter-train      L-steps (F1/F2): learn cards with NEXT, then SPEAK cards (speaker → mic → stop)
 *   letter-hunt       P/A-steps (F1/F2): "Find the letter" — target audio auto-plays, tap the option
 *   letter-launcher   F3 P-steps: shown token vs spoken audio → Match / No match, fast for fuel
 *   combined-letter-launcher-memory-challenge   F3 A-steps: launcher levels, then Memory Challenge
 *
 * Answers are derived at runtime, never hard-coded:
 *   - Letter Hunt / Letter Launcher: the prompt plays <s3>/mechanics_audios/<lang>/<TOKEN>.wav;
 *     an init-script hook on HTMLMediaElement.play records the URL (window.__playedMedia).
 *   - SPEAK: scored on the Web Speech transcript (the word must start with the target letter).
 *     The fake recogniser (fakeMedia.ts) returns window.__fakeTranscript, set to the shown word.
 *   - Memory Challenge: the sequence is on screen during "Remember the sequence"; it is read then.
 *
 * `playCurrentStep()` is one state machine for all of them, so combined steps and the screens
 * between levels (CONTINUE / NEXT LEVEL / START GAME / PLAY AGAIN) need no special casing.
 */
export class FoundationPage {
    private page: Page;
    private readonly lang: AppLanguage;
    private hooked = false;

    constructor(page: Page, lang: AppLanguage = languageByCode('english')) {
        this.page = page;
        this.lang = lang;
    }

    // ============================================
    // LOCATORS
    // ============================================

    stepIntroTitle = () => this.page.locator('.all-step-intro__title');
    startStepButton = (node: string) => this.page.getByRole('button', { name: copyRe('startStep', this.lang, { vars: { step: node } }) });
    anyStartStepButton = () => this.page.locator('.all-step-intro button.all-btn');
    headerBadge = () => this.page.locator('.all-header-badge');
    /** Node strip: L1 P1 L2 … 🏆 A1 … (scrolls sideways inside its card on small screens). */
    stepPills = () => this.page.locator('.all-learning-header__pills .all-step-pill');
    mechanicProgress = () => this.page.locator('.all-mechanic-progress__count');

    // ---- Letter Train (L-nodes) ----
    letterTrain = () => this.page.locator('[class*="_train_"]').first();
    letterCard = () => this.page.locator('[class*="_card_"]').filter({ has: this.page.locator('[class*="_bigLetter_"]') });
    bigLetter = () => this.page.locator('[class*="_bigLetter_"]');
    letterPicture = () => this.page.locator('[class*="_picture_"]');
    replayButton = () => this.page.locator('[class*="_controlsButtons_"] > button');
    previousButton = () => this.page.locator('[class*="_nav_"] > button:not([class*="_next_"])');
    nextButton = () => this.page.locator('[class*="_nav_"] > button[class*="_next_"]');
    // The visible card is `_cardFill_` (a hidden sizing copy is also rendered). Its text content is
    // "Speak<word>" with no separator, so match the prefix only.
    private speakCard = () => this.page.locator('[class*="_cardFill_"]').filter({ hasText: /^\s*speak/i });

    // ---- Memory Challenge ----
    memoryInstruction = () => this.page.locator('[class*="_instruction_"]');
    memorySlots = () => this.page.locator('[class*="_row_"] [class*="_slot_"]');
    memoryOptions = () => this.page.locator('[class*="_options_"] > button');
    memoryCheck = () => this.page.locator('button[class*="_checkBtn_"]');

    // ============================================
    // NAVIGATION
    // ============================================

    /** On the "UP NEXT" card, start whichever node it offers (e.g. START L1). */
    async startCurrentStep(): Promise<void> {
        await this.anyStartStepButton().click();
    }

    /** "<node> · <mechanic>" from the UP NEXT card, or null when a game is running. */
    async upNext(): Promise<{ node: string; mechanic: string } | null> {
        if (!(await this.stepIntroTitle().isVisible())) return null;
        const [node, ...rest] = (await this.stepIntroTitle().innerText()).split('·').map((s) => s.trim());
        return { node, mechanic: rest.join('·') };
    }

    /** Wait for the UP NEXT card (after navigation or between steps) and return it. */
    async waitForUpNext(timeout = 30000): Promise<{ node: string; mechanic: string }> {
        await expect(this.stepIntroTitle()).toBeVisible({ timeout });
        return (await this.upNext())!;
    }

    // ============================================
    // GAME ENGINE
    // ============================================

    /** Record the URL of every played <audio>, in this document and after reloads. */
    async installAudioHook(): Promise<void> {
        if (this.hooked) return;
        this.hooked = true;
        const hook = () => {
            const w = window as unknown as { __playedMedia?: string[] };
            if (w.__playedMedia) return;
            w.__playedMedia = [];
            const orig = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function (this: HTMLMediaElement, ...args: unknown[]) {
                w.__playedMedia!.push(this.currentSrc || this.src);
                return orig.apply(this, args as []);
            };
        };
        await this.page.addInitScript(hook);
        await this.page.evaluate(hook);
    }

    /** Last played mechanics prompt token (e.g. "A", "the"), or '' if none since `clearPlayed`. */
    private async lastPromptToken(): Promise<string> {
        const url = await this.page.evaluate(() => (window as unknown as { __playedMedia: string[] }).__playedMedia.at(-1) ?? '');
        const m = /\/mechanics_audios\/[^/]+\/([^/?#]+)\.\w+(?:[?#]|$)/.exec(url);
        return m ? decodeURIComponent(m[1]).trim() : '';
    }

    private async clearPlayed(): Promise<void> {
        await this.page.evaluate(() => { (window as unknown as { __playedMedia: string[] }).__playedMedia.length = 0; });
    }

    /** Text of every enabled, visible button — one DOM read per tick keeps the engine fast. */
    private async screen() {
        return this.page.evaluate(() => {
            const visible = (e: Element) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
            const buttons = [...document.querySelectorAll('button')].filter(visible).map((b) => ({
                label: (b.getAttribute('aria-label') || (b as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim(),
                cls: String(b.className),
                enabled: !b.disabled,
            }));
            const text = document.body.innerText.replace(/\s+/g, ' ');
            return { text, buttons };
        });
    }

    /**
     * Play the step on the UP NEXT card to its end and return what was played and what comes next.
     * Throws with the current screen text if nothing actionable appears for `stallMs`.
     */
    async playCurrentStep({ stallMs = 60000, maxMs = 20 * 60000 } = {}): Promise<StepResult> {
        await this.installAudioHook();
        const start = await this.waitForUpNext();
        const t0 = Date.now();
        const stats: Record<string, number> = {};
        const notes: string[] = [];
        const bump = (k: string, n = 1) => { stats[k] = (stats[k] ?? 0) + n; };
        let memorySequence: string[] | null = null;
        let lastAction = Date.now();
        let promptWaitSince = 0;
        let huntMisses = 0;
        let launcherMisses = 0;

        await this.clearPlayed();
        await this.startCurrentStep();

        while (Date.now() - t0 < maxMs) {
            const s = await this.screen();
            const enabled = (re: RegExp) => s.buttons.find((b) => b.enabled && re.test(b.label));
            const acted = () => { lastAction = Date.now(); };

            // ---- Done: the next step's UP NEXT card, or the stage-complete screen. ----
            const next = await this.upNext();
            if (next && next.node !== start.node) {
                return { node: start.node, mechanic: start.mechanic, nextNode: next.node, stats, notes, durationMs: Date.now() - t0 };
            }
            if (/Foundation \d+ Complete|RETURN TO ROADMAP/i.test(s.text)) {
                return { node: start.node, mechanic: start.mechanic, nextNode: 'COMPLETE', stats, notes, durationMs: Date.now() - t0 };
            }

            // ---- Memory Challenge: memorise, then repeat. ----
            if (/remember the sequence/i.test(s.text) && (await this.memorySlots().count()) > 0) {
                const seq = (await this.memorySlots().allInnerTexts()).map((x) => x.trim()).filter(Boolean);
                if (seq.length) memorySequence = seq;
                await this.page.waitForTimeout(100);
                continue;
            }
            if (/repeat the sequence/i.test(s.text) && memorySequence && (await this.memoryOptions().first().isEnabled().catch(() => false))) {
                for (const token of memorySequence) {
                    await this.memoryOptions().filter({ hasText: new RegExp(`^\\s*${escapeRe(token)}\\s*$`, 'i') }).first().click();
                }
                await this.memoryCheck().click();
                bump('memory rounds');
                memorySequence = null;
                acted();
                continue;
            }

            // ---- Letter Launcher: answer the moment Match is enabled (≤1.5 s = full fuel). ----
            const matchBtn = enabled(/^match$/i);
            if (matchBtn) {
                const shown = (await this.page.locator('[class*="_letter_"], [class*="_syllable_"]').first().innerText()).trim();
                const spoken = await this.lastPromptToken();
                const isMatch = spoken.toLowerCase() === shown.toLowerCase();
                // Same race as Letter Hunt: the round can end between reading and clicking.
                const answered = await this.page.getByRole('button', { name: isMatch ? /^match$/i : /^no match$/i })
                    .click({ timeout: 2000 }).then(() => true, (e) => {
                        if (++launcherMisses >= 3) throw new Error(`Letter Launcher: could not answer "${shown}" vs spoken "${spoken}": ${String(e).split('\n')[0]}`);
                        return false;
                    });
                if (!answered) continue;
                launcherMisses = 0;
                bump('launcher answers');
                await this.clearPlayed();
                acted();
                continue;
            }

            // ---- Letter Hunt: tap the option whose text is the spoken prompt. ----
            const huntOptions = s.buttons.filter((b) => b.enabled && /_option_/.test(b.cls) && !/_options_/.test(b.cls));
            if (huntOptions.length && /find the/i.test(s.text)) {
                let target = await this.lastPromptToken();
                if (!target) {
                    promptWaitSince ||= Date.now();
                    if (Date.now() - promptWaitSince > 4000) {   // no autoplay: press the speaker
                        await this.page.locator('button:not([class*="_option_"])').filter({ has: this.page.locator('svg') })
                            .filter({ hasNot: this.page.locator('.all-back-button') }).last().click().catch(() => undefined);
                        promptWaitSince = Date.now();
                    }
                    await this.page.waitForTimeout(150);
                    continue;
                }
                promptWaitSince = 0;
                const option = this.page.locator('button[class*="_option_"]:not([disabled])')
                    .filter({ hasText: new RegExp(`^\\s*${escapeRe(target)}\\s*$`, 'i') }).first();
                // The options re-render as a question appears and lock as a level ends, so a click can
                // race the UI: on a miss, re-read the screen and try again; give up after 3 misses.
                const clicked = await option.click({ timeout: 2000 }).then(() => true, (e) => {
                    huntMisses++;
                    if (huntMisses >= 3) {
                        throw new Error(`Letter Hunt: prompt "${target}" did not match a clickable option [${huntOptions.map((o) => o.label).join(', ')}]: ${String(e).split('\n')[0]}`);
                    }
                    return false;
                });
                if (!clicked) continue;
                huntMisses = 0;
                bump('hunt answers');
                await this.clearPlayed();
                acted();
                continue;
            }

            // ---- Letter Train SPEAK card: set the transcript to the word, speaker → mic → stop. ----
            if (await this.speakCard().isVisible() && !(await this.nextButton().isEnabled())) {
                const word = (await this.speakCard().innerText()).replace(/^\s*speak\s*/i, '').trim();
                await this.page.evaluate((w) => { (window as unknown as { __fakeTranscript: string }).__fakeTranscript = w; }, word);
                const controls = () => this.page.locator('[class*="_controlsButtons_"] button:not([disabled])');
                await controls().last().click();                                   // speaker (listen)
                await expect.poll(async () => controls().count(), { timeout: 10000 }).toBeGreaterThan(1); // replay + mic appear
                await controls().last().click();                                   // mic: start
                await this.page.waitForTimeout(1500);
                await controls().last().click();                                   // mic: stop
                await expect(this.nextButton()).toBeEnabled({ timeout: 15000 });
                const outcome = await this.page.locator('[data-outcome]').getAttribute('data-outcome').catch(() => null);
                bump(outcome === 'right' ? 'speak right' : 'speak wrong');
                if (outcome !== 'right') notes.push(`SPEAK "${word}" was scored ${outcome ?? 'unknown'}`);
                await this.nextButton().click();
                acted();
                continue;
            }

            // ---- Letter Train learn cards. ----
            if (await this.nextButton().isVisible() && await this.nextButton().isEnabled()) {
                await this.nextButton().click();
                bump('train cards');
                acted();
                continue;
            }

            // ---- Screens between questions / levels. ----
            const transition = enabled(/^(continue|next level|start game|let'?s go|practice)\b/i) ?? enabled(/play again/i);
            if (transition) {
                if (/play again/i.test(transition.label)) notes.push(`Level not passed — replayed (${(/[^.]*need[^.]*\./i.exec(s.text) ?? [''])[0].trim() || 'Play again'})`);
                await this.clearPlayed();
                // Match on the leading words only: icons such as "➔" are not part of the accessible name.
                const words = /^[\p{L}' ]+/u.exec(transition.label)?.[0].trim() ?? transition.label;
                await this.page.locator('button:not([disabled])').filter({ hasText: new RegExp(`^\\s*${escapeRe(words)}`, 'i') }).first().click();
                acted();
                continue;
            }

            if (Date.now() - lastAction > stallMs) {
                throw new Error(`${start.node} (${start.mechanic}) stalled for ${stallMs / 1000}s on: ${s.text.slice(0, 400)}`);
            }
            await this.page.waitForTimeout(200);
        }
        throw new Error(`${start.node} (${start.mechanic}) did not finish within ${maxMs / 60000} min`);
    }

    /**
     * Play exactly `nodes`, in order, asserting each one is the node offered before playing it.
     * Returns the results; the caller asserts where it ended (`at(-1).nextNode`).
     */
    async playNodes(nodes: string[], opts?: Parameters<FoundationPage['playCurrentStep']>[0]): Promise<StepResult[]> {
        const played: StepResult[] = [];
        for (const node of nodes) {
            await this.expectStepIntro(node);
            played.push(await this.playCurrentStep(opts));
        }
        return played;
    }

    // ============================================
    // ASSERTIONS
    // ============================================

    /** On /learn with the "UP NEXT" card for `node`, e.g. ('L1', /Letter Train/). */
    async expectStepIntro(node: string, mechanic?: RegExp): Promise<void> {
        await expect(this.page).toHaveURL(/\/learn/);
        await expect(this.stepIntroTitle()).toContainText(node, { timeout: 30000 });
        if (mechanic) await expect(this.stepIntroTitle()).toHaveText(mechanic);
        await expect(this.startStepButton(node)).toBeVisible();
    }

    async expectLetterTrainVisible(): Promise<void> {
        await expect(this.bigLetter()).toBeVisible({ timeout: 20000 });
        await expect(this.bigLetter()).toHaveText(/\S/);
        await expect(this.nextButton()).toBeVisible();
    }

    /** The node strip marks `node` as done (✓). */
    async expectNodeCompleted(node: string): Promise<void> {
        await expect(this.stepPills().filter({ hasText: new RegExp(`(^|\\s)${node}$`) }).first()).toContainText('✓');
    }
}

/** One line per played node for the report, e.g. "L1 → P1 in 48s (train cards 12, speak right 4)". */
export function describeSteps(steps: StepResult[]): string {
    return steps.map((s) => {
        const stats = Object.entries(s.stats).map(([k, v]) => `${k} ${v}`).join(', ');
        return `${s.node} → ${s.nextNode} in ${Math.round(s.durationMs / 1000)}s (${stats})${s.notes.length ? ` — ${s.notes.join('; ')}` : ''}`;
    }).join('\n');
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
