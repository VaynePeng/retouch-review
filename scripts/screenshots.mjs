import { chromium } from '@playwright/test';
import { mkdir, access } from 'node:fs/promises';

// The browser test generates this synthetic project; never capture a user's browser profile.
const fixture = new URL('../artifacts/project.retouch', import.meta.url);
await access(fixture);
const output = new URL('../docs/screenshots/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:5178');
  await page.locator('#package-input').setInputFiles(fixture.pathname);
  await page.waitForFunction(() => document.querySelector('.project-name').textContent.endsWith('· 导入'));
  await page.click('[data-action="rename"]');
  await page.fill('#project-title', '人像精修 · 第一轮反馈');
  await page.locator('#rename-form button').click();
  await page.click('[data-action="fit"]');
  const toast = page.locator('#toast');
  if (await toast.isVisible()) await toast.click();
  await page.waitForFunction(() => document.getElementById('original-scale').textContent !== '—');
  const capture = async name => {
    // Wait for layout/Canvas RAF completion before capturing the real UI.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: new URL(name, output).pathname });
  };
  await capture('compare.png');
  await page.click('[data-action="toggle-sidebar"]');
  await page.locator('[data-focus]').first().click();
  await capture('annotation.png');
  await page.click('[data-action="toggle-sidebar"]');
  await page.click('button[data-view="retouch"]');
  await page.click('[data-action="fit"]');
  await capture('retouch.png');
  console.log('Saved docs/screenshots/{compare,annotation,retouch}.png');
} finally {
  await browser.close();
}
