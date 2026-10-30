/**
 * Base URLs per environment.
 * Precedence: BASE_URL (explicit override) > ENV > TEST_ENV > 'AXL-TEST'.
 * Names are case-insensitive, so ENV=axl-test and ENV=AXL-TEST both work.
 */
export const ENVIRONMENTS = {
  'AXL-TEST': 'https://axl-test.the-axl.ai',
  UAT: 'https://all-uat.theall.ai',
  // TODO: real LAB/LAB2 URLs
  LAB: 'https://lab.example.com',
  LAB2: 'https://lab2.example.com',
} as const;

export type EnvName = keyof typeof ENVIRONMENTS;

export const DEFAULT_ENV: EnvName = 'AXL-TEST';

export function resolveEnvName(): EnvName {
  const raw = (process.env.ENV || process.env.TEST_ENV || DEFAULT_ENV).toUpperCase();
  if (!(raw in ENVIRONMENTS)) {
    throw new Error(`Unknown environment "${raw}". Expected one of: ${Object.keys(ENVIRONMENTS).join(', ')}`);
  }
  return raw as EnvName;
}

export function resolveBaseUrl(): string {
  return process.env.BASE_URL || ENVIRONMENTS[resolveEnvName()];
}
