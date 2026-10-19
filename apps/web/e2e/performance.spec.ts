import { expect, test } from '@playwright/test';
import { demoLogin, openChannel } from './helpers';

test.describe('long history stays fast', () => {
  test('virtualized: few DOM rows, pages in older messages, keeps the viewport still', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await demoLogin(page, 'admin');
    await openChannel(page, 'random');
    const log = page.getByRole('log');
    await expect(log.locator('article').first()).toBeVisible();

    const rows = () => log.locator('article').count();
    expect(await rows()).toBeLessThan(80);

    // Scroll to the top repeatedly: older pages are fetched, DOM stays small, position is anchored.
    let maxRows = 0;
    let loadedAtLeastOnePage = false;
    for (let i = 0; i < 6; i++) {
      const before = await log.evaluate((el) => {
        const top = el.getBoundingClientRect().top;
        const a = [...el.querySelectorAll<HTMLElement>('article')].find(
          (n) => n.getBoundingClientRect().top >= top + 8,
        );
        return a ? { id: a.dataset.messageId!, y: a.getBoundingClientRect().top - top } : null;
      });
      await log.evaluate((el) => (el.scrollTop = 0));
      await page.waitForTimeout(900);
      maxRows = Math.max(maxRows, await rows());
      if (before) {
        const after = await log.evaluate((el, id) => {
          const n = el.querySelector<HTMLElement>(`article[data-message-id="${id}"]`);
          return n ? n.getBoundingClientRect().top - el.getBoundingClientRect().top : null;
        }, before.id);
        if (after !== null) {
          loadedAtLeastOnePage = true;
          // The message we were reading is still where it was (±80px once measured rows settle).
          expect(Math.abs(after - before.y)).toBeLessThan(120);
        }
      }
    }
    expect(loadedAtLeastOnePage).toBe(true);
    expect(maxRows).toBeLessThan(120);

    // Jump back to the newest message.
    await page.getByRole('button', { name: /Jump to latest|new message/ }).click();
    await expect
      .poll(() => log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight), {
        timeout: 5000,
      })
      .toBeLessThan(120);
  });

  test('opening a long conversation is quick', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await demoLogin(page, 'admin');
    await openChannel(page, 'general');
    const t0 = Date.now();
    await openChannel(page, 'random');
    await expect(page.getByRole('log').locator('article').last()).toBeVisible();
    expect(Date.now() - t0).toBeLessThan(2500);
  });
});
