const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.49-forecast-lifecycle';
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

    await page.addInitScript(() => {
      localStorage.clear();
      const NativeDate = Date;
      const fixed = NativeDate.parse('2026-09-29T10:00:00+08:00');
      window.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [fixed])); }
        static now() { return fixed; }
      };
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('.app').waitFor({ state: 'visible' });
    await page.evaluate(() => {
      const batch = window.ForecastBatchContract.getCurrentMeta();
      window.ForecastBatchContract.launchSalesSubmission(batch.id, '2026-09-29T10:00:00+08:00');
    });
    await page.locator('[data-view="sales"][data-menu-origin="top-sales"]').click();
    const salesList = page.locator('.sales-forecast-list-root');
    await salesList.waitFor();
    await salesList.getByRole('button', { name: '查看' }).first().evaluate(button => button.click());
    await page.locator('.forecast-table:visible').waitFor();
    assert.deepEqual((await page.locator('.workspace-tabs-v028 .ant-tabs-tab').allTextContents()).map(value => value.replace('×', '').trim()), ['销售预测列表', '销售预测详情']);

    const initial = await page.evaluate(() => ({
      windowState: window.ForecastWindow.current(),
      isOpen: window.ForecastWindow.isOpen(),
      manualEntries: document.querySelectorAll('td.entry-cell [data-edit-manual]').length,
      activityEntries: document.querySelectorAll('td.entry-cell [data-event]').length,
      statusText: document.querySelector('.sales-window-state')?.textContent?.trim() || '',
      submitDisabled: document.querySelector('.sales-window-actions .ant-btn-primary')?.disabled ?? true
    }));

    assert.equal(initial.windowState.key, 'open', 'sales page should open in the launched submission window');
    assert.equal(initial.windowState.editable, true, 'launched submission window should be editable');
    assert.equal(initial.isOpen, true, 'ForecastWindow.isOpen should allow editing');
    assert.match(initial.statusText, /销售填报中/, 'top status should show the batch lifecycle state');
    assert.ok(initial.manualEntries > 0, 'manual forecast cells should expose edit actions');
    assert.ok(initial.activityEntries > 0, 'activity forecast cells should expose edit actions');
    assert.equal(initial.submitDisabled, false, 'sales submit action should be enabled in initial fill state');

    assert.equal(await page.locator('.forecast-table:visible .head-goods [data-tree]').count(), 1, 'product details header should expose one stateful toggle');
    await page.getByRole('button', { name: '一键收起全部父子ASIN' }).click();
    assert.equal(await page.getByRole('button', { name: '一键展开全部父子ASIN' }).count(), 1, 'collapsed product details should replace the icon action in place');
    await page.getByRole('button', { name: '一键展开全部父子ASIN' }).click();

    const firstForecastToggle = page.locator('.forecast-table:visible [data-forecast-toggle-button]').first();
    assert.equal(await firstForecastToggle.locator('path').getAttribute('d'), 'M2 6h8', 'expanded forecast rows should show the collapse icon');
    await firstForecastToggle.click();
    const restoredForecastToggle = page.locator('.forecast-table:visible [data-forecast-toggle-button]').first();
    assert.equal(await restoredForecastToggle.locator('path').getAttribute('d'), 'M2 6h8M6 2v8', 'collapsed forecast rows should replace the control with the expand icon');
    await restoredForecastToggle.click();

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

    const identityResizer = page.locator('.forecast-table:visible [data-resize-column="identity"]');
    const resizeBox = await identityResizer.boundingBox();
    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x - 280, resizeBox.y + resizeBox.height / 2, { steps: 6 });
    await page.mouse.up();
    assert.ok((await page.locator('.forecast-table:visible .identity-head').boundingBox()).width < 260, 'sales product column should resize below the old content minimum');
    assert.deepEqual(errors, [], 'browser errors');
    console.log('sales initial fill verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
