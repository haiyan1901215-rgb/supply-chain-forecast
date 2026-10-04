const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.40-forecast-lines';
const chrome = process.env.PLAYWRIGHT_CHROME || chromium.executablePath();

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('.app').waitFor({ state: 'visible' });
    await page.locator('[data-view="sales"][data-menu-origin="top-sales"]').click();
    await page.locator('.forecast-table:visible').waitFor();

    const initial = await page.evaluate(() => ({
      windowState: window.ForecastWindow.current(),
      isOpen: window.ForecastWindow.isOpen(),
      manualEntries: document.querySelectorAll('td.entry-cell [data-edit-manual]').length,
      activityEntries: document.querySelectorAll('td.entry-cell [data-event]').length,
      statusText: document.querySelector('.sales-window-state')?.textContent?.trim() || '',
      submitDisabled: document.querySelector('.sales-window-actions .ant-btn-primary')?.disabled ?? true
    }));

    assert.equal(initial.windowState.key, 'initial', 'sales page should open in initial submission state');
    assert.equal(initial.windowState.editable, true, 'initial submission state should be editable');
    assert.equal(initial.isOpen, true, 'ForecastWindow.isOpen should allow editing');
    assert.match(initial.statusText, /初始填报/, 'top status should tell users this is the initial fill state');
    assert.ok(initial.manualEntries > 0, 'manual forecast cells should expose edit actions');
    assert.ok(initial.activityEntries > 0, 'activity forecast cells should expose edit actions');
    assert.equal(initial.submitDisabled, false, 'sales submit action should be enabled in initial fill state');

    await page.locator('td.entry-cell [data-edit-manual]').first().click();
    await page.getByRole('dialog', { name: '人工预测' }).waitFor();
    await page.getByLabel('预测销量').fill('42');
    await page.getByLabel('人工预测原因').fill('初始填报状态验证');
    await page.getByRole('button', { name: '保存' }).click();
    await page.getByText('已保存', { exact: true }).waitFor();

    const saved = await page.evaluate(() => {
      const first = document.querySelector('td.entry-cell [data-edit-manual]');
      if (!first) return null;
      const row = first.closest('tr');
      return row?.textContent || '';
    });
    assert.match(saved || '', /42/, 'saved manual forecast should be visible in the ledger');
    assert.deepEqual(errors, [], 'browser errors');
    console.log('sales initial fill verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
