const fs = require('fs');
const { chromium } = require('playwright');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:8814/reviews/v0.3.3-pmc11/index.html?v=0.3.6-performance-date1';
  const installedChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(installedChrome) ? { executablePath: installedChrome } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('.app').waitFor({ state: 'visible' });
    const initial = await page.evaluate(() => ({
      current: window.ForecastBatchContract.getCurrent(),
      batches: window.ForecastBatchContract.listBatches().map(batch => batch.batchDate),
      salesBatch: state.batch,
      coverage: document.querySelector('#coverageRange')?.textContent,
      echartsLoaded: performance.getEntriesByType('resource').some(entry => entry.name.includes('echarts-6.0.0.min.js'))
    }));
    assert(initial.current.batchDate === '2026-09-29' && initial.current.dataCutoffDate === '2026-09-28', 'current batch date or cutoff is incorrect');
    assert(initial.current.forecastEndDate === '2027-03-29' && initial.salesBatch === '2026-09-29', 'sales forecast range is not aligned to the current batch');
    assert(initial.coverage.includes('2026/09/29') && initial.coverage.includes('2027/03/29'), 'sales coverage text is not aligned');
    assert(['2026-09-29', '2026-09-22', '2026-09-15', '2026-09-08'].every(date => initial.batches.includes(date)), 'planning history batches are incomplete');
    assert(!initial.echartsLoaded, 'ECharts loaded during the initial page load');

    await page.locator('[data-history-entry]').first().click();
    await page.locator('tr.history-row[data-history-for]').first().waitFor();
    const historyText = (await page.locator('tr.history-row[data-history-for]').allInnerTexts()).join(' ');
    assert(historyText.includes('2026/09/22') && historyText.includes('2026/09/15'), 'historical submissions are missing 2026/09/22 or 2026/09/15');

    const planningStarted = Date.now();
    await page.evaluate(() => document.querySelectorAll('.menu button')[3].click());
    await page.getByText('预测批次列表', { exact: true }).waitFor();
    const planningMs = Date.now() - planningStarted;
    const planText = await page.locator('.fp-batch-row').allInnerTexts();
    assert(['2026-09-29', '2026-09-22', '2026-09-15', '2026-09-08'].every(date => planText.some(text => text.includes(date))), 'planning list does not show all mock batches');
    assert(planningMs < 2500, `planning menu switch took ${planningMs}ms`);

    const salesStarted = Date.now();
    await page.evaluate(() => document.querySelectorAll('.menu button')[0].click());
    await page.locator('.content').waitFor({ state: 'visible' });
    const salesMs = Date.now() - salesStarted;
    assert(salesMs < 1200, `sales menu switch took ${salesMs}ms`);

    await page.locator('[data-insight="sales"]').first().click();
    await page.locator('[data-testid="sales-chart"]').waitFor();
    await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('echarts-6.0.0.min.js')));
    assert(errors.length === 0, errors.join('\n'));
    console.log(JSON.stringify({ planningMs, salesMs, batches: initial.batches, history: ['2026-09-22', '2026-09-15'], echarts: 'lazy-loaded' }));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
