const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.30-pmc-refinement';
const click = locator => locator.evaluate(node => node.click());
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.clock.setFixedTime(new Date('2026-10-01T10:00:00+08:00'));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'ForecastBatchModel', { configurable: true, set(api) {
        const create = api.createStore;
        api.createStore = (...args) => { const store = create(...args); window.__forecastTestStore = store; return store; };
        Object.defineProperty(window, 'ForecastBatchModel', { value: api, configurable: true });
      } });
    });
    await page.goto(url, { waitUntil: 'networkidle' });
    await click(page.locator('[data-menu-toggle="planning"]'));
    await click(page.locator('[data-view="decomposition"][data-menu-origin="plan-batches"]'));
    await click(page.getByRole('button', { name: '2026-09-29 预测批次', exact: true }));
    const ledger = page.locator('.fp-pmc-forecast-table');
    await ledger.waitFor();
    assert.equal(await ledger.locator('[data-forecast-line="manual"],[data-forecast-line="activity"]').count(), 0);
    assert.equal(await ledger.locator('[data-forecast-line="pmc"]').count(), 16);
    assert.equal(await ledger.locator('thead .date-head small').count(), 14, '日期保留销售母版的星期标签');
    assert.equal(await ledger.locator('.parent-row .is-diagnostic').count(), 0, '模型依据不占主表');
    assert.equal(await ledger.getByRole('button', { name: /^校准PMC / }).count(), 0, '规则预测未生成前不得操作PMC校准');
    assert.equal(await page.locator('.planning-system-tabs').count(), 0);
    await page.screenshot({ path: '../../evidence/pmc-role-baseline-desktop.png' });

    await page.evaluate(() => {
      const store = window.__forecastTestStore;
      const batch = store.getCurrent();
      store.confirmRelations(batch.id);
      store.confirmSplit(batch.id);
      store.generateForecast(batch.id);
    });
    await ledger.getByRole('button', { name: /^校准PMC / }).first().waitFor();

    await click(ledger.getByRole('button', { name: /^校准PMC / }).first());
    const modal = page.locator('.ant-modal:visible');
    await modal.getByLabel('目标ADU').fill('35');
    await modal.getByLabel('校准原因').fill('广告投入增加');
    await click(modal.getByRole('button', { name: '保存校准', exact: true }));
    await modal.waitFor({ state: 'hidden' });
    const calibrated = await page.evaluate(() => {
      const b = window.ForecastBatchContract.getCurrent(), c = b.childForecastResults[0], date = b.forecastStartDate;
      return { id: c.childId, asin: c.childASIN, date, system: c.dailyRuleForecast[date], pmc: c.dailyFinalForecast[date], log: b.adjustmentLog[0] };
    });
    assert.equal(calibrated.pmc, 18, '父体35件按当前份额拆分到首个子体'); assert.equal(calibrated.log.type, 'PMC基准');
    await click(ledger.getByRole('button', { name: /^校准PMC / }).first());
    assert.match(await modal.innerText(), /变更记录[\s\S]*广告投入增加/);
    await modal.getByLabel('校准原因').fill('恢复默认');
    await click(modal.getByRole('button', { name: '恢复系统预测', exact: true }));
    await modal.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => Object.keys(window.ForecastBatchContract.getCurrent().calibrations.parent).length), 0);

    await click(page.getByRole('button', { name: '预测参数', exact: true }));
    assert.match(await modal.innerText(), /后续批次生效[\s\S]*基础参数[\s\S]*趋势参数[\s\S]*季节参数/);
    await click(modal.locator('.ant-modal-close'));
    await click(page.getByRole('button', { name: '父子关系', exact: true }));
    const drawer = page.locator('.ant-drawer-open');
    assert.match(await drawer.innerText(), /父子ASIN关系维护[\s\S]*当前关系版本[\s\S]*SKU[\s\S]*当前父体/);
    await click(drawer.locator('.ant-drawer-close'));
    await click(ledger.getByRole('button', { name: /^子体份额 / }).first());
    await click(ledger.getByRole('button', { name: '调整本组子体份额', exact: true }));
    const share = ledger.locator('.fp-inline-share-editor');
    await share.waitFor();
    assert.equal(await page.locator('.ant-drawer-open').count(), 0);
    await click(share.getByRole('button', { name: '恢复系统占比', exact: true }));
    await click(share.getByRole('button', { name: '取消', exact: true }));
    await click(page.getByText('周汇总', { exact: true }));
    assert.equal(await ledger.locator('thead th.date-head').count(), 3);
    await click(page.getByText('日预测', { exact: true }));
    assert.equal(await ledger.locator('thead th.date-head').count(), 14);

    // Supply explicit model states through the upstream-result adapter, never infer from type codes.
    await page.evaluate(() => {
      const s = window.__forecastTestStore, b = s.getCurrent(), p = b.parentForecastResults[0], days = Object.keys(p.daily);
      s.importDailyModelResults(b.id, p.key, { ...p.daily, [days[0]]: null }, { [days[0]]: '人工启动（待实际销量）' }, '测试上游F10日级结果');
      s.confirmRelations(b.id); s.confirmSplit(b.id);
      s.calibrateBaseline(b.id, 'child', b.childForecastResults[0].childId, { mode: 'ratio', value: 10 }, '测试PMC基准');
    });
    assert.match(await ledger.locator('[data-forecast-line="final"]').first().locator('td.date-col').first().innerText(), /启动/);
    await click(page.getByRole('button', { name: '重新计算', exact: true }));
    await page.locator('.ant-modal-confirm').waitFor();
    assert.match(await page.locator('.ant-modal-confirm').innerText(), /计算范围[\s\S]*父子关系[\s\S]*PMC已保存校准[\s\S]*保留[\s\S]*清除/);
    await click(page.locator('.ant-modal-confirm').getByRole('button', { name: '开始计算' }));
    await page.locator('.ant-modal-confirm').waitFor({ state: 'hidden' });
    await click(page.getByRole('button', { name: '确认发布', exact: true }));
    
    await click(page.locator('.ant-drawer-open').getByRole('button', { name: '确认发起' }));
    await click(page.locator('.ant-modal-confirm .ant-btn-primary'));
    await page.waitForFunction(() => window.ForecastBatchContract.getCurrent().submissionState === '填报中');
    await page.locator('.ant-modal-confirm').waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('button', { name: '重新计算', exact: true }).isDisabled(), true);
    await click(page.locator('[data-view="sales"][data-menu-origin="top-sales"]'));
    const sales = page.locator('.forecast-table:visible');
    await sales.waitFor();
    const row = sales.locator(`[data-child-row="${calibrated.id}"]`);
    for (const line of ['system', 'pmc', 'manual', 'activity', 'final']) assert.ok(await row.locator(`xpath=self::*[@data-forecast-line="${line}"]`).count());
    assert.equal(await row.locator('[data-edit-pmc]').count(), 0);
    assert.match(await row.locator('xpath=self::*[@data-forecast-line="final"]').locator('td.date-col').first().innerText(), /启动/);
    assert.equal(await row.locator('xpath=self::*[@data-forecast-line="manual"]').locator('td.date-col').first().locator('button').count(), 0);
    const data = await page.evaluate(({ id, date }) => {
      const c = findChild(id), dates = visibleDays(), f = forecastAt(c, state.batch, date);
      return { f, sum: aggregate(c, state.batch, dates), expected: dates.map(d => forecastAt(c, state.batch, dateKey(d)).final).filter(v => typeof v === 'number').reduce((s,v) => s+v,0) };
    }, calibrated);
    assert.equal(data.f.final, null); assert.equal(data.sum, data.expected);
    const precedence = await page.evaluate(id => {
      const c=findChild(id), date=dateKey(visibleDays()[1]), draft=batchDraft(c,state.batch), expected=window.ForecastBatchContract.getDailyForecast(state.batch,id,date);
      draft.manual[date]=111; draft.activity[date]={qty:222,name:'测试活动'};
      const activity=forecastAt(c,state.batch,date).final;
      delete draft.activity[date]; const manual=forecastAt(c,state.batch,date).final;
      delete draft.manual[date]; const baseline=forecastAt(c,state.batch,date);
      const snapshot=window.ForecastBatchContract.getForecastIndex(state.batch);
      const relations=displayGroups().every(g=>g.children.every(child=>snapshot.children[[g.market,g.account,child.asin].join('|')]?.parentASIN===g.parent));
      return {activity,manual,baseline,expected,relations};
    },calibrated.id);
    assert.equal(precedence.activity,222); assert.equal(precedence.manual,111);
    assert.equal(precedence.baseline.ai,precedence.expected.systemForecast);
    assert.equal(precedence.baseline.pmc,precedence.expected.pmcBaseline);
    assert.equal(precedence.baseline.final,precedence.expected.pmcBaseline);
    assert.equal(precedence.relations,true,'销售树必须使用快照父子关系');
    assert.match(await page.locator('.sales-window-actions').innerText(), /预测批次：[\s\S]*参数版本：/);
    await page.locator('.ant-message-notice').waitFor({ state: 'hidden' });
    await page.screenshot({ path: '../../evidence/sales-role-baseline-desktop.png' });
    assert.deepEqual(errors, []);
    console.log('Role ledger UI, calibration, readiness, publication and sales state parity passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
