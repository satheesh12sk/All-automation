import { defineMasterySuite } from './masterySuite';

/** Mastery M8 — REG-073…REG-076 (testcase/M8-M9 - Sheet1.csv). See masterySuite.ts. */
defineMasterySuite({
  level: 'M8',
  next: 'M9',
  readP1: 'REG-073',
  paragraph: true,
  s1Pass: 'REG-074',
  fullPass: 'REG-075',
  networkPractice: 'REG-076',
});
