const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.50-demand-forecast-menu';
const chrome = process.env.PLAYWRIGHT_CHROME || chromium.executablePath();
const domClick = locator => locator.waitFor({ state: 'attached' }).then(() => locator.evaluate(node => node.click()));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.addInitScript(() => {
      localStorage.clear();
      const NativeDate = Date;
      const fixed = NativeDate.parse('2026-10-06T10:00:00+08:00');
      window.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [fixed])); }
        static now() { return fixed; }
      };
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('.app').waitFor({ state: 'visible' });
    const forecastList = page.locator('.forecast-batch-list-root').filter({ has: page.locator('.fpb-page-header', { hasText: '预测批次' }) });
    await forecastList.waitFor();
    assert.equal((await page.locator('.crumb b').innerText()).trim(), '预测批次列表', 'refresh should land on forecast batch list');
    assert.deepEqual((await page.locator('.workspace-tabs-v028 .ant-tabs-tab').allTextContents()).map(value => value.replace('×', '').trim()), ['预测批次列表']);
    assert.equal(await page.locator('.forecast-workbench-root').count(), 0, 'refresh should not show forecast detail before list positioning');
    assert.equal(await page.locator('.forecast-table:visible').count(), 0, 'refresh should not flash the sales detail table');

    const seeded = await page.evaluate(() => window.ForecastBatchContract.listBatches().map(batch => ({
      id: batch.id,
      batchDate: batch.batchDate,
      status: batch.calibrationStatus,
      submissionState: batch.submissionState
    })));
    assert.equal(seeded[0].batchDate, '2026-09-29');
    assert.equal(seeded[0].status, '待校准', 'forecast batch list must keep one calibration-ready row');
    assert.ok(seeded.some(batch => batch.batchDate === '2026-09-22' && batch.status === '销售填报中' && batch.submissionState === '填报中'), 'sales forecast list must have one fillable demo row');

    await domClick(page.locator('[data-view="sales"][data-menu-origin="top-sales"]'));
    const salesList = page.locator('.sales-forecast-list-root');
    await salesList.waitFor();
    assert.equal((await page.locator('.crumb b').innerText()).trim(), '销售预测列表', 'sales menu should open the sales forecast list first');
    assert.deepEqual(
      (await salesList.locator('.ant-table-thead th').allTextContents()).map(value => value.trim()),
      ['预测批次', '预测周期', '商品范围', '参与销售', '我的待填', '整体进度', '状态', '操作']
    );
    assert.equal(await salesList.locator('.fpb-filter-panel .ant-form-inline').count(), 1, 'sales list filters must reuse the inline Form pattern');
    assert.deepEqual(
      (await salesList.locator('.fpb-filter-panel .ant-form-item-label').allTextContents()).map(value => value.replace(/[:：]\s*$/, '').trim()),
      ['预测批次', '预测周期', '批次状态']
    );
    assert.equal(await salesList.locator('.fpb-filter-panel .ant-input-search').count(), 0, 'sales list must not use a separate search-bar composition');
    assert.equal(await salesList.getByRole('button', { name: '查询' }).count(), 1);
    assert.equal(await salesList.getByRole('button', { name: '重置' }).count(), 1);

    const bodyRows = salesList.locator('.ant-table-tbody tr.ant-table-row');
    const firstText = await bodyRows.first().innerText();
    assert.match(firstText, /2026-09-22/, 'fillable demo sales batch should be sorted first');
    assert.match(firstText, /填报中/);
    await domClick(bodyRows.first().getByRole('button', { name: '查看' }));
    await page.locator('.forecast-table:visible').waitFor();
    assert.deepEqual((await page.locator('.workspace-tabs-v028 .ant-tabs-tab').allTextContents()).map(value => value.replace('×', '').trim()), ['销售预测列表', '销售预测详情']);
    assert.equal(await page.locator('[data-view="sales"][data-menu-origin="top-sales"]').evaluate(node => node.classList.contains('active')), true, 'sales detail must keep the Sales Forecast submenu active');
    assert.equal(await page.locator('[data-view="forecast-workbench"][data-menu-origin="top-forecast-workbench"]').evaluate(node => node.classList.contains('active')), false, 'sales detail must not activate the forecast batch submenu');
    assert.equal(await page.locator('[data-menu-group="demand-forecast"]').evaluate(node => node.classList.contains('is-active')), true, 'sales detail should keep Demand Forecast as the parent context only');
    assert.equal((await page.locator('#batchSelect').inputValue()), '2026-09-22', 'sales detail should open the selected demo batch');
    assert.match(await page.locator('.sales-window-time').innerText(), /2026\/10\/06 00:00 .* 2026\/10\/10 18:00/);
    assert.equal((await page.locator('.sales-window-state').innerText()).trim(), '销售填报中');
    assert.equal(await page.locator('.sales-window-actions .ant-btn-primary').isDisabled(), false, 'demo sales batch should be fillable');
    assert.ok(await page.locator('td.entry-cell [data-edit-manual]').count() > 0, 'sales detail should expose manual fill actions');

    await page.locator('.workspace-tabs-v028 .ant-tabs-tab').filter({ hasText: '销售预测列表' }).click();
    await salesList.waitFor();
    assert.deepEqual((await page.locator('.workspace-tabs-v028 .ant-tabs-tab').allTextContents()).map(value => value.replace('×', '').trim()), ['销售预测列表', '销售预测详情'], 'switching back to list should keep the detail tab open');
    assert.equal(await page.locator('.forecast-table:visible').count(), 0, 'sales detail should be hidden while the list tab is active');
    await domClick(salesList.getByRole('button', { name: '查询' }));
    assert.match(await bodyRows.first().innerText(), /2026-09-22/);

    assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
    console.log('sales forecast list UI pattern and demo batch sync verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
