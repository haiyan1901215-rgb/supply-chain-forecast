const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({channel:'chrome', headless:true});
  const context = await browser.newContext({viewport:{width:1366,height:768}, permissions:['clipboard-read','clipboard-write']});
  const page = await context.newPage(), errors=[];
  page.on('pageerror', error=>errors.push(error.message));
  const shot = name=>page.screenshot({path:path.join(__dirname,'evidence',name+'.png')});
  const range = ()=>page.locator('#rangeDisplay').textContent();
  const final = i=>page.locator(`[data-final="B08MDW2H86"][data-index="${i}"]`);
  const code = label=>page.locator(`[data-code-tip^="${label} ·"] .code-text`).first();
  try {
    await page.goto('http://127.0.0.1:8800/?v=0.1.7');
    await page.locator('.product-action').first().waitFor();
    for(const width of [1366,1440,1920]) {
      await page.setViewportSize({width,height:width===1366?768:900});
      const layout=await page.evaluate(()=>{
        const r=s=>document.querySelector(s).getBoundingClientRect();
        const a=r('.range-current'),b=r('.range-nav'),c=r('.range-tabs'),m=r('.range-meta');
        const coverage=getComputedStyle(document.querySelector('#coverageRange')), current=getComputedStyle(document.querySelector('#rangeDisplay'));
        return {overflow:document.documentElement.scrollWidth>innerWidth, order:a.right<=b.left && b.right<=c.left && c.right<m.left, footer:r('.list-footer').bottom, height:innerHeight, bar:r('.range-bar').height, typography:coverage.fontSize===current.fontSize && coverage.fontWeight===current.fontWeight};
      });
      assert.equal(layout.overflow,false); assert.equal(layout.order,true); assert.equal(layout.footer,layout.height); assert.ok(layout.bar<=46); assert.equal(layout.typography,true);
      console.log('layout',width,JSON.stringify(layout));
    }
    await page.setViewportSize({width:1366,height:768});
    await shot('v017-default');
    assert.equal(await page.locator('.identity-cell [title]').count(),0);
    for (const label of ['Parent ASIN','SPU','Child ASIN','SKU','SKC']) {
      await code(label).hover();
      await page.locator('#codeTooltip:not([hidden])').waitFor();
      assert.equal(await page.locator('[role="tooltip"]:visible').count(),1);
      assert.ok((await page.locator('#codeTooltip').textContent()).startsWith(label+' ·'));
    }
    await shot('v017-code-tooltip');
    await code('Parent ASIN').hover();
    await page.locator('#codeTooltip:not([hidden])').waitFor();
    await page.getByRole('button',{name:'复制Parent ASIN B08XXXX91',exact:true}).hover();
    assert.equal(await page.locator('[role="tooltip"]:visible').count(),1);
    await page.getByRole('button',{name:'复制Parent ASIN B08XXXX91',exact:true}).click();
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'B08XXXX91');
    await page.mouse.move(1000,80);
    assert.equal(await page.locator('[role="tooltip"]:visible').count(),0);
    await code('SPU').focus();
    assert.ok((await page.locator('#codeTooltip').textContent()).startsWith('SPU ·'));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#codeTooltip').isVisible(),false);
    await page.locator('.thumb').first().hover();
    assert.equal(await page.locator('#imagePreview').isVisible(),true);
    assert.equal(await page.locator('#codeTooltip').isVisible(),false);
    await page.mouse.move(1000,80);
    console.log('tooltip: one instance, code/copy shared, all five types, focus, escape and image mutual exclusion PASS');

    const widthBefore=await page.locator('.identity-head').evaluate(e=>e.getBoundingClientRect().width);
    const handle=await page.locator('[data-resize-column="identity"]').boundingBox();
    await page.mouse.move(handle.x+4,handle.y+25); await page.mouse.down(); await page.mouse.move(handle.x+36,handle.y+25); await page.mouse.up();
    const widthAfter=await page.locator('.identity-head').evaluate(e=>e.getBoundingClientRect().width);
    assert.equal(widthAfter,widthBefore+32);
    await page.getByRole('button',{name:'向后切换窗口',exact:true}).click();
    assert.equal(await range(),'2026/11/04 - 2026/11/17');
    await page.getByRole('button',{name:'向前切换窗口',exact:true}).click();
    await page.getByRole('button',{name:'30天',exact:true}).click();
    assert.equal(await range(),'2026/10/21 - 2026/11/19');
    assert.equal(await page.locator('.date-head').count(),30);
    assert.equal(await page.locator('.identity-head').evaluate(e=>e.getBoundingClientRect().width),widthAfter);
    await page.getByRole('button',{name:'向后切换窗口',exact:true}).click();
    assert.equal(await range(),'2026/11/20 - 2026/12/19');
    await page.getByRole('button',{name:'选择当前查看窗口',exact:true}).click();
    await page.locator('#rangeStart').fill('2026-12-28'); await page.locator('#rangeEnd').fill('2027-01-10');
    await page.getByRole('button',{name:'确定',exact:true}).click();
    assert.equal(await range(),'2026/12/28 - 2027/01/10');
    assert.deepEqual(await page.locator('.week-head').allTextContents(),['W53 · 12/28-1/03','W1 · 1/04-1/10']);
    console.log('date windows: 14 / 30 day steps, custom range, year boundary ISO week, manual width retained PASS');

    await page.reload();
    await page.locator('[data-edit-manual="B08MDW2H86"][data-index="0"]').click();
    await page.locator('[data-manual]').fill('35'); await page.locator('[data-manual]').press('Enter');
    assert.equal((await final(0).innerText()).replace(/\s+/g,''),'35人工');
    await page.locator('[data-edit-manual="B08MDW2H86"][data-index="2"]').click();
    await page.locator('[data-manual]').fill('35'); await page.locator('[data-manual]').press('Enter');
    assert.equal((await final(2).innerText()).replace(/\s+/g,''),'80活动');
    await page.locator('[data-edit-manual="B08MDW2H86"][data-index="1"]').hover();
    const cross=await page.evaluate(()=>{const e=document.querySelector('.focus-cross-cell'),style=getComputedStyle(e);return {row:style.getPropertyValue('--cross-row').trim(),column:style.getPropertyValue('--cross-column').trim(),final:document.querySelector('td.line-final.focus-cross-column')!==null};});
    assert.notEqual(cross.row,'transparent'); assert.notEqual(cross.column,'transparent'); assert.equal(cross.final,true);
    await shot('v017-cross-highlight');
    console.log('forecast regression: input alignment retained, manual overrides AI, activity overrides manual, cross highlight PASS');

    await page.locator('[data-insight="sales"][data-asin="B08MDW2H86"]').click();
    assert.equal(await page.locator('#drawerTitle').textContent(),'销售趋势');
    assert.match(await page.locator('#drawerBody').textContent(),/870 件/);
    assert.equal(await page.locator('.trend-chart polyline').count(),1);
    await page.locator('#drawer [data-insight="analysis"]').click();
    assert.equal(await page.locator('#drawerTitle').textContent(),'预测分析');
    assert.equal(await page.locator('.trend-chart polyline').count(),2);
    await shot('v017-forecast-analysis');
    await page.locator('#drawer [data-insight="mapping"]').click();
    assert.equal(await page.locator('.mapping-table tbody tr').count(),2);
    await page.locator('#drawer [data-insight="product"]').click();
    assert.match(await page.locator('#drawerBody').textContent(),/2025\/10\/10/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#drawer').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.insight),'sales');
    console.log('product entries: sales chart, live forecast analysis, mappings, profile and focus return PASS');

    const headBefore=await page.locator('.identity-head').boundingBox();
    await page.locator('#workbench').hover(); await page.mouse.wheel(0,460); await page.waitForTimeout(150);
    const headAfter=await page.locator('.identity-head').boundingBox();
    assert.equal(headBefore.y,headAfter.y);
    const fixed=await page.evaluate(()=>({footer:document.querySelector('.list-footer').getBoundingClientRect().bottom,scroll:document.querySelector('.horizontal-scrollbar').getBoundingClientRect().bottom,height:innerHeight}));
    assert.equal(fixed.footer,fixed.height); assert.equal(fixed.scroll,fixed.height-46);
    assert.deepEqual(errors,[]);
    console.log('fixed header/footer/scrollbar and console checks PASS');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
