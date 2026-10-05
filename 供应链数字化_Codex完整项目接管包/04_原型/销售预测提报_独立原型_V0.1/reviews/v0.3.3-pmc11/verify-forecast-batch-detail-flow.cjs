const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.45-batch-detail-flow';
const chrome = process.env.PLAYWRIGHT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const domClick = locator => locator.waitFor({ state: 'attached' }).then(() => locator.evaluate(node => node.click()));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(url, { waitUntil: 'networkidle' });

    const workbench = page.locator('.forecast-workbench-root');
    await workbench.waitFor();
    const firstChild = workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-child-row').first();
    const context = await firstChild.evaluate(row => {
      const entityKey = row.getAttribute('data-row-key');
      return {
        entityKey,
        childId: entityKey.split('|').at(-1),
        childAsin: row.querySelector('.fpw-code-trigger')?.textContent?.trim() || ''
      };
    });
    assert.ok(context.childAsin && context.childId, '需要取得当前子ASIN上下文');

    await domClick(firstChild.locator('.fpw-code-trigger'));
    const drawer = page.locator('.fpw-detail-drawer');
    await drawer.waitFor();
    assert.deepEqual(await drawer.locator('.fpw-drawer-section > h3, .fpw-drawer-section-head > h3').allTextContents(), ['批次信息', '当前预测对象', '预测结果形成', '预测依据']);
    assert.equal(await drawer.locator('.fpw-result-line').count(), 4, '详情应展示四层预测结果');
    assert.match(await drawer.innerText(), new RegExp(context.childAsin));
    await page.waitForTimeout(350);
    await page.screenshot({ path: 'evidence/forecast-batch-detail.png', fullPage: false });
    await domClick(drawer.getByRole('button', { name: '进入销售预测填报' }));

    const salesTable = page.locator('.forecast-table:visible');
    await salesTable.waitFor();
    const salesContext = page.locator('.sales-workbench-context');
    await salesContext.waitFor();
    assert.match(await salesContext.innerText(), new RegExp(context.childAsin));
    assert.equal(await page.getByRole('textbox', { name: '编码或商品名称' }).inputValue(), context.childAsin, '销售预测筛选器应同步当前子ASIN');
    const targetRows = salesTable.locator(`tr[data-child-row="${context.childId}"]`);
    assert.ok(await targetRows.count() >= 4, '进入销售预测后应定位并展开当前子ASIN预测线');

    const manualEntry = targetRows.filter({ has: page.locator('[data-edit-manual]') }).locator('[data-edit-manual]').first();
    await domClick(manualEntry);
    const editor = page.getByRole('dialog', { name: '人工预测' });
    await editor.waitFor();
    await editor.getByRole('spinbutton', { name: '预测销量' }).fill('321');
    await editor.getByRole('textbox', { name: '人工预测原因' }).fill('预测批次详情闭环验证');
    await domClick(editor.getByRole('button', { name: '保存' }));
    await editor.waitFor({ state: 'hidden' });

    await domClick(page.getByRole('button', { name: '返回预测工作台并定位当前对象' }));
    await workbench.waitFor();
    const manualRow = workbench.locator(`tr[data-row-key="${context.entityKey}|manual"]`);
    const finalRow = workbench.locator(`tr[data-row-key="${context.entityKey}|final"]`);
    await manualRow.waitFor();
    assert.equal((await manualRow.locator('.fpw-forecast-cell .entry-number').first().innerText()).trim(), '321', '返回后人工预测应同步更新');
    assert.equal((await finalRow.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).trim(), '321', '返回后最终预测应按优先级更新');

    await domClick(workbench.locator(`tr[data-row-key="${context.entityKey}"] .fpw-code-trigger`));
    await drawer.waitFor();
    assert.match(await drawer.locator('.fpw-result-line.is-manual small').innerText(), /已填写 1 天/);
    assert.match(await drawer.locator('.fpw-result-line.is-final small').innerText(), /人工 1 天/);
    await page.waitForTimeout(350);
    await page.screenshot({ path: 'evidence/forecast-batch-detail-flow.png', fullPage: false });

    assert.deepEqual(errors, [], `页面运行时错误：${errors.join('；')}`);
    console.log('Forecast batch detail business flow verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
