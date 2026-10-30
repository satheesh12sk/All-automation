import { defineMasterySuite } from './masterySuite';

/** Mastery M6 — REG-064…REG-066 (testcase/M4-M7 - Sheet1.csv). See masterySuite.ts. */
defineMasterySuite({
  level: 'M6',
  next: 'M7',
  readP1: 'REG-064',
  fullPass: 'REG-066',
  s1Fail: 'REG-065',
});
