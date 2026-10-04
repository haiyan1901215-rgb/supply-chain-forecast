const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.39-interaction-parity';
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
    assert.equal((await page.locator('.ant-tabs-tab-active').innerText()).trim(), '预测工作台', '系统应默认打开预测工作台');
    assert.ok((await page.locator('[data-view="forecast-workbench"]').first().getAttribute('class') || '').includes('active'), '左侧应高亮预测工作台');

    await domClick(page.locator('[data-view="sales"][data-menu-origin="top-sales"]'));
    const salesTable = page.locator('.forecast-table');
    await salesTable.waitFor();
    const salesHeaderGlyphs = await salesTable.locator('.identity-head .tree-tool svg').evaluateAll(nodes => nodes.map(node => ({
      viewBox: node.getAttribute('viewBox'),
      strokeWidth: node.getAttribute('stroke-width'),
      path: node.querySelector('path')?.getAttribute('d')
    })));
    const salesParentGlyph = await salesTable.locator('.parent-row .collapse svg').first().evaluate(node => ({
      viewBox: node.getAttribute('viewBox'),
      strokeWidth: node.getAttribute('stroke-width'),
      path: node.querySelector('path')?.getAttribute('d')
    }));
    assert.ok(await salesTable.locator('td.entry-cell [data-edit-manual]').count() > 0, '销售预测填报的人工预测编辑仍可用');
    assert.ok(await salesTable.locator('td.entry-cell [data-event]').count() > 0, '销售预测填报的活动预测编辑仍可用');
    await domClick(page.locator('[data-view="forecast-workbench"][data-menu-origin="top-forecast-workbench"]'));
    await workbench.waitFor();

    const headerTools = workbench.locator('.fpw-variant-header-actions .tree-tool');
    assert.ok(await headerTools.count() >= 2, '变体表头应保留展开和收起控件');
    const workbenchHeaderGlyphs = await headerTools.locator('svg').evaluateAll(nodes => nodes.slice(0, 2).map(node => ({
      viewBox: node.getAttribute('viewBox'),
      strokeWidth: node.getAttribute('stroke-width'),
      path: node.querySelector('path')?.getAttribute('d')
    })));
    assert.deepEqual(workbenchHeaderGlyphs, salesHeaderGlyphs, '变体表头应直接复用销售预测填报的展开收起SVG');

    const parentToggle = workbench.locator('.fpw-parent-row .fpw-parent-collapse').first();
    const workbenchParentGlyph = await parentToggle.locator('svg').evaluate(node => ({
      viewBox: node.getAttribute('viewBox'),
      strokeWidth: node.getAttribute('stroke-width'),
      path: node.querySelector('path')?.getAttribute('d')
    }));
    assert.deepEqual(workbenchParentGlyph, salesParentGlyph, '父体行应直接复用销售预测填报的展开收起SVG');
    await domClick(parentToggle);
    assert.equal(await parentToggle.locator('svg path').getAttribute('d'), 'M2 6h8M6 2v8');
    await domClick(parentToggle);

    const groupHeaders = workbench.locator('th.fpw-business-group');
    assert.deepEqual((await groupHeaders.allTextContents()).map(value => value.trim()), ['近30天销量', 'FBA']);
    for (const header of await groupHeaders.all()) {
      assert.equal(await header.evaluate(node => getComputedStyle(node).textAlign), 'left', '销量与库存分组表头应左对齐');
      assert.equal(await header.locator('.fpw-field-title').count(), 1, '销量与库存分组表头应使用字段提示样式');
    }
    await groupHeaders.first().locator('.fpw-field-title').hover();
    await page.locator('.ant-tooltip:visible').waitFor();
    assert.match((await page.locator('.ant-tooltip:visible').innerText()).trim(), /近30天销量/);
    await page.mouse.move(1200, 60);
    await page.locator('.ant-tooltip:visible').waitFor({ state: 'hidden' });

    assert.equal((await workbench.locator('.fpw-tree-head').innerText()).includes('子ASIN'), false, '左栏父ASIN不应显示子体数量');
    assert.equal(await workbench.locator('.fpw-tree-child-title button').count(), 0, '子ASIN节点不应保留绑定管理入口');
    const relationButton = workbench.getByRole('button', { name: '变体关系管理' });
    await relationButton.hover();
    const relationTooltip = page.locator('.ant-tooltip:visible').filter({ hasText: '变体关系管理' });
    await relationTooltip.waitFor();
    assert.equal((await relationTooltip.innerText()).trim(), '变体关系管理');
    await page.mouse.move(1200, 60);

    const parentCode = workbench.locator('.fpw-parent-row .fpw-code-trigger').first();
    await domClick(parentCode);
    const drawer = page.locator('.fpw-detail-drawer');
    await drawer.waitFor();
    assert.match(await drawer.locator('.fpw-drawer-title').innerText(), /Parent ASIN/);
    assert.deepEqual((await drawer.getByRole('tab').allTextContents()).map(value => value.trim()), ['预测依据', '子体拆分', '父子关系', '销售组合']);
    await drawer.locator('.ant-drawer-close').click();
    await drawer.waitFor({ state: 'hidden' });
    await domClick(workbench.locator('.fpw-child-row .fpw-code-trigger').first());
    await drawer.waitFor();
    assert.match(await drawer.locator('.fpw-drawer-title').innerText(), /Child ASIN/);
    await drawer.locator('.ant-drawer-close').click();
    await drawer.waitFor({ state: 'hidden' });
    assert.equal(await workbench.locator('.fpw-open-detail').count(), 0, '不应另外增加详情图标');

    const parentShares = (await workbench.locator('.fpw-parent-share').allTextContents()).map(value => value.trim());
    assert.ok(parentShares.length > 0 && parentShares.every(value => value === '100.00%'), '父ASIN应显示子ASIN占比合计100.00%');
    const shareEntry = workbench.locator('.fpw-child-row .fpw-share-entry').first();
    const shareIcon = shareEntry.locator('.fpw-share-edit-slot svg');
    assert.equal(await shareIcon.evaluate(node => getComputedStyle(node).opacity), '0');
    await shareEntry.hover();
    assert.equal(await shareIcon.evaluate(node => getComputedStyle(node).opacity), '1', '子ASIN占比悬停时应显示编辑图标');
    const shareBefore = Number((await shareEntry.innerText()).replace('%', '').trim());
    await domClick(shareEntry);
    const shareDialog = page.getByRole('dialog', { name: '调整子ASIN占比' });
    await shareDialog.waitFor();
    await shareDialog.getByRole('spinbutton', { name: '子ASIN占比' }).fill(String(shareBefore));
    await shareDialog.getByRole('textbox', { name: '占比调整原因' }).fill('交互回归：保持当前占比');
    await shareDialog.getByRole('button', { name: '保存' }).click();
    await shareDialog.waitFor({ state: 'hidden' });
    const totalShares = await workbench.locator('.fpw-parent-row').evaluateAll(rows => rows.map(row => Number(row.querySelector('.fpw-parent-share').textContent.replace('%', ''))));
    assert.ok(totalShares.every(value => value <= 100 && value === 100), '同一父ASIN的子ASIN占比合计必须为100%');
    await shareEntry.hover();
    await page.locator('.ant-popover:visible').waitFor();
    assert.match(await page.locator('.ant-popover:visible').innerText(), /交互回归：保持当前占比/);
    await page.mouse.move(1200, 60);

    const originalMetricHeaders = await workbench.locator('.fpw-metric-header').count();
    await workbench.getByRole('button', { name: '列配置' }).click();
    const columnDrawer = page.getByRole('dialog', { name: '列配置' });
    await columnDrawer.waitFor();
    const templateSelect = columnDrawer.getByRole('combobox', { name: '选择列配置模板' });
    await templateSelect.click();
    await templateSelect.press('ArrowDown');
    await templateSelect.press('Enter');
    assert.equal((await columnDrawer.locator('.antd-column-template .ant-select-selection-item').innerText()).trim(), '精简查看');
    await columnDrawer.getByRole('button', { name: '保存并应用' }).click();
    await columnDrawer.waitFor({ state: 'hidden' });
    assert.ok(await workbench.locator('.fpw-metric-header').count() < originalMetricHeaders, '精简列配置应减少可见业务列');
    await workbench.getByRole('button', { name: '列配置' }).click();
    await columnDrawer.getByRole('button', { name: '恢复默认' }).click();
    await columnDrawer.getByRole('button', { name: '保存并应用' }).click();
    assert.equal(await workbench.locator('.fpw-metric-header').count(), originalMetricHeaders, '恢复默认应还原全部业务列');

    await relationButton.click();
    const bindingWorkspace = page.locator('.fpw-binding-workspace');
    await bindingWorkspace.waitFor();
    assert.deepEqual((await page.locator('.workspace-tabs-v028 .ant-tabs-tab').allTextContents()).map(value => value.replace('×', '').trim()), ['预测工作台', '变体关系管理']);
    assert.equal(await page.locator('.workspace-tabs-v028 .ant-tabs-tab-remove').count(), 1, '新开页签应显示可关闭的×');
    await domClick(page.locator('.workspace-tabs-v028 .ant-tabs-tab').filter({ hasText: '预测工作台' }));
    await workbench.waitFor();
    await domClick(page.locator('.workspace-tabs-v028 .ant-tabs-tab').filter({ hasText: '变体关系管理' }));
    await bindingWorkspace.waitFor();
    await domClick(page.locator('.workspace-tabs-v028 .ant-tabs-tab-remove'));
    await workbench.waitFor();
    assert.deepEqual((await page.locator('.workspace-tabs-v028 .ant-tabs-tab').allTextContents()).map(value => value.trim()), ['预测工作台']);

    await page.screenshot({ path: 'evidence/forecast-workbench-v039.png', fullPage: false });
    assert.deepEqual(errors, [], `页面运行时错误：${errors.join('；')}`);
    assert.deepEqual(warnings, [], `页面运行时告警：${warnings.join('；')}`);
    console.log('Forecast workbench V0.3.39 browser verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
