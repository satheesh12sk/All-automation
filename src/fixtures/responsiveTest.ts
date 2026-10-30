import { test as appTest, expect } from './appTest';

/** Device classes from the UI/UX test plan's matrix; set per project in playwright.config.ts. */
export type Profile = 'phone' | 'tablet' | 'laptop' | 'desktop';

export const test = appTest.extend<{ profile: Profile }>({
  profile: async ({}, use, testInfo) => {
    const profile = testInfo.project.metadata?.profile as Profile | undefined;
    if (!profile) throw new Error(`Project "${testInfo.project.name}" has no metadata.profile — responsive specs only run in the device projects`);
    await use(profile);
  },
});

/**
 * Skip the current test unless the project's profile is one of `profiles`
 * (the "Devices" column of the test plan). Call at the top of the test body.
 */
export function runOn(...profiles: Profile[]): void {
  const profile = test.info().project.metadata?.profile as Profile | undefined;
  test.skip(!profile || !profiles.includes(profile), `Runs on ${profiles.join(', ')} only`);
}

export { expect };
