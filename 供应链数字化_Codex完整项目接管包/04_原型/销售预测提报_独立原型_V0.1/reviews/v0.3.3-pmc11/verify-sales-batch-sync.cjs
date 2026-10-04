const { chromium } = require('playwright');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const domClick = locator => locator.evaluate(element => element.click());

(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.40-forecast-lines';
  const installedChrome = process.env.PLAYWRIGHT_CHROME || chromium.executablePath();
  const browser = await chromium.launch({ headless: true, executablePath: installedChrome });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => localStorage.clear());
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

  const waitForBatchStep = async (step, timeout = 30000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const batch = await page.evaluate(() => window.ForecastBatchContract.getCurrent());
      if (batch.currentStep === step) return batch;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const batch = await page.evaluate(() => window.ForecastBatchContract.getCurrent());
    throw new Error(`batch did not reach ${step}: ${JSON.stringify({ status: batch.status, currentStep: batch.currentStep, resultState: batch.resultState })}`);
  };

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('.app').waitFor({ state: 'visible' });
    assert(!await page.evaluate(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('echarts-6.0.0.min.js'))), 'ECharts must not load before an insight chart is opened');
    const planningStarted = Date.now();
    await page.locator('[data-menu-toggle="planning"]').click();
    await page.locator('[data-view="decomposition"][data-menu-origin="plan-batches"]').click();
    await page.getByRole('button', { name: '2026-09-29 预测批次', exact: true }).waitFor();
    assert(Date.now() - planningStarted < 2000, 'planning menu switch must complete within 2 seconds');
    for (const date of ['2026-09-29', '2026-09-22', '2026-09-15', '2026-09-08']) assert(await page.getByText(date, { exact: false }).count() > 0, `planning batch list missing ${date}`);

    await page.getByRole('button', { name: '发起预测填报' }).click();
    await domClick(page.getByRole('dialog').getByRole('button', { name: '下一步' }));
    const createDrawer = page.getByRole('dialog');
    await createDrawer.getByText('选择继承内容').waitFor();
    await domClick(createDrawer.getByRole('button', { name: '下一步' }));
    await createDrawer.getByText('填报开始时间').waitFor();
    await domClick(createDrawer.getByRole('button', { name: '创建批次' }));

    const created = await page.evaluate(() => window.ForecastBatchContract.getCurrent());
    assert(created.batchDate === '2026-10-06' && created.status === '草稿', 'new batch must start as a 2026-10-06 draft');
    await page.locator('.fp-pmc-forecast-table').waitFor();
    const taskButton = () => page.locator('.fp-pmc-primary-actions').getByRole('button');
    await domClick(taskButton().filter({ hasText: '待处理' }));
    await domClick(page.locator('.ant-drawer-open').getByRole('button', { name: '确认父子关系', exact: true }));
    await domClick(taskButton().filter({ hasText: '待处理' }));
    await domClick(page.locator('.ant-drawer-open').getByRole('button', { name: '确认预测拆解', exact: true }));
    await domClick(taskButton().filter({ hasText: '重新生成预测' }));
    await domClick(page.locator('.ant-modal-confirm').getByRole('button', { name: '开始计算', exact: true }));
    await page.waitForFunction(() => window.ForecastBatchContract.getCurrent().resultState === '已生成');
    await domClick(page.locator('.fp-pmc-search-action').getByRole('button', { name: '确认预测', exact: true }));
    await waitForBatchStep('submission');
    await domClick(taskButton().filter({ hasText: '发起销售预测填报' }));
    await page.locator('.ant-drawer-open').getByRole('button', { name: '确认发起' }).click();
    await page.locator('.ant-modal-confirm .ant-btn-primary').click();
    await page.waitForFunction(() => window.ForecastBatchContract.getCurrent().submissionState === '填报中');

    const published = await page.evaluate(() => window.ForecastBatchContract.getCurrent());
    const child = published.childForecastResults[0];
    assert(published.batchDate === '2026-10-06' && published.submissionState === '填报中', 'new batch must publish its own sales window');

    const salesStarted = Date.now();
    await page.evaluate(() => document.querySelector('[data-view="sales"][data-menu-origin="top-sales"]').click());
    const salesLedger = page.locator('.forecast-table:visible');
    await salesLedger.waitFor();
    const salesMs = Date.now() - salesStarted;
    assert(await page.locator('#batchSelect').inputValue() === '2026-10-06', 'sales selector must follow the active batch');
    assert((await page.locator('#coverageRange').innerText()).includes('2026/10/06'), 'sales range must follow the active batch');
    assert((await salesLedger.locator('.date-head').first().innerText()).includes('10/06'), 'sales dates must start at the active batch date');
    const contractValue = await page.evaluate(({ childId, date }) => window.ForecastBatchContract.getDailyForecast(undefined, childId, date).ruleForecast, { childId: child.childId, date: published.forecastStartDate });
    const salesValue = await salesLedger.locator(`[data-child-row="${child.childId}"][data-forecast-line="final"] td.date-col`).first().innerText();
    assert(salesValue.includes(Number(contractValue).toLocaleString('zh-CN')), `sales value must match contract: ${salesValue} / ${contractValue}`);

    await page.getByRole('button', { name: '提交本批次' }).click();
    await domClick(page.getByRole('dialog').getByRole('button', { name: '提交', exact: true }));
    await page.getByText('已提交至PMC审核', { exact: true }).waitFor();
    const isolated = await page.evaluate(batchId => ({
      active: window.pmcWorkflow.getBatchState(batchId),
      previous: window.pmcWorkflow.getBatchState('FB-20260929-01'),
      keys: Object.keys(window.pmcWorkflow.getState().records)
    }), published.id);
    assert(isolated.active.submitted === published.childForecastResults.length, 'all active-batch children must be submitted');
    assert(isolated.keys.every(key => key.startsWith('2026-10-06|')), 'submission keys must use the active batch date');
    assert(isolated.previous.submitted === 0, 'previous batch totals must remain isolated');

    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.app').waitFor({ state: 'visible' });
    const reset = await page.evaluate(() => ({ batch: window.ForecastBatchContract.getCurrent(), salesBatch: state.batch, records: window.pmcWorkflow.getState().records }));
    assert(reset.batch.batchDate === '2026-09-29' && reset.batch.status === '规则预测待确认' && reset.batch.resultState === '已生成', 'refresh must restore the initial planning batch');
    assert(reset.salesBatch === '2026-09-29' && Object.keys(reset.records).length === 0, 'refresh must reset sales batch state and submissions');
    await page.locator('[data-view="sales"][data-menu-origin="top-sales"]').click();
    await page.locator('.forecast-table:visible').waitFor();
    await page.locator('[data-history-entry]').first().click();
    const historyText = await page.locator('tr.history-row[data-history-for]').allTextContents();
    assert(historyText.some(text => text.includes('2026/09/22')) && historyText.some(text => text.includes('2026/09/15')), 'sales history must include the 2026/09/22 and 2026/09/15 submissions');
    assert(errors.length === 0, errors.join('\n'));
    console.log(`sales publication, daily snapshot parity and submission isolation passed; sales switch ${salesMs}ms`);
    assert(salesMs < 1200, `sales menu switch must complete within 1.2 seconds (${salesMs}ms)`);
    console.log('sales batch sync browser verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
