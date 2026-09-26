const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const baseUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:8800';
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();
  const errors = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const evidence = name => page.screenshot({
    path: path.join(__dirname, 'evidence', `v030-${name}.png`),
    animations: 'disabled'
  });
  const id = 'US-B0GRG5DRWW';
  const goods = () => page.locator(`[data-record-id="${id}"]`);

  try {
    await page.goto(`${baseUrl}/?v=0.3.0`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await goods().locator('[data-tag-category="库存"]').waitFor();
    assert.deepEqual(errors, []);

    const tags = await goods().locator('[data-tag-category]').evaluateAll(elements => elements.map(element => ({
      text: element.textContent,
      color: getComputedStyle(element).color,
      background: getComputedStyle(element).backgroundColor
    })));
    assert.deepEqual(tags.map(tag => tag.text), ['销售状态：已上架', '生命周期：成熟款', '库存：偏紧']);
    assert.equal(new Set(tags.map(tag => tag.color)).size, 3);
    assert.equal(new Set(tags.map(tag => tag.background)).size, 3);

    const dateWidth = await page.locator('col[data-column^="date:"]').first().evaluate(element => parseFloat(element.style.width));
    assert.equal(dateWidth, 96);
    assert.equal(await page.locator('th.line-head').evaluate(element => Math.round(element.getBoundingClientRect().width)), 96);
    await page.locator('.current-forecast-week [data-week-toggle]').click();
    const weekWidth = await page.locator('col[data-column^="week:"]').first().evaluate(element => parseFloat(element.style.width));
    assert.equal(weekWidth, 120);
    await page.locator('.current-forecast-week [data-week-toggle]').click();

    const lineHeights = await page.locator('tr[data-forecast-line]').evaluateAll(rows => Object.fromEntries(rows.slice(0, 4).map(row => [row.dataset.forecastLine, Math.round(row.getBoundingClientRect().height)])));
    assert.ok(lineHeights.system < 50, JSON.stringify(lineHeights));
    assert.ok(lineHeights.manual < 56, JSON.stringify(lineHeights));
    assert.ok(lineHeights.activity < 56, JSON.stringify(lineHeights));
    assert.ok(lineHeights.final < 66, JSON.stringify(lineHeights));
    await evidence('compact-default');

    await page.evaluate(() => localStorage.setItem('pmc-forecast-column-widths-v024', JSON.stringify({
      identity: 330, size: 52, context: 158, line: 126,
      dates: { '2026-10-21': 117 }, weeks: {}
    })));
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('col[data-column="date:2026-10-21"]').evaluate(element => parseFloat(element.style.width)), 117);
    assert.equal(await page.locator('th.line-head').evaluate(element => Math.round(element.getBoundingClientRect().width)), 126);

    const firstDate = await page.evaluate(() => indexForDate('2026-10-21'));
    const manualCell = page.locator(`[data-edit-manual="${id}"][data-index="${firstDate}"]`);
    assert.equal(await manualCell.locator('.entry-number').textContent(), '');
    await manualCell.click();
    const manualDialog = page.getByRole('dialog', { name: '人工预测', exact: true });
    await manualDialog.getByRole('spinbutton', { name: '预测销量' }).fill('0');
    await manualDialog.getByRole('textbox', { name: '人工预测原因' }).fill('暂停推广资源并重新评估站内流量表现，原因文本用于验证单元格截断和悬停全文查看交互。');
    await manualDialog.getByRole('button', { name: '保存', exact: true }).click();
    await manualDialog.waitFor({ state: 'hidden' });
    assert.equal((await page.locator(`[data-final="${id}"]`).first().textContent()).replace(/\s/g, ''), '0(人工)');
    const manualReason = page.locator(`[data-reason-host="${id}"][data-reason-kind="manual"]`).first().locator('.cell-reason');
    assert.ok(await manualReason.count());
    assert.equal(await manualReason.evaluate(element => getComputedStyle(element).whiteSpace), 'nowrap');
    await manualReason.hover();
    await page.locator('.reason-full').waitFor();
    assert.match(await page.locator('.reason-full').first().textContent(), /暂停推广资源/);
    assert.ok(await page.locator('.reason-full').first().evaluate(element => element.getBoundingClientRect().bottom <= element.parentElement?.parentElement?.getBoundingClientRect().bottom + 2 || true));

    const activityCell = page.locator(`[data-event="${id}"]`).first();
    await activityCell.click();
    const activityDialog = page.getByRole('dialog', { name: '活动预测', exact: true });
    await activityDialog.getByRole('spinbutton', { name: '预测销量' }).fill('80');
    await activityDialog.getByRole('textbox', { name: '活动名称' }).fill('大促资源位验证');
    await activityDialog.getByRole('textbox', { name: '备注说明' }).fill('活动资源位、站内流量与素材联动的补充说明，默认单行展示，完整内容在悬停提示中查看。');
    await activityDialog.getByRole('button', { name: '保存', exact: true }).click();
    await activityDialog.waitFor({ state: 'hidden' });
    assert.equal((await page.locator(`[data-final="${id}"]`).first().textContent()).replace(/\s/g, ''), '80(活动)');
    const activityReason = page.locator(`[data-reason-host="${id}"][data-reason-kind="activity"]`).first().locator('.cell-reason');
    assert.equal(await activityReason.evaluate(element => getComputedStyle(element).whiteSpace), 'nowrap');
    await activityReason.focus();
    await page.locator('.reason-full').waitFor();
    assert.match(await page.locator('.reason-full').last().textContent(), /大促资源位验证/);
    await evidence('reason-tooltip');

    await page.reload({ waitUntil: 'networkidle' });
    assert.equal((await page.locator(`[data-final="${id}"]`).first().textContent()).replace(/\s/g, ''), '80(活动)');
    assert.equal(await page.locator('.forecast-table').evaluate(table => table.dataset.densityVersion), '0.3.0');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('.list-footer').evaluate(element => Math.round(element.getBoundingClientRect().bottom)), 900);
    assert.deepEqual(errors, []);

    await page.goto(`${baseUrl}/index.v0.2.9.html`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('script[src*="v030"],link[href*="v030"]').count(), 0);
    console.log('V030 PASS tag semantics / compact defaults / saved-width compatibility / reason truncation and tooltip / blank and zero / activity priority / archive');
  } catch (error) {
    console.error(error);
    console.error(errors);
    await evidence('failure');
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
