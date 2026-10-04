const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.37-variant-bindings';
const chrome = process.env.PLAYWRIGHT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const domClick = locator => locator.waitFor({ state: 'attached' }).then(() => locator.evaluate(node => node.click()));
const styleProps = ['color', 'backgroundColor', 'fontSize', 'fontWeight', 'borderRightColor', 'borderBottomColor', 'textAlign'];
const styles = (locator, properties = styleProps) => locator.first().evaluate((node, keys) => {
  const computed = getComputedStyle(node);
  return Object.fromEntries(keys.map(key => [key, computed[key]]));
}, properties);

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
    await domClick(page.locator('[data-view="sales"][data-menu-origin="top-sales"]'));
    await page.locator('.forecast-table').waitFor();

    const salesVisual = {
      header: await styles(page.locator('.forecast-table th.identity-head')),
      week: await styles(page.locator('.forecast-table th.week-head')),
      day: await styles(page.locator('.forecast-table th.date-head:not(.weekend)')),
      variables: await page.locator('.forecast-table').evaluate(node => {
        const computed = getComputedStyle(node);
        return {
          cross: computed.getPropertyValue('--forecast-cross-color').trim(),
          focus: computed.getPropertyValue('--forecast-focus-border').trim(),
          weekend: computed.getPropertyValue('--forecast-weekend-bg').trim()
        };
      })
    };
    const salesProduct = page.locator('.forecast-table .child-start .identity-cell').first();
    assert.match((await salesProduct.locator('.sales-listing').innerText()).trim(), /^上架时间：/);
    assert.ok(await salesProduct.locator('.sales-tags .ant-tag').count() >= 3, '销售预测填报应恢复上架时间下方的商品标签');
    const salesTagStyles = await page.locator('.forecast-table .sales-tags .ant-tag').evaluateAll(nodes => Object.fromEntries(nodes.map(node => {
      const computed = getComputedStyle(node);
      return [node.textContent.trim(), { color: computed.color, backgroundColor: computed.backgroundColor, fontSize: computed.fontSize, borderColor: computed.borderColor }];
    })));

    const menuItems = (await page.locator('.menu > button[data-view]').allTextContents()).map(value => value.trim());
    assert.deepEqual(menuItems.slice(0, 2), ['预测工作台', '销售预测'], '预测工作台应位于销售预测之前');
    await domClick(page.locator('[data-view="forecast-workbench"][data-menu-origin="top-forecast-workbench"]'));
    const workbench = page.locator('.forecast-workbench-root');
    await workbench.waitFor();

    assert.equal((await page.locator('.crumb b').innerText()).trim(), '预测工作台');
    assert.equal((await page.locator('.topbar-route-label').innerText()).trim(), '预测工作台');
    assert.equal(await page.locator('.pmc-role-bar').isVisible(), false, '工作台不应叠加销售填报角色条');
    assert.equal(await workbench.locator('.fpw-header').count(), 0, '不应恢复批次版本和配置头部');
    assert.equal((await workbench.innerText()).includes('周合计'), false, '表格不应显示周合计列或说明');

    assert.equal(await workbench.locator('.fpw-search-panel').count(), 1, '预测列表应提供独立搜索区域');
    assert.equal(await workbench.locator('.fpw-filter-row .ant-select').count(), 5, '搜索区应使用系统Ant Design Select');
    assert.equal(await workbench.getByRole('button', { name: '查询' }).count(), 1);
    assert.equal(await workbench.getByRole('button', { name: '重置' }).count(), 1);
    assert.equal(await workbench.locator('.ant-tree').count(), 1, '变体结构应使用Ant Design Tree');
    assert.ok(await workbench.locator('.fpw-tree-scroll .ant-tree-checkbox').count() > 16, '变体树应使用Ant Design复选框');
    assert.equal((await workbench.locator('.fpw-tree-head h2').innerText()).trim(), '变体');
    assert.equal((await workbench.locator('.fpw-tree-head').innerText()).includes('父体'), false, '变体树不应再显示父子数量提示');
    assert.deepEqual((await workbench.locator('.fpw-tree-selection-actions button').allTextContents()).map(value => value.trim()), ['全选', '反选', '排除']);
    assert.ok(await workbench.locator('.ant-table').count() >= 1, '预测矩阵应使用Ant Design Table');
    assert.equal(await workbench.locator('.ant-pagination').count(), 1, '分页应使用Ant Design Pagination');
    assert.equal(await workbench.locator('.ant-table-selection-column .ant-checkbox').count() > 0, true, '列表应使用Ant Design复选框选择');
    assert.equal(await workbench.locator('.fpw-tree-tags').count(), 0, '左侧父ASIN树不应重复展示商品标签');
    assert.equal(await workbench.locator('.fpw-tree-note').count(), 0, '左侧树不应保留操作说明占位');
    assert.equal(await workbench.locator('.fpw-parent-row .fpw-country-flag').count(), 6, '每个父ASIN编码前应显示站点国旗');
    assert.equal(await workbench.locator('.fpw-child-row .fpw-country-flag').count(), 0, '子ASIN不应显示站点国旗');
    assert.equal(await workbench.locator('.fpw-parent-row').count(), 6, '应展示6个父ASIN样例');
    assert.equal(await workbench.locator('.fpw-child-row').count(), 16, '应展示16个子ASIN样例');
    assert.match(await workbench.locator('.ant-pagination-total-text').innerText(), /6 个父ASIN.*16 个子ASIN/);
    assert.equal(await workbench.locator('.ant-pagination-options').count(), 1, '分页应提供每页条数选择');
    assert.ok(await workbench.locator('.ant-table-cell-fix-left').count() >= 6, '业务上下文列应形成连续固定区');
    assert.ok((await workbench.getByText(/^W\d{2}$/).count()) >= 3, '周表头应只显示W周编号');
    assert.ok((await workbench.locator('.fpw-forecast-cell').allTextContents()).some(value => value.trim() && value.trim() !== '—'), '预测矩阵不应为空');

    const firstParentIdentity = workbench.locator('.fpw-parent-row .fpw-identity-parent').first();
    const firstParentText = (await firstParentIdentity.innerText()).replace(/\s+/g, ' ');
    assert.match(firstParentText, /B0[A-Z0-9]+.*丨.*C0001/, '父ASIN与SPU编码应使用丨分隔并同时显示');
    assert.match(firstParentText, /Amazon.*US.*BRABIC-US.*销售：/);
    assert.equal(await firstParentIdentity.locator('.fpw-store .anticon-shop').count(), 1, '店铺应复用销售预测填报的ShopOutlined图标');
    assert.equal((await workbench.locator('.fpw-child-row .fpw-child-meta').first().innerText()).includes('BRABIC-US'), false, '站点、店铺与销售应属于父ASIN层级');
    const firstWorkbenchTag = firstParentIdentity.locator('.fpw-parent-tags .ant-tag').first();
    const firstWorkbenchTagText = (await firstWorkbenchTag.innerText()).trim();
    assert.deepEqual(await styles(firstWorkbenchTag, ['color', 'backgroundColor', 'fontSize', 'borderColor']), salesTagStyles[firstWorkbenchTagText], '工作台父ASIN标签应与销售预测填报同源');

    const parentCodes = firstParentIdentity.locator('.fpw-code-value');
    assert.equal(await parentCodes.count(), 2, '父体应同时显示父ASIN与SPU两个编码');
    const parentAsinTrigger = parentCodes.first().locator('.fpw-code-trigger');
    await parentAsinTrigger.hover();
    const codeTooltip = page.locator('.ant-tooltip:visible');
    await codeTooltip.waitFor();
    assert.equal((await codeTooltip.innerText()).trim(), '父ASIN', '父ASIN悬停应仅显示编码名称');
    await page.mouse.move(1000, 70);
    await page.waitForTimeout(350);
    await parentCodes.nth(1).locator('.fpw-code-trigger').hover();
    await codeTooltip.waitFor();
    assert.equal((await codeTooltip.innerText()).trim(), 'SPU', 'SPU悬停应仅显示编码名称');
    await page.mouse.move(1000, 70);
    await page.waitForTimeout(350);

    const firstCodeLine = workbench.locator('.fpw-code-line').first();
    const firstCopy = parentCodes.first().locator('.fpw-copy-code');
    assert.equal(await firstCopy.evaluate(node => getComputedStyle(node).opacity), '0', '复制图标默认应隐藏');
    await parentCodes.first().hover();
    await page.waitForTimeout(250);
    assert.equal(await firstCopy.evaluate(node => getComputedStyle(node).opacity), '1', '编码悬停时应显示复制图标');
    assert.equal(await firstCopy.locator('svg').getAttribute('viewBox'), '0 0 24 24', '复制图标应复用销售预测填报SVG视口');
    assert.equal(await firstCopy.locator('svg path').getAttribute('d'), 'M16 8V3H3v13h5', '复制图标应复用销售预测填报SVG路径');

    assert.equal((await workbench.locator('.fpw-identity-header').innerText()).trim(), '变体');
    const variantHeaderToggle = workbench.locator('.fpw-variant-header-toggle').first();
    await variantHeaderToggle.click();
    assert.equal(await workbench.locator('.fpw-child-row').count(), 0, '变体表头图标应收起全部子变体');
    await variantHeaderToggle.click();
    assert.equal(await workbench.locator('.fpw-child-row').count(), 16, '变体表头图标应展开全部子变体');

    await workbench.getByRole('button', { name: '全选', exact: true }).click();
    assert.ok(await workbench.locator('.fpw-tree-scroll .ant-tree-checkbox-checked').count() > 16, '全选应勾选可见变体');
    await workbench.getByRole('button', { name: '反选', exact: true }).click();
    assert.equal(await workbench.locator('.fpw-tree-scroll .ant-tree-checkbox-checked').count(), 0, '反选应反转当前变体选择');
    await workbench.locator('.fpw-tree-scroll .ant-tree-treenode .ant-tree-checkbox').last().click();
    await workbench.getByRole('button', { name: '排除', exact: true }).click();
    assert.equal(await workbench.locator('.fpw-child-row').count(), 15, '排除应从主表移除已选变体');
    const collapsedPanelButton = workbench.getByRole('button', { name: '收起变体栏' });
    await collapsedPanelButton.click();
    assert.ok((await workbench.locator('.fpw-tree-panel').getAttribute('class')).includes('is-collapsed'), '变体栏应支持收起');
    await workbench.getByRole('button', { name: '展开变体栏' }).click();
    assert.equal(await workbench.locator('.fpw-tree-head h2').isVisible(), true, '变体栏应支持再次展开');

    await workbench.getByRole('button', { name: '管理变体绑定' }).click();
    const bindingWorkspace = page.locator('.fpw-binding-workspace');
    await bindingWorkspace.waitFor();
    assert.deepEqual((await page.locator('[data-forecast-workbench-tab]').allTextContents()).map(value => value.replace('×', '').trim()), ['预测工作台', '变体绑定管理'], '绑定管理应在门户顶部新开工作页签');
    assert.equal(await bindingWorkspace.getByRole('button', { name: '新增绑定' }).count(), 1);
    assert.equal(await bindingWorkspace.getByRole('button', { name: '管理已选' }).isDisabled(), true);
    assert.equal(await bindingWorkspace.getByRole('button', { name: '移除绑定' }).isDisabled(), true);
    await domClick(bindingWorkspace.locator('.ant-table-tbody .ant-checkbox-input').first());
    assert.equal(await bindingWorkspace.getByRole('button', { name: '管理已选' }).isEnabled(), true);
    await bindingWorkspace.getByRole('button', { name: '管理已选' }).click();
    const bindingModal = page.getByRole('dialog');
    await bindingModal.waitFor();
    assert.match(await bindingModal.innerText(), /目标父ASIN/);
    await bindingModal.getByRole('button', { name: '取消' }).click();
    await page.screenshot({ path: 'evidence/forecast-workbench-v037-bindings.png', fullPage: false });
    await bindingWorkspace.getByRole('button', { name: '返回预测工作台' }).click();
    await workbench.waitFor();
    assert.equal((await page.locator('.crumb b').innerText()).trim(), '预测工作台');

    await parentAsinTrigger.click();
    const drawer = page.locator('.fpw-detail-drawer');
    await drawer.waitFor();
    assert.match(await drawer.locator('.fpw-drawer-title').innerText(), /Parent ASIN/);
    assert.deepEqual((await drawer.getByRole('tab').allTextContents()).map(value => value.trim()), ['预测依据', '子体拆分', '父子关系', '销售组合'], '抽屉应保留四个既有页签');
    await drawer.locator('.ant-drawer-close').click();
    await drawer.waitFor({ state: 'hidden' });

    const firstCheckbox = workbench.locator('.fpw-parent-row .ant-checkbox-input').first();
    await domClick(firstCheckbox);
    assert.match(await workbench.locator('.fpw-selected-summary').innerText(), /已选 1 项/);
    assert.equal(await drawer.isVisible(), false, '勾选行不应打开ASIN抽屉');

    const firstForecastCell = workbench.locator('.fpw-child-row .fpw-forecast-cell').first();
    await firstForecastCell.hover();
    assert.equal(await firstForecastCell.evaluate(node => node.classList.contains('fpw-cross-cell')), true, '当前单元格应显示十字焦点');
    assert.equal(await firstForecastCell.locator('xpath=ancestor::tr').evaluate(node => node.classList.contains('fpw-cross-row')), true, '当前行应显示十字高亮');
    assert.ok(await workbench.locator('.fpw-cross-column').count() > 1, '当前列应连续高亮');

    const workbenchVisual = {
      header: await styles(workbench.locator('.fpw-identity-header')),
      week: await styles(workbench.locator('.fpw-week-group')),
      day: await styles(workbench.locator('.fpw-day-header:not(.fpw-weekend-header)')),
      variables: await workbench.evaluate(node => {
        const computed = getComputedStyle(node);
        return {
          cross: computed.getPropertyValue('--forecast-cross-color').trim(),
          focus: computed.getPropertyValue('--forecast-focus-border').trim(),
          weekend: computed.getPropertyValue('--forecast-weekend-bg').trim()
        };
      })
    };
    assert.deepEqual(workbenchVisual.header, salesVisual.header, '工作台普通表头样式应与销售预测填报同源');
    assert.deepEqual(workbenchVisual.week, salesVisual.week, '工作台W周表头样式应与销售预测填报同源');
    assert.deepEqual(workbenchVisual.day, salesVisual.day, '工作台日期表头样式应与销售预测填报同源');
    assert.deepEqual(workbenchVisual.variables, salesVisual.variables, '工作台十字高亮变量应与销售预测填报同源');

    const identityHeader = workbench.locator('.fpw-identity-header');
    const identityResizer = identityHeader.locator('.fpw-column-resizer');
    const widthBefore = (await identityHeader.boundingBox()).width;
    const handleBox = await identityResizer.boundingBox();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2 + 40, handleBox.y + handleBox.height / 2);
    await page.mouse.up();
    const widthAfter = (await identityHeader.boundingBox()).width;
    assert.ok(widthAfter >= widthBefore + 30, `拖拽后列宽应增加：${widthBefore} -> ${widthAfter}`);

    const listSearch = workbench.getByRole('textbox', { name: '父ASIN、子ASIN、SKU或SPU' });
    await listSearch.fill('B0GRG5DRWW');
    await workbench.getByRole('button', { name: '查询' }).click();
    assert.equal(await workbench.locator('.fpw-parent-row').count(), 2, '列表查询应保留两个国家下的同编码父体');
    assert.equal(await workbench.locator('.fpw-child-row').count(), 2, '列表查询应同步过滤子体');
    await workbench.getByRole('button', { name: '重置' }).click();
    assert.equal(await workbench.locator('.fpw-parent-row').count(), 6, '重置后应恢复完整父体列表');

    const firstWeek = workbench.locator('.fpw-week-title').first();
    assert.match((await firstWeek.innerText()).trim(), /^W\d{2}$/);
    const dayCountBefore = await workbench.locator('.fpw-day-header').count();
    await firstWeek.locator('.fpw-week-toggle').click();
    assert.ok(await workbench.locator('.fpw-day-header').count() < dayCountBefore, 'W周图标应收起本周日级列');
    await workbench.locator('.fpw-week-title').first().locator('.fpw-week-toggle').click();
    assert.equal(await workbench.locator('.fpw-day-header').count(), dayCountBefore, 'W周图标应恢复本周日级列');

    const footerBox = await workbench.locator('.fpw-footer').boundingBox();
    const paginationBox = await workbench.locator('.ant-pagination').boundingBox();
    assert.ok(Math.abs((footerBox.x + footerBox.width) - (paginationBox.x + paginationBox.width)) <= 14, '分页组件应靠列表右下角对齐');
    const dimensions = await page.evaluate(() => ({
      pageWidth: document.documentElement.clientWidth,
      pageScrollWidth: document.documentElement.scrollWidth,
      pageOverflowX: getComputedStyle(document.documentElement).overflowX,
      matrixClientWidth: document.querySelector('.fpw-table-shell')?.clientWidth || 0,
      matrixScrollWidth: document.querySelector('.fpw-table-shell .ant-table-body')?.scrollWidth || 0
    }));
    assert.ok(dimensions.pageScrollWidth <= dimensions.pageWidth + 1 || dimensions.pageOverflowX === 'clip', `页面不应产生可操作的外层横向滚动：${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.matrixClientWidth > 0, '预测矩阵应具有稳定可见宽度');
    assert.ok(dimensions.matrixScrollWidth > dimensions.matrixClientWidth, '预测矩阵应保留表格内部横向滚动');

    await domClick(workbench.locator('.fpw-parent-row .ant-checkbox-input').first());
    await page.mouse.move(1000, 70);
    await page.screenshot({ path: 'evidence/forecast-workbench-v037.png', fullPage: false });
    await workbench.locator('.fpw-parent-row .fpw-code-trigger').first().click();
    await drawer.waitFor();
    await page.waitForTimeout(250);
    await page.screenshot({ path: 'evidence/forecast-workbench-v037-drawer.png', fullPage: false });
    assert.deepEqual(errors, [], `页面运行时错误：${errors.join('；')}`);
    assert.deepEqual(warnings, [], `页面运行时告警：${warnings.join('；')}`);
    console.log('Forecast workbench V0.3.37 browser verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
