const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.48-forecast-batch-flow';
const chrome = process.env.PLAYWRIGHT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const domClick = locator => locator.waitFor({ state: 'attached' }).then(() => locator.evaluate(node => node.click()));
const dismissPopover = async page => {
  await page.keyboard.press('Escape');
  await page.mouse.move(8, 8);
  await page.waitForTimeout(250);
};

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
    await page.locator('.forecast-batch-list-root').waitFor();
    await page.evaluate(() => {
      const batch = window.ForecastBatchContract.getCurrentMeta();
      window.pmcWorkflow.openForecastWorkbenchBatch(batch.id, batch.calibrationStatus);
    });

    const workbench = page.locator('.forecast-workbench-root');
    await workbench.waitFor();
    assert.equal((await page.locator('.ant-tabs-tab-active').innerText()).trim(), '预测工作台');

    const fixedHeaders = (await workbench.locator('th.fpw-identity-header, th.fpw-share-header, th.fpw-context-header, th.fpw-line-header').allTextContents()).map(value => value.replaceAll(/\s+/g, ' ').trim());
    assert.deepEqual(fixedHeaders.map(value => value.split(' ')[0]), ['变体', '占比', '销量', '预测线']);
    assert.equal(await workbench.locator('th.fpw-business-group').count(), 0, '销量、库存、DOS不应再占用独立列');
    assert.ok(await workbench.locator('.fpw-context-cell .fpw-metric-grid').count() > 0, '应使用销售填报同源指标网格');

    assert.equal(await workbench.locator('.fpw-tree-parent-title .fpw-tree-more').count(), 0, '父ASIN节点不应显示更多操作');
    assert.ok(await workbench.locator('.fpw-tree-child-title .fpw-tree-more').count() > 0, '子ASIN节点应恢复悬停操作');
    const treeAction = workbench.locator('.fpw-tree-child-title .fpw-tree-more').first();
    assert.equal(await treeAction.evaluate(node => getComputedStyle(node).opacity), '0');
    assert.ok(await treeAction.evaluate(node => node.getBoundingClientRect().width > 0), '悬停操作应保留稳定点击区');

    const variantHeaderGeometry = await workbench.locator('th.fpw-identity-header .fpw-resizable-title').evaluate(node => {
      const label = node.children[0].getBoundingClientRect();
      const actions = node.querySelector('.fpw-variant-header-actions').getBoundingClientRect();
      return { labelRight: label.right, actionLeft: actions.left, gap: actions.left - label.right };
    });
    assert.ok(variantHeaderGeometry.gap >= 0 && variantHeaderGeometry.gap <= 8, '变体展开折叠图标应直接跟在标题右侧');
    assert.equal(await workbench.locator('th.fpw-identity-header').first().locator('.fpw-variant-header-actions .forecast-state-toggle').count(), 1, '每个变体标题只应有一个状态化展开折叠入口');
    await domClick(workbench.getByRole('button', { name: '一键收起全部父子ASIN' }));
    assert.equal(await workbench.getByRole('button', { name: '一键展开全部父子ASIN' }).count(), 1, '收起后应在原位替换为展开操作');
    await domClick(workbench.getByRole('button', { name: '一键展开全部父子ASIN' }));

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

    const tableGeometry = await workbench.locator('.fpw-table').evaluate(node => {
      const headerRows = [...node.querySelectorAll('.ant-table-header thead tr')];
      const dayHeader = node.querySelector('th.fpw-day-header');
      const standards = window.EnterpriseUiStandards.forecastTable;
      return {
        headerHeights: headerRows.map(row => Math.round(row.getBoundingClientRect().height)),
        dayWidth: Math.round(dayHeader.getBoundingClientRect().width),
        standards
      };
    });
    assert.deepEqual(tableGeometry.headerHeights, [28, 34], '工作台双层表头必须使用销售预测 28px + 34px 规则');
    assert.equal(tableGeometry.dayWidth, 72, '日级预测列必须使用共享 72px 宽度');
    assert.equal(tableGeometry.standards.dayWidth, 72);
    assert.equal(tableGeometry.standards.weekHeaderHeight + tableGeometry.standards.dayHeaderHeight, 62);

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
    let shareDialog = page.getByRole('dialog', { name: '调整子ASIN份额占比' });
    await shareDialog.getByRole('spinbutton', { name: '子ASIN份额占比' }).fill('100');
    await shareDialog.getByRole('textbox', { name: '份额占比调整原因' }).fill('超额预警回归');
    assert.equal(await shareDialog.getByText('仅修改当前子ASIN', { exact: false }).count(), 0, '份额编辑弹窗应移除冗余说明');
    const countLayout = await shareDialog.locator('.ant-input-data-count').evaluate(node => {
      const count = node.getBoundingClientRect();
      const field = node.parentElement.getBoundingClientRect();
      return { insideRight: count.right <= field.right + 1, insideBottom: count.bottom <= field.bottom + 1 };
    });
    assert.deepEqual(countLayout, { insideRight: true, insideBottom: true }, '字符计数应收在文本框内');
    await domClick(shareDialog.getByRole('button', { name: '保存' }));
    await shareDialog.waitFor({ state: 'hidden' });
    assert.ok(await workbench.locator('.fpw-parent-share.is-over').count() > 0, '合计超过100%时父ASIN必须预警');
    assert.ok(await workbench.locator('.fpw-parent-share.is-over .fpw-share-warning').count() > 0, '超额预警不能只依赖颜色');
    assert.equal(await workbench.locator('.fpw-parent-share.is-over').first().evaluate(node => node.firstElementChild?.classList.contains('fpw-share-warning')), true, '超额预警图标应置于合计数值左侧');
    await domClick(workbench.locator('.fpw-share-entry').first());
    shareDialog = page.getByRole('dialog', { name: '调整子ASIN份额占比' });
    await shareDialog.getByRole('spinbutton', { name: '子ASIN份额占比' }).fill(String(originalShare));
    await shareDialog.getByRole('textbox', { name: '份额占比调整原因' }).fill('恢复回归前占比');
    await domClick(shareDialog.getByRole('button', { name: '保存' }));
    await shareDialog.waitFor({ state: 'hidden' });
    assert.equal(await workbench.locator('.fpw-parent-share.is-over').count(), initialOverCount);

    const firstChild = workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-child-row').first();
    const identityBackground = await firstChild.locator('td.fpw-identity-cell').evaluate(node => getComputedStyle(node).backgroundColor);
    await firstChild.locator('td.fpw-identity-cell').hover();
    assert.equal(await workbench.locator('.fpw-cross-column, .fpw-cross-row, .fpw-cross-cell').count(), 0, '固定信息列悬停不应触发十字高亮');
    assert.equal(await firstChild.locator('td.fpw-identity-cell').evaluate(node => getComputedStyle(node).backgroundColor), identityBackground, '非日期业务列悬停不得改变底色');
    await firstChild.locator('td.fpw-forecast-cell').first().hover();
    assert.ok(await firstChild.locator('td.fpw-forecast-cell.fpw-cross-column').count() > 0, '日期预测单元格应触发十字高亮');
    assert.equal(await firstChild.locator('td.fpw-identity-cell.fpw-cross-column').count(), 0, '日期高亮不应污染固定信息列');

    await domClick(workbench.locator('.fpw-parent-row .fpw-code-trigger').first());
    const detailDrawer = page.locator('.fpw-detail-drawer');
    await detailDrawer.waitFor();
    assert.equal(await detailDrawer.locator('.ant-tabs').count(), 0, '右侧抽屉应移除多余Tab');
    for (const heading of ['批次信息', '当前预测对象', '预测结果形成', '预测依据']) await detailDrawer.getByRole('heading', { name: heading, exact: true }).waitFor();
    assert.equal(await detailDrawer.getByText('预测关键参数', { exact: true }).count(), 0, '详情不应继续以模型参数为主体');
    for (const parameter of ['动态 Alpha', '季节因子', 'Listing适配系数']) assert.equal(await detailDrawer.getByText(parameter, { exact: true }).count(), 0, `${parameter}不应在业务详情中展开`);
    assert.equal(await detailDrawer.getByText('活动预测 > 人工预测 > 规则预测。', { exact: false }).count(), 1, '详情应明确最终预测的按日形成关系');
    assert.equal(await detailDrawer.getByRole('button', { name: '进入销售预测填报' }).count(), 1, '详情必须提供销售预测填报入口');
    assert.equal(await detailDrawer.getByRole('button', { name: '返回列表并定位' }).count(), 1, '详情必须提供当前对象定位入口');
    await domClick(detailDrawer.locator('.ant-drawer-close'));
    await detailDrawer.waitFor({ state: 'hidden' });

    const initialFirstChildLines = await workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-child-row').evaluateAll(rows => {
      const entityKeyOf = row => row.getAttribute('data-row-key')?.replace(/\|(system|manual|activity|final)$/, '');
      const entityKey = entityKeyOf(rows[0]);
      return rows.filter(row => entityKeyOf(row) === entityKey).map(row => row.querySelector('.fpw-line-label')?.textContent?.trim());
    });
    assert.deepEqual(initialFirstChildLines, ['规则预测', '人工预测', '活动预测', '最终预测'], '预测工作台预测线应默认展开');
    assert.equal(await workbench.locator('tbody tr[data-row-key] .fpw-forecast-toggle').count(), 0, '父子ASIN行内不得显示预测线开关');
    assert.equal(await workbench.locator('th.fpw-line-header .fpw-forecast-toggle').count(), 1, '预测线表头必须只保留一个全局开关');
    assert.equal(await workbench.getByRole('button', { name: '收起全部预测线' }).count(), 1, '默认展开后应显示收起操作');
    await domClick(workbench.getByRole('button', { name: '收起全部预测线' }));
    assert.deepEqual((await workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-child-row .fpw-line-label').allTextContents()).slice(0, 1).map(value => value.trim()), ['最终预测'], '收起后只显示最终预测');
    await domClick(workbench.getByRole('button', { name: '展开全部预测线' }));
    const firstChildLines = await workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-child-row').evaluateAll(rows => {
      const entityKeyOf = row => row.getAttribute('data-row-key')?.replace(/\|(system|manual|activity|final)$/, '');
      const entityKey = entityKeyOf(rows[0]);
      return rows.filter(row => entityKeyOf(row) === entityKey).map(row => ({
        label: row.querySelector('.fpw-line-label')?.textContent?.trim(),
        labelCount: row.querySelectorAll('.fpw-line-label').length
      }));
    });
    assert.deepEqual(firstChildLines.map(row => row.label), ['规则预测', '人工预测', '活动预测', '最终预测']);
    assert.ok(firstChildLines.every(row => row.labelCount === 1), '四条预测线必须渲染为四个独立列表行');
    const firstChildSystem = workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-child-row.fpw-prediction-system').first();
    const firstChildManual = workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-child-row.fpw-prediction-manual').first();
    const firstChildActivity = workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-child-row.fpw-prediction-activity').first();
    const firstChildFinal = workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-child-row.fpw-prediction-final').first();
    assert.equal(await workbench.getByRole('button', { name: '收起全部预测线' }).count(), 1, '展开后表头开关应在原位替换为收起语义');
    assert.ok(await firstChildManual.locator('.fpw-entry-button.fpw-line-manual').count() > 0);
    assert.ok(await firstChildActivity.locator('.fpw-entry-button.fpw-line-activity').count() > 0);
    const childFixedCells = firstChildSystem.locator('td.fpw-identity-cell, td.fpw-share-cell, td.fpw-context-cell');
    const fixedBackgroundsBeforeCrossHover = await childFixedCells.evaluateAll(cells => cells.map(cell => getComputedStyle(cell).backgroundColor));
    await firstChildManual.locator('td.fpw-forecast-cell').first().hover();
    const fixedBackgroundsAfterCrossHover = await childFixedCells.evaluateAll(cells => cells.map(cell => getComputedStyle(cell).backgroundColor));
    assert.deepEqual(fixedBackgroundsAfterCrossHover, fixedBackgroundsBeforeCrossHover, '十字高亮不得改变变体、占比、销量 / 库存列底色');
    assert.ok(fixedBackgroundsAfterCrossHover.every(color => color === 'rgb(255, 255, 255)'), '子ASIN固定业务列在十字高亮时必须保持白底');
    const emptyEntryTargets = [
      ['子ASIN人工预测', firstChildManual.locator('.fpw-entry-button.fpw-entry-empty').first()],
      ['子ASIN活动预测', firstChildActivity.locator('.fpw-entry-button.fpw-entry-empty').first()],
      ['父ASIN人工预测', workbench.locator('.fpw-parent-row.fpw-prediction-manual .fpw-entry-button.fpw-entry-empty').first()],
      ['父ASIN活动预测', workbench.locator('.fpw-parent-row.fpw-prediction-activity .fpw-entry-button.fpw-entry-empty').first()]
    ];
    for (const [label, target] of emptyEntryTargets) {
      const emptyEntryGeometry = await target.evaluate(node => {
        const cell = node.closest('td.fpw-forecast-cell').getBoundingClientRect();
        const wrapper = node.closest('.fpw-forecast-entry-wrap');
        const button = node.getBoundingClientRect();
        const icon = node.querySelector('.edit-icon').getBoundingClientRect();
        const center = rect => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        const cellCenter = center(cell);
        const buttonCenter = center(button);
        const iconCenter = center(icon);
        return {
          cellIconHorizontalDelta: Math.abs(cellCenter.x - iconCenter.x),
          cellIconVerticalDelta: Math.abs(cellCenter.y - iconCenter.y),
          buttonIconHorizontalDelta: Math.abs(buttonCenter.x - iconCenter.x),
          buttonIconVerticalDelta: Math.abs(buttonCenter.y - iconCenter.y),
          wrapperJustifyContent: getComputedStyle(wrapper).justifyContent
        };
      });
      assert.ok(emptyEntryGeometry.cellIconHorizontalDelta <= 1 && emptyEntryGeometry.cellIconVerticalDelta <= 1, `${label}的编辑图标必须相对整个预测单元格上下左右居中：${JSON.stringify(emptyEntryGeometry)}`);
      assert.ok(emptyEntryGeometry.buttonIconHorizontalDelta <= 1 && emptyEntryGeometry.buttonIconVerticalDelta <= 1, `${label}的编辑图标必须保持按钮内居中`);
      assert.equal(emptyEntryGeometry.wrapperJustifyContent, 'center', `${label}空值容器必须复用销售预测的垂直居中规则`);
    }
    await emptyEntryTargets[0][1].hover();
    await page.waitForTimeout(180);
    await page.screenshot({ path: 'evidence/forecast-workbench-empty-entry-center.png', fullPage: false });
    assert.equal(await workbench.getByText('(PMC)', { exact: true }).count(), 0, '预测来源只能是规则、人工、活动');
    assert.ok(await workbench.getByText('(规则)', { exact: true }).count() > 0, '规则预测来源应在最终预测值下方展示');

    const originalSystem = Number((await firstChildSystem.locator('.fpw-forecast-cell .fpw-line-system').first().innerText()).replaceAll(',', '').trim());
    const originalFinal = (await firstChildFinal.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).trim();
    await domClick(firstChildManual.locator('.fpw-entry-button.fpw-line-manual').first());
    let editor = page.getByRole('dialog', { name: '人工预测' });
    await editor.getByRole('spinbutton', { name: '预测销量' }).fill('777');
    await editor.getByRole('textbox', { name: '人工预测原因' }).fill('优先级回归');
    await domClick(editor.getByRole('button', { name: '保存' }));
    await editor.waitFor({ state: 'hidden' });
    await page.waitForTimeout(150);
    assert.equal((await firstChildFinal.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).trim(), '777');
    assert.equal((await firstChildManual.locator('.entry-number').first().innerText()).trim(), '777', '人工预测行必须同时显示用户填写的销量值');
    const populatedEntryTypography = await firstChildManual.locator('.fpw-entry-button.fpw-entry-value').first().evaluate(node => {
      const value = node.querySelector('span:first-child');
      const icon = node.querySelector('.edit-icon').getBoundingClientRect();
      const valueRect = value.getBoundingClientRect();
      const style = getComputedStyle(value);
      return {
        font: [style.fontSize, style.fontWeight, style.lineHeight],
        gap: Math.round(icon.left - valueRect.right),
        verticalDelta: Math.abs((icon.top + icon.height / 2) - (valueRect.top + valueRect.height / 2))
      };
    });
    assert.deepEqual(populatedEntryTypography.font, ['12px', '400', '16px'], '工作台已填人工/活动预测数值必须使用销售页同款字号、字重和行高');
    assert.ok(populatedEntryTypography.gap >= 3 && populatedEntryTypography.gap <= 4 && populatedEntryTypography.verticalDelta <= 1, '已填数值与编辑图标必须按销售页规则对齐');
    await firstChildManual.locator('.fpw-entry-button.fpw-entry-value').first().hover();
    await page.waitForTimeout(180);
    await page.screenshot({ path: 'evidence/forecast-workbench-entry-child-icon.png', fullPage: false });
    const manualAdjustment = firstChildManual.locator('.fpw-adjustment-entry .cell-reason').first();
    assert.equal((await manualAdjustment.innerText()).trim(), `+${(777 - originalSystem).toLocaleString('zh-CN')}`, '人工预测下方应显示相对规则预测的差值');
    assert.deepEqual(await manualAdjustment.evaluate(node => {
      const style = getComputedStyle(node);
      return [style.fontSize, style.fontWeight, style.lineHeight];
    }), ['10px', '400', '14px'], '调整差值必须使用销售页同款字号、字重和行高');
    await manualAdjustment.hover();
    const manualPreview = page.locator('.ant-popover:visible .activity-preview-compact');
    await manualPreview.waitFor();
    assert.match(await manualPreview.innerText(), /预测日期[\s\S]*人工预测销量[\s\S]*调整原因[\s\S]*调整人[\s\S]*调整时间/);
    await dismissPopover(page);

    await domClick(firstChildActivity.locator('.fpw-entry-button.fpw-line-activity').first());
    editor = page.getByRole('dialog', { name: '活动预测' });
    await editor.getByRole('spinbutton', { name: '预测销量' }).fill('888');
    await editor.getByRole('textbox', { name: '活动名称' }).fill('活动覆盖回归');
    await domClick(editor.getByRole('button', { name: '保存' }));
    await editor.waitFor({ state: 'hidden' });
    await page.waitForTimeout(150);
    assert.equal((await firstChildFinal.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).trim(), '888');
    assert.equal((await firstChildFinal.locator('.fpw-forecast-cell .fpw-line-final small').first().innerText()).trim(), '(活动)');
    assert.equal((await firstChildActivity.locator('.entry-number').first().innerText()).trim(), '888', '活动预测行必须同时显示用户填写的销量值');
    const activityAdjustment = firstChildActivity.locator('.fpw-adjustment-entry .cell-reason').first();
    assert.equal((await activityAdjustment.innerText()).trim(), '+111', '活动预测下方应优先显示相对人工预测的差值');
    await activityAdjustment.hover();
    const activityPreview = page.locator('.ant-popover:visible .activity-preview-compact');
    await activityPreview.waitFor();
    assert.match(await activityPreview.innerText(), /活动日期[\s\S]*活动预测销量[\s\S]*活动名称[\s\S]*备注[\s\S]*调整人[\s\S]*调整时间/);
    await page.waitForTimeout(250);
    await page.screenshot({ path: 'evidence/forecast-workbench-entry-child-popover.png', fullPage: false });
    await dismissPopover(page);
    await domClick(firstChildActivity.locator('.fpw-entry-button.fpw-line-activity').first());
    editor = page.getByRole('dialog', { name: '活动预测' });
    await domClick(editor.getByRole('button', { name: '清除预测' }));
    await editor.waitFor({ state: 'hidden' });
    await page.waitForTimeout(150);
    assert.equal((await firstChildFinal.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).trim(), '777');
    await domClick(firstChildManual.locator('.fpw-entry-button.fpw-line-manual').first());
    editor = page.getByRole('dialog', { name: '人工预测' });
    await domClick(editor.getByRole('button', { name: '清除预测' }));
    await editor.waitFor({ state: 'hidden' });
    await page.waitForTimeout(150);
    assert.equal((await firstChildFinal.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).trim(), originalFinal);

    const firstParent = workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-parent-row').first();
    const parentLines = await workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-parent-row').evaluateAll(rows => {
      const entityKeyOf = row => row.getAttribute('data-row-key')?.replace(/\|(system|manual|activity|final)$/, '');
      const entityKey = entityKeyOf(rows[0]);
      return rows.filter(row => entityKeyOf(row) === entityKey).map(row => row.querySelector('.fpw-line-label')?.textContent?.trim());
    });
    assert.deepEqual(parentLines, ['规则预测', '人工预测', '活动预测', '最终预测']);
    const firstParentSystem = workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-parent-row.fpw-prediction-system').first();
    const firstParentManual = workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-parent-row.fpw-prediction-manual').first();
    const firstParentActivity = workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-parent-row.fpw-prediction-activity').first();
    const firstParentFinal = workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-parent-row.fpw-prediction-final').first();
    const originalParentSystem = Number((await firstParentSystem.locator('.fpw-forecast-cell .fpw-line-system').first().innerText()).replaceAll(',', '').trim());
    const originalParentFinal = (await firstParentFinal.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).trim();
    await domClick(firstParentManual.locator('.fpw-entry-button.fpw-line-manual').first());
    editor = page.getByRole('dialog', { name: '人工预测' });
    assert.match(await editor.locator('.forecast-editor-context').innerText(), /B0GRGFFVVN/);
    await editor.getByRole('spinbutton', { name: '预测销量' }).fill('300');
    await editor.getByRole('textbox', { name: '人工预测原因' }).fill('父体分配回归');
    await domClick(editor.getByRole('button', { name: '保存' }));
    await editor.waitFor({ state: 'hidden' });
    await page.waitForTimeout(150);
    assert.equal((await firstParentFinal.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).trim(), '300');
    assert.equal((await firstParentManual.locator('.entry-number').first().innerText()).trim(), '300', '父ASIN人工预测必须使用同一主值结构');
    const parentManualGeometry = await firstParentManual.locator('.fpw-entry-button.fpw-entry-value').first().evaluate(node => {
      const value = node.querySelector('.entry-number').getBoundingClientRect();
      const icon = node.querySelector('.edit-icon').getBoundingClientRect();
      return { gap: Math.round(icon.left - value.right), verticalDelta: Math.abs((icon.top + icon.height / 2) - (value.top + value.height / 2)) };
    });
    assert.ok(parentManualGeometry.gap >= 3 && parentManualGeometry.gap <= 4 && parentManualGeometry.verticalDelta <= 1, '父ASIN人工预测值与编辑图标必须水平对齐');
    await firstParentManual.locator('.fpw-entry-button.fpw-entry-value').first().hover();
    await page.waitForTimeout(180);
    await page.screenshot({ path: 'evidence/forecast-workbench-entry-parent-icon.png', fullPage: false });
    const parentManualAdjustment = firstParentManual.locator('.fpw-adjustment-entry .cell-reason').first();
    assert.equal((await parentManualAdjustment.innerText()).trim(), `${300 - originalParentSystem > 0 ? '+' : ''}${(300 - originalParentSystem).toLocaleString('zh-CN')}`);
    await parentManualAdjustment.hover();
    const parentManualPreview = page.locator('.ant-popover:visible .activity-preview-compact');
    await parentManualPreview.waitFor();
    assert.match(await parentManualPreview.innerText(), /人工预测销量[\s\S]*300[\s\S]*调整原因[\s\S]*父体分配回归/);
    await dismissPopover(page);
    const distributed = await workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-child-row.fpw-prediction-final').evaluateAll(rows => rows.slice(0, 3).map(row => Number(row.querySelector('.fpw-forecast-cell .fpw-line-final strong')?.textContent || 0)));
    assert.equal(distributed.reduce((sum, value) => sum + value, 0), 300, '父ASIN调整量应精确分配到子ASIN');

    await domClick(firstParentActivity.locator('.fpw-entry-button.fpw-line-activity').first());
    editor = page.getByRole('dialog', { name: '活动预测' });
    await editor.getByRole('spinbutton', { name: '预测销量' }).fill('360');
    await editor.getByRole('textbox', { name: '活动名称' }).fill('父体活动回归');
    await domClick(editor.getByRole('button', { name: '保存' }));
    await editor.waitFor({ state: 'hidden' });
    await page.waitForTimeout(150);
    assert.equal((await firstParentActivity.locator('.entry-number').first().innerText()).trim(), '360', '父ASIN活动预测必须使用同一主值结构');
    assert.equal((await firstParentActivity.locator('.fpw-adjustment-entry .cell-reason').first().innerText()).trim(), '+60', '父ASIN活动预测应显示相对人工预测的差值');
    const parentActivityGeometry = await firstParentActivity.locator('.fpw-entry-button.fpw-entry-value').first().evaluate(node => {
      const value = node.querySelector('.entry-number').getBoundingClientRect();
      const icon = node.querySelector('.edit-icon').getBoundingClientRect();
      return { gap: Math.round(icon.left - value.right), verticalDelta: Math.abs((icon.top + icon.height / 2) - (value.top + value.height / 2)) };
    });
    assert.ok(parentActivityGeometry.gap >= 3 && parentActivityGeometry.gap <= 4 && parentActivityGeometry.verticalDelta <= 1, '父ASIN活动预测值与编辑图标必须水平对齐');
    await firstParentActivity.locator('.fpw-adjustment-entry .cell-reason').first().hover();
    const parentActivityPreview = page.locator('.ant-popover:visible .activity-preview-compact');
    await parentActivityPreview.waitFor();
    assert.match(await parentActivityPreview.innerText(), /活动预测销量[\s\S]*360[\s\S]*活动名称[\s\S]*父体活动回归/);
    await page.waitForTimeout(250);
    await page.screenshot({ path: 'evidence/forecast-workbench-entry-parent-popover.png', fullPage: false });
    await dismissPopover(page);
    await domClick(firstParentActivity.locator('.fpw-entry-button.fpw-line-activity').first());
    editor = page.getByRole('dialog', { name: '活动预测' });
    await domClick(editor.getByRole('button', { name: '清除预测' }));
    await editor.waitFor({ state: 'hidden' });
    await page.waitForTimeout(150);
    await domClick(firstParentManual.locator('.fpw-entry-button.fpw-line-manual').first());
    editor = page.getByRole('dialog', { name: '人工预测' });
    await domClick(editor.getByRole('button', { name: '清除预测' }));
    await editor.waitFor({ state: 'hidden' });
    await page.waitForTimeout(150);
    assert.equal((await firstParentFinal.locator('.fpw-forecast-cell .fpw-line-final strong').first().innerText()).trim(), originalParentFinal);

    await domClick(workbench.getByRole('button', { name: '列配置' }));
    const columnDrawer = page.getByRole('dialog', { name: '列配置' });
    const selectedRows = columnDrawer.locator('.antd-selected-field-row[draggable="true"]');
    assert.equal(await selectedRows.count(), 5);
    assert.deepEqual((await columnDrawer.locator('.antd-selected-group').first().locator('.antd-selected-field-name').allTextContents()).map(value => value.trim()), ['变体'], '列配置只允许变体作为必备字段');
    assert.equal(await columnDrawer.getByRole('button', { name: /^移除/ }).count(), 8);
    for (const label of ['占比', '预测线', '日期预测']) assert.equal(await columnDrawer.getByRole('button', { name: `移除${label}` }).count(), 1, `${label}必须可移除`);
    assert.equal(await columnDrawer.getByRole('button', { name: /^置顶/ }).count(), 5);
    assert.equal(await columnDrawer.getByRole('button', { name: /^固定/ }).count(), 5);
    assert.equal(await columnDrawer.getByRole('button', { name: '保存为新模板' }).count(), 1);
    const beforeOrder = (await columnDrawer.locator('.antd-selected-group').last().locator('.antd-selected-field-name').allTextContents()).map(value => value.trim());
    await selectedRows.first().press('Alt+ArrowDown');
    const afterOrder = (await columnDrawer.locator('.antd-selected-group').last().locator('.antd-selected-field-name').allTextContents()).map(value => value.trim());
    assert.notDeepEqual(afterOrder, beforeOrder, '列配置应支持键盘/拖拽重排');
    await domClick(columnDrawer.getByRole('button', { name: /^固定/ }).first());
    assert.equal(await columnDrawer.locator('.column-quick-action.is-pinned').count(), 1);
    await domClick(columnDrawer.getByRole('button', { name: '移除占比' }));
    await domClick(columnDrawer.getByRole('button', { name: '移除预测线' }));
    await domClick(columnDrawer.getByRole('button', { name: '移除日期预测' }));
    await domClick(columnDrawer.getByRole('button', { name: '保存并应用' }));
    await columnDrawer.waitFor({ state: 'hidden' });
    assert.equal(await workbench.locator('th.fpw-share-header').count(), 0, '移除占比后工作台不得继续渲染占比列');
    assert.equal(await workbench.locator('th.fpw-line-header').count(), 0, '移除预测线后工作台不得继续渲染预测线列');
    assert.equal(await workbench.locator('th.fpw-week-group').count(), 0, '移除日期预测后工作台不得继续渲染日期矩阵');
    assert.equal(await workbench.locator('th.fpw-identity-header').count(), 1, '变体列必须始终保留');
    await domClick(workbench.getByRole('button', { name: '列配置' }));
    const restoredColumnDrawer = page.getByRole('dialog', { name: '列配置' });
    await domClick(restoredColumnDrawer.getByRole('button', { name: '恢复默认' }));
    await domClick(restoredColumnDrawer.getByRole('button', { name: '保存并应用' }));
    await restoredColumnDrawer.waitFor({ state: 'hidden' });
    assert.equal(await workbench.locator('th.fpw-share-header').count(), 1, '恢复默认后应恢复占比列');
    assert.equal(await workbench.locator('th.fpw-line-header').count(), 1, '恢复默认后应恢复预测线列');
    assert.ok(await workbench.locator('th.fpw-week-group').count() > 0, '恢复默认后应恢复日期预测');

    await page.mouse.move(1500, 60);
    await page.waitForTimeout(3600);
    await page.screenshot({ path: 'evidence/forecast-workbench-v041-component-parity.png', fullPage: false });

    const identityResizer = workbench.getByRole('separator', { name: '调整变体列宽' });
    assert.equal(await identityResizer.getAttribute('aria-valuemin'), '0', '列宽不应使用内容型最小值');
    const resizeBox = await identityResizer.boundingBox();
    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x - 280, resizeBox.y + resizeBox.height / 2, { steps: 6 });
    await page.mouse.up();
    assert.ok((await workbench.locator('th.fpw-identity-header').boundingBox()).width < 260, '变体列应能拖窄到旧最小值以下');

    assert.deepEqual(errors, [], `页面运行时错误：${errors.join('；')}`);
    assert.deepEqual(warnings, [], `页面运行时告警：${warnings.join('；')}`);
    console.log('Forecast workbench V0.3.47 component parity browser verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
