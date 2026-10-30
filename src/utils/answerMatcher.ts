import { normalize } from './Text';

/** True when `actual` matches any of the accepted answers after normalisation. */
export function matchesAnswer(actual: string, accepted: string[]): boolean {
  const a = normalize(actual);
  return accepted.some((x) => normalize(x) === a);
}
