import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { demoLogin } from './helpers';

const WIDTHS = [
  { w: 320, h: 640 },
  { w: 375, h: 667 },
  { w: 414, h: 896 },
  { w: 768, h: 1024 },
  { w: 1024, h: 768 },
  { w: 1280, h: 800 },
  { w: 1440, h: 900 },
  { w: 1920, h: 1080 },
];
const SHOTS = 'e2e-results/screens';

async function noHorizontalOverflow(page: Page, label: string) {
  const o = await page.evaluate(() => {
    const doc = document.scrollingElement!;
    const wide = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.right > window.innerWidth + 1 &&
          getComputedStyle(el).position !== 'fixed' &&
          !el.closest('[role=log]') &&
          !el.closest('[data-radix-popper-content-wrapper]')
        );
      })
      .slice(0, 3)
      .map((el) => `${el.tagName}.${String(el.className).slice(0, 40)}`);
    return { overflow: doc.scrollWidth - window.innerWidth, wide };
  });
  expect(
    o.overflow,
    `${label}: page scrolls horizontally (${o.wide.join(', ')})`,
  ).toBeLessThanOrEqual(1);
}

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));

for (const theme of ['dark', 'light'] as const) {
  for (const lang of ['en', 'fa'] as const) {
    test(`layout is sound at every width — ${theme}/${lang}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await context.addInitScript(
        ([th, lg]) => localStorage.setItem('tc:prefs', JSON.stringify({ theme: th, lang: lg })),
        [theme, lang],
      );
      const page = await context.newPage();

      for (const { w, h } of WIDTHS) {
        await page.setViewportSize({ width: w, height: h });
        const label = `${w}px ${theme}/${lang}`;

        // Login screen
        await page.context().clearCookies();
        await page.goto('/');
        await expect(page.locator('main')).toBeVisible();
        await noHorizontalOverflow(page, `login ${label}`);
        if (w === 375 || w === 1440)
          await page.screenshot({ path: `${SHOTS}/login-${w}-${theme}-${lang}.png` });

        // Chat
        await page.getByRole('button', { name: lang === 'en' ? /admin/i : /مدیر/ }).click();
        await expect(page.locator('nav').first()).toBeVisible();
        if (w < 768) {
          // phones start with the drawer open on "/"
          await page.waitForTimeout(400);
          await noHorizontalOverflow(page, `drawer ${label}`);
          if (w === 375)
            await page.screenshot({ path: `${SHOTS}/drawer-${w}-${theme}-${lang}.png` });
          await page
            .getByRole('link')
            .filter({ hasText: /design-team|تیم-طراحی/ })
            .first()
            .click();
        } else {
          await page
            .getByRole('link')
            .filter({ hasText: /design-team|تیم-طراحی/ })
            .first()
            .click();
        }
        await expect(page.getByRole('log')).toBeVisible();
        await page.waitForTimeout(500);
        await noHorizontalOverflow(page, `chat ${label}`);

        // composer must be fully inside the viewport
        const box = await page.getByRole('textbox').first().boundingBox();
        expect(box, `composer ${label}`).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(-1);
        expect(box!.x + box!.width).toBeLessThanOrEqual(w + 1);
        expect(box!.y + box!.height).toBeLessThanOrEqual(h + 1);

        if ((theme === 'dark' && lang === 'en') || w === 375 || w === 1440)
          await page.screenshot({ path: `${SHOTS}/chat-${w}-${theme}-${lang}.png` });

        // Side panel (details) fits too
        await page.getByRole('button', { name: lang === 'en' ? 'Members' : 'اعضا' }).click();
        await page.waitForTimeout(1000);
        await noHorizontalOverflow(page, `panel ${label}`);
        if (w === 375 || w === 1024)
          await page.screenshot({ path: `${SHOTS}/panel-${w}-${theme}-${lang}.png` });
        const pw = await page.getByRole('complementary').last().boundingBox();
        expect(pw!.x + pw!.width).toBeLessThanOrEqual(w + 1);
        expect(pw!.x).toBeGreaterThanOrEqual(-1);
      }
      await context.close();
    });
  }
}

test('touch targets on phones are at least 32px', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await demoLogin(page, 'admin');
  await page
    .getByRole('link')
    .filter({ hasText: /design-team/ })
    .first()
    .click();
  await expect(page.getByRole('log')).toBeVisible();
  const small = await page.evaluate(
    () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          'header button, footer button, [role=toolbar] button, textarea',
        ),
      ]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && (r.width < 28 || r.height < 28)).length,
  );
  expect(small).toBe(0);
  await context.close();
});
