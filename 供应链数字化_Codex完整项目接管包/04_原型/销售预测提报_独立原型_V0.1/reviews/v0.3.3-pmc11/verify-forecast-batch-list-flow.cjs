const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.49-forecast-lifecycle';
const chrome = process.env.PLAYWRIGHT_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const domClick = locator => locator.waitFor({ state: 'attached' }).then(() => locator.evaluate(node => node.click()));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => {
      localStorage.clear();
      const NativeDate = Date;
      const fixed = NativeDate.parse('2026-09-29T10:00:00+08:00');
      window.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [fixed])); }
        static now() { return fixed; }
      };
    });
    await page.goto(url, { waitUntil: 'networkidle' });

    const batchList = page.locator('.forecast-batch-list-root');
    await batchList.waitFor();
    assert.deepEqual(
      (await batchList.locator('.ant-table-thead th').allTextContents()).map(value => value.trim()),
      ['预测批次', '预测周期', '当前窗口', '预测对象', '待校准', '创建时间', '状态', '操作']
    );

    const seeded = await page.evaluate(() => window.ForecastBatchContract.listBatches().map(batch => ({
      id: batch.id,
      batchDate: batch.batchDate,
      status: batch.calibrationStatus,
      coverage: [batch.forecastStartDate, batch.forecastEndDate]
    })));
    assert.deepEqual(seeded.map(batch => batch.batchDate), [...seeded].map(batch => batch.batchDate).sort().reverse());
    const current = seeded[0];
    assert.equal(current.status, '待校准');
    assert.equal(seeded.some(batch => batch.status === '销售填报中'), true, '销售预测列表需要保留一条填报中的演示批次');
    assert.equal(await batchList.getByRole('button', { name: '开始校准' }).count(), 1);
    assert.equal(await batchList.getByRole('button', { name: '查看详情' }).count(), seeded.length - 1);
    assert.deepEqual((await page.locator('.workspace-tabs-v028 .ant-tabs-tab').allTextContents()).map(value => value.replace('×', '').trim()), ['预测批次列表']);
    await page.screenshot({ path: 'evidence/forecast-batch-list.png', fullPage: false });

    const frozenHistorical = seeded.find(batch => batch.status === '已冻结');
    await domClick(batchList.locator('.ant-table-tbody tr').filter({ hasText: frozenHistorical.batchDate }).getByRole('button', { name: '查看详情' }));
    const historicalLabel = `${frozenHistorical.batchDate} 预测批次`;
    let workbench = page.locator('.forecast-workbench-root');
    await workbench.waitFor();
    assert.deepEqual((await page.locator('.workspace-tabs-v028 .ant-tabs-tab').allTextContents()).map(value => value.replace('×', '').trim()), ['预测批次列表', historicalLabel]);
    let contextBar = workbench.locator('.fpw-batch-context');
    assert.match(await contextBar.innerText(), /状态：\s*已冻结/);
    assert.equal(await contextBar.getByRole('button', { name: '查看冻结结果' }).count(), 1);
    assert.equal(await contextBar.getByRole('button', { name: '返回批次列表' }).count(), 0);
    assert.equal(await workbench.locator('.fpw-entry-button').count(), 0);
    await page.locator('.workspace-tabs-v028 .ant-tabs-tab').filter({ hasText: '预测批次列表' }).click();
    await batchList.waitFor();
    assert.deepEqual((await page.locator('.workspace-tabs-v028 .ant-tabs-tab').allTextContents()).map(value => value.replace('×', '').trim()), ['预测批次列表', historicalLabel], '返回列表不应关闭已打开的详情页签');

    const batchFilter = batchList.getByPlaceholder('批次名称 / 批次编号');
    await batchFilter.fill(current.id);
    await domClick(batchList.getByRole('button', { name: '查询' }));
    await domClick(batchList.getByRole('button', { name: '开始校准' }));
    workbench = page.locator('.forecast-workbench-root');
    await workbench.waitFor();
    contextBar = workbench.locator('.fpw-batch-context');
    assert.match(await contextBar.innerText(), /状态：\s*校准中/);
    assert.equal(await contextBar.getByRole('button', { name: '保存' }).count(), 1);
    assert.equal(await contextBar.getByRole('button', { name: '发起销售填报' }).count(), 1, '保存与发起销售填报应作为平级动作同时出现');

    const target = await page.evaluate(batchId => {
      const batch = window.ForecastBatchContract.getBatch(batchId);
      return { childId: batch.childForecastResults[0].childId, date: batch.forecastStartDate };
    }, current.id);
    const before = await page.evaluate(({ batchId, childId, date }) => ({
      resultVersion: window.ForecastBatchContract.getBatchMeta(batchId).activeResultVersion,
      salesRule: window.ForecastBatchContract.getDailyForecast(batchId, childId, date).salesRuleForecast
    }), { batchId: current.id, ...target });

    const manualRow = workbench.locator('.fpw-table .ant-table-tbody > tr.fpw-child-row.fpw-prediction-manual').first();
    await domClick(manualRow.locator('.fpw-entry-button.fpw-line-manual').first());
    let editor = page.getByRole('dialog', { name: '人工预测' });
    await editor.getByRole('spinbutton', { name: '预测销量' }).fill('777');
    await editor.getByRole('textbox', { name: '人工预测原因' }).fill('批次生命周期验收');
    await domClick(editor.getByRole('button', { name: '保存' }));
    await editor.waitFor({ state: 'hidden' });

    await domClick(contextBar.getByRole('button', { name: '保存' }));
    await page.getByText('预测批次已保存，尚未发起销售填报', { exact: true }).waitFor();
    const pending = await page.evaluate(({ batchId, childId, date }) => {
      const meta = window.ForecastBatchContract.getBatchMeta(batchId);
      return {
        status: meta.calibrationStatus,
        submissionState: meta.submissionState,
        coverage: [meta.forecastStartDate, meta.forecastEndDate],
        resultVersion: meta.activeResultVersion,
        salesRule: window.ForecastBatchContract.getDailyForecast(batchId, childId, date).salesRuleForecast
      };
    }, { batchId: current.id, ...target });
    assert.equal(pending.status, '校准中');
    assert.notEqual(pending.submissionState, '填报中', '保存预测批次不得启动销售填报窗口');
    assert.deepEqual(pending.coverage, current.coverage, '校准完成不得修改滚动预测覆盖周期');
    assert.equal(pending.resultVersion, before.resultVersion, '仅保存不应生成新的最终预测结果版本');
    assert.equal(pending.salesRule, before.salesRule, '仅保存不应把PMC草稿发布为销售规则预测');
    await page.waitForFunction(() => document.querySelector('.fpw-batch-context')?.textContent.includes('校准中'));

    await domClick(contextBar.getByRole('button', { name: '发起销售填报' }));
    const confirm = page.getByRole('dialog', { name: '发起销售填报？' });
    await confirm.waitFor();
    await domClick(confirm.getByRole('button', { name: '确认发起' }));
    await confirm.waitFor({ state: 'hidden' });
    await page.getByText('销售填报已发起，系统已生成填报与冻结时间', { exact: true }).waitFor();

    const launched = await page.evaluate(({ batchId, childId, date }) => {
      const meta = window.ForecastBatchContract.getBatchMeta(batchId);
      const daily = window.ForecastBatchContract.getDailyForecast(batchId, childId, date);
      return { status: meta.calibrationStatus, coverage: [meta.forecastStartDate, meta.forecastEndDate], window: meta.submissionWindow, salesRule: daily.salesRuleForecast, resultVersion: daily.resultVersion };
    }, { batchId: current.id, ...target });
    assert.equal(launched.status, '销售填报中');
    assert.deepEqual(launched.coverage, current.coverage);
    assert.notEqual(launched.resultVersion, before.resultVersion);
    assert.equal(launched.salesRule, 777, '发起销售填报时PMC最终预测应成为销售规则预测');
    assert.deepEqual(
      [launched.window.submissionStartTime, launched.window.submissionDeadlineTime, launched.window.submissionFreezeTime, launched.window.ruleEffectiveTime],
      ['2026-09-29T10:00:00+08:00', '2026-10-10T18:00:00+08:00', '2026-10-12T00:00:00+08:00', '2026-10-12T09:00:00+08:00']
    );
    assert.equal(launched.window.calendarVersion, 'CN-BUSINESS-CALENDAR-2026-V1');
    assert.match(await contextBar.innerText(), /填报开始：\s*2026\/09\/29 10:00/);
    assert.match(await contextBar.innerText(), /填报截止：\s*2026\/10\/10 18:00/);
    assert.match(await contextBar.innerText(), /冻结时间：\s*2026\/10\/12 00:00/);
    assert.equal(await contextBar.getByRole('button', { name: '保存' }).count(), 0, '发起销售填报后不得继续保存PMC校准');
    assert.equal(await contextBar.getByRole('button', { name: '查看销售填报' }).count(), 1);

    await domClick(contextBar.getByRole('button', { name: '查看销售填报' }));
    const salesTable = page.locator('.forecast-table:visible');
    await salesTable.waitFor();
    assert.equal(await page.evaluate(() => window.pmcWorkflow.getSalesBatchId()), current.id, '销售页应直接承接发起批次');
    assert.equal((await page.locator('.sales-window-time').innerText()).includes('2026/09/29 10:00'), true);
    assert.equal((await page.locator('.sales-window-state').innerText()).trim(), '销售填报中');
    const salesSystemCell = salesTable.locator(`tr[data-child-row="${target.childId}"][data-forecast-line="system"] td.date-col`).first();
    assert.equal(Number((await salesSystemCell.innerText()).replaceAll(',', '').trim()), 777);

    const salesManualCell = salesTable.locator(`tr[data-child-row="${target.childId}"][data-forecast-line="manual"] [data-edit-manual]`).first();
    await domClick(salesManualCell);
    editor = page.getByRole('dialog', { name: '人工预测' });
    await editor.getByRole('spinbutton', { name: '预测销量' }).fill('888');
    await editor.getByRole('textbox', { name: '人工预测原因' }).fill('销售填报冻结快照验收');
    await domClick(editor.getByRole('button', { name: '保存' }));
    await editor.waitFor({ state: 'hidden' });

    const timed = await page.evaluate(() => ({
      closed: window.ForecastWindow.current(Date.parse('2026-10-10T19:00:00+08:00')),
      holidaySchedule: window.ForecastBatchContract.scheduleSubmissionWindow('2026-10-06T10:00:00+08:00')
    }));
    assert.equal(timed.closed.editable, false, '截止后销售应立即只读');
    assert.equal(timed.closed.key, 'closed');
    assert.deepEqual(
      [timed.holidaySchedule.submissionStartTime, timed.holidaySchedule.submissionDeadlineTime],
      ['2026-10-08T09:00:00+08:00', '2026-10-13T18:00:00+08:00'],
      '国庆假期内发起应顺延填报和截止窗口'
    );

    const frozen = await page.evaluate(({ batchId, childId, date }) => {
      window.ForecastWindow.sync(Date.parse('2026-10-12T00:00:00+08:00'));
      const meta = window.ForecastBatchContract.getBatchMeta(batchId);
      const downstream = window.ForecastBatchContract.getDownstreamSnapshot(batchId);
      const row = downstream.rows.find(item => item.childId === childId);
      return { status: meta.calibrationStatus, downstreamReady: meta.downstreamReady, frozenResultVersion: meta.frozenResultVersion, finalForecast: row.daily[date].finalForecast };
    }, { batchId: current.id, ...target });
    assert.equal(frozen.status, '已冻结');
    assert.equal(frozen.downstreamReady, true);
    assert.match(frozen.frozenResultVersion, /^FROZEN-/);
    assert.equal(frozen.finalForecast, 888, '冻结快照应保存销售最终预测而不是仅保存PMC规则预测');
    await page.waitForFunction(() => document.querySelector('.sales-window-state')?.textContent.includes('已冻结'));
    assert.equal(await salesTable.locator('[data-edit-manual],[data-event]').count(), 0, '冻结后销售不得继续编辑');

    await domClick(page.locator('.sales-rule-source').getByRole('button', { name: '查看来源' }));
    workbench = page.locator('.forecast-workbench-root');
    await workbench.waitFor();
    assert.match(await workbench.locator('.fpw-batch-context').innerText(), /状态：\s*已冻结/);
    assert.equal(await workbench.getByRole('button', { name: '查看冻结结果' }).count(), 1);
    await page.waitForTimeout(3200);
    await page.screenshot({ path: 'evidence/forecast-batch-list-flow.png', fullPage: false });

    assert.deepEqual(errors, [], `页面运行时错误：${errors.join('；')}`);
    console.log('Forecast batch lifecycle, scheduling, freeze and downstream snapshot verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
