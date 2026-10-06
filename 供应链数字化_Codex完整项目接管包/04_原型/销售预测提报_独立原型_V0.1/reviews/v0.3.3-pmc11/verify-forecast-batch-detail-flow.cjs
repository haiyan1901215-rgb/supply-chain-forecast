const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.49-forecast-lifecycle';
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
    await page.locator('.forecast-batch-list-root').waitFor();
    await page.evaluate(() => {
      const batch = window.ForecastBatchContract.getCurrentMeta();
      window.pmcWorkflow.openForecastWorkbenchBatch(batch.id, batch.calibrationStatus);
    });

    const workbench = page.locator('.forecast-workbench-root');
    await workbench.waitFor();
    const firstChild = workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-child-row').first();
    const context = await firstChild.evaluate(row => {
      const entityKey = row.getAttribute('data-row-key');
      return {
        entityKey,
        childId: entityKey.split('|').at(-1),
        childAsin: row.querySelector('.fpw-code-line .fpw-code-trigger')?.textContent?.trim() || ''
      };
    });
    assert.ok(context.childAsin && context.childId, '需要取得当前子ASIN上下文');
    const workbenchBefore = await page.evaluate(childId => {
      const batch = window.ForecastBatchContract.getCurrentMeta();
      const date = batch.forecastStartDate;
      return {
        batchId: batch.id,
        date,
        manual: window.ForecastBatchContract.getWorkbenchDraft(batch.id, childId).manual[date] ?? null,
        final: window.ForecastBatchContract.getDailyForecast(batch.id, childId, date).ruleForecast
      };
    }, context.childId);

    assert.equal((await firstChild.locator('.fpw-child-meta').first().innerText()).trim(), 'N0C0001A-91-S', '非组合商品业务识别码应保持原有轻量文本');
    assert.equal(await firstChild.locator('.fpw-child-meta .fpw-code-trigger').count(), 0, '非组合商品业务识别码不应变成按钮式编码控件');
    const expectedChildProductMeta = await page.evaluate(childId => {
      const group = groups.find(item => item.children.some(child => child.id === childId));
      return {
        listing: `上架时间：${group.listedAt.replaceAll('-', '/')} · ${Number(group.listingDays).toLocaleString('zh-CN', { maximumFractionDigits: 1 })} 天`,
        tags: group.tags
      };
    }, context.childId);
    assert.equal((await firstChild.locator('.fpw-child-listing').innerText()).trim(), expectedChildProductMeta.listing, '预测批次详情子ASIN应展示与销售预测一致的上架时间');
    assert.deepEqual(await firstChild.locator('.fpw-child-tags .ant-tag').allTextContents(), expectedChildProductMeta.tags, '预测批次详情子ASIN应展示与销售预测一致的商品标签');

    const manualLine = workbench.locator(`tr[data-row-key="${context.entityKey}|manual"] .fpw-line-value.fpw-line-manual`).first();
    const activityLine = workbench.locator(`tr[data-row-key="${context.entityKey}|activity"] .fpw-line-value.fpw-line-activity`).first();
    await manualLine.waitFor();
    assert.deepEqual(await manualLine.evaluate(node => {
      const style = getComputedStyle(node);
      const cellStyle = getComputedStyle(node.closest('td'));
      return { minHeight: style.minHeight, padding: style.padding, alignItems: style.alignItems, justifyContent: style.justifyContent, gap: style.gap, cellPadding: cellStyle.padding, cellVerticalAlign: cellStyle.verticalAlign };
    }), { minHeight: '32px', padding: '0px', alignItems: 'flex-start', justifyContent: 'center', gap: '1px', cellPadding: '3px 8px', cellVerticalAlign: 'middle' }, '人工预测行应与销售预测详情使用同款对齐结构');
    assert.deepEqual(await activityLine.evaluate(node => {
      const style = getComputedStyle(node);
      const cellStyle = getComputedStyle(node.closest('td'));
      return { minHeight: style.minHeight, padding: style.padding, alignItems: style.alignItems, justifyContent: style.justifyContent, gap: style.gap, cellPadding: cellStyle.padding, cellVerticalAlign: cellStyle.verticalAlign };
    }), { minHeight: '32px', padding: '0px', alignItems: 'flex-start', justifyContent: 'center', gap: '1px', cellPadding: '3px 8px', cellVerticalAlign: 'middle' }, '活动预测行应与销售预测详情使用同款对齐结构');

    const activityEntry = workbench.locator('tr.fpw-parent-row.fpw-prediction-activity .fpw-entry-button').first();
    await domClick(activityEntry);
    const activityEditor = page.getByRole('dialog', { name: '活动预测' });
    await activityEditor.waitFor();
    assert.equal(await activityEditor.getByRole('textbox', { name: '活动名称' }).inputValue(), '', '预测批次详情活动名称不应自动预填');
    await domClick(activityEditor.getByRole('button', { name: '取消' }));
    await activityEditor.waitFor({ state: 'hidden' });

    await page.evaluate(() => {
      const batch = window.ForecastBatchContract.getCurrentMeta();
      window.ForecastBatchContract.launchSalesSubmission(batch.id, '2026-09-29T10:00:00+08:00');
    });

    await domClick(firstChild.locator('.fpw-code-line .fpw-code-trigger').first());
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
    const salesContext = page.locator('.sales-workbench-context:not(.sales-rule-source)');
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

    await domClick(page.getByRole('button', { name: '返回预测批次详情并定位当前对象' }));
    await workbench.waitFor();
    const manualRow = workbench.locator(`tr[data-row-key="${context.entityKey}|manual"]`);
    const finalRow = workbench.locator(`tr[data-row-key="${context.entityKey}|final"]`);
    await manualRow.waitFor();
    const workbenchAfterSalesEdit = await page.evaluate(({ batchId, childId, date }) => ({
      manual: window.ForecastBatchContract.getWorkbenchDraft(batchId, childId).manual[date] ?? null,
      final: window.ForecastBatchContract.getDailyForecast(batchId, childId, date).ruleForecast
    }), { ...workbenchBefore, childId: context.childId });
    assert.deepEqual(workbenchAfterSalesEdit, { manual: workbenchBefore.manual, final: workbenchBefore.final }, '销售填报不得反向改写PMC校准结果');
    assert.equal(await manualRow.locator('.fpw-entry-button').count(), 0, '销售填报发起后PMC校准结果应只读');
    assert.equal(Number((await finalRow.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).replaceAll(',', '').trim()), workbenchBefore.final, '返回后PMC最终预测不应被销售填报改写');

    await domClick(workbench.locator(`tr[data-row-key="${context.entityKey}"] .fpw-code-line .fpw-code-trigger`).first());
    await drawer.waitFor();
    assert.equal((await drawer.locator('.fpw-result-line.is-manual small').innerText()).trim(), '未填写');
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
