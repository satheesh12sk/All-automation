import type { BrowserContext } from '@playwright/test';

/**
 * Decide the server's verdict on Mastery showcase steps (S1/S2, mechanic read-aloud-2.0).
 *
 * Practice steps (P1…P12) are scored in the browser from the Web Speech transcript, which the fake
 * recogniser controls (window.__fakeTranscript). Showcase steps are scored on the SERVER:
 *   POST /lais/scores/updateLearnerProfile/<lang>  { original_text, audio, … } → { responseText, … }
 *        per item: the app compares responseText with the sentence ("100% Excellent reading!")
 *   POST /lais/scores/getSetResult                 { sub_session_id, … }       → { data: { sessionResult: "pass" | "fail", percentage } }
 *        after the last item: decides "🏆 S1 passed!" vs "💪 S1 not quite yet"
 * The server transcribes the uploaded audio, and the generated fake voice is not speech, so it
 * always says "fail". This forwards both calls to the real server (so the learner profile and
 * session are still recorded) and rewrites only the verdict:
 *   'pass' → responseText = the expected sentence, sessionResult "pass", percentage 100
 *   'fail' → responseText = unrelated words,       sessionResult "fail", percentage 20
 * What is under test is the app's handling of the verdict (routing, screens, saved progress) —
 * not the server's speech scoring.
 */
export type ShowcaseVerdict = 'pass' | 'fail';

const WRONG_TEXT = 'zebra quantum violet';

export interface ShowcaseHandle {
  verdict: ShowcaseVerdict;
  /** Set results the app received, oldest first. */
  readonly results: Array<{ sessionResult: string; percentage: number }>;
}

export async function stubShowcaseVerdict(context: BrowserContext, verdict: ShowcaseVerdict): Promise<ShowcaseHandle> {
  const handle: ShowcaseHandle = { verdict, results: [] };

  await context.route('**/scores/updateLearnerProfile/**', async (route) => {
    let body: { original_text?: string } = {};
    try { body = route.request().postDataJSON() ?? {}; } catch { /* not JSON */ }
    const response = await route.fetch().catch(() => null);
    let json: Record<string, unknown> = {};
    try { json = response ? await response.json() : {}; } catch { /* keep {} */ }
    json.responseText = handle.verdict === 'pass' ? body.original_text ?? '' : WRONG_TEXT;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });

  await context.route('**/scores/getSetResult**', async (route) => {
    const response = await route.fetch();
    const json = await response.json().catch(() => ({}));
    const percentage = handle.verdict === 'pass' ? 100 : 20;
    json.data = { ...(json.data ?? {}), sessionResult: handle.verdict, percentage };
    handle.results.push({ sessionResult: handle.verdict, percentage });
    await route.fulfill({ response, json });
  });

  return handle;
}
