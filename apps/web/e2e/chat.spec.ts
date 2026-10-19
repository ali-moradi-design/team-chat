import { expect, test } from '@playwright/test';
import { newUserPage, openChannel, send } from './helpers';

test.describe('two users chatting in real time', () => {
  test('messages, reactions, threads, typing, unread and edit/delete', async ({ browser }) => {
    const ali = await newUserPage(browser, 'admin');
    const sara = await newUserPage(browser, 'member');
    await openChannel(ali.page, 'design-team');
    await openChannel(sara.page, 'design-team');

    // 1. live delivery both ways
    const text = `hello from ali ${Date.now()}`;
    await send(ali.page, text);
    await expect(sara.page.getByRole('log').getByText(text)).toBeVisible();
    await send(sara.page, 'hi ali, **bold** works');
    await expect(ali.page.getByRole('log').locator('strong', { hasText: 'bold' })).toBeVisible();

    // 2. typing indicator
    await ali.page.getByRole('textbox').first().pressSequentially('typing now', { delay: 20 });
    await expect(sara.page.getByText(/Ali Moradi is typing/)).toBeVisible();
    await ali.page.getByRole('textbox').first().fill('');

    // 3. reactions
    const row = sara.page.locator('article', { hasText: text });
    await row.hover();
    await row.getByRole('button', { name: '👍' }).click();
    await expect(
      ali.page.locator('article', { hasText: text }).getByRole('button', { name: /👍/ }),
    ).toContainText('1');

    // 4. threads
    await row.hover();
    await row.getByRole('button', { name: 'Reply in thread' }).click();
    const panel = sara.page.getByRole('complementary', { name: 'Thread' });
    await expect(panel).toBeVisible();
    await panel.getByRole('textbox').fill('thread reply from sara');
    await panel.getByRole('textbox').press('Enter');
    await expect(panel.getByText('thread reply from sara')).toBeVisible();
    await expect(
      ali.page.locator('article', { hasText: text }).getByRole('button', { name: /1 reply/ }),
    ).toBeVisible();

    // 5. unread badge in another channel
    await openChannel(sara.page, 'general');
    await send(ali.page, 'ping for sara in design-team');
    await expect(sara.page.getByRole('link', { name: /design-team.*1 unread/ })).toBeVisible();
    await openChannel(sara.page, 'design-team');
    await expect(sara.page.getByRole('link', { name: /^design-team$/ })).toBeVisible();

    // 6. edit and delete
    const mine = ali.page.locator('article', { hasText: 'ping for sara in design-team' });
    await mine.hover();
    await mine.getByRole('button', { name: 'More actions' }).click();
    await ali.page.getByRole('menuitem', { name: 'Edit message' }).click();
    await ali.page.getByRole('textbox', { name: 'Edit message' }).fill('ping (edited)');
    await ali.page.getByRole('textbox', { name: 'Edit message' }).press('Enter');
    await expect(sara.page.getByRole('log').getByText('ping (edited)')).toBeVisible();
    await expect(sara.page.getByRole('log').getByText('(edited)').first()).toBeVisible();

    const edited = ali.page.locator('article', { hasText: 'ping (edited)' });
    await edited.hover();
    await edited.getByRole('button', { name: 'More actions' }).click();
    await ali.page.getByRole('menuitem', { name: 'Delete message' }).click();
    await ali.page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(sara.page.getByText('This message was deleted.').first()).toBeVisible();

    await ali.context.close();
    await sara.context.close();
  });

  test('mixed-language messages get their own direction and Persian UI is RTL', async ({
    browser,
  }) => {
    const { page, context } = await newUserPage(browser, 'member');
    await openChannel(page, 'design-team');
    await send(page, 'سلام، این یک پیام فارسی است');
    const fa = page.getByRole('log').getByText('سلام، این یک پیام فارسی است');
    await expect(fa).toBeVisible();
    await expect(fa.locator('xpath=ancestor-or-self::div[@dir="auto"][1]')).toHaveAttribute(
      'dir',
      'auto',
    );
    expect(await fa.evaluate((el) => getComputedStyle(el.closest('div[dir]')!).direction)).toBe(
      'rtl',
    );

    await page
      .getByRole('button', { name: /Sara Lindqvist|Profile/ })
      .first()
      .click();
    await page.getByRole('menuitem', { name: 'Preferences' }).click();
    await page.getByRole('radio', { name: 'فارسی' }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await context.close();
  });

  test('search, quick switcher and creating a channel', async ({ browser }) => {
    const { page, context } = await newUserPage(browser, 'admin');
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox').fill('engi');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/c\//);

    await page.getByRole('button', { name: 'Search in conversation' }).click();
    await page.getByPlaceholder('Search messages…').fill('index');
    await expect(
      page
        .getByRole('complementary')
        .getByText(/Index review/)
        .first(),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Create a channel' }).click();
    await page.getByRole('menuitem', { name: 'Create a channel' }).click();
    await page
      .getByRole('dialog')
      .getByRole('textbox')
      .first()
      .fill(`e2e ${Date.now() % 100000}`);
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Channel created')).toBeVisible();
    await context.close();
  });
});
