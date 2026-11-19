/**
 * Base URLs per environment.
 * Precedence: BASE_URL (explicit override) > ENV > TEST_ENV > 'AXL-TEST'.
 * Names are case-insensitive, so ENV=axl-test and ENV=AXL-TEST both work.
 */
export const ENVIRONMENTS = {
  'AXL-TEST': 'https://axl-test.the-axl.ai',
  UAT: 'https://all-uat.theall.ai',
  // TODO: real LAB URL
  LAB: 'https://lab.example.com',
  // AXL portal: login → /home cards → "Continue to ALL" (first card) → ALL at /learn.
  LAB2: 'https://lab2.the-axl.ai',
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

/**
 * Where the ALL app is mounted. On lab2 it lives under /learn (the portal frames
 * /learn/index.html), so its /roadmap is /learn/roadmap. Override with APP_PATH.
 */
const APP_PATHS: Partial<Record<EnvName, string>> = { LAB2: '/learn' };

/** An ALL route ('/roadmap', '/learn?step=s1') as a URL path in the configured environment. */
export function appPath(route: string): string {
  return (process.env.APP_PATH ?? APP_PATHS[resolveEnvName()] ?? '') + route;
}

/**
 * Service workers are blocked where ALL is mounted under a path (lab2): its worker caches API
 * responses and fetches outside Playwright's routing on WebKit, so stage overrides and network
 * faults would silently not apply. Without it the app behaves as on axl-test (see gotoApp).
 */
export function serviceWorkerPolicy(): 'block' | 'allow' {
  return appPath('') ? 'block' : 'allow';
}
