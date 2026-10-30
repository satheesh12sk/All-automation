import type { AppLanguage } from './languages';
import { UI_COPY_DATA } from './UiCopyData';

/**
 * Per-language UI string registry. Every on-screen string a test asserts on or clicks by text
 * goes through one of these keys, so the same spec runs in any language that has the key.
 */
export type UiCopyKey = keyof typeof UI_COPY_DATA;

export const UI_COPY_KEYS = Object.keys(UI_COPY_DATA) as UiCopyKey[];

type Entry = Partial<Record<string, string[]>> & { englishOnly?: boolean };

/**
 * All wordings of `key` (or of several keys, concatenated) for `lang`.
 * Throws on a missing translation instead of silently falling back to English — a run in the
 * wrong language must fail loudly. Keys flagged `englishOnly` use English for every language.
 */
export function copy(key: UiCopyKey | readonly UiCopyKey[], lang: AppLanguage): string[] {
  const keys = (Array.isArray(key) ? key : [key]) as UiCopyKey[];
  return keys.flatMap((k) => {
    const entry = UI_COPY_DATA[k] as Entry;
    const values = entry[lang.code] ?? (entry.englishOnly ? entry.en : undefined);
    if (!values || values.length === 0) {
      throw new Error(`Missing uiCopy "${k}" for language "${lang.name}". Run npm run lang:check.`);
    }
    return values;
  });
}

export interface CopyReOptions {
  /** Anchor with ^…$ (after trimming). Default false: match anywhere, so "CONTINUE ➔" matches "Continue". */
  exact?: boolean;
  /** RegExp flags. Default 'i' — the app upper-cases many labels with CSS. */
  flags?: string;
  /** 'any' lets straight/curly/missing apostrophes all match. */
  apostrophe?: 'any';
  /** 'flexible' lets any run of whitespace (or none) match a space. */
  space?: 'flexible';
  /** Values for `{placeholder}`s. An unfilled placeholder matches any text. */
  vars?: Record<string, string | number>;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A RegExp matching any wording of `key` for `lang`. */
export function copyRe(key: UiCopyKey | readonly UiCopyKey[], lang: AppLanguage, opts: CopyReOptions = {}): RegExp {
  const alternatives = copy(key, lang).map((text) => {
    let src = '';
    for (const part of text.split(/(\{\w+\})/)) {
      const ph = /^\{(\w+)\}$/.exec(part);
      if (ph) {
        src += opts.vars && ph[1] in opts.vars ? escapeRe(String(opts.vars[ph[1]])) : '.+?';
        continue;
      }
      let lit = escapeRe(part);
      if (opts.apostrophe === 'any') lit = lit.replace(/['’]/g, "['’]?");
      if (opts.space === 'flexible') lit = lit.replace(/ +/g, '\\s*');
      src += lit;
    }
    return src;
  });
  const body = alternatives.length === 1 ? alternatives[0] : `(?:${alternatives.join('|')})`;
  return new RegExp(opts.exact ? `^\\s*${body}\\s*$` : body, opts.flags ?? 'i');
}

/**
 * Define `obj[name]` as a lazily-resolved, cached property: `resolve` runs on first read, not
 * at definition time, so a missing translation only throws when something actually uses it.
 */
export function lazyProp<T extends object, K extends keyof T>(obj: T, name: K, resolve: () => T[K]): void {
  let cached: { value: T[K] } | undefined;
  Object.defineProperty(obj, name, {
    configurable: true,
    enumerable: true,
    get: () => (cached ??= { value: resolve() }).value,
  });
}
