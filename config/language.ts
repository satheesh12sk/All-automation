import { isLangCode, LangCode } from '../src/utils/languages';

/**
 * Target language for a run.
 * Precedence: TEST_LANG > APP_LANG > 'en'.
 */
export function resolveLanguage(): LangCode {
  const raw = (process.env.TEST_LANG || process.env.APP_LANG || 'en').toLowerCase();
  if (!isLangCode(raw)) {
    throw new Error(`Unsupported language "${raw}". Add it to src/utils/languages.ts first.`);
  }
  return raw;
}
