const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.40-forecast-lines';
const chrome = process.env.PLAYWRIGHT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const domClick = locator => locator.waitFor({ state: 'attached' }).then(() => locator.evaluate(node => node.click()));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = [];
    const warnings = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
      if (message.type() === 'warning') warnings.push(message.text());
    });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(url, { waitUntil: 'networkidle' });

    const workbench = page.locator('.forecast-workbench-root');
    await workbench.waitFor();
    assert.equal((await page.locator('.ant-tabs-tab-active').innerText()).trim(), '预测工作台');

    const fixedHeaders = (await workbench.locator('th.fpw-identity-header, th.fpw-share-header, th.fpw-context-header, th.fpw-line-header').allTextContents()).map(value => value.replaceAll(/\s+/g, ' ').trim());
    assert.deepEqual(fixedHeaders.map(value => value.split(' ')[0]), ['变体', '占比', '销量', '预测线']);
    assert.equal(await workbench.locator('th.fpw-business-group').count(), 0, '销量、库存、DOS不应再占用独立列');
    assert.ok(await workbench.locator('.fpw-context-cell .fpw-metric-grid').count() > 0, '应使用销售填报同源指标网格');

    assert.ok(await workbench.locator('.fpw-tree-parent-title .fpw-tree-more').count() > 0, '父ASIN节点应恢复悬停操作');
    assert.ok(await workbench.locator('.fpw-tree-child-title .fpw-tree-more').count() > 0, '子ASIN节点应恢复悬停操作');
    const treeAction = workbench.locator('.fpw-tree-parent-title .fpw-tree-more').first();
    assert.equal(await treeAction.evaluate(node => getComputedStyle(node).opacity), '0');
    assert.ok(await treeAction.evaluate(node => node.getBoundingClientRect().width > 0), '悬停操作应保留稳定点击区');

    const variantHeaderGeometry = await workbench.locator('th.fpw-identity-header .fpw-resizable-title').evaluate(node => {
      const label = node.children[0].getBoundingClientRect();
      const actions = node.querySelector('.fpw-variant-header-actions').getBoundingClientRect();
      return { labelRight: label.right, actionLeft: actions.left, gap: actions.left - label.right };
    });
    assert.ok(variantHeaderGeometry.gap >= 0 && variantHeaderGeometry.gap <= 8, '变体展开折叠图标应直接跟在标题右侧');

    await domClick(workbench.getByRole('button', { name: '收起变体栏' }));
    const collapsedLayout = await workbench.locator('.fpw-body').evaluate(node => {
      const panel = node.querySelector('.fpw-tree-panel').getBoundingClientRect();
      const button = node.querySelector('.fpw-tree-divider-toggle').getBoundingClientRect();
      return { columns: getComputedStyle(node).gridTemplateColumns, panelWidth: panel.width, buttonWidth: button.width, buttonHeight: button.height };
    });
    assert.equal(collapsedLayout.panelWidth, 0, '折叠后变体栏不应预留空白宽度');
    assert.ok(collapsedLayout.columns.startsWith('0px '));
    assert.deepEqual([collapsedLayout.buttonWidth, collapsedLayout.buttonHeight], [22, 36]);
    await domClick(workbench.getByRole('button', { name: '展开变体栏' }));

    const firstShare = workbench.locator('.fpw-share-entry').first();
    const shareLayout = await firstShare.evaluate(node => {
      const value = node.querySelector('.fpw-share-value').getBoundingClientRect();
      const edit = node.querySelector('.fpw-share-edit-slot').getBoundingClientRect();
      return { gap: edit.left - value.right };
    });
    assert.ok(shareLayout.gap >= 4, '占比编辑图标必须位于数值右侧且不重叠');
    const initialOverCount = await workbench.locator('.fpw-parent-share.is-over').count();
    const originalShare = Number((await firstShare.innerText()).replace('%', '').trim());
    await domClick(firstShare);
    let shareDialog = page.getByRole('dialog', { name: '调整子ASIN占比' });
    await shareDialog.getByRole('spinbutton', { name: '子ASIN占比' }).fill('100');
    await shareDialog.getByRole('textbox', { name: '占比调整原因' }).fill('超额预警回归');
    await domClick(shareDialog.getByRole('button', { name: '保存' }));
    await shareDialog.waitFor({ state: 'hidden' });
    assert.ok(await workbench.locator('.fpw-parent-share.is-over').count() > 0, '合计超过100%时父ASIN必须预警');
    assert.ok(await workbench.locator('.fpw-parent-share.is-over .fpw-share-warning').count() > 0, '超额预警不能只依赖颜色');
    await domClick(workbench.locator('.fpw-share-entry').first());
    shareDialog = page.getByRole('dialog', { name: '调整子ASIN占比' });
    await shareDialog.getByRole('spinbutton', { name: '子ASIN占比' }).fill(String(originalShare));
    await shareDialog.getByRole('textbox', { name: '占比调整原因' }).fill('恢复回归前占比');
    await domClick(shareDialog.getByRole('button', { name: '保存' }));
    await shareDialog.waitFor({ state: 'hidden' });
    assert.equal(await workbench.locator('.fpw-parent-share.is-over').count(), initialOverCount);

    const firstChild = workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-child-row').first();
    assert.deepEqual((await firstChild.locator('.fpw-line-label').allTextContents()).map(value => value.trim()), ['最终预测'], '默认只显示最终预测');
    await domClick(firstChild.getByRole('button', { name: /展开 .* 预测线/ }));
    assert.deepEqual((await firstChild.locator('.fpw-line-label').allTextContents()).map(value => value.trim()), ['系统预测', '人工预测', '活动预测', '最终预测']);
    assert.ok(await firstChild.locator('.fpw-entry-button.fpw-line-manual').count() > 0);
    assert.ok(await firstChild.locator('.fpw-entry-button.fpw-line-activity').count() > 0);

    const originalFinal = (await firstChild.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).trim();
    await domClick(firstChild.locator('.fpw-entry-button.fpw-line-manual').first());
    let editor = page.getByRole('dialog', { name: '人工预测' });
    await editor.getByRole('spinbutton', { name: '预测销量' }).fill('777');
    await editor.getByRole('textbox', { name: '人工预测原因' }).fill('优先级回归');
    await domClick(editor.getByRole('button', { name: '保存' }));
    await editor.waitFor({ state: 'hidden' });
    await page.waitForTimeout(150);
    assert.equal((await firstChild.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).trim(), '777');

    await domClick(firstChild.locator('.fpw-entry-button.fpw-line-activity').first());
    editor = page.getByRole('dialog', { name: '活动预测' });
    await editor.getByRole('spinbutton', { name: '预测销量' }).fill('888');
    await editor.getByRole('textbox', { name: '活动名称' }).fill('活动覆盖回归');
    await domClick(editor.getByRole('button', { name: '保存' }));
    await editor.waitFor({ state: 'hidden' });
    await page.waitForTimeout(150);
    assert.equal((await firstChild.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).trim(), '888');
    assert.equal((await firstChild.locator('.fpw-forecast-cell .fpw-line-final small').first().innerText()).trim(), '活动');
    await domClick(firstChild.locator('.fpw-entry-button.fpw-line-activity').first());
    editor = page.getByRole('dialog', { name: '活动预测' });
    await domClick(editor.getByRole('button', { name: '清除预测' }));
    await editor.waitFor({ state: 'hidden' });
    await page.waitForTimeout(150);
    assert.equal((await firstChild.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).trim(), '777');
    await domClick(firstChild.locator('.fpw-entry-button.fpw-line-manual').first());
    editor = page.getByRole('dialog', { name: '人工预测' });
    await domClick(editor.getByRole('button', { name: '清除预测' }));
    await editor.waitFor({ state: 'hidden' });
    await page.waitForTimeout(150);
    assert.equal((await firstChild.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).trim(), originalFinal);

    const firstParent = workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-parent-row').first();
    await domClick(firstParent.getByRole('button', { name: /展开 .* 预测线/ }));
    assert.deepEqual((await firstParent.locator('.fpw-line-label').allTextContents()).map(value => value.trim()), ['系统预测', '人工预测', '活动预测', '最终预测']);
    const originalParentFinal = (await firstParent.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).trim();
    await domClick(firstParent.locator('.fpw-entry-button.fpw-line-manual').first());
    editor = page.getByRole('dialog', { name: '人工预测' });
    assert.match(await editor.locator('.forecast-editor-context').innerText(), /B0GRGFFVVN/);
    await editor.getByRole('spinbutton', { name: '预测销量' }).fill('300');
    await editor.getByRole('textbox', { name: '人工预测原因' }).fill('父体分配回归');
    await domClick(editor.getByRole('button', { name: '保存' }));
    await editor.waitFor({ state: 'hidden' });
    await page.waitForTimeout(150);
    assert.equal((await firstParent.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).trim(), '300');
    const distributed = await workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-child-row').evaluateAll(rows => rows.slice(0, 3).map(row => Number(row.querySelector('.fpw-forecast-cell .fpw-line-final strong')?.textContent || 0)));
    assert.equal(distributed.reduce((sum, value) => sum + value, 0), 300, '父ASIN调整量应精确分配到子ASIN');
    await domClick(firstParent.locator('.fpw-entry-button.fpw-line-manual').first());
    editor = page.getByRole('dialog', { name: '人工预测' });
    await domClick(editor.getByRole('button', { name: '清除预测' }));
    await editor.waitFor({ state: 'hidden' });
    await page.waitForTimeout(150);
    assert.equal((await firstParent.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).trim(), originalParentFinal);

    await domClick(workbench.getByRole('button', { name: '列配置' }));
    const columnDrawer = page.getByRole('dialog', { name: '列配置' });
    const selectedRows = columnDrawer.locator('.antd-selected-field-row[draggable="true"]');
    assert.equal(await selectedRows.count(), 5);
    assert.equal(await columnDrawer.getByRole('button', { name: /^移除/ }).count(), 5);
    assert.equal(await columnDrawer.getByRole('button', { name: /^置顶/ }).count(), 5);
    assert.equal(await columnDrawer.getByRole('button', { name: /^固定/ }).count(), 5);
    assert.equal(await columnDrawer.getByRole('button', { name: '保存为新模板' }).count(), 1);
    const beforeOrder = (await columnDrawer.locator('.antd-selected-group').last().locator('.antd-selected-field-name').allTextContents()).map(value => value.trim());
    await selectedRows.first().press('Alt+ArrowDown');
    const afterOrder = (await columnDrawer.locator('.antd-selected-group').last().locator('.antd-selected-field-name').allTextContents()).map(value => value.trim());
    assert.notDeepEqual(afterOrder, beforeOrder, '列配置应支持键盘/拖拽重排');
    await domClick(columnDrawer.getByRole('button', { name: /^固定/ }).first());
    assert.equal(await columnDrawer.locator('.column-quick-action.is-pinned').count(), 1);
    await domClick(columnDrawer.getByRole('button', { name: /^移除/ }).last());
    assert.ok(await columnDrawer.locator('.antd-selected-field-row[draggable="true"]').count() < 5);
    await domClick(columnDrawer.getByRole('button', { name: '恢复默认' }));
    await domClick(columnDrawer.getByRole('button', { name: '保存并应用' }));
    await columnDrawer.waitFor({ state: 'hidden' });

    await page.screenshot({ path: 'evidence/forecast-workbench-v040.png', fullPage: false });
    assert.deepEqual(errors, [], `页面运行时错误：${errors.join('；')}`);
    assert.deepEqual(warnings, [], `页面运行时告警：${warnings.join('；')}`);
    console.log('Forecast workbench V0.3.40 browser verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
