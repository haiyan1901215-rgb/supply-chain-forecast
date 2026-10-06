const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://127.0.0.1:8816/index.html?v=0.3.50-demand-forecast-menu';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.clear());
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('.forecast-batch-list-root').waitFor();

    assert.equal(await page.locator('[data-menu-toggle="demand-forecast"]').count(), 1, '需求预测必须是一个可展开业务域');
    assert.equal(await page.locator('[data-menu-toggle="planning"]').count(), 0, '不得保留旧计划配置分组');
    assert.equal(await page.locator('[data-view="sales"][data-menu-origin="top-sales"]').count(), 1, '销售预测必须作为需求预测下的二级对象入口');

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

    const submenu = page.locator('#demand-forecast-submenu');
    await submenu.waitFor({ state: 'visible' });
    assert.deepEqual(await submenu.locator('[data-view]').allTextContents(), ['预测批次', '销售预测'], '需求预测下必须只有预测批次和销售预测两个业务对象');

    await submenu.locator('[data-view="sales"][data-menu-origin="top-sales"]').click();
    await page.locator('.sales-forecast-list-root').waitFor();
    assert.equal((await page.locator('.crumb b').innerText()).trim(), '销售预测列表', '销售预测入口应先进入销售预测列表');
    assert.equal(await page.locator('[data-view="sales"][data-menu-origin="top-sales"]').evaluate(el => el.classList.contains('active')), true, '销售预测二级入口应显示激活态');
    assert.equal(await page.locator('[data-menu-group="demand-forecast"]').evaluate(el => el.classList.contains('is-active')), true, '需求预测父级应保留激活上下文');

    await submenu.locator('[data-view="forecast-workbench"][data-menu-origin="top-forecast-workbench"]').click();
    await page.locator('.forecast-batch-list-root').waitFor();
    assert.equal((await page.locator('.crumb b').innerText()).trim(), '预测批次列表', '预测批次入口应进入预测批次列表');
    assert.equal(await page.locator('.topbar-route-label').isVisible(), false, '需求预测业务域不应再显示旧计划配置路由标签');
    assert.equal(await page.locator('.workspace-tabs-v028').isVisible(), true, '预测批次应保留工作页签上下文');

    await page.locator('[data-view="sales"][data-menu-origin="top-sales"]').click();
    await page.locator('.sales-forecast-list-root').waitFor();
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
