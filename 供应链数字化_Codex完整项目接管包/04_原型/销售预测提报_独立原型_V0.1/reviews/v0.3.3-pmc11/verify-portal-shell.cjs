const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.26-portal-shell-menu';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.clear());
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('.forecast-table').waitFor();

    assert.equal(await page.locator('[data-view="sales"][data-menu-origin="top-sales"]').count(), 1, '原销售预测一级菜单必须保留');
    assert.equal(await page.locator('[data-menu-toggle="planning"]').count(), 1, '计划配置必须是一个可展开分组');

    const shell = await page.evaluate(() => {
      const rect = selector => Math.round(document.querySelector(selector).getBoundingClientRect().height);
      const width = selector => Math.round(document.querySelector(selector).getBoundingClientRect().width);
      return {
        sider: width('.sider'),
        topbar: rect('.topbar'),
        crumbbar: rect('.crumbbar'),
        logoWidth: document.querySelector('.brand-logo-full')?.naturalWidth || 0,
        tabsInTopbar: !!document.querySelector('.topbar .workspace-tabs-v028'),
      };
    });
    assert.equal(shell.sider, 224, '桌面侧栏必须为门户基准 224px');
    assert.equal(shell.topbar, 40, '全局顶部栏必须为门户基准 40px');
    assert.equal(shell.crumbbar, 36, '面包屑行必须独立占 36px');
    assert.ok(shell.logoWidth > 0, '门户 Logo 必须加载成功');
    assert.equal(shell.tabsInTopbar, true, '销售工作页签必须嵌入全局顶部栏');

    await page.locator('[data-menu-toggle="planning"]').click();
    const submenu = page.locator('#planning-submenu');
    await submenu.waitFor({ state: 'visible' });
    assert.deepEqual(await submenu.locator('[data-view]').allTextContents(), ['销售预测', '预测批次列表'], '计划配置下必须只有两个平级二级菜单');

    await submenu.locator('[data-view="sales"][data-menu-origin="plan-sales"]').click();
    await page.locator('.forecast-table').waitFor();
    assert.equal((await page.locator('.crumb b').innerText()).trim(), '销售预测', '计划配置下销售预测应复用销售预测工作区');
    assert.equal(await page.locator('[data-view="sales"][data-menu-origin="plan-sales"]').evaluate(el => el.classList.contains('active')), true, '二级销售预测入口应显示激活态');
    assert.equal(await page.locator('[data-menu-group="planning"]').evaluate(el => el.classList.contains('is-active')), true, '计划配置父级应保留激活上下文');

    await page.locator('#planning-submenu [data-view="decomposition"]').click();
    await page.getByRole('button', { name: '2026-09-29 预测批次', exact: true }).waitFor();
    assert.equal((await page.locator('.crumb b').innerText()).trim(), '预测批次列表', '预测批次列表应进入现有计划配置列表');
    assert.equal(await page.locator('.topbar-route-label').isVisible(), true, '计划配置路由应显示顶部工作区上下文');
    assert.equal(await page.locator('.workspace-tabs-v028').isVisible(), false, '计划配置不应显示旧状态机页签区');

    await page.locator('[data-view="sales"][data-menu-origin="top-sales"]').click();
    await page.locator('.forecast-table').waitFor();
    await page.locator('[data-shell-action="toggle-user"]').click();
    assert.equal(await page.locator('.user-menu').isVisible(), true, '用户中心应可展开');
    assert.equal(await page.getByRole('menuitem', { name: '个人中心' }).count(), 1);
    await page.locator('[data-action="toggle-sidebar"]').click();
    await page.waitForFunction(() => Math.round(document.querySelector('.sider').getBoundingClientRect().width) === 72);
    assert.equal(await page.evaluate(() => Math.round(document.querySelector('.sider').getBoundingClientRect().width)), 72, '侧栏收起宽度应为 72px');
    await page.locator('[data-action="toggle-sidebar"]').click();
    await page.waitForFunction(() => Math.round(document.querySelector('.sider').getBoundingClientRect().width) === 224);
    assert.equal(await page.evaluate(() => Math.round(document.querySelector('.sider').getBoundingClientRect().width)), 224, '侧栏展开宽度应恢复 224px');

    assert.deepEqual(errors, [], '壳层交互不应产生页面异常');
    await page.screenshot({ path: '../../evidence/portal-shell-menu-desktop.png', fullPage: false });
    console.log('Portal shell and nested menu verification passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
