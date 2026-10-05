const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=forecast-toggle-performance';
const chrome = process.env.PLAYWRIGHT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const thresholdMs = 700;

const measureToggle = async (page, expanded) => {
  const button = page.locator('[data-forecast-toggle-button="all"]');
  const startedAt = Date.now();
  await button.evaluate(node => node.click());
  const clickMs = Date.now() - startedAt;
  await page.waitForFunction(nextExpanded => {
    const table = document.querySelector('.forecast-table');
    const allRows = [...(table?.querySelectorAll('tbody tr[data-child-row][data-forecast-line]') || [])];
    const rows = allRows.filter(row => !row.hidden);
    const childCount = new Set(allRows.map(row => row.dataset.childRow)).size;
    const expectedRows = childCount * (nextExpanded ? 4 : 1);
    const toggle = document.querySelector('[data-forecast-toggle-button="all"]');
    return childCount > 0 && rows.length === expectedRows && toggle?.getAttribute('aria-expanded') === String(nextExpanded);
  }, expanded);
  const domMs = Date.now() - startedAt;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return { clickMs, domMs, totalMs: Date.now() - startedAt };
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('[data-view="sales"][data-menu-origin="top-sales"]').click();
    await page.locator('.forecast-table:visible').waitFor();

    const collapseMs = await measureToggle(page, false);
    const collapsedContract = await page.locator('.forecast-table:visible').evaluate(table => {
      const rows = [...table.querySelectorAll('tbody tr[data-child-row][data-forecast-line]')].filter(row => !row.hidden);
      return {
        lines: [...new Set(rows.map(row => row.dataset.forecastLine))],
        childCount: new Set(rows.map(row => row.dataset.childRow)).size,
        fixedCellRows: rows.filter(row => row.querySelector('td.identity-cell[rowspan="1"]')).length
      };
    });
    assert.deepEqual(collapsedContract.lines, ['final'], '收起后每个子ASIN只保留最终预测行');
    assert.equal(collapsedContract.fixedCellRows, collapsedContract.childCount, '收起后商品详情与最终预测行必须保持同一行');

    await page.evaluate(() => renderTable());
    await page.waitForFunction(() => {
      const table = document.querySelector('.forecast-table');
      const rows = [...(table?.querySelectorAll('tbody tr[data-child-row][data-forecast-line]') || [])].filter(row => !row.hidden);
      const childCount = new Set(rows.map(row => row.dataset.childRow)).size;
      return childCount > 0 && rows.length === childCount && rows.every(row => row.dataset.forecastLine === 'final');
    });
    const rerenderedCollapsedContract = await page.locator('.forecast-table:visible').evaluate(table => {
      const rows = [...table.querySelectorAll('tbody tr[data-child-row][data-forecast-line]')].filter(row => !row.hidden);
      return {
        lines: [...new Set(rows.map(row => row.dataset.forecastLine))],
        childCount: new Set(rows.map(row => row.dataset.childRow)).size,
        fixedCellRows: rows.filter(row => row.querySelector('td.identity-cell[rowspan="1"]')).length
      };
    });
    assert.deepEqual(rerenderedCollapsedContract.lines, ['final'], '整表重渲染后必须保持最终预测单行结构');
    assert.equal(rerenderedCollapsedContract.fixedCellRows, rerenderedCollapsedContract.childCount, '整表重渲染后固定列不得回到规则预测行');

    const expandMs = await measureToggle(page, true);
    const expandedContract = await page.locator('.forecast-table:visible').evaluate(table => {
      const rows = [...table.querySelectorAll('tbody tr[data-child-row][data-forecast-line]')].filter(row => !row.hidden);
      return {
        lines: [...new Set(rows.map(row => row.dataset.forecastLine))],
        childCount: new Set(rows.map(row => row.dataset.childRow)).size,
        fixedCellRows: rows.filter(row => row.dataset.forecastLine === 'system' && row.querySelector('td.identity-cell[rowspan="4"]')).length
      };
    });
    assert.deepEqual(expandedContract.lines, ['system', 'manual', 'activity', 'final'], '展开后必须恢复规则、人工、活动、最终四条预测线');
    assert.equal(expandedContract.fixedCellRows, expandedContract.childCount, '展开后商品详情必须跨四条预测线');

    console.log(`Sales forecast toggle latency: collapse=${JSON.stringify(collapseMs)}, expand=${JSON.stringify(expandMs)}`);
    assert.ok(collapseMs.totalMs <= thresholdMs, `销售预测收起预测线耗时 ${collapseMs.totalMs}ms，超过 ${thresholdMs}ms`);
    assert.ok(expandMs.totalMs <= thresholdMs, `销售预测展开预测线耗时 ${expandMs.totalMs}ms，超过 ${thresholdMs}ms`);
    console.log(`Sales forecast toggle latency passed: collapse=${collapseMs.totalMs}ms, expand=${expandMs.totalMs}ms`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
