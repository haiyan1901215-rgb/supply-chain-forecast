const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.50-sales-combo';
const chrome = process.env.PLAYWRIGHT_CHROME || chromium.executablePath();
const visibleCopyOpacity = locator => locator.evaluate(node => getComputedStyle(node).opacity);

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('.forecast-batch-list-root').waitFor();

    const combo = await page.evaluate(() => ({
      meta: window.getSalesComboDefinition('B0GRG6H2KL'),
      batch: window.ForecastBatchContract.getCurrentMeta()
    }));
    assert.deepEqual(combo.meta.lines, [{ sku: 'SKU-A', quantity: 1 }, { sku: 'SKU-B', quantity: 2 }]);
    assert.equal(combo.meta.name, '黑色M+L双装');
    assert.equal(await page.evaluate(asin => groups.filter(group => group.market === 'US').flatMap(group => group.children).filter(child => child.asin === asin).length, 'B0GRG6H2KL'), 1, '同一站点的组合 ASIN 只能有一条商品记录');

    await page.evaluate(batchId => window.pmcWorkflow.openForecastWorkbenchBatch(batchId, '待校准'), combo.batch.id);
    const workbench = page.locator('.forecast-workbench-root');
    await workbench.waitFor();
    const workbenchComboRow = workbench.locator('.fpw-child-row').filter({ hasText: 'B0GRG6H2KL' }).first();
    await workbenchComboRow.waitFor();
    assert.equal(await workbenchComboRow.locator('.sales-combo-trigger').count(), 0, '预测批次详情不应显示独立组合 Tag');
    assert.equal(await workbenchComboRow.locator('.ant-tag').filter({ hasText: /^组合$/ }).count(), 0, '预测批次详情不应显示组合 Tag 文案');
    assert.equal(await workbenchComboRow.locator('.sales-combo-code').count(), 1, '预测批次详情应显示销售组合编码');
    assert.match(await workbenchComboRow.locator('.sales-combo-code').innerText(), /^SC[A-Z0-9]{7}$/);
    assert.match(await workbenchComboRow.innerText(), /黑色M\+L双装/);
    assert.match(await workbenchComboRow.innerText(), /高腰塑形短裤/);
    await workbenchComboRow.locator('.sales-combo-code').hover();
    assert.equal(await visibleCopyOpacity(workbenchComboRow.locator('.sales-combo-code .copy-code')), '1', '预测批次详情销售组合编码悬停应显示复制按钮');
    const workbenchPopover = page.locator('.ant-popover:visible').last();
    await workbenchPopover.waitFor();
    const workbenchPopoverText = await workbenchPopover.innerText();
    assert.match(workbenchPopoverText, /销售组合/);
    assert.match(workbenchPopoverText, /黑色M\+L双装/);
    assert.match(workbenchPopoverText, /SKU-A\s+×\s+1/);
    assert.match(workbenchPopoverText, /SKU-B\s+×\s+2/);
    assert.equal(await workbenchPopover.getByRole('button').count(), 0, '组合 Popover 只读，不应出现编辑按钮');
    await page.keyboard.press('Escape');

    await page.evaluate(() => window.pmcWorkflow.openSalesBatch('FB-20260922-01'));
    const salesTable = page.locator('.forecast-table:visible');
    await salesTable.waitFor();
    const salesComboCell = salesTable.locator('[data-record-id="US-B0GRG6H2KL"]');
    await salesComboCell.waitFor();
    assert.equal(await salesComboCell.locator('.sales-combo-trigger').count(), 0, '销售预测详情不应显示独立组合 Tag');
    assert.equal(await salesComboCell.locator('.ant-tag').filter({ hasText: /^组合$/ }).count(), 0, '销售预测详情不应显示组合 Tag 文案');
    assert.equal(await salesComboCell.locator('.sales-combo-code').count(), 1, '销售预测详情应显示销售组合编码');
    assert.match(await salesComboCell.locator('.sales-combo-code').innerText(), /^SC[A-Z0-9]{7}$/);
    const salesComboIdentifiers = salesComboCell.locator('.product-identifiers');
    const salesComboIdentifierText = await salesComboIdentifiers.innerText();
    const salesComboSku = await page.evaluate(() => groups.find(group => group.market === 'US').children.find(child => child.asin === 'B0GRG6H2KL').sku);
    assert.match(salesComboIdentifierText, /^SC[A-Z0-9]{7}$/, '组合商品原 SKU 位置应仅展示销售组合编码');
    assert.doesNotMatch(salesComboIdentifierText, new RegExp(salesComboSku), '组合商品不应展示 SKU 编码');
    assert.equal(await salesComboIdentifiers.locator('.biz-code').count(), 0, '组合商品不应展示业务识别码');
    assert.match(await salesComboCell.innerText(), /黑色M\+L双装/);
    assert.match(await salesComboCell.innerText(), /高腰塑形短裤/);
    assert.equal(await salesTable.locator('[data-record-id="US-B0GRG6H2KL"]').count(), 1, '销售预测仍按 ASIN 保持一条商品预测记录');
    assert.equal(await salesTable.locator('tr').filter({ hasText: 'SKU-A' }).count(), 0, '销售组合 SKU 不能生成预测行');
    await salesComboCell.locator('.sales-combo-code').hover();
    assert.equal(await visibleCopyOpacity(salesComboCell.locator('.sales-combo-code .copy-code')), '1', '销售预测详情销售组合编码悬停应显示复制按钮');
    const salesPopover = page.locator('.ant-popover:visible').last();
    await salesPopover.waitFor();
    const salesPopoverText = await salesPopover.innerText();
    assert.equal(salesPopoverText, workbenchPopoverText, '两个详情页应使用完全相同的组合 Popover 数据');
    assert.equal(await salesPopover.getByRole('button').count(), 0, '销售组合 Popover 只读，不应出现编辑按钮');

    assert.deepEqual(errors, [], `页面运行时错误：${errors.join('；')}`);
    console.log('sales combo parity verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
