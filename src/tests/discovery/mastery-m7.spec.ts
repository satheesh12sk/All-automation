import { defineMasterySuite } from './masterySuite';

/** Mastery M7 — REG-067…REG-072 (testcase/M4-M7 - Sheet1.csv). See masterySuite.ts. */
defineMasterySuite({
  level: 'M7',
  next: 'M8',
  readP1: 'REG-067',
  paragraph: true,
  readP1Mismatch: {
    title: 'sheet: bottom-to-top movement — not in this build',
    note: 'REG-067 expects the text to move bottom-to-top; the card is static.',
  },
  wrongReading: 'REG-068',
  speakTimeout: 'REG-072',
  s1Pass: 'REG-069',
  fullPass: 'REG-071',
  s1Fail: 'REG-070',
});
