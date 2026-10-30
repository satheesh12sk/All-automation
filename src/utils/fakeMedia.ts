import fs from 'node:fs';
import path from 'node:path';

/**
 * Test doubles for the microphone, which the axl-test app gates the whole journey on.
 *
 * The audio check (/audio-check) passes only when BOTH:
 *   1. the mic levels look like speech (RMS peaks, variation, not muted), and
 *   2. the browser's Web Speech recogniser returns a non-empty transcript.
 * Headless Chromium's default fake device plays a quiet beep (fails 1), and real Web Speech
 * needs Google's servers (fails 2). So:
 *   - FAKE_VOICE_WAV is a generated, voice-like WAV that Chromium loops as the mic
 *     (`--use-file-for-fake-audio-capture`), and the same audio is what gets recorded/uploaded
 *     during Discovery.
 *   - installFakeSpeechRecognition replaces window.SpeechRecognition with a stub that "hears"
 *     a fixed transcript (window.__fakeTranscript, default "my name is test").
 * Chromium only: Firefox/WebKit ignore the fake-capture flag.
 */
export const FAKE_VOICE_WAV = path.resolve(__dirname, '../testdata/audio/fake-voice.wav');

/** Writes FAKE_VOICE_WAV if missing (2.5 s of harmonic, syllable-modulated "speech" + 1 s quiet). */
export function ensureFakeVoiceWav(file = FAKE_VOICE_WAV): string {
  if (fs.existsSync(file)) return file;
  const rate = 48_000;
  const samples: number[] = [];
  let seed = 42;
  const noise = (amp: number) => {
    seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
    return (seed / 2 ** 31 - 0.5) * 2 * amp;
  };
  for (let i = 0; i < rate * 2.5; i++) {
    const t = i / rate;
    const envelope = 0.55 + 0.45 * Math.sin(2 * Math.PI * 4 * t);
    const f0 = 140 + 30 * Math.sin(2 * Math.PI * 0.7 * t);
    let s = 0;
    for (let k = 1; k <= 5; k++) s += Math.sin(2 * Math.PI * f0 * k * t) / k;
    samples.push(Math.max(-1, Math.min(1, s * 0.35 * envelope + noise(0.03))));
  }
  for (let i = 0; i < rate; i++) samples.push(noise(0.002));

  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(s * 32_000), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([header, data]));
  return file;
}

/** Chromium launch args: auto-grant the mic and use FAKE_VOICE_WAV as its input. */
export function chromiumFakeMediaArgs(): string[] {
  return [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${ensureFakeVoiceWav()}`,
    '--autoplay-policy=no-user-gesture-required',
  ];
}

/**
 * Firefox prefs: a fake mic (a tone, not a voice) and no permission prompt. Enough to record in
 * Discovery, NOT enough to pass the audio check — Firefox sessions start from a Chromium-made guest.
 */
export const FIREFOX_FAKE_MEDIA_PREFS = {
  'media.navigator.streams.fake': true,
  'media.navigator.permission.disabled': true,
  'media.autoplay.default': 0,
};

/** Set window.__fakeTranscript to this to make the stub hear nothing (no result is ever fired). */
export const SILENT_TRANSCRIPT = '__silence__';

/**
 * Init script (pass to page/context.addInitScript): stub Web Speech recognition.
 *
 * Shipped as plain JavaScript source, not a TypeScript function: Playwright sends a function to
 * the page as its source text, and some transpilers (tsx/esbuild) rewrite that text with helpers
 * such as `__name(...)` that do not exist in the page — the stub then crashed on load and the
 * real recogniser (which hears nothing) was used instead.
 */
export const installFakeSpeechRecognition = {
  content: `(() => {
  function fire(self, name, ev) { const h = self['on' + name]; if (typeof h === 'function') h(ev); }
  function FakeSpeechRecognition() {
    this.lang = 'en-IN';
    this.continuous = false;
    this.interimResults = false;
    this.maxAlternatives = 1;
  }
  FakeSpeechRecognition.prototype.start = function () {
    const self = this;
    const text = window.__fakeTranscript || 'my name is test';
    if (text === '${SILENT_TRANSCRIPT}') { fire(self, 'start'); return; } // hears nothing until stop()
    self.timer = setTimeout(function () {
      const result = Object.assign([{ transcript: text, confidence: 0.95 }], { isFinal: true });
      fire(self, 'start');
      fire(self, 'result', { resultIndex: 0, results: [result] });
      fire(self, 'speechend');
      fire(self, 'end');
    }, 700);
  };
  FakeSpeechRecognition.prototype.stop = function () { const self = this; setTimeout(function () { fire(self, 'end'); }, 10); };
  FakeSpeechRecognition.prototype.abort = function () { clearTimeout(this.timer); fire(this, 'end'); };
  FakeSpeechRecognition.prototype.addEventListener = function (name, fn) { this['on' + name] = fn; };
  FakeSpeechRecognition.prototype.removeEventListener = function () {};
  window.SpeechRecognition = FakeSpeechRecognition;
  window.webkitSpeechRecognition = FakeSpeechRecognition;
})();`,
};
