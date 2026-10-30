import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const TTS_SUPPORTED = process.platform === 'win32';

/** Speaks `text` through the default output device (Windows System.Speech only). */
export async function speak(text: string): Promise<void> {
  if (!TTS_SUPPORTED) {
    throw new Error('TtsHelper.speak is Windows-only; skip this step on other platforms.');
  }
  const escaped = text.replace(/'/g, "''");
  const script = `Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${escaped}')`;
  await execFileAsync('powershell', ['-NoProfile', '-Command', script]);
}
