// Regenerates docs/screens/*.png from the running app (seeded demo data).
// Start the e2e stack first (pnpm e2e starts it), then: node scripts/screenshots.mjs
import { chromium } from '@playwright/test';
const OUT = new URL('../../../docs/screens', import.meta.url).pathname;
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
async function session(prefs, viewport, mobile = false) {
  const ctx = await b.newContext({ viewport, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  await ctx.addInitScript((p) => localStorage.setItem('tc:prefs', JSON.stringify(p)), prefs);
  const p = await ctx.newPage();
  await p.goto((process.env.BASE_URL ?? 'http://127.0.0.1:5273') + '/');
  return { ctx, p };
}
const login = async (p, re = /admin|مدیر/i) => { await p.getByRole('button', { name: re }).click(); await p.locator('nav').first().waitFor(); };
const open = async (p, name) => { await p.getByRole('link', { name: new RegExp('^' + name) }).first().click(); await p.getByRole('log').waitFor(); await p.waitForTimeout(900); };

// 1) dark desktop with thread
let { ctx, p } = await session({ theme: 'dark', lang: 'en' }, { width: 1440, height: 900 });
await p.screenshot({ path: `${OUT}/login-dark.png` });
await login(p); await open(p, 'design-team');
await p.locator('article', { hasText: 'checked it on mobile' }).getByRole('button', { name: /replies/ }).click();
await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/chat-dark-thread.png` });
await ctx.close();

// 2) light desktop
({ ctx, p } = await session({ theme: 'light', lang: 'en' }, { width: 1440, height: 900 }));
await login(p); await open(p, 'design-team');
await p.screenshot({ path: `${OUT}/chat-light.png` });
await ctx.close();

// 3) persian rtl (dark)
({ ctx, p } = await session({ theme: 'dark', lang: 'fa' }, { width: 1440, height: 900 }));
await login(p); await open(p, 'design-team|تیم-طراحی');
await p.screenshot({ path: `${OUT}/chat-fa-rtl-dark.png` });
await ctx.close();

// 4) mobile
({ ctx, p } = await session({ theme: 'dark', lang: 'en' }, { width: 390, height: 844 }, true));
await login(p);
await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/mobile-drawer.png` });
await p.getByRole('link', { name: /^design-team/ }).first().click();
await p.getByRole('log').waitFor(); await p.waitForTimeout(900);
await p.screenshot({ path: `${OUT}/mobile-chat.png` });
await ctx.close();
await b.close();
