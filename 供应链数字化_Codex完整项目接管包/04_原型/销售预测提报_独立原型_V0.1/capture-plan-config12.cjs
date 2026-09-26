const { chromium } = require('/Users/yan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const path = require('node:path');
const root = __dirname;
const url = 'http://127.0.0.1:8800/reviews/v0.3.3-pmc11/index.html?v=0.3.3-config12';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const width of [1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 1080 } });
    const page = await context.newPage();
    await page.goto(url);
    await page.evaluate(() => localStorage.removeItem('pmc-planning-config12'));
    await page.reload();
    await page.getByRole('button', { name: /计划配置/ }).click();
    await page.getByRole('heading', { name: '预测规则', exact: true }).waitFor();
    await page.screenshot({ path: path.join(root, `evidence/config12-rules-${width}.png`), fullPage: true });
    if (width === 1440) {
      await page.getByRole('tab', { name: '父子关系', exact: true }).click();
      await page.getByRole('row').filter({ hasText: 'R20261021' }).getByRole('button', { name: '查看', exact: true }).click();
      await page.locator('.pc12-cell-link').first().click();
      await page.screenshot({ path: path.join(root, 'evidence/config12-relation-1440.png'), fullPage: true });
    }
    await context.close();
  }
  await browser.close();
  console.log('capture-plan-config12: PASS');
})().catch(error => { console.error(error); process.exit(1); });
