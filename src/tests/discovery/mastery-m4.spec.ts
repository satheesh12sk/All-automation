import { defineMasterySuite } from './masterySuite';

/** Mastery M4 — REG-054…REG-060 (testcase/M4-M7 - Sheet1.csv). See masterySuite.ts. */
defineMasterySuite({
  level: 'M4',
  next: 'M5',
  readP1: 'REG-054',
  noSkip: 'REG-060',
  s1Pass: 'REG-055',
  wordWall: 'REG-057',
  s2Pass: 'REG-058',
  fullPass: 'REG-059',
  s1Fail: 'REG-056',
});
