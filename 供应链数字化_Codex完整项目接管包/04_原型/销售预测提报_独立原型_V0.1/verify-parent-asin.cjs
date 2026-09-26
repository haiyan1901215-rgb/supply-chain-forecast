const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:8800/?v=0.3.3-pmc9');
    await page.getByRole('button', { name: '计划配置' }).click();
    await page.getByRole('heading', { name: '父子ASIN拆解' }).waitFor();
    assert.equal(await page.getByRole('tab', { name: '关系版本', exact: true }).count(), 1);
    assert.equal(await page.getByRole('tab', { name: '子体份额调优', exact: true }).count(), 1);
    assert(await page.locator('.decomp-parent-row').count() >= 3);
    assert(await page.getByText('平台同步', { exact: true }).count() > 0);
    assert(await page.getByText('本批次已冻结', { exact: true }).count() > 0);
    assert.equal(await page.locator('.decomp-parent-row').filter({ hasText: 'R01' }).locator('td').nth(8).innerText(), '');

    await page.getByRole('tab', { name: '子体份额调优', exact: true }).click();
    await page.getByRole('columnheader', { name: '系统计算份额', exact: true }).waitFor();
    const firstShare = page.getByRole('spinbutton').first();
    const firstValue = Number(await firstShare.inputValue());
    await firstShare.fill(String(firstValue + 1));
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('button', { name: '保存调优', exact: true }).isDisabled(), true);

    const secondShare = page.getByRole('spinbutton').nth(1);
    const secondValue = Number(await secondShare.inputValue());
    await secondShare.fill(String(secondValue - 1));
    await page.getByRole('button', { name: '保存调优', exact: true }).waitFor({ state: 'visible' });
    assert.equal(await page.getByRole('button', { name: '保存调优', exact: true }).isDisabled(), false);
    await page.getByRole('button', { name: '保存调优', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '保存子体份额调优', exact: true });
    await modal.waitFor();
    await modal.getByRole('textbox', { name: '份额调优原因' }).fill('小众尺码近期结构变化，按业务策略调整份额。');
    await modal.getByRole('button', { name: '保存调优', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    assert.equal(await page.getByText('小众尺码近期结构变化，按业务策略调整份额。', { exact: true }).count(), 1);

    await page.getByRole('button', { name: /查看拆解规则/ }).first().click();
    await page.locator('.ant-drawer').filter({ hasText: '历史份额观察周期' }).waitFor();
    assert.equal(await page.getByText('历史份额观察周期', { exact: true }).count(), 1);
    await page.locator('.ant-drawer-open .ant-drawer-close').click();
    await page.locator('.ant-drawer-open').waitFor({ state: 'hidden' });
    await page.getByRole('tab', { name: '关系版本', exact: true }).click();
    await page.locator('.decomp-table .ant-table-tbody > tr').filter({ hasText: 'B0GRGFFVVN' }).first().getByRole('button', { name: '查看', exact: true }).click();
    await page.locator('.ant-drawer').filter({ hasText: '关系来源' }).waitFor();
    assert(await page.getByText('关系来源', { exact: true }).count() >= 1);
    await page.locator('.ant-drawer-open .ant-drawer-close').click();
    await page.getByRole('button', { name: '销售预测' }).click();
    await page.getByRole('button', { name: '提交本批次', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS parent-child relation tab, frozen snapshot, share validation, adjustment reason, rule drawer, relation drawer, route return, no browser errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
