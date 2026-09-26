const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:8800/reviews/v0.3.3-pmc11/index.html?v=0.3.3-pmc11');
    for (const label of ['待PMC审核', '已确认', '销售退回', '待销售提报', '按实际数据']) {
      await page.locator('.ant-select[aria-label="切换流程演示状态"]').click({ force: true });
      await page.locator('.ant-select-item-option-content').filter({ hasText: label }).click();
      await page.locator('.ant-select[aria-label="切换流程演示状态"] .ant-select-selection-item').filter({ hasText: label }).waitFor();
    }
    await page.getByRole('button', { name: '计划配置' }).click();
    await page.getByRole('heading', { name: '计划配置' }).waitFor();
    for (const label of ['预测规则', '拆解规则', '关系维护', '人工调优', '参数版本']) {
      assert.equal(await page.getByRole('tab', { name: label, exact: true }).count(), 1);
    }
    assert.equal(await page.getByText('成长款默认预测', { exact: true }).count(), 1);

    await page.getByRole('button', { name: '新建预测规则', exact: true }).click();
    await page.locator('.ant-drawer-open').filter({ hasText: '新建预测规则' }).waitFor();
    await page.locator('.ant-drawer-open .ant-drawer-close').click();

    await page.getByRole('tab', { name: '拆解规则', exact: true }).click();
    assert.equal(await page.getByText('低销量不稳定调和', { exact: true }).count(), 1);
    await page.getByRole('button', { name: '新建拆解规则', exact: true }).click();
    await page.locator('.ant-drawer-open').filter({ hasText: '新建拆解规则' }).waitFor();
    assert.equal(await page.getByText('规则示例', { exact: true }).count(), 1);
    await page.locator('.ant-drawer-open .ant-drawer-close').click();

    await page.getByRole('tab', { name: '关系维护', exact: true }).click();
    assert(await page.locator('.decomp-parent-row').count() >= 3);
    assert(await page.getByText('平台同步', { exact: true }).count() > 0);
    await page.locator('.decomp-parent-row').first().getByRole('button', { name: '批量迁移', exact: true }).click();
    await page.locator('.ant-drawer-open').filter({ hasText: '批量调整父子关系' }).waitFor();
    await page.locator('.ant-drawer-open .ant-drawer-close').click();

    await page.getByRole('tab', { name: '人工调优', exact: true }).click();
    await page.getByRole('columnheader', { name: '系统计算份额', exact: true }).waitFor();
    const firstShare = page.getByRole('spinbutton').first();
    const firstValue = Number(await firstShare.inputValue());
    await firstShare.fill(String(firstValue + 1));
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('button', { name: '保存调优', exact: true }).isDisabled(), true);
    const secondShare = page.getByRole('spinbutton').nth(1);
    const secondValue = Number(await secondShare.inputValue());
    await secondShare.fill(String(secondValue - 1));
    await page.getByRole('button', { name: '保存调优', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '保存子体份额调优', exact: true });
    await modal.waitFor();
    await modal.getByRole('textbox', { name: '份额调优原因' }).fill('小众尺码近期结构变化，按业务策略调整份额。');
    await modal.getByRole('button', { name: '保存调优', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    assert.equal(await page.getByText('小众尺码近期结构变化，按业务策略调整份额。', { exact: true }).count(), 1);

    await page.getByRole('tab', { name: '参数版本', exact: true }).click();
    assert.equal(await page.getByText('V1.1', { exact: true }).count() >= 1, true);
    await page.getByRole('button', { name: '查看差异', exact: true }).first().click();
    await page.locator('.ant-drawer-open').filter({ hasText: '参数版本差异' }).waitFor();
    await page.locator('.ant-drawer-open .ant-drawer-close').click();

    await page.locator('.menu button').first().click();
    await page.getByRole('button', { name: '提交本批次', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS plan config five tabs, rule editors, relation migration drawer, share validation, parameter version snapshot, route return, no browser errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
