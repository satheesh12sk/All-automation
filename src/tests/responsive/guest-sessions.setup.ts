import { test as setup } from '@playwright/test';
import { saveGuestSession } from '../../utils/guestSession';

/**
 * Creates the two shared guest sessions the responsive projects start from. Done in Chromium
 * because only its fake mic passes the audio check; the saved localStorage session then works
 * in every engine. Tests that change the guest's progress mint their own guest instead.
 */
setup('guest at /discover (audio check passed)', async () => {
  await saveGuestSession('discover');
});

setup('guest on /roadmap (Discovery done, placed in F1)', async () => {
  setup.setTimeout(4 * 60_000);
  await saveGuestSession('roadmap');
});
