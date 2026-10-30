import { languageByCode, type LangCode } from './languages';
import { copy, type UiCopyKey } from './UiCopy';
import { UI_COPY_DATA } from './UiCopyData';

/** First wording of `key` for `lang` (code). Throws if the language has no entry. */
export function uiCopy(lang: LangCode, key: UiCopyKey): string {
  return copy(key, languageByCode(lang))[0];
}

export function hasUiCopy(lang: LangCode, key: UiCopyKey): boolean {
  const entry = UI_COPY_DATA[key] as Partial<Record<string, string[]>> & { englishOnly?: boolean };
  return Boolean(entry[lang]?.length || entry.englishOnly);
}
