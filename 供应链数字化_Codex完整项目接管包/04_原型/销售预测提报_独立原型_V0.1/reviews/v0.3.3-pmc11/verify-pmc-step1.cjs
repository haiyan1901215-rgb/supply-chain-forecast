const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.31-step1';
const chrome = process.env.PLAYWRIGHT_CHROME || chromium.executablePath();

async function openBatch(page) {
  await page.locator('[data-menu-toggle="planning"]').evaluate(button => button.click());
  await page.locator('[data-view="decomposition"][data-menu-origin="plan-batches"]').evaluate(button => button.click());
  await page.getByRole('button', { name: '2026-09-29 预测批次', exact: true }).evaluate(button => button.click());
  await page.locator('.fp-pmc-forecast-table').waitFor();
}

async function clickDom(locator) {
  await locator.waitFor({ state: 'attached' });
  await locator.evaluate(element => element.click());
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.clear());
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await openBatch(page);

    const detail = page.locator('.fp-pmc-detail-root');
    const ledger = page.locator('.fp-pmc-forecast-table');
    const visibleText = await detail.innerText();
    assert.equal(errors.length, 0, `页面运行时错误：${errors.join('；')}`);
    assert.equal(await page.locator('.fp-batch-nav, .fp-detail-root .ant-steps, .fp-overview-tasks').count(), 0, 'Step 1 不应出现左侧导航、步骤条或 Dashboard 卡片');
    assert.match(await page.locator('.fp-pmc-title-block').innerText(), /待PMC确认|待发起填报|销售填报中|已冻结/);
    assert.ok(await page.locator('.fp-pmc-batch-context').innerText().then(value => /销量数据截至：2026\/09\/28/.test(value)), '批次上下文应使用业务化的数据截至文案');
    assert.ok(await page.locator('.fp-pmc-batch-context').innerText().then(value => /预测范围：全部国家 \/ 全部平台/.test(value)), '批次范围应使用业务化的国家/平台文案');
    assert.equal(await page.getByText('数据服务正常', { exact: false }).count(), 0, '详情页不应继续使用监控式的数据服务正常文案');
    assert.equal(await page.locator('.crumbbar .shell-time').innerText(), '销量数据截至：2026/09/28', '全局状态文案应使用业务化的数据截至表达');
    assert.match(await page.locator('.fp-pmc-taskbar').innerText(), /当前任务/);
    assert.ok(!visibleText.includes('评估中'), '详情主视觉不应使用评估中');
    assert.ok(!/REL-|PARAM-|FORECAST-|SEASON-|SPLIT-/.test(visibleText), '版本号不应出现在详情主视觉');

    const toolbarButtons = (await page.locator('.fp-pmc-function-row button').allTextContents()).map(value => value.trim()).filter(Boolean);
    assert.deepEqual(toolbarButtons, ['发起销售预测填报', '重新生成预测', '刷新数据', '查看规则依据', '更多'], '主操作区必须收敛到业务动作');
    assert.equal(await page.getByRole('button', { name: '预测参数', exact: true }).count(), 0, '预测参数不应作为一级按钮');
    assert.equal(await page.getByRole('button', { name: '父子关系', exact: true }).count(), 0, '父子关系不应作为一级按钮');
    assert.equal(await page.getByRole('button', { name: '子体拆分', exact: true }).count(), 0, '子体拆分不应作为一级按钮');

    assert.equal(await ledger.locator('.parent-row').count(), 6, '父ASIN树必须保留');
    assert.equal(await ledger.locator('[data-child-row][data-forecast-line="system"]').count(), 16, '子ASIN系统预测必须有真实样例行');
    assert.equal(await ledger.locator('.date-head').count(), 14, '默认保持14天查看窗口');
    assert.ok(await ledger.locator('tbody td.date-col').allTextContents().then(values => values.some(value => value.trim())), '日级预测不应全部为空');
    assert.equal(await page.locator('.fp-pmc-detail-root .ant-segmented-item-label').allTextContents().then(values => values.join('|')), '日预测|周汇总');

    await page.getByRole('button', { name: '更多', exact: true }).click();
    const menu = page.locator('.ant-dropdown:visible');
    await menu.waitFor();
    const menuText = await menu.innerText();
    assert.ok(menuText.includes('预测参数'), '配置入口应下沉到更多菜单');
    assert.ok(menuText.includes('父子关系'), '关系入口应下沉到更多菜单');
    assert.ok(menuText.includes('子体拆分'), '拆分入口应下沉到更多菜单');
    await page.keyboard.press('Escape');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    const mobile = await page.evaluate(() => ({
      rootWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      taskWidth: document.querySelector('.fp-pmc-taskbar')?.getBoundingClientRect().width || 0,
      tableScrollWidth: document.querySelector('.fp-pmc-workbench')?.scrollWidth || 0,
      tableClientWidth: document.querySelector('.fp-pmc-workbench')?.clientWidth || 0
    }));
    assert.ok(mobile.scrollWidth <= mobile.rootWidth + 1, `窄屏页面不应产生根级横向溢出：${JSON.stringify(mobile)}`);
    assert.ok(mobile.taskWidth <= mobile.rootWidth, '当前任务条应适配窄屏');
    assert.ok(mobile.tableScrollWidth >= mobile.tableClientWidth, '主表横向滚动应保留在台账内部');

    console.log('PMC Step 1 browser verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
