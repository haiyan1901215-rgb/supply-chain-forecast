const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.30-pmc-refinement';
const chrome = process.env.PLAYWRIGHT_CHROME || chromium.executablePath();

async function domClick(locator) {
  await locator.waitFor({ state: 'attached' });
  await locator.evaluate(element => element.click());
}

async function enterBatch(page) {
  await page.locator('[data-menu-toggle="planning"]').evaluate(button => button.click());
  await page.locator('[data-view="decomposition"][data-menu-origin="plan-batches"]').evaluate(button => button.click());
  await page.getByRole('button', { name: '2026-09-29 预测批次', exact: true }).evaluate(button => button.click());
  await page.locator('.fp-pmc-forecast-table').waitFor();
}

async function closeDrawer(page) {
  const drawer = page.locator('.ant-drawer-open');
  await domClick(drawer.locator('.ant-drawer-close'));
  await drawer.waitFor({ state: 'hidden' });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.clear());
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('.forecast-table').waitFor();
    await page.locator('.forecast-table .product-status-tags .ant-tag').first().waitFor();
    await page.locator('.forecast-table .forecast-toggle-action').first().waitFor();
    const salesGolden = await page.evaluate(() => {
      const table = document.querySelector('.forecast-table');
      const signature = selector => {
        const node = table.querySelector(selector);
        const style = getComputedStyle(node);
        return { height: Math.round(node.getBoundingClientRect().height), font: `${style.fontSize}/${style.fontWeight}`, padding: `${style.paddingTop}/${style.paddingRight}/${style.paddingBottom}/${style.paddingLeft}`, background: style.backgroundColor, position: style.position };
      };
      const paths = selector => [...table.querySelector(selector).querySelectorAll('path')].map(path => path.getAttribute('d'));
      const tags = [...table.querySelectorAll('.product-status-tags')][0];
      return {
        timeline: { header: signature('thead th'), week: signature('.week-head'), date: signature('.date-head') },
        icons: {
          copy: paths('.copy-code'),
          treeExpand: paths('[aria-label="一键展开全部父子ASIN"]'),
          treeCollapse: paths('[aria-label="一键收起全部父子ASIN"]'),
          parent: paths('.parent-row .collapse'),
          week: paths('.week-toggle'),
          forecast: paths('.forecast-toggle-action')
        },
        insightIcons: Object.fromEntries(['sales', 'analysis', 'mapping'].map(key => [key, paths(`.product-action.${key}`)])),
        dateWidth: Math.round(table.querySelector('.date-head').getBoundingClientRect().width),
        tags: [...tags.querySelectorAll('.ant-tag')].map(tag => ({ text: tag.textContent.trim(), category: tag.dataset.tagCategory, colorClass: [...tag.classList].find(name => /^ant-tag-(success|processing|warning|error)$/.test(name)) || 'ant-tag-default' }))
      };
    });
    await enterBatch(page);

    const ledger = page.locator('.fp-pmc-forecast-table');
    assert.equal(await page.locator('.fp-batch-nav').count(), 0, '批次详情不应出现左侧批次导航');
    assert.equal(await page.locator('.fp-pmc-detail-root .ant-steps').count(), 0, '批次详情不应出现步骤条');
    assert.equal(await page.locator('.fp-pmc-detail-root .fp-overview-tasks').count(), 0, '批次详情不应使用Dashboard卡片骨架');
    assert.deepEqual(await page.locator('.fp-pmc-detail-root .ant-segmented-item-label').allTextContents(), ['日预测', '周汇总'], '仅保留结果粒度切换，不显示状态机分区');
    assert.equal(await page.locator('.planning-system-tabs:visible').count(), 0, '状态机Tab必须从页面布局中移除');
    assert.equal(await page.locator('.fp-pmc-workbench .forecast-table').count(), 1, 'PMC主台账必须使用销售页同源forecast-table');
    assert.equal(await page.locator('.fp-pmc-workbench .ant-table').count(), 0, 'PMC主台账不得回退到Ant Table');
    assert.equal(await page.locator('.fp-pmc-detail-root .fp-sales-ledger-table, .fp-pmc-detail-root .fp-pmc-ledger-table').count(), 0, '旧PMC台账Renderer不得继续挂载');
    assert.equal(await ledger.locator('.parent-row').count(), 6);
    assert.equal(await ledger.locator('[data-parent-line]').count(), 18, '每个父体必须显示预测池、PMC校准、最终预测三层');
    assert.equal(await page.getByRole('button', { name: '保存调整', exact: true }).count(), 0, '已保存的历史变更不应显示全局保存按钮');
    assert.equal(await ledger.locator('.source-tag.system').count(), 0, '普通日期不应逐日显示规则标签');
    assert.equal(await ledger.locator('[data-child-row][data-forecast-line="system"]').count(), 16);
    assert.equal(await ledger.locator('[data-child-row][data-forecast-line]').count(), 48, '展开状态每个子ASIN应只有3条预测线');
    assert.equal(await ledger.locator('[data-forecast-line="pmc-controls"]').count(), 0, '子ASIN不得再生成独立预测线控制行');
    assert.equal(await ledger.locator('button.ant-table-row-expand-icon').count(), 0, '只保留PMC自己的父子树入口');

    const switchLevel = async label => {
      await page.locator('.ant-select').filter({ has: page.getByRole('combobox', { name: '层级', exact: true }) }).click();
      await page.locator('.ant-select-dropdown:visible').getByText(label, { exact: true }).click();
    };
    assert.equal(await page.locator('.fp-pmc-ledger-view-tabs').count(), 0, '层级切换位于筛选区');


    const header = (await ledger.locator('thead tr').first().locator('th').allTextContents()).slice(1, 5).map(value => value.trim().replace(/\s+/g, ' '));
    assert.deepEqual(header, ['商品详情', '尺码', '销量 / 库存', '预测线'], 'PMC应保持销售台账左侧列顺序');
    assert.equal(await ledger.locator('thead .date-head').count(), 14, '默认展示14天日级预测');
    assert.ok(await ledger.locator('tbody td.date-col').count() > 0, '台账应展示日级预测值');
    assert.equal(await ledger.locator('.week-period').count(), 0, 'W周不应重复显示日期范围');
    assert.equal(await ledger.locator('thead .date-head small').count(), 14, '日期表头与销售母版一致，每日显示一处星期');
    for (const label of await ledger.locator('.week-head').allTextContents()) assert.match(label.trim(), /^W\d+$/, 'W周表头只显示周号');
    assert.equal(await page.locator('.fp-pmc-detail-root').getByText('数据更新时间：2026/09/28 08:30', { exact: true }).count(), 1, '应与销售页一致展示数据更新时间');
    assert.ok(await ledger.getByText('丨', { exact: true }).count() > 0, '编码与上下文必须使用竖线分隔');
    const firstChildIdentity = ledger.locator('[data-child-row][data-forecast-line="system"]').first().locator('.identity-cell');
    const childContextParts = await firstChildIdentity.locator('.product-meta').first().locator(':scope > span:not(.fp-inline-separator)').allTextContents();
    assert.equal(childContextParts.length, 3, '子ASIN应同时展示销售人员、站点和店铺');
    assert.match(childContextParts[0], /^销售：/);
    assert.match(childContextParts[1], /^Amazon \/ US$/);
    assert.ok(childContextParts[2].trim(), '店铺信息不应为空');
    assert.equal(await firstChildIdentity.locator('.product-identifiers .code-value').count(), 2, '子ASIN必须同时显示SKU和业务识别码');
    assert.match(await firstChildIdentity.locator('.sales-listing').innerText(), /上架\s+\d{4}\/\d{2}\/\d{2}[\s\S]*丨[\s\S]*\d+\s+天/, '子ASIN必须显示上架日期和距今天数');
    assert.deepEqual(await firstChildIdentity.locator('.product-actions > .product-action').evaluateAll(actions => actions.slice(0, 2).map(action => action.textContent.trim())), ['销售趋势', '预测依据'], '子ASIN主操作应收敛为销售趋势和预测依据');
    await domClick(firstChildIdentity.getByRole('button', { name: /更多操作/ }));
    assert.equal(await page.locator('.ant-dropdown:visible').getByText('SKU映射', { exact: true }).count(), 1, 'SKU映射应收进更多操作');
    await page.keyboard.press('Escape');
    assert.equal(await ledger.getByText('关系待确认', { exact: true }).count(), 0, '父子关系不能以子行标签重复表达');
    assert.equal(await ledger.getByRole('button', { name: '查看每日预测', exact: true }).count(), 0, '父子每日预测已在右侧日级列直接呈现');
    assert.equal(await ledger.getByRole('button', { name: '历史', exact: true }).count(), 0, '历史对比不应增加额外行操作按钮');
    assert.equal(await page.locator('.fp-pmc-function-row button').filter({ hasText: '参数' }).count(), 1, '功能按键应收敛在台账左上角');
    assert.equal(await page.locator('.fp-pmc-list-footer .pagination').count(), 1, '列表右下角应显示分页组件');
    assert.equal(await page.locator('.fp-pmc-selection-summary').count(), 0, '分页左侧不应保留重复合计摘要');
    assert.equal((await page.locator('.fp-pmc-list-footer .pagination').innerText()).trim().startsWith('共 16 条'), true, '合计统计必须紧贴分页控件之前');
    assert.deepEqual(await page.locator('.fp-pmc-list-footer select option').allTextContents(), ['20 / 页', '50 / 页'], '每页条数与销售页保持一致');

    const parityStyle = await page.evaluate(() => {
      const copy = document.querySelector('.fp-pmc-forecast-table .copy-code');
      const tag = document.querySelector('.fp-pmc-forecast-table .product-tags .ant-tag');
      const product = document.querySelector('.fp-pmc-forecast-table .product-title');
      const header = document.querySelector('.fp-pmc-forecast-table thead th');
      const context = document.querySelector('.fp-pmc-context-section');
      const footerHost = document.querySelector('.fp-pmc-list-footer');
      const footer = footerHost.querySelector('.pagination');
      const table = document.querySelector('.fp-pmc-forecast-table');
      const signature = selector => {
        const node = table.querySelector(selector);
        const style = getComputedStyle(node);
        return { height: Math.round(node.getBoundingClientRect().height), font: `${style.fontSize}/${style.fontWeight}`, padding: `${style.paddingTop}/${style.paddingRight}/${style.paddingBottom}/${style.paddingLeft}`, background: style.backgroundColor, position: style.position };
      };
      const paths = selector => [...table.querySelector(selector).querySelectorAll('path')].map(path => path.getAttribute('d'));
      const lineRect = table.querySelector('.line-head').getBoundingClientRect();
      const weekRect = table.querySelector('.week-head').getBoundingClientRect();
      const dateRect = table.querySelector('.date-head').getBoundingClientRect();
      return {
        copyOpacity: getComputedStyle(copy).opacity,
        tagRadius: getComputedStyle(tag).borderRadius,
        tagFont: getComputedStyle(tag).fontSize,
        productFont: `${getComputedStyle(product).fontSize}/${getComputedStyle(product).fontWeight}`,
        headerFont: `${getComputedStyle(header).fontSize}/${getComputedStyle(header).fontWeight}`,
        contextColumns: getComputedStyle(context).gridTemplateColumns.split(' ').length,
        footerRightGap: Math.round(footerHost.getBoundingClientRect().right - footer.getBoundingClientRect().right),
        footerPosition: getComputedStyle(footerHost).position,
        footerBottom: getComputedStyle(footerHost).bottom,
        widths: ['--identity-width', '--size-width', '--context-width', '--line-width'].map(name => getComputedStyle(table).getPropertyValue(name).trim()),
        timeline: { header: signature('thead th'), week: signature('.week-head'), date: signature('.date-head') },
        icons: {
          copy: paths('.copy-code'),
          treeExpand: paths('[aria-label="一键展开全部父子ASIN"]'),
          treeCollapse: paths('[aria-label="一键收起全部父子ASIN"]'),
          parent: paths('.parent-row .collapse'),
          week: paths('.week-toggle'),
          forecast: paths('.forecast-toggle-action')
        },
        insightIcons: Object.fromEntries(['sales', 'analysis'].map(key => [key, paths(`.product-action.${key}`)])),
        timelineGeometry: { dateWidth: Math.round(dateRect.width), lineWeekGap: Math.round(weekRect.left - lineRect.right), lineDateGap: Math.round(dateRect.left - lineRect.right) },
        tags: [...table.querySelector('.product-status-tags').querySelectorAll('.ant-tag')].map(tag => ({ text: tag.textContent.trim(), category: tag.dataset.tagCategory, colorClass: [...tag.classList].find(name => /^ant-tag-(success|processing|warning|error)$/.test(name)) || 'ant-tag-default' }))
      };
    });
    assert.equal(parityStyle.copyOpacity, '0', '复制icon默认应隐藏');
    assert.equal(parityStyle.tagRadius, '3px');
    assert.equal(parityStyle.tagFont, '12px');
    assert.equal(parityStyle.productFont, '13px/600');
    assert.equal(parityStyle.headerFont, '12px/500');
    assert.equal(parityStyle.contextColumns, 2, '销量/库存应保持销售页的两列指标布局');
    assert.ok(parityStyle.footerRightGap <= 16, '分页应靠右对齐');
    assert.equal(parityStyle.footerPosition, 'fixed', '分页必须固定到视口底部');
    assert.equal(parityStyle.footerBottom, '0px');
    assert.deepEqual(parityStyle.widths, ['334px', '60px', '190px', '130px'], '固定列宽必须使用销售页基准');
    assert.deepEqual(parityStyle.timeline, salesGolden.timeline, '表头、W周和日期表头必须直接继承销售页样式签名');
    assert.deepEqual(parityStyle.icons, salesGolden.icons, '复制、树、父体、W周和预测线图标必须与销售页同源');
    assert.deepEqual(parityStyle.insightIcons, Object.fromEntries(['sales', 'analysis'].map(key => [key, salesGolden.insightIcons[key]])), '销售趋势和预测依据图标必须与销售页同源');
    assert.equal(parityStyle.timelineGeometry.dateWidth, salesGolden.dateWidth, 'PMC日列宽度必须与销售页一致');
    assert.deepEqual({ lineWeekGap: parityStyle.timelineGeometry.lineWeekGap, lineDateGap: parityStyle.timelineGeometry.lineDateGap }, { lineWeekGap: 0, lineDateGap: 0 }, '预测线右边缘必须与首个W周和日期列无缝衔接');
    assert.deepEqual(parityStyle.tags, salesGolden.tags, '子ASIN标签内容、语义和颜色必须与销售页一致');
    const firstCode = ledger.locator('.child-asin-line .code-value').first();
    await firstCode.hover();
    await page.waitForFunction(element => Number(getComputedStyle(element).opacity) > 0.95, await firstCode.locator('.copy-code').elementHandle());
    await page.screenshot({ path: '../../evidence/forecast-plan-component-parity-desktop.png', fullPage: false });

    for (const label of ['销售趋势']) {
      await domClick(firstChildIdentity.getByRole('button', { name: label, exact: true }));
      const insightDrawer = page.locator('.ant-drawer-open');
      await insightDrawer.waitFor();
      assert.match(await insightDrawer.innerText(), new RegExp(label), `${label}应直接复用销售预测详情交互`);
      await closeDrawer(page);
    }
    await domClick(firstChildIdentity.getByRole('button', { name: '预测依据', exact: true }));
    assert.match(await ledger.locator('.fp-pmc-child-detail-row').innerText(), /预测依据[\s\S]*Clean ADU[\s\S]*动态α/, '预测依据应在当前台账内按需展开');
    await domClick(firstChildIdentity.getByRole('button', { name: '预测依据', exact: true }));
    await domClick(firstChildIdentity.getByRole('button', { name: /更多操作/ }));
    await domClick(page.locator('.ant-dropdown:visible').getByText('SKU映射', { exact: true }));
    const mappingDrawer = page.locator('.ant-drawer-open');
    await mappingDrawer.waitFor();
    assert.match(await mappingDrawer.innerText(), /SKU映射/, 'SKU映射应保留销售预测母版详情交互');
    await closeDrawer(page);

    await switchLevel('层级：子ASIN');
    assert.equal(await ledger.locator('.parent-row').count(), 0, '仅看子ASIN视图不得渲染父体行');
    assert.equal(await ledger.locator('[data-child-row][data-forecast-line="system"]').count(), 16, '仅看子ASIN应保留全部子体日级预测');
    assert.equal(await ledger.locator('.fp-child-parent-context').count(), 16, '子体独立视图必须补充父ASIN和SPU上下文');
    assert.equal((await page.locator('.fp-pmc-list-footer .pagination').innerText()).trim().startsWith('共 16 条'), true);
    await switchLevel('层级：父ASIN');
    assert.equal(await ledger.locator('.parent-row').count(), 6, '仅看父ASIN应保留全部父体日级预测');
    assert.equal(await ledger.locator('[data-child-row]').count(), 0, '仅看父ASIN视图不得渲染子体行');
    assert.equal(await ledger.locator('.tree-tool').count(), 0, '非变体视图不显示树展开工具');
    assert.equal((await page.locator('.fp-pmc-list-footer .pagination').innerText()).trim().startsWith('共 6 条'), true, '父体视图分页应按父ASIN计数');
    await switchLevel('层级：全部（变体）');
    assert.equal(await ledger.locator('.parent-row').count(), 6);
    assert.equal(await ledger.locator('[data-child-row][data-forecast-line="system"]').count(), 16);

    const identityWidthBefore = await ledger.evaluate(table => Number.parseFloat(getComputedStyle(table).getPropertyValue('--identity-width')));
    const identityHandle = ledger.locator('[data-pmc-resize-column="identity"]');
    const handleBox = await identityHandle.boundingBox();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2 + 24, handleBox.y + handleBox.height / 2, { steps: 4 });
    await page.mouse.up();
    const identityWidthAfter = await ledger.evaluate(table => Number.parseFloat(getComputedStyle(table).getPropertyValue('--identity-width')));
    assert.ok(identityWidthAfter >= identityWidthBefore + 20, '表头拖拽应实时调整列宽');

    assert.equal(await ledger.locator('[data-forecast-line="activity"],[data-forecast-line="manual"]').count(), 0, 'PMC不显示销售填报线');
    assert.equal(await ledger.locator('[data-child-row] .line-kicker').filter({ hasText: '占父体' }).count(), 0, '预测线不得重复显示子ASIN份额');
    assert.equal(await firstChildIdentity.getByRole('button', { name: /^子体份额 / }).count(), 1, '子ASIN份额默认只保留商品区一处可操作入口');

    const allLineToggle = ledger.locator('.line-head .forecast-toggle-action');
    await domClick(allLineToggle);
    assert.equal(await ledger.locator('[data-child-row][data-forecast-line]').count(), 16, '预测线收起后每个子ASIN仅保留一条汇总行');
    await domClick(allLineToggle);
    assert.equal(await ledger.locator('[data-child-row][data-forecast-line]').count(), 48, '预测线展开后恢复三条预测线');

    await domClick(page.locator('.range-tabs').getByRole('button', { name: '30天', exact: true }));
    assert.equal(await ledger.locator('thead .date-head').count(), 30, '30天窗口应与销售页一致切换日列');
    await domClick(page.locator('.range-tabs').getByRole('button', { name: '14天', exact: true }));
    assert.equal(await ledger.locator('thead .date-head').count(), 14);

    // PMC校准及撤销由verify-role-baseline-ui覆盖；销售日级编辑仍由销售回归覆盖。

    const focusCell = ledger.locator('[data-child-row][data-forecast-line="system"] td[data-time-column]').first();
    await focusCell.hover();
    assert.ok(await ledger.locator('.focus-cross-row').count() > 0, '悬浮日期单元格应高亮当前行');
    assert.ok(await ledger.locator('.focus-cross-column').count() > 1, '悬浮日期单元格应高亮当前列');

    await domClick(page.locator('.fp-pmc-function-row button').filter({ hasText: '参数' }));
    await domClick(page.locator('.ant-modal:visible').getByRole('button', { name: '复制为新版本', exact: true }));
    await page.locator('.ant-modal:visible textarea[placeholder*="提交后次日0点生效"]').fill('验收参数次日生效提示');
    await domClick(page.locator('.ant-modal:visible').getByRole('button', { name: '提交参数调整', exact: true }));
    await domClick(page.locator('.ant-modal:visible .ant-modal-close'));
    assert.match(await page.locator('.fp-parameter-effective-alert').innerText(), /次日生效[\s\S]*00:00[\s\S]*当前批次仍使用[\s\S]*不会立即覆盖/);
    const parameterState = await page.evaluate(() => {
      const batch = window.ForecastBatchContract.getCurrent();
      return { current: batch.parameterSnapshot, pending: batch.pendingParameterSnapshot, effectiveAt: batch.parameterEffectiveAt };
    });
    assert.notEqual(parameterState.current.version, parameterState.pending.version, '当前参数与待生效参数必须分开保存');
    assert.match(parameterState.effectiveAt, /T00:00:00\+08:00$/, '待生效时间必须是次日0点');

    const parentCounts = await page.evaluate(() => {
      const batch = window.ForecastBatchContract.getCurrent();
      return batch.parentForecastResults
        .filter(row => row.parentASIN === 'B0GRGFFVVN')
        .map(parent => ({
          country: parent.country,
          children: batch.childForecastResults.filter(child => `${child.country}|${child.store}|${child.parentASIN}` === parent.key).length
        }));
    });
    assert.deepEqual(parentCounts, [{ country: 'US', children: 2 }, { country: 'UK', children: 2 }], '同编码不同国家的父体必须各自显示2个子体');

    await domClick(ledger.locator('button[aria-label="一键收起全部父子ASIN"]').first());
    assert.equal(await ledger.locator('.parent-row').count(), 6);
    assert.equal(await ledger.locator('[data-child-row][data-forecast-line]').count(), 0, '收起后只保留父ASIN行');
    await domClick(ledger.locator('button[aria-label="一键展开全部父子ASIN"]').first());
    assert.equal(await ledger.locator('[data-child-row][data-forecast-line]').count(), 48, '展开后恢复16个子体的三条预测线');

    const firstParent = ledger.locator('.parent-row').first();
    await domClick(firstParent.locator('button[aria-label^="收起 "]'));
    assert.equal(await ledger.locator('[data-child-row][data-forecast-line]').count(), 42, '单父体收起只影响当前父体的两个子体');
    await domClick(firstParent.locator('button[aria-label^="展开 "]'));

    const firstWeekToggle = ledger.locator('.week-toggle').first();
    const firstWeekSpan = await firstWeekToggle.locator('xpath=ancestor::th[1]').getAttribute('colspan');
    await domClick(firstWeekToggle);
    assert.equal(await ledger.locator('thead .date-head').count(), 14 - Number(firstWeekSpan) + 1, '周收起后应以一个周合计列替代当周日列');
    await domClick(ledger.locator('.week-toggle[aria-expanded="false"]').first());
    assert.equal(await ledger.locator('thead .date-head').count(), 14);

    await domClick(firstParent.getByRole('button', { name: '父体预测池', exact: true }));
    const parentBasisPopover = page.locator('.ant-popover:visible').last();
    await parentBasisPopover.waitFor();
    for (const label of ['预测依据', 'Clean ADU', '初始化ADU0', '动态α', 'Listing适配系数']) assert.ok((await parentBasisPopover.innerText()).includes(label));
    assert.doesNotMatch(await parentBasisPopover.innerText(), /全窗有效Clean天数/);
    await domClick(firstParent.getByRole('button', { name: '父体预测池', exact: true }));
    await parentBasisPopover.waitFor({ state: 'hidden' });

    const firstChild = ledger.locator('[data-child-row][data-forecast-line="system"]').first();
    const expectedMetrics = await firstChild.evaluate(element => {
      const batch = window.ForecastBatchContract.getCurrent();
      const child = batch.childForecastResults.find(row => row.childId === element.dataset.childRow);
      const previous = window.ForecastBatchContract.getBatch(batch.previousBatchId)?.childForecastResults.find(row => row.country === child.country && row.store === child.store && row.childASIN === child.childASIN);
      const actual = batch.actualSales[child.childId] || {};
      const dates = Object.keys(actual).filter(date => actual[date] != null && previous?.dailyFinalForecast?.[date] != null);
      return {
        total90: Object.keys(child.dailyFinalForecast).sort().slice(0, 90).reduce((sum, date) => sum + child.dailyFinalForecast[date], 0).toLocaleString('zh-CN'),
        prior: dates.length ? dates.reduce((sum, date) => sum + previous.dailyFinalForecast[date], 0).toLocaleString('zh-CN') : ''
      };
    });
    assert.equal(await firstChild.locator('[data-section="sales"] .metric').filter({ hasText: '预计90天' }).count(), 0, '商品上下文不应重复展示预计90天');
    if (expectedMetrics.prior) {
      await domClick(firstChild.getByRole('button', { name: '历史对比', exact: true }));
      assert.ok((await page.locator('.ant-popover:visible').innerText()).includes(expectedMetrics.prior), '历史对比必须使用相同日期');
      await domClick(firstChild.getByRole('button', { name: '历史对比', exact: true }));
    } else {
      assert.equal(await firstChild.locator('[data-section="history"]').count(), 0, '没有上一批同周期数据时不应渲染空的历史对比');
    }
    await domClick(firstChild.getByRole('button', { name: /^子体份额 / }));
    assert.match(await ledger.locator('.fp-pmc-child-detail-row').innerText(), /84天历史份额[\s\S]*系统计算份额[\s\S]*PMC调整[\s\S]*最终子体份额/);
    await domClick(firstChild.getByRole('button', { name: /^子体份额 / }));
    if (expectedMetrics.prior) {
      assert.equal(await firstChild.getByRole('button', { name: '历史对比', exact: true }).count(), 1, '历史仅保留按需入口');
    } else {
      assert.doesNotMatch(await firstChild.locator('.context-cell').innerText(), /历史对比|上批预测|实际销量|偏差/, '没有上一批同周期数据时不应保留空历史字段');
    }

    await domClick(ledger.getByRole('button', { name: '销售组合拆解', exact: true }));
    assert.ok(await ledger.locator('.fp-pmc-combo-row').count() >= 2, '销售组合应在同一树中下钻到SKU');
    assert.match(await ledger.locator('.fp-pmc-combo-row').first().innerText(), /默认比例[\s\S]*最终比例[\s\S]*组合拆解/);

    await page.getByRole('checkbox', { name: /需要PMC处理/ }).check();
    assert.equal(await ledger.locator('[data-child-row][data-forecast-line="system"]').count(), 6, '只看需处理应与待处理数一致');
    assert.equal(await ledger.locator('.parent-row').count(), 3);
    await page.getByRole('checkbox', { name: /需要PMC处理/ }).uncheck();

    await domClick(firstChild.getByRole('button', { name: /^子体份额 / }));
    await domClick(ledger.getByRole('button', { name: '调整本组子体份额', exact: true }));
    assert.match(await ledger.locator('.fp-inline-share-editor').innerText(), /最终份额合计 100\.00%[\s\S]*重新归一化[\s\S]*保存份额/);
    assert.equal(await page.locator('.ant-drawer-open').count(), 0, '份额应在主台账行内编辑');
    await ledger.locator('.fp-inline-share-editor').scrollIntoViewIfNeeded();
    assert.ok(await ledger.locator('.fp-inline-share-editor').evaluate(editor => {
      const viewport = editor.querySelector('.ant-table-content').getBoundingClientRect();
      return [...editor.querySelectorAll('.ant-input-number-group-wrapper')].every(input => {
        const rect = input.getBoundingClientRect();
        return rect.left >= viewport.left && rect.right <= viewport.right;
      });
    }), '桌面行内最终份额输入框应直接可见');
    await page.screenshot({ path: '../../evidence/forecast-plan-inline-calibration.png', fullPage: false });
    await domClick(ledger.locator('.fp-inline-share-editor').getByRole('button', { name: '取消', exact: true }));

    await firstChild.locator('input[type="checkbox"]').check();
    await domClick(page.getByRole('button', { name: '父子关系', exact: true }));
    await domClick(page.locator('.ant-drawer-open').getByRole('button', { name: '调整', exact: true }).first());
    assert.match(await page.locator('.ant-drawer-open').innerText(), /调整为[\s\S]*调整原因[\s\S]*保存关系并重新计算/, '父子关系只通过顶部功能按键维护');
    await closeDrawer(page);

    const childMore = firstChild.locator('button[aria-label$="更多操作"]');
    await domClick(childMore);
    await domClick(page.locator('.ant-dropdown:visible').getByText('维护预测标签', { exact: true }));
    const tagEditorText = await page.locator('.ant-drawer-open').innerText();
    assert.match(tagEditorText, /原标签[\s\S]*商品阶段[\s\S]*备货标签[\s\S]*趋势标签[\s\S]*清空某项表示删除本批次人工标签/);
    assert.doesNotMatch(tagEditorText, /系统趋势\s*成熟期/, '商品阶段不能冒充系统趋势');
    await closeDrawer(page);

    await page.getByPlaceholder('输入父ASIN、子ASIN、SKU 或 SKC').fill('N0C0001A-91-M');
    await domClick(page.getByRole('button', { name: '查询', exact: true }));
    assert.equal(await ledger.locator('.parent-row').count(), 1);
    assert.equal(await ledger.locator('[data-child-row][data-forecast-line="system"]').count(), 1);
    await domClick(page.getByRole('button', { name: '重置', exact: true }));

    await domClick(page.getByRole('button', { name: '父子关系', exact: true }));
    await domClick(page.locator('.ant-drawer-open').getByRole('button', { name: /添加子ASIN/ }));
    await page.locator('.ant-drawer-open').getByText('新增或恢复本批次关系').waitFor();
    await closeDrawer(page);

    await domClick(page.getByRole('button', { name: '父子关系', exact: true }));
    await domClick(page.locator('.ant-drawer-open').getByRole('button', { name: '确认父子关系', exact: true }));
    await domClick(page.getByRole('button', { name: '子体拆分', exact: true }));
    await domClick(page.locator('.ant-drawer-open').getByRole('button', { name: '确认预测拆解', exact: true }));
    await domClick(page.getByRole('button', { name: '重新计算', exact: true }));
    await domClick(page.locator('.ant-modal-confirm').getByRole('button', { name: '开始计算', exact: true }));
    await page.waitForFunction(() => window.ForecastBatchContract.getCurrent().resultState === '已生成');
    assert.equal((await page.evaluate(() => window.ForecastBatchContract.getCurrent())).activeResultVersion, 'RESULT-20260929-V01');
    await page.locator('.fp-pmc-workbench').evaluate(node => { node.scrollTop = 0; node.scrollLeft = 0; });
    await page.screenshot({ path: '../../evidence/pmc-workbench-v030-ready.png', fullPage: false });
    await domClick(page.getByRole('button', { name: '确认发布', exact: true }));
    const publishDrawerText = await page.locator('.ant-drawer-open').innerText();
    assert.match(publishDrawerText, /销售填报开始/);
    assert.match(publishDrawerText, /销售填报截止/);
    assert.match(publishDrawerText, /冻结时间/);
    assert.match(publishDrawerText, /16 条/);
    await domClick(page.locator('.ant-drawer-open').getByRole('button', { name: '确认发起', exact: true }));
    await domClick(page.locator('.ant-modal-confirm .ant-btn-primary'));
    await page.waitForFunction(() => window.ForecastBatchContract.getCurrent().submissionState === '填报中');

    await page.locator('[data-view="sales"][data-menu-origin="top-sales"]').evaluate(button => button.click());
    const salesLedger = page.locator('.forecast-table:visible');
    await salesLedger.waitFor();
    for (const line of ['system', 'pmc', 'manual', 'activity', 'final']) {
      assert.ok(await salesLedger.locator(`[data-forecast-line="${line}"]`).count() > 0, `sales ${line} line missing`);
    }
    const published = await page.evaluate(() => window.ForecastBatchContract.getCurrent());
    const child = published.childForecastResults[0];
    const ruleValue = await page.evaluate(({ childId, date }) => window.ForecastBatchContract.getDailyForecast(undefined, childId, date).systemForecast, { childId: child.childId, date: published.forecastStartDate });
    const salesValue = await salesLedger.locator(`[data-child-row="${child.childId}"][data-forecast-line="system"] td.date-col`).first().innerText();
    assert.match(salesValue, new RegExp(`\\b${Number(ruleValue).toLocaleString('zh-CN')}\\b`), '销售系统预测必须与PMC发布快照一致');
    assert.deepEqual(errors, [], '桌面端浏览器错误');
    await page.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileErrors = [];
    mobile.on('pageerror', error => mobileErrors.push(error.message));
    await mobile.addInitScript(() => localStorage.clear());
    await mobile.goto(url, { waitUntil: 'domcontentloaded' });
    await enterBatch(mobile);
    await mobile.screenshot({ path: '../../evidence/forecast-plan-component-parity-mobile.png', fullPage: false });
    await mobile.locator('.fp-pmc-forecast-table').scrollIntoViewIfNeeded();
    await mobile.screenshot({ path: '../../evidence/forecast-plan-component-parity-mobile-ledger.png', fullPage: false });
    const geometry = await mobile.evaluate(() => {
      const level = document.querySelector('[aria-label="层级"]').closest('.ant-select').getBoundingClientRect();
      return {
        pageOverflow: document.documentElement.scrollWidth - innerWidth,
        workbenchHeight: document.querySelector('.fp-pmc-workbench')?.getBoundingClientRect().height || 0,
        tableWidth: document.querySelector('.fp-pmc-forecast-table')?.getBoundingClientRect().width || 0,
        viewportWidth: document.querySelector('.fp-pmc-workbench')?.getBoundingClientRect().width || 0,
        selectionSummaryCount: document.querySelectorAll('.fp-pmc-selection-summary').length,
        pageTotalHeight: Math.round(document.querySelector('.fp-pmc-list-footer .page-total').getBoundingClientRect().height),
        viewTabsClipped: level.left < 0 || level.right > innerWidth
      };
    });
    assert.equal(geometry.pageOverflow, 0, '移动端不应产生页面级横向滚动');
    assert.ok(geometry.workbenchHeight >= 200, '移动端台账滚动区应保持可用');
    assert.ok(geometry.tableWidth > geometry.viewportWidth, '移动端应在台账内部保留日级横向滚动');
    assert.equal(geometry.selectionSummaryCount, 0, '固定页脚不应渲染重复的左侧摘要');
    assert.ok(geometry.pageTotalHeight <= 20, '移动端分页总数不得被挤成多行');
    assert.equal(geometry.viewTabsClipped, false, '层级选择在移动端不得溢出');
    await mobile.locator('.fp-pmc-forecast-table .parent-row').first().getByRole('button', { name: '父体预测池', exact: true }).evaluate(button => button.click());
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, '行内计算依据不应造成移动端页面溢出');
    assert.deepEqual(mobileErrors, [], '移动端浏览器错误');
    await mobile.close();
    console.log('PMC shared-ledger workflow verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
