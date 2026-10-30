/** Normalises text for comparison: NFC, collapsed whitespace, trimmed, lower-cased. */
export function normalize(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

export const normalizeText = normalize;
