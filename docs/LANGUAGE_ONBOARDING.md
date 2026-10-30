# Language Onboarding Runbook

1. Add the language to `src/utils/languages.ts`.
2. Run a throwaway `_<lang>-observation-probe.spec.ts` to capture on-screen strings (do not commit).
3. Fill `src/utils/UiCopyData.ts` for the new language; check with `npm run lang:check`.
4. Run Discovery: `npm run e2e -- --lang <code>`.
5. Add observed fixtures under `src/testdata/<language>/`.
6. Log evidence in a `<LANGUAGE>_ROLLOUT_LOG.md` (see `HINDI_ROLLOUT_LOG.md`).
