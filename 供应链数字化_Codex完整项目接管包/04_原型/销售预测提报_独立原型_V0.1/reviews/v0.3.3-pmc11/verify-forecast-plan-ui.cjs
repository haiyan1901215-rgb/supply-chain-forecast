const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:8800/reviews/v0.3.3-pmc11/index.html?v=0.3.4-auto-flow1';
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
    await page.getByRole('button', { name: '2026/10/21 批次', exact: true }).click();
    assert(await page.getByText('流程演示状态', { exact: true }).count() === 0, 'manual planning demo state control must be removed');
    const initial = await page.evaluate(() => window.ForecastBatchContract.getCurrent());
    assert(initial.status === '评估中' && initial.currentStep === 'assessment' && initial.resultSnapshots.length === 0, 'planning demo must start at assessment without generated results');
    await page.locator('.ant-steps-item-process').getByText('预测评估', { exact: true }).waitFor();

    await page.getByRole('button', { name: '确认评估并进入参数调整' }).click();
    await page.locator('.ant-steps-item-process').getByText('预测参数', { exact: true }).waitFor();
    assert((await page.evaluate(() => window.ForecastBatchContract.getCurrent())).status === '参数调整中', 'assessment action must advance workflow status');

    await page.getByPlaceholder('例如：上一批次低销量子体偏差较大，本批次提高近期份额权重。').fill('演示：确认默认参数并进入关系处理');
    await page.getByRole('button', { name: '保存本批次参数' }).click();
    await page.locator('.ant-steps-item-process').getByText('父子关系', { exact: true }).waitFor();
    assert((await page.evaluate(() => window.ForecastBatchContract.getCurrent())).status === '参数已确认', 'parameter save must advance workflow status');

    await page.getByText('本批次父子关系', { exact: true }).waitFor();
    assert(await page.getByRole('button', { name: '沿用上一版本' }).count() === 1, 'relation inherit action missing');
    assert(await page.getByRole('button', { name: '新增关系' }).count() === 1, 'relation add action missing');
    const changedRelation = page.locator('.fp-plan-table tbody tr').filter({ hasText: '父体变更' }).first();
    await changedRelation.getByRole('button', { name: '查看' }).click();
    await page.getByText('父ASIN关系历史', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    await page.getByRole('button', { name: '确认本批次关系' }).click();
    await page.locator('.ant-steps-item-process').getByText('子体拆解', { exact: true }).waitFor();
    assert((await page.evaluate(() => window.ForecastBatchContract.getCurrent())).status === '关系已确认', 'relation confirmation must advance workflow status');

    const splitPanel = page.locator('.fp-panel').filter({ hasText: '本批次子ASIN份额调配' });
    const comboRow = splitPanel.locator('tr.ant-table-row').filter({ hasText: '销售组合' }).first();
    assert(await comboRow.count() === 1, 'sales combo row missing from split table');
    assert(await comboRow.locator('.fp-combo-expand').count() === 1, 'sales combo row must be expandable');
    const skuRow = splitPanel.locator('tr.ant-table-row').filter({ hasText: '普通SKU' }).first();
    assert(await skuRow.locator('.fp-combo-expand').count() === 0, 'ordinary SKU must not be expandable');
    await comboRow.locator('.fp-combo-expand').click();
    const comboDetail = splitPanel.locator('.fp-combo-detail').first();
    await comboDetail.getByText('COMB-001', { exact: false }).first().waitFor();
    assert(await comboDetail.getByText('SKU-A', { exact: true }).count() === 1 && await comboDetail.getByText('SKU-B', { exact: true }).count() === 1, 'combo detail SKU rows missing');
    assert(await comboDetail.getByText('33.33%', { exact: true }).count() === 1 && await comboDetail.getByText('66.67%', { exact: true }).count() === 1, 'combo quantity ratios missing');
    const comboInputs = comboDetail.getByRole('spinbutton');
    await comboInputs.nth(0).fill('20');
    await comboInputs.nth(1).fill('-20');
    await comboDetail.getByRole('combobox').click();
    await page.getByText('库存消化', { exact: true }).last().click();
    await comboDetail.getByRole('button', { name: '保存组合明细' }).click();
    await page.getByText('COMB-001 组合明细已保存', { exact: true }).waitFor();
    const comboState = await page.evaluate(() => window.ForecastBatchContract.getCurrent().childForecastResults.find(row => row.businessObjectType === 'COMBO'));
    assert(comboState.comboLines.find(line => line.sku === 'SKU-A').pmcAdjustment === 20 && comboState.comboLines.find(line => line.sku === 'SKU-B').pmcAdjustment === -20, 'combo adjustment action must update model');
    const totalTag = splitPanel.locator('.ant-tag').filter({ hasText: '100.00%' });
    await totalTag.waitFor();
    assert((await totalTag.getAttribute('class') || '').includes('ant-tag-success'), '100% share tag must be success');

    const splitBefore = await page.evaluate(() => window.ForecastBatchContract.getCurrent());
    const firstParent = splitBefore.parentForecastResults[0];
    const firstChild = splitBefore.childForecastResults.find(row => `${row.country}|${row.store}|${row.parentASIN}` === firstParent.key);
    const storedTotal = Object.values(firstChild.dailyFinalForecast).reduce((sum, value) => sum + Number(value || 0), 0);
    const firstPreview = await page.locator('.fp-panel').filter({ hasText: '本批次子ASIN份额调配' }).locator('tr.ant-table-row').first().locator('td').last().innerText();
    assert(firstPreview.includes(storedTotal.toLocaleString('zh-CN')), `unchanged split preview must use stored daily total: ${firstPreview} / ${storedTotal}`);
    const firstShareInput = splitPanel.locator('tr.ant-table-row').first().getByRole('spinbutton').nth(1);
    const initialShare = Number(await firstShareInput.inputValue());
    await firstShareInput.fill(String(Math.min(99, initialShare + 1)));
    await splitPanel.getByRole('button', { name: '按系统份额分配剩余' }).click();
    await splitPanel.locator('.fp-adjust-reason .ant-select-selector').click();
    await page.getByText('近期销售趋势变化', { exact: true }).last().click();
    await splitPanel.getByRole('button', { name: '保存人工调配' }).click();
    await page.getByText('本批次子ASIN份额已保存并记录调整原因', { exact: true }).waitFor();
    await page.locator('.ant-steps-item-process').getByText('规则预测', { exact: true }).waitFor();

    const currentAdjusted = await page.evaluate(() => window.ForecastBatchContract.getCurrent());
    const adjustedSiblings = currentAdjusted.childForecastResults.filter(row => `${row.country}|${row.store}|${row.parentASIN}` === firstParent.key);
    assert(adjustedSiblings.reduce((sum, row) => sum + row.finalShare, 0) === 10000, 'saved shares must total 10000 basis points');
    assert(currentAdjusted.adjustmentLog.some(item => item.type === '子ASIN份额'), 'share adjustment must be audited');
    assert(currentAdjusted.status === '拆解已确认' && currentAdjusted.resultState === '待生成' && !currentAdjusted.activeResultVersion, 'split action must advance to ungenerated forecast');

    await page.getByText('生成前校验', { exact: true }).waitFor();
    await page.getByRole('button', { name: /生成本批次规则预测/ }).click();
    await page.locator('.ant-steps-item-process').getByText('销售提报窗口', { exact: true }).waitFor({ timeout: 10000 });
    const generated = await page.evaluate(() => window.ForecastBatchContract.getCurrent());
    assert(generated.activeResultVersion === 'RESULT-20261021-V01' && generated.resultSnapshots.length === 1 && generated.status === '规则预测已生成', 'generation must create V01 and advance to submission');

    await page.getByRole('button', { name: '发布销售填报窗口' }).click();
    await page.getByText('销售填报窗口已绑定到本批次', { exact: true }).waitFor();
    const published = await page.evaluate(() => window.ForecastBatchContract.getCurrent());
    assert(published.status === '销售填报中' && published.submissionState === '填报中', 'publishing must advance to active sales submission');

    const messageNotice = page.locator('.ant-message-notice');
    if (await messageNotice.count()) await messageNotice.last().waitFor({ state: 'hidden' });
    await page.evaluate(() => { window.scrollTo(0, 0); const host = document.querySelector('.pmc-workspace'); if (host) host.scrollTop = 0; });
    await page.screenshot({ path: path.resolve(__dirname, '../../evidence/forecast-plan-split-workspace.png'), fullPage: true });

    await page.locator('.menu button').filter({ hasText: '销售预测' }).click();
    await page.locator('.forecast-table').waitFor();
    await page.locator(`[data-child-row="${firstChild.childId}"][data-forecast-line="final"]`).waitFor();
    const salesFinalValue = await page.locator(`[data-child-row="${firstChild.childId}"][data-forecast-line="final"] td.date-col`).first().innerText();
    const contractDailyValue = await page.evaluate(({ childId, date }) => window.ForecastBatchContract.getDailyForecast(undefined, childId, date).ruleForecast, { childId: firstChild.childId, date: splitBefore.forecastStartDate });
    assert(salesFinalValue.includes(Number(contractDailyValue).toLocaleString('zh-CN')), `sales daily value must use contract: ${salesFinalValue} / ${contractDailyValue}`);
    assert(await page.getByRole('button', { name: '切换流程演示状态' }).count() === 0, 'manual workflow demo selector must be removed');
    assert(await page.getByRole('button', { name: '切换填报演示状态' }).count() === 0, 'manual submission window selector must be removed');
    await page.locator('#pmcRoleBar').getByText('填报中', { exact: true }).waitFor();
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

    await page.getByRole('button', { name: '提交本批次' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '提交', exact: true }).click();
    await page.getByText('已提交至PMC审核', { exact: true }).waitFor();
    await page.locator('#pmcRoleBar').getByText('待PMC审核', { exact: true }).waitFor();
    const submitted = await page.evaluate(() => window.pmcWorkflow.getState());
    assert(Object.keys(submitted.records).length > 0 && Object.values(submitted.records).every(record => record.status === 'pending'), 'sales submit must advance workflow to PMC review');

    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.app').waitFor({ state: 'visible' });
    const resetState = await page.evaluate(() => ({ batch: window.ForecastBatchContract.getCurrent(), workflow: window.pmcWorkflow.getState(), window: window.ForecastWindow.current() }));
    assert(resetState.batch.status === '评估中' && resetState.batch.currentStep === 'assessment' && resetState.batch.resultSnapshots.length === 0, 'refresh must reset planning workflow to assessment');
    assert(Object.keys(resetState.workflow.records).length === 0 && resetState.window.key === 'waiting', 'refresh must reset sales workflow and submission window');
    await page.locator('#pmcRoleBar').getByText('待销售提报', { exact: true }).waitFor();
    await page.locator('.menu button').filter({ hasText: '计划配置' }).click();
    await page.getByRole('button', { name: '2026/10/21 批次', exact: true }).click();
    await page.locator('.ant-steps-item-process').getByText('预测评估', { exact: true }).waitFor();

    assert(errors.length === 0, errors.join('\n'));
    console.log('forecast plan browser verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
