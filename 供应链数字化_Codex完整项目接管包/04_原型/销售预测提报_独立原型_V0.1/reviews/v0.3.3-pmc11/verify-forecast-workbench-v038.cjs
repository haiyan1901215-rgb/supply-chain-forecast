const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.38-time-window-parity';
const chrome = process.env.PLAYWRIGHT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const domClick = locator => locator.waitFor({ state: 'attached' }).then(() => locator.evaluate(node => node.click()));
const styleProps = ['color', 'backgroundColor', 'fontSize', 'fontWeight', 'borderRightColor', 'borderBottomColor', 'textAlign'];
const parentStyleProps = ['color', 'backgroundColor', 'fontSize', 'borderBottomColor', 'textAlign'];
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
      parent: await styles(page.locator('.forecast-table tr.parent-row td.parent-band'), parentStyleProps),
      variables: await page.locator('.forecast-table').evaluate(node => {
        const computed = getComputedStyle(node);
        return {
          cross: computed.getPropertyValue('--forecast-cross-color').trim(),
          focus: computed.getPropertyValue('--forecast-focus-border').trim(),
          weekend: computed.getPropertyValue('--forecast-weekend-bg').trim()
        };
      })
    };

    await domClick(page.locator('[data-view="forecast-workbench"][data-menu-origin="top-forecast-workbench"]'));
    const workbench = page.locator('.forecast-workbench-root');
    await workbench.waitFor();

    assert.equal(await workbench.locator('.fpw-range-bar').count(), 1, '工作台应显示同源时间轴');
    assert.equal((await workbench.locator('.fpw-range-title').innerText()).replace(/\s+/g, ' ').trim(), '预测范围 2026/09/29 ~ 2027/03/29');
    assert.deepEqual(await workbench.locator('.fpw-range-current input').evaluateAll(inputs => inputs.map(input => input.value)), ['2026/09/29', '2026/10/12']);
    assert.equal(await workbench.locator('[aria-label="当前指标"]').count(), 0, '应移除预测指标下拉框');
    assert.equal((await workbench.innerText()).includes('周合计'), false, '工作台不应显示周合计列');

    await domClick(workbench.getByRole('button', { name: '30天', exact: true }));
    assert.equal(await workbench.locator('.fpw-day-header').count(), 30, '30天切换应展示30个日列');
    assert.deepEqual(await workbench.locator('.fpw-range-current input').evaluateAll(inputs => inputs.map(input => input.value)), ['2026/09/29', '2026/10/28']);
    await domClick(workbench.getByRole('button', { name: '向后切换窗口' }));
    assert.deepEqual(await workbench.locator('.fpw-range-current input').evaluateAll(inputs => inputs.map(input => input.value)), ['2026/10/29', '2026/11/27']);
    await workbench.locator('.fpw-range-current input').first().press('Enter');
    await page.locator('.ant-picker-dropdown:visible').waitFor();
    await page.keyboard.press('Escape');
    await domClick(workbench.getByRole('button', { name: '14天', exact: true }));
    assert.equal(await workbench.locator('.fpw-day-header').count(), 14, '14天切换应恢复14个日列');

    assert.equal(await workbench.locator('.fpw-tree-country-title').count(), 0, '变体树不应保留国家层级');
    assert.equal(await workbench.locator('.fpw-tree-parent-title .fpw-tree-flag').count(), 6, '国旗应直接位于父ASIN左侧');
    assert.equal(await workbench.locator('.fpw-tree-head [aria-label="添加变体绑定"]').count(), 0, '左栏头部不应保留加号入口');
    const treeIndentCounts = await workbench.locator('.fpw-tree-scroll .ant-tree-treenode').evaluateAll(nodes => [...new Set(nodes.map(node => node.querySelectorAll('.ant-tree-indent-unit').length))].sort());
    assert.deepEqual(treeIndentCounts, [0, 1], '变体树应只有父ASIN和子ASIN两层');
    const panelBox = await workbench.locator('.fpw-tree-panel').boundingBox();
    const collapseBox = await workbench.locator('.fpw-tree-divider-toggle').boundingBox();
    assert.ok(Math.abs((panelBox.y + panelBox.height / 2) - (collapseBox.y + collapseBox.height / 2)) <= 2, '侧栏折叠按钮应位于分隔线中部');

    assert.equal((await workbench.locator('.fpw-share-header').innerText()).trim(), '占比');
    const shareValues = (await workbench.locator('.fpw-child-row .fpw-share-cell').allTextContents()).map(value => value.trim());
    assert.equal(shareValues.length, 16);
    assert.ok(shareValues.every(value => /^\d+\.\d{2}%$/.test(value)), '子ASIN占比应保留两位小数');

    assert.equal(await workbench.locator('.fpw-child-thumb').count(), 16, '每个子ASIN应显示商品缩略图');
    await workbench.locator('.fpw-child-thumb').first().hover();
    await page.locator('#imagePreview:visible').waitFor();
    await page.mouse.move(1200, 80);
    await workbench.locator('.fpw-child-meta').first().hover();
    await page.locator('.ant-tooltip:visible').waitFor();
    assert.equal((await page.locator('.ant-tooltip:visible').innerText()).trim(), '业务识别码');

    const parentCodes = workbench.locator('.fpw-parent-row .fpw-code-value').first();
    const copyButton = parentCodes.locator('.fpw-copy-code');
    assert.equal(await copyButton.evaluate(node => getComputedStyle(node).opacity), '0');
    await parentCodes.hover();
    assert.equal(await copyButton.evaluate(node => getComputedStyle(node).opacity), '1');
    assert.equal(await copyButton.locator('svg path').getAttribute('d'), 'M16 8V3H3v13h5');

    await domClick(workbench.locator('.fpw-tree-child-title > span:first-child').first());
    assert.equal(await page.locator('.fpw-detail-drawer:visible').count(), 0, '点击左树ASIN不应打开抽屉');
    await domClick(workbench.locator('.fpw-parent-row .fpw-code-trigger').first());
    assert.equal(await page.locator('.fpw-detail-drawer:visible').count(), 0, '点击ASIN编码不应打开抽屉');
    await domClick(workbench.locator('.fpw-parent-row .fpw-open-detail').first());
    const drawer = page.locator('.fpw-detail-drawer');
    await drawer.waitFor();
    assert.deepEqual((await drawer.getByRole('tab').allTextContents()).map(value => value.trim()), ['预测依据', '子体拆分', '父子关系', '销售组合']);
    await drawer.locator('.ant-drawer-close').click();
    await drawer.waitFor({ state: 'hidden' });

    const variantHeaderToggle = workbench.locator('.fpw-variant-header-toggle').first();
    assert.ok(await workbench.locator('.fpw-variant-header-toggle').count() >= 1, '固定列表头应保留变体展开控件');
    assert.equal(await variantHeaderToggle.getAttribute('aria-expanded'), 'true');
    assert.equal(await variantHeaderToggle.locator('[role="img"][aria-label="up"]').count(), 1, '变体列应复用UpOutlined展开图标');
    await domClick(variantHeaderToggle);
    assert.equal(await workbench.locator('.fpw-child-row').count(), 0);
    assert.ok((await workbench.locator('.fpw-variant-header-toggle').evaluateAll(nodes => nodes.every(node => node.getAttribute('aria-expanded') === 'false'))), '固定列表头应同步收起状态');
    assert.equal(await variantHeaderToggle.locator('[role="img"][aria-label="down"]').count(), 1, '变体列应复用DownOutlined收起图标');
    await domClick(variantHeaderToggle);

    const workbenchVisual = {
      header: await styles(workbench.locator('.fpw-identity-header')),
      week: await styles(workbench.locator('.fpw-week-group')),
      day: await styles(workbench.locator('.fpw-day-header:not(.fpw-weekend-header)')),
      parent: await styles(workbench.locator('.fpw-parent-row td.fpw-identity-cell'), parentStyleProps),
      variables: await workbench.evaluate(node => {
        const computed = getComputedStyle(node);
        return {
          cross: computed.getPropertyValue('--forecast-cross-color').trim(),
          focus: computed.getPropertyValue('--forecast-focus-border').trim(),
          weekend: computed.getPropertyValue('--forecast-weekend-bg').trim()
        };
      })
    };
    assert.deepEqual(workbenchVisual.header, salesVisual.header, '普通表头应与销售预测填报同源');
    assert.deepEqual(workbenchVisual.week, salesVisual.week, 'W周表头应与销售预测填报同源');
    assert.deepEqual(workbenchVisual.day, salesVisual.day, '日期表头应与销售预测填报同源');
    assert.deepEqual(workbenchVisual.parent, salesVisual.parent, '父ASIN行应与销售预测填报同源');
    assert.deepEqual(workbenchVisual.variables, salesVisual.variables, '十字高亮参数应与销售预测填报同源');

    const firstForecastCell = workbench.locator('.fpw-child-row .fpw-forecast-cell').first();
    await firstForecastCell.hover();
    assert.equal(await firstForecastCell.evaluate(node => node.classList.contains('fpw-cross-cell')), true);
    assert.ok(await workbench.locator('.fpw-cross-column').count() > 1);
    const dividerStyle = await workbench.locator('th.fpw-fixed-boundary').evaluate(node => {
      const pseudo = getComputedStyle(node, '::after');
      return { width: pseudo.width, height: pseudo.height, color: pseudo.backgroundColor };
    });
    assert.equal(dividerStyle.width, '1px');
    assert.ok(parseFloat(dividerStyle.height) > 60, 'DOS右侧固定区分隔线应贯通表头');
    assert.equal(await workbench.locator('td.fpw-forecast-cell').first().evaluate(node => getComputedStyle(node).borderRightWidth), '1px', '日期列之间应保留竖线');

    assert.equal(await workbench.locator('.ant-pagination').count(), 1);
    assert.match(await workbench.locator('.ant-pagination-total-text').innerText(), /6 个父ASIN.*16 个子ASIN/);
    assert.equal(await workbench.locator('.ant-pagination-options').count(), 1);
    await page.screenshot({ path: 'evidence/forecast-workbench-v038.png', fullPage: false });

    assert.deepEqual(errors, [], `页面运行时错误：${errors.join('；')}`);
    assert.deepEqual(warnings, [], `页面运行时告警：${warnings.join('；')}`);
    console.log('Forecast workbench V0.3.38 browser verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
