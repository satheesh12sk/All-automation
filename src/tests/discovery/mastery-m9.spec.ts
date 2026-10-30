import { defineMasterySuite } from './masterySuite';

/** Mastery M9 — REG-077…REG-080 (testcase/M8-M9 - Sheet1.csv). See masterySuite.ts. */
defineMasterySuite({
  level: 'M9',
  next: null, // M9 is the last milestone: S2 pass ends the course
  readP1: 'REG-077',
  paragraph: true,
  readP1Mismatch: {
    title: 'sheet: image with a highlighted paragraph — not in this build',
    note: 'REG-077 expects a paragraph image with a highlighted paragraph to identify; P1 shows a plain text paragraph.',
  },
  s1Pass: 'REG-078',
  fullPass: 'REG-079',
  networkShowcase: 'REG-080',
});
