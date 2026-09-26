const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:8800/reviews/v0.3.3-pmc11/index.html?v=0.3.3-config12';
  const installedChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(installedChrome) ? { executablePath: installedChrome } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('.app').waitFor({ state: 'visible' });
    const planningMenu = page.locator('.menu button').filter({ hasText: '计划配置' });
    await planningMenu.waitFor({ state: 'visible' });
    await planningMenu.click();
    await page.getByText('预测计划', { exact: true }).first().waitFor();
    await page.getByRole('button', { name: '2026-10-21 第1批预测', exact: true }).click();

    const workflowLabels = ['预测评估', '预测参数', '父子关系', '拆解规则', '规则预测', '销售提报窗口', '预测复盘'];
    for (const label of workflowLabels) {
      await page.locator('.fp-stepbar').getByText(label, { exact: true }).click();
      await page.locator('.ant-steps-item-process').getByText(label, { exact: true }).waitFor();
    }

    await page.locator('.fp-stepbar').getByText('拆解规则', { exact: true }).click();
    const totalTag = page.locator('.fp-panel').filter({ hasText: '本批次子ASIN份额调配' }).locator('.ant-tag').filter({ hasText: '100.00%' });
    await totalTag.waitFor();
    assert((await totalTag.getAttribute('class') || '').includes('ant-tag-success'), '100% share tag must be success');

    const currentBefore = await page.evaluate(() => window.ForecastBatchContract.getCurrent());
    const firstParent = currentBefore.parentForecastResults[0];
    const firstChild = currentBefore.childForecastResults.find(row => `${row.country}|${row.store}|${row.parentASIN}` === firstParent.key);
    const storedTotal = Object.values(firstChild.dailyFinalForecast).reduce((sum, value) => sum + Number(value || 0), 0);
    const firstPreview = await page.locator('.fp-panel').filter({ hasText: '本批次子ASIN份额调配' }).locator('.ant-table-wrapper tbody tr').first().locator('td').last().innerText();
    assert(firstPreview.includes(storedTotal.toLocaleString('zh-CN')), `unchanged split preview must use stored daily total: ${firstPreview} / ${storedTotal}`);

    await page.locator('.fp-stepbar').getByText('规则预测', { exact: true }).click();
    await page.locator('.fp-panel').filter({ hasText: '子ASIN规则预测清单' }).waitFor();
    const finalForecastCell = await page.locator('.fp-panel').filter({ hasText: '子ASIN规则预测清单' }).locator('.ant-table-wrapper tbody tr').first().locator('td').nth(8).innerText();
    assert(finalForecastCell.includes(storedTotal.toLocaleString('zh-CN')), `forecast result must use contract total: ${finalForecastCell} / ${storedTotal}`);

    await page.locator('.fp-stepbar').getByText('拆解规则', { exact: true }).click();
    const splitPanel = page.locator('.fp-panel').filter({ hasText: '本批次子ASIN份额调配' });
    const firstShareInput = splitPanel.getByRole('spinbutton').first();
    const initialShare = Number(await firstShareInput.inputValue());
    await firstShareInput.fill(String(Math.min(99, initialShare + 1)));
    await splitPanel.getByPlaceholder('例如：XL近期销量异常，按运营策略提高本批次份额。').fill('浏览器回归：根据近期趋势调整');
    await splitPanel.getByRole('button', { name: '保存本批次调配' }).click();
    await page.getByText('本批次子ASIN份额已保存', { exact: true }).waitFor();

    const currentAdjusted = await page.evaluate(() => window.ForecastBatchContract.getCurrent());
    const adjustedSiblings = currentAdjusted.childForecastResults.filter(row => `${row.country}|${row.store}|${row.parentASIN}` === firstParent.key);
    assert(adjustedSiblings.reduce((sum, row) => sum + row.finalShare, 0) === 10000, 'saved shares must total 10000 basis points');
    assert(currentAdjusted.adjustmentLog.some(item => item.type === '子ASIN份额'), 'share adjustment must be audited');

    const messageNotice = page.locator('.ant-message-notice');
    if (await messageNotice.count()) await messageNotice.last().waitFor({ state: 'hidden' });
    await page.evaluate(() => { window.scrollTo(0, 0); const host = document.querySelector('.pmc-workspace'); if (host) host.scrollTop = 0; });
    await page.screenshot({ path: path.resolve(__dirname, '../../evidence/forecast-plan-split-workspace.png'), fullPage: true });

    await page.locator('.menu button').filter({ hasText: '销售预测' }).click();
    await page.locator('.forecast-table').waitFor();
    await page.locator(`[data-child-row="${firstChild.childId}"][data-forecast-line="final"]`).waitFor();
    const salesFinalValue = await page.locator(`[data-child-row="${firstChild.childId}"][data-forecast-line="final"] td.date-col`).first().innerText();
    const contractDailyValue = currentBefore.childForecastResults.find(row => row.childId === firstChild.childId).dailyFinalForecast[currentBefore.forecastStartDate];
    assert(salesFinalValue.includes(Number(contractDailyValue).toLocaleString('zh-CN')), `sales daily value must use contract: ${salesFinalValue} / ${contractDailyValue}`);
    assert(await page.getByText(/^(AI预测|规则预测)$/).count() > 0, 'frozen sales surface missing AI/rule forecast line');
    for (const label of ['人工预测', '活动预测', '最终预测', '历史提报记录']) {
      assert(await page.getByText(label, { exact: true }).count() > 0, `frozen sales surface missing ${label}`);
    }
    await page.locator('[data-history-entry]').first().click();
    await page.locator('tr.history-row[data-history-for]').first().waitFor();
    const historyAlignment = await page.locator('tr.history-row[data-history-for] td.date-col').first().evaluate(cell => {
      const value = cell.querySelector('.history-value');
      const finalValue = cell.querySelector('.history-final-value');
      return {
        cellTextAlign: getComputedStyle(cell).textAlign,
        valueTextAlign: value ? getComputedStyle(value).textAlign : '',
        finalAlignItems: finalValue ? getComputedStyle(finalValue).alignItems : ''
      };
    });
    assert(historyAlignment.cellTextAlign === 'left', `history value cell must align left: ${historyAlignment.cellTextAlign}`);
    assert(historyAlignment.valueTextAlign === 'left', `history value content must align left: ${historyAlignment.valueTextAlign}`);
    assert(historyAlignment.finalAlignItems === 'flex-start', `history final source tag must align left: ${historyAlignment.finalAlignItems}`);
    const actualAlignment = await page.locator('tr.actual-row[data-history-for] td.date-col').first().evaluate(cell => getComputedStyle(cell).textAlign);
    assert(actualAlignment === 'left', `history actual sales cell must align left: ${actualAlignment}`);
    assert(await page.locator('.date-head').count() > 0, 'frozen sales daily date header missing');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.resolve(__dirname, '../../evidence/forecast-plan-sales-frozen.png'), fullPage: true });

    assert(errors.length === 0, errors.join('\n'));
    console.log('forecast plan browser verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
