const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.32-pmc-refinement';
const chrome = process.env.PLAYWRIGHT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const domClick = locator => locator.waitFor({ state: 'attached' }).then(() => locator.evaluate(node => node.click()));

async function openPlanningList(page) {
  await domClick(page.locator('[data-menu-toggle="planning"]'));
  await domClick(page.locator('[data-view="decomposition"][data-menu-origin="plan-batches"]'));
  await page.locator('.fp-list-page').waitFor();
}

async function openBatchInTab(page) {
  const row = page.locator('.fp-batch-row').filter({ hasText: '2026-09-29 预测批次' }).first();
  await row.waitFor();
  await domClick(row.getByRole('button', { name: '进入', exact: true }));
  await page.locator('.planning-system-tabs').waitFor();
  await page.locator('.fp-pmc-forecast-table').waitFor();
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.clear());
    await page.goto(url, { waitUntil: 'networkidle' });

    const sales = page.locator('.content');
    await page.locator('.forecast-table').waitFor();
    const salesWindowActions = page.locator('.sales-window-actions');
    const salesText = await sales.innerText();
    assert.equal(await sales.locator('.line-cell').allTextContents().then(values => values.some(value => value.includes('PMC校准'))), false, '销售预测填报不应显示PMC校准数据行');
    assert.equal(await salesWindowActions.getByText('预测批次', { exact: false }).count(), 0, '销售操作区不应显示预测批次版本');
    assert.equal(await salesWindowActions.getByText('参数版本', { exact: false }).count(), 0, '销售操作区不应显示参数版本');
    assert.equal(await sales.getByText('计算依据', { exact: false }).count(), 0, '销售页不应显示计算依据入口');
    assert.equal(salesText.includes('销量数据截至'), false, '销售页不应显示销量数据截至时间');
    assert.equal(salesText.includes('数据更新时间'), false, '销售页不应显示数据更新时间');

    await openPlanningList(page);
    const planningMenuTexts = await page.locator('#planning-submenu button').allTextContents();
    assert.deepEqual(planningMenuTexts.map(value => value.trim()), ['预测批次列表'], '计划配置下只保留预测批次列表');
    assert.equal(await page.locator('.sider-foot').count(), 0, '侧栏不应保留版本提示占位节点');
    const siderBox = await page.locator('.sider').boundingBox();
    const toggleBox = await page.locator('.sider-toggle').boundingBox();
    assert.ok(siderBox && toggleBox && toggleBox.y + toggleBox.height > siderBox.y + siderBox.height - 48, '侧栏折叠按钮应位于底部');

    await openBatchInTab(page);
    const detail = page.locator('.fp-pmc-detail-root');
    const ledger = page.locator('.fp-pmc-forecast-table');
    const detailText = await detail.innerText();
    assert.equal(await page.locator('.planning-system-tab').count(), 2, '进入批次详情后应保留列表页签并新增详情页签');
    assert.equal(await page.locator('.planning-system-tab').filter({ hasText: '预测批次列表' }).count(), 1);
    assert.equal(await page.locator('.planning-system-tab').filter({ hasText: '2026-09-29 预测批次' }).count(), 1);
    assert.equal(await detail.getByText('销量数据截至', { exact: false }).count(), 0, '详情顶部不应显示销量数据截至');
    assert.equal(await detail.getByText('销量数据更新', { exact: false }).count(), 0, '详情顶部不应显示销量数据更新');
    assert.equal(await detail.getByText('预测范围', { exact: false }).count(), 0, '详情顶部不应显示预测范围');
    assert.equal(await detail.getByText('商品范围', { exact: false }).count(), 0, '详情顶部不应显示商品范围');
    assert.equal(await detail.getByText('当前任务', { exact: true }).count(), 0, '详情不应显示当前任务提示条');
    assert.equal(await detail.getByText('仅看需要PMC处理', { exact: false }).count(), 0, '详情不应显示仅看需要PMC处理');
    assert.equal(await detail.getByRole('button', { name: '查看规则依据', exact: true }).count(), 0, '详情不应显示查看规则依据');
    assert.equal(await detail.getByRole('button', { name: '刷新数据', exact: true }).count(), 0, '详情不应显示刷新数据');
    assert.equal(await detail.getByText('日预测', { exact: true }).count(), 0, '详情不应显示日预测切换');
    assert.equal(await detail.getByText('周汇总', { exact: true }).count(), 0, '详情不应显示周汇总切换');
    assert.equal(detailText.includes('SKC'), false, '父体主表不应显示SKC');
    assert.ok(await ledger.getByText('人工校准', { exact: true }).count() > 0, 'PMC校准行应改为人工校准');
    assert.equal(await ledger.getByText('PMC校准', { exact: true }).count(), 0, '主表不应继续使用PMC校准行文案');
    const seasonTag = ledger.locator('.season-state').first();
    assert.ok(await seasonTag.count() > 0, '季节属性应以Tag呈现');
    await seasonTag.hover();
    await page.waitForTimeout(700);
    const seasonTooltipText = await page.locator('.ant-tooltip:visible').allTextContents();
    assert.ok(seasonTooltipText.some(value => value.trim() === '季节'), `季节Tag悬浮提示应为季节：${seasonTooltipText.join('|')}`);
    assert.equal(await page.locator('.fp-pmc-search-action').getByRole('button', { name: '确认预测', exact: true }).count(), 1, '确认预测应位于搜索区右侧');
    assert.equal(await detail.locator('.fp-pmc-list-footer .page-total').count(), 1, '父/子数量应置于分页左侧');
    assert.match(await detail.locator('.fp-pmc-list-footer .page-total').innerText(), /6 个父ASIN · 16 个子ASIN/);
    assert.deepEqual(await detail.locator('.fp-pmc-list-footer select option').allTextContents(), ['20 / 页', '50 / 页'], '分页每页条数应与销售预测填报一致');
    assert.ok(await ledger.locator('tbody td.date-col').allTextContents().then(values => values.some(value => value.trim())), '详情主表应保留真实日级预测值');

    await domClick(page.locator('.planning-system-tab').filter({ hasText: '预测批次列表' }));
    await page.locator('.fp-list-page').waitFor();
    assert.equal(await page.locator('.fp-batch-row').count() > 0, true, '切回列表页签后列表仍应保留');
    await domClick(page.locator('.planning-system-tab').filter({ hasText: '2026-09-29 预测批次' }));
    await page.locator('.fp-pmc-forecast-table').waitFor();

    await page.screenshot({ path: 'evidence/pmc-refinement-v032.png', fullPage: false });
    assert.deepEqual(errors, [], `页面运行时错误：${errors.join('；')}`);
    console.log('PMC refinement V0.3.32 browser verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
