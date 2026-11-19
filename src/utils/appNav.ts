import { Page } from '@playwright/test';
import { appPath } from '../../config/environments';

/**
 * Open an ALL route ('/roadmap', '/discover', '/learn?step=s1') with a fresh page load.
 *
 * On axl-test this is a plain goto. On lab2 ALL is mounted at /learn behind the AXL portal and the
 * server answers every /learn/<route> with the portal (which 404s it); only /learn/index.html is
 * ALL. Service workers are blocked there (serviceWorkerPolicy), so ALL is loaded from index.html
 * and then routed client-side to `route`, as a deep link would.
 */
export async function gotoApp(page: Page, route: string): Promise<void> {
    const prefix = appPath('');
    if (!prefix) {
        await page.goto(route);
        return;
    }
    await page.goto(`${prefix}/index.html`);
    // ALL boots by redirecting index.html to the learner's current screen.
    await page.waitForURL((url) => !url.pathname.endsWith('/index.html'), { timeout: 30000 }).catch(() => {});
    await page.evaluate((target) => {
        history.pushState({}, '', target);
        dispatchEvent(new PopStateEvent('popstate'));
    }, prefix + route);
}
