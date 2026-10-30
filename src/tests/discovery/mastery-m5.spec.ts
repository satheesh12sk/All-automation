import { defineMasterySuite } from './masterySuite';

/** Mastery M5 — REG-061…REG-063 (testcase/M4-M7 - Sheet1.csv). See masterySuite.ts. */
defineMasterySuite({
  level: 'M5',
  next: 'M6',
  readP1: 'REG-061',
  fullPass: 'REG-063',
  s1Fail: 'REG-062',
});
