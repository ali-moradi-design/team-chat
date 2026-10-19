import { expect, type Browser, type Page } from '@playwright/test';

export async function demoLogin(page: Page, who: 'admin' | 'member' = 'admin'): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: who === 'admin' ? /admin/i : /member/i }).click();
  await expect(page.locator('nav').first()).toBeVisible();
}

export async function openChannel(page: Page, name: string): Promise<void> {
  await page
    .getByRole('link', { name: new RegExp(`^${name}`) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/c\//);
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(`^${name}`) })).toBeVisible();
  await expect(page.getByRole('log')).toBeVisible();
}

export async function newUserPage(browser: Browser, who: 'admin' | 'member') {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await demoLogin(page, who);
  return { context, page };
}

export async function send(page: Page, text: string): Promise<void> {
  const box = page.getByRole('textbox').first();
  await box.fill(text);
  await box.press('Enter');
}
