import { Page } from '@playwright/test';
import { VisionService } from './visionService';
import { normalizeText as normalize } from '../utils/Text';

/**
 * Pluggable "answer source" for picture-based multiple-choice assessments (Mastery S-nodes;
 * first used by M4 S1 / TC-024). Given the on-screen question + options (and, if needed, the
 * image), it returns the text of the correct option. Kept behind an interface so the S-node
 * flow (VqaSpeakingAssessment) does not care HOW the answer is obtained:
 *
 *   • ContentApiAnswerSource — reads the answer from the app's own content API response
 *     (GetContent/sentence marks the correct option with isAns:true). Deterministic, free,
 *     offline of any 3rd-party service. Default for a reliable regression suite.
 *   • VisionAnswerSource — sends the image + question to a vision model (VisionService).
 *     Provider-agnostic; used when no content-API answer is available or when explicitly
 *     selected. Requires a configured VISION_API_KEY.
 *
 * Nothing about the questions/answers is hardcoded — both sources derive the answer at
 * runtime. Reusable across M4–M9 image/text MCQ activities.
 */
export interface AnswerContext {
    question: string;
    options: string[];
    /** Lazily capture the illustration (only vision needs it — the content API does not). */
    captureImage: () => Promise<{ base64: string; mediaType: string }>;
}

export interface AnswerSource {
    readonly describe: string;
    isReady(): Promise<boolean>;
    answer(ctx: AnswerContext): Promise<string>;
}

/**
 * Reads the correct answer from the app's content API. Must be created BEFORE navigation so
 * its response listener captures the content payload the app fetches when the assessment
 * loads. Passive: it only observes responses (no request interception / no app mutation).
 */
export class ContentApiAnswerSource implements AnswerSource {
    readonly describe = 'content-api';
    // normalized question text -> correct option text
    private readonly byQuestion = new Map<string, string>();
    // fallback: normalized sorted option-set -> correct option text
    private readonly byOptions = new Map<string, string>();
    private captured = 0;

    private constructor(private readonly page: Page) {}

    /** Attach the response listener and return the source (call before navigate()). */
    static attach(page: Page): ContentApiAnswerSource {
        const src = new ContentApiAnswerSource(page);
        page.on('response', async (resp) => {
            try {
                const url = resp.url();
                if (!/GetContent|mechanic|content/i.test(url)) return;
                const ct = (resp.headers()['content-type'] || '').toLowerCase();
                if (!/json/.test(ct) && !/\.json(\?|$)/.test(url)) return;
                const body = await resp.text();
                if (!/mechanics_data|isAns|correctness/i.test(body)) return;
                src.ingest(body);
            } catch { /* ignore non-JSON / consumed bodies */ }
        });
        return src;
    }

    /** Parse a content payload and index every question → correct option it contains. */
    private ingest(body: string): void {
        let json: unknown;
        try { json = JSON.parse(body); } catch { return; }
        const items = this.collectItems(json);
        for (const md of items) {
            const q = normalize(String(md.text || ''));
            const opts: Array<{ text?: string; isAns?: boolean }> = Array.isArray(md.options) ? md.options : [];
            let correct = opts.find((o) => o && o.isAns === true)?.text || '';
            if (!correct && md.correctness && typeof md.correctness === 'object') {
                for (const v of Object.values(md.correctness as Record<string, unknown>)) {
                    if (Array.isArray(v) && v.length) { correct = String(v[0]); break; }
                }
            }
            if (!correct) continue;
            this.captured++;
            if (q) this.byQuestion.set(q, correct);
            const key = opts.map((o) => normalize(String(o.text || ''))).filter(Boolean).sort().join('|');
            if (key) this.byOptions.set(key, correct);
        }
    }

    /** Walk the payload for objects that look like a mechanics MCQ (text + options[isAns]). */
    private collectItems(json: unknown): Array<{ text?: string; options?: Array<{ text?: string; isAns?: boolean }>; correctness?: unknown }> {
        const out: Array<{ text?: string; options?: Array<{ text?: string; isAns?: boolean }>; correctness?: unknown }> = [];
        const seen = new Set<unknown>();
        const walk = (node: unknown) => {
            if (!node || typeof node !== 'object' || seen.has(node)) return;
            seen.add(node);
            const obj = node as Record<string, unknown>;
            if (Array.isArray(obj.options) && (obj.options as unknown[]).some((o) => o && typeof o === 'object' && 'isAns' in (o as object))) {
                out.push(obj as { text?: string; options?: Array<{ text?: string; isAns?: boolean }>; correctness?: unknown });
            }
            for (const v of Object.values(obj)) {
                if (Array.isArray(v)) v.forEach(walk);
                else if (v && typeof v === 'object') walk(v);
            }
        };
        walk(json);
        return out;
    }

    async isReady(): Promise<boolean> { return true; }  // passive; may be empty until content loads

    async answer(ctx: AnswerContext): Promise<string> {
        // Give the content payload a moment to arrive if nothing captured yet.
        for (let i = 0; i < 10 && this.captured === 0; i++) await this.page.waitForTimeout(500);
        const q = normalize(ctx.question);
        if (q && this.byQuestion.has(q)) return this.byQuestion.get(q)!;
        const key = ctx.options.map((o) => normalize(o)).filter(Boolean).sort().join('|');
        if (key && this.byOptions.has(key)) return this.byOptions.get(key)!;
        return '';
    }
}

/** Answer via a vision model (image + question + options). Requires VISION_API_KEY. */
export class VisionAnswerSource implements AnswerSource {
    readonly describe: string;
    constructor(private readonly vision: VisionService) { this.describe = `vision:${vision.describe}`; }
    async isReady(): Promise<boolean> { return this.vision.isConfigured(); }
    async answer(ctx: AnswerContext): Promise<string> {
        const img = await ctx.captureImage();
        return this.vision.answer(img.base64, img.mediaType, ctx.question, ctx.options);
    }
}
