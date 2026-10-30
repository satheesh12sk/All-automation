/**
 * The app's language vocabulary: codes, on-screen labels, and testdata folder names.
 *
 * `nativeLabel` / `englishLabel` are exactly what the axl-test language modal shows on each
 * option button (e.g. "हिन्दी Hindi"), so page objects can pick an option by either label.
 */
export const LANGUAGES = {
  en: { code: 'en', name: 'english', nativeLabel: 'English', englishLabel: 'English', dataDir: 'english' },
  hi: { code: 'hi', name: 'hindi', nativeLabel: 'हिन्दी', englishLabel: 'Hindi', dataDir: 'hindi' },
  te: { code: 'te', name: 'telugu', nativeLabel: 'తెలుగు', englishLabel: 'Telugu', dataDir: 'telugu' },
  kn: { code: 'kn', name: 'kannada', nativeLabel: 'ಕನ್ನಡ', englishLabel: 'Kannada', dataDir: 'kannada' },
} as const;

export type LangCode = keyof typeof LANGUAGES;
export type AppLanguage = (typeof LANGUAGES)[LangCode];

export function isLangCode(value: string): value is LangCode {
  return value in LANGUAGES;
}

/** Look up a language by code ('hi') or name ('hindi'), case-insensitively. */
export function languageByCode(codeOrName: string): AppLanguage {
  const key = codeOrName.trim().toLowerCase();
  const found = Object.values(LANGUAGES).find((l) => l.code === key || l.name === key);
  if (!found) {
    throw new Error(`Unknown language "${codeOrName}". Known: ${Object.values(LANGUAGES).map((l) => l.name).join(', ')}`);
  }
  return found;
}
