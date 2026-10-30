import type { BrowserContext } from '@playwright/test';

/**
 * Start a guest at any Foundation (F1–F3) or Mastery (M1–M9) stage/lesson without a parked account.
 *
 * The app decides where a learner is from two server responses:
 *   GET /lais/scores/getMilestone                      → { milestone_level: "B", sub_milestone_level: "F1" | "F2" | "F3" }
 *                                                        { milestone_level: "m4", sub_milestone_level: "" }
 *   GET /…/lesson/getLessonProgressByUserId            → { result: { lesson: "<n>" } }
 *                                                        (F2/F3: step index n-1; M-levels: step index n,
 *                                                         e.g. M4 0 = P1-P2, 3 = S1, 7 = S2)
 * This rewrites both IN THIS BROWSER CONTEXT ONLY, so a throwaway guest (e.g. from
 * mintGuestSession('roadmap')) opens directly on, say, F2 L1 or M4 S1 with real content.
 *
 * Lesson progress is only rewritten until the app saves its first progress for the new stage
 * (POST …/lesson/addLesson). From then on the server's own answer — which the app itself just
 * wrote — is passed through, so moving from step to step behaves exactly as for a real learner.
 *
 * Use it for stage CONTENT (F2/F3 games, M-level reading, UI checks). Real stage-to-stage transitions are covered
 * by the F1 suite, which plays a real guest from Discovery to the end of F1.
 */
export type Stage = 'F1' | 'F2' | 'F3' | `M${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

export interface StageOverride {
  stage: Stage;
  /** Lesson number as the server reports it (see above; 0 → first step). */
  lesson?: number;
  /**
   * M-levels: when the app saves progress for the NEXT milestone (addLesson milestoneLevel "m5" after
   * M4 S2 passed), report that milestone from then on — what the server does after a real pass.
   * Needed because the pass itself is stubbed (showcaseVerdict.ts), so the server never promotes.
   */
  followPromotion?: boolean;
}

/** One POST …/lesson/addLesson the app sent: { milestoneLevel: "m4", lesson: "4", progress: 50, … }. */
export interface SavedProgress {
  milestoneLevel: string;
  milestone: string;
  lesson: string;
  progress: number;
}

export interface StageHandle {
  /** The stage getMilestone currently reports. */
  readonly stage: Stage;
  /** Every progress save, oldest first. */
  readonly saved: SavedProgress[];
}

export async function overrideStage(context: BrowserContext, { stage, lesson = 0, followPromotion = false }: StageOverride): Promise<StageHandle> {
  let progressSaved = false;
  const handle = { stage, saved: [] as SavedProgress[] };

  await context.route('**/scores/getMilestone**', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    if (json?.data) {
      const foundation = handle.stage.startsWith('F');
      json.data.milestone_level = foundation ? 'B' : handle.stage.toLowerCase();
      json.data.sub_milestone_level = foundation ? handle.stage : '';
    }
    await route.fulfill({ response, json });
  });

  await context.route('**/lesson/getLessonProgressByUserId**', async (route) => {
    const response = await route.fetch();
    if (progressSaved) return route.fulfill({ response });
    const json = await response.json();
    if (json?.result) json.result.lesson = String(lesson);
    await route.fulfill({ response, json });
  });

  context.on('request', (request) => {
    if (request.method() !== 'POST' || !/\/lesson\/addLesson/.test(request.url())) return;
    progressSaved = true;
    let body: Partial<SavedProgress> = {};
    try { body = request.postDataJSON() ?? {}; } catch { /* not JSON */ }
    handle.saved.push({
      milestoneLevel: String(body.milestoneLevel ?? ''),
      milestone: String(body.milestone ?? ''),
      lesson: String(body.lesson ?? ''),
      progress: Number(body.progress ?? 0),
    });
    const level = String(body.milestoneLevel ?? '').toUpperCase();
    if (followPromotion && /^M\d$/.test(level)) handle.stage = level as Stage;
  });

  return handle;
}
