const { chromium } = require('/Users/yan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  try {
    await page.goto('http://127.0.0.1:8800/reviews/v0.3.3-pmc11/index.html?v=0.3.3-config12');
    await page.evaluate(() => localStorage.removeItem('pmc-planning-config12'));
    await page.reload();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /计划配置/ }).click();
    await page.getByRole('heading', { name: '预测规则', exact: true }).waitFor();
    assert.deepEqual(await page.getByRole('tab').allTextContents(), ['预测规则', '父子关系', '预测参数']);
    assert.equal(await page.getByText('适用场景', { exact: true }).count(), 1);
    assert.equal(await page.getByText('规则命中说明', { exact: true }).count(), 1);

    await page.getByRole('button', { name: /新增拆解规则/ }).click();
    const drawer = page.locator('.ant-drawer-open').filter({ hasText: '新增子ASIN拆解规则' });
    await drawer.getByLabel('规则名称').fill('小众尺码专项规则');
    await drawer.getByLabel('规则编码').fill('S-MINORITY');
    await drawer.getByLabel('生效时间').fill('2026-11-01');
    await drawer.getByText('普通父ASIN', { exact: true }).click();
    await page.getByText('特定业务标签', { exact: true }).last().click();
    await drawer.getByLabel('业务标签').fill('小众尺码');
    await drawer.getByRole('button', { name: '保存为新版本' }).click();
    await drawer.waitFor({ state: 'hidden' });
    await page.getByText('小众尺码专项规则', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pmc-planning-config12')).rules.at(-1).rules.some(r => r.code === 'S-MINORITY')), true);

    await page.getByRole('tab', { name: '父子关系', exact: true }).click();
    await page.getByRole('heading', { name: '父子关系版本', exact: true }).waitFor();
    await page.getByRole('row').filter({ hasText: 'R20261021' }).getByRole('button', { name: '查看', exact: true }).click();
    await page.getByText('计算依据', { exact: true }).waitFor();
    await page.locator('.pc12-cell-link').first().click();
    const readOnlyAlert = page.getByText('该关系版本为只读快照。请为下一预测批次新建关系版本。', { exact: true });
    await readOnlyAlert.waitFor();
    assert.equal(await page.getByRole('button', { name: '保存调配', exact: true }).isDisabled(), true);
    await page.getByText('按子ASIN', { exact: true }).click();
    await page.getByPlaceholder('输入子ASIN反查历史父体').fill('B0GRG5DRWW');
    await page.getByText('历史挂靠关系', { exact: true }).waitFor();
    assert(await page.getByRole('row').filter({ hasText: 'R20261007' }).count() >= 1);

    await page.getByRole('button', { name: /返回版本列表/ }).click();
    await page.getByRole('button', { name: /新建关系版本/ }).click();
    const newVersion = page.locator('.ant-drawer-open').filter({ hasText: '新建父子关系版本' });
    await newVersion.getByLabel('关联预测批次').fill('2026-11-04');
    await newVersion.getByRole('button', { name: '创建草稿' }).click();
    await newVersion.waitFor({ state: 'hidden' });
    await page.getByText('R20261104 · 父子关系版本', { exact: true }).waitFor();
    await page.locator('.pc12-cell-link').first().click();
    const shareInputs = page.getByRole('spinbutton', { name: /最终份额$/ });
    assert(await shareInputs.count() >= 2);
    const first = shareInputs.first();
    const before = Number(await first.inputValue());
    await first.fill(String(before + 1));
    await page.getByRole('combobox', { name: '调整原因' }).click();
    await page.getByText('尺码结构变化', { exact: true }).last().click();
    await page.getByRole('button', { name: '保存调配', exact: true }).click();
    await page.getByText('100.00%', { exact: true }).waitFor();
    const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('pmc-planning-config12')));
    const draft = persisted.versions.find(v => v.id === 'R20261104');
    const group = draft.rows.filter(r => [r.platform, r.country, r.store, r.parent].join('|') === [draft.rows[0].platform, draft.rows[0].country, draft.rows[0].store, draft.rows[0].parent].join('|'));
    assert.equal(group.reduce((n, r) => n + r.final, 0), 10000);
    assert.equal(group.reduce((n, r) => n + r.qty, 0), group[0].parentQty);

    await page.getByRole('button', { name: /调整关系/ }).click();
    const relationDrawer = page.locator('.ant-drawer-open').filter({ hasText: '调整父子关系' });
    await relationDrawer.locator('.ant-form-item').filter({ hasText: '选择子ASIN' }).locator('.ant-select-selector').click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').first().click();
    await relationDrawer.getByLabel('目标父ASIN').fill('B0NEWPOOL1');
    await relationDrawer.getByRole('button', { name: '提交变更' }).click();
    await relationDrawer.waitFor({ state: 'hidden' });
    const afterMove = await page.evaluate(() => JSON.parse(localStorage.getItem('pmc-planning-config12')));
    assert(afterMove.changes.some(c => c.versionId === 'R20261104' && c.type === '子ASIN更换父ASIN'));
    assert.equal(afterMove.versions.find(v => v.id === 'R20261021').status, '已冻结');
    const movedDraft = afterMove.versions.find(v => v.id === 'R20261104');
    const movedTotals = Object.values(movedDraft.rows.reduce((acc, r) => { const key = [r.platform, r.country, r.store, r.parent].join('|'); (acc[key] ||= []).push(r.final); return acc; }, {})).map(values => values.reduce((a, b) => a + b, 0));
    if (movedTotals.some(v => v !== 10000)) console.log('invalid totals after move', movedTotals);

    await page.getByRole('button', { name: '提交确认', exact: true }).click();
    await page.waitForTimeout(400);
    const submittedStatus = await page.evaluate(() => JSON.parse(localStorage.getItem('pmc-planning-config12')).versions.find(v => v.id === 'R20261104').status);
    if (submittedStatus !== '待确认') console.log('transition diagnostics', { submittedStatus, text: (await page.locator('body').innerText()).slice(-1200) });
    assert.equal(submittedStatus, '待确认');
    await page.getByRole('button', { name: '确认生效', exact: true }).click();
    await page.getByRole('button', { name: '冻结版本', exact: true }).click();
    await page.getByRole('dialog', { name: '冻结关系版本？' }).getByRole('button', { name: '确认冻结' }).click();
    await page.getByText('已冻结', { exact: true }).first().waitFor();
    assert.equal(await page.getByRole('button', { name: /调整关系/ }).count(), 0);

    await page.getByRole('tab', { name: '预测参数', exact: true }).click();
    await page.getByRole('heading', { name: '预测参数', exact: true }).waitFor();
    assert.equal(await page.getByText('销售周期', { exact: true }).count() >= 1, true);
    await page.getByRole('button', { name: /销售预测/ }).click();
    await page.getByRole('button', { name: /计算依据/ }).click();
    await page.getByRole('button', { name: 'Split-V2', exact: true }).click();
    await page.getByRole('heading', { name: '预测规则', exact: true }).waitFor();
    await page.getByText('Split-V2 · 2026-10-01 09:00', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('verify-plan-config12: PASS');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
