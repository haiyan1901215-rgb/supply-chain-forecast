const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2];
if (!url) throw Error('Provide the local PMC prototype URL');

async function domClick(locator) {
  await locator.waitFor({ state: 'attached' });
  await locator.evaluate(element => element.click());
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-menu-toggle="planning"]').click();
    await page.locator('[data-view="decomposition"][data-menu-origin="plan-batches"]').click();
    await page.getByRole('button', { name: '2026-09-29 预测批次', exact: true }).evaluate(button => button.click());
    const ledger = page.locator('.fp-pmc-forecast-table');
    await ledger.waitFor();

    const initial = await page.evaluate(() => window.ForecastBatchContract.getCurrent());
    assert.equal(initial.resultState, '待生成');
    assert.equal(initial.relationConfirmed, false);
    assert.equal(await page.locator('.fp-pmc-function-row input[type="file"]:not([disabled])').count(), 1, '待生成状态应支持在台账左上直接导入覆盖');
    assert.equal(await page.getByRole('button', { name: '父子关系', exact: true }).count(), 1, '待生成状态应支持关系维护');

    const firstRow = ledger.locator('[data-child-row][data-forecast-line="system"]').first();
    await domClick(firstRow.getByRole('button', { name: /^父体占比 / }));
    await domClick(ledger.getByRole('button', { name: '调整本组子体份额', exact: true }));
    const shareDrawer = ledger.locator('.fp-inline-share-editor');
    assert.equal(await page.locator('.ant-drawer-open').count(), 0, '份额调整必须保留列表上下文');
    const firstShare = shareDrawer.locator('input.ant-input-number-input').first();
    await firstShare.fill('25');
    assert.match(await shareDrawer.innerText(), /最终份额合计 (?!100\.00%)/);
    await domClick(shareDrawer.getByRole('button', { name: '重新归一化', exact: true }));
    assert.match(await shareDrawer.innerText(), /最终份额合计 100\.00%/);
    await shareDrawer.getByPlaceholder('必填，写明人工调配依据').fill('本批次复核');
    await domClick(shareDrawer.getByRole('button', { name: '保存份额', exact: true }));
    await shareDrawer.waitFor({ state: 'hidden' });
    const afterShare = await page.evaluate(() => window.ForecastBatchContract.getCurrent());
    assert.equal(afterShare.relationConfirmed, false, '份额调整不应隐式确认父子关系');
    assert.ok(afterShare.adjustmentLog.some(item => item.type === '子ASIN份额'));

    const refreshedFirstRow = ledger.locator('[data-child-row][data-forecast-line="system"]').first();
    await domClick(refreshedFirstRow.locator('button[aria-label$="更多操作"]'));
    await domClick(page.locator('.ant-dropdown:visible').getByText('维护预测标签', { exact: true }));
    const tagDrawer = page.locator('.ant-drawer-open');
    await tagDrawer.locator('.ant-select').first().click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: '成长' }).click();
    await tagDrawer.getByPlaceholder('说明标签调整依据').fill('人工复核商品阶段');
    await domClick(tagDrawer.getByRole('button', { name: '保存标签', exact: true }));
    await tagDrawer.waitFor({ state: 'hidden' });
    const afterTag = await page.evaluate(() => window.ForecastBatchContract.getCurrent());
    assert.ok(afterTag.adjustmentLog.some(item => item.type === '预测标签'));
    assert.ok(afterTag.childForecastResults.some(item => item.tagOverrides?.productStage === '成长'));
    assert.equal(afterTag.resultState, '待生成');

    const files = [
      ['/Users/yan/Desktop/父体标签结果.xlsx', '9 行', '42 列'],
      ['/Users/yan/Desktop/子体标签与90天预测结果.xlsx', '12 行', '29 列'],
      ['/Users/yan/Desktop/季节大盘指数库_第3版_含季节运行规则.xlsx', '31 行', '15 列']
    ];
    for (const [file, rows, fields] of files) {
      await page.locator('.fp-pmc-function-row input[type="file"]').setInputFiles(file);
      const drawer = page.locator('.ant-drawer-open');
      await drawer.getByText(rows, { exact: true }).first().waitFor();
      assert.match(await drawer.innerText(), new RegExp(fields));
      assert.match(await drawer.innerText(), /可覆盖/);
      await domClick(drawer.getByRole('button', { name: '仅保存来源快照', exact: true }));
      await drawer.waitFor({ state: 'hidden' });
    }

    const refs = await page.evaluate(() => window.ForecastBatchContract.getCurrent().sourceReferences);
    assert.equal(refs.parent.rows.length, 9);
    assert.equal(refs.child.rows.length, 12);
    assert.equal(refs.season.rows.length, 31);
    assert.equal(refs.rules.rows.length, 2);
    assert.equal(refs.parent.matchedRows, 0);
    assert.equal(refs.child.matchedRows, 0);
    assert.equal(refs.season.matchedRows, 1);
    assert.equal(refs.rules.matchedRows, 0);

    await domClick(page.getByRole('button', { name: '更多', exact: true }));
    await domClick(page.locator('.ant-dropdown:visible').getByText('字段来源', { exact: true }));
    const sourcesDrawer = page.locator('.ant-drawer-open');
    await sourcesDrawer.getByText('预测截止日', { exact: true }).waitFor();
    await sourcesDrawer.locator('div.ant-select[aria-label="父体标签结果来源记录"]').click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').nth(1).click();
    assert.match(await sourcesDrawer.innerText(), new RegExp(refs.parent.rows[1]['父体ASIN']));
    await domClick(sourcesDrawer.locator('.ant-drawer-close'));
    assert.deepEqual(errors, []);
    console.log('PMC inline edit and workbook-source verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
