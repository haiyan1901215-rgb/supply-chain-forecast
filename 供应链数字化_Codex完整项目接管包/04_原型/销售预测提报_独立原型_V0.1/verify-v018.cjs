const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:900},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const shot=name=>page.screenshot({path:path.join(__dirname,'evidence',name+'.png')});
  const range=()=>page.locator('#rangeDisplay').textContent();
  const day=label=>page.locator(`#rangeEditor [data-calendar-own="true"][aria-label="${label}"]`);
  const toggle=key=>page.locator(`[data-week-toggle="${key}"]`);
  const manual=i=>page.locator(`[data-edit-manual="B08MDW2H86"][data-index="${i}"]`);
  const final=i=>page.locator(`[data-final="B08MDW2H86"][data-index="${i}"]`);
  const note='活动备货说明：<常规>，关注10/23销量';
  try {
    await page.goto('http://127.0.0.1:8800/?v=0.1.8');
    await page.locator('.size-head').waitFor();
    assert.deepEqual(await page.locator('.size-value').allTextContents(),['M','L','S','M','S','M']);
    const childInfo=await page.locator('.identity-cell[rowspan]').first().textContent();
    assert.ok(!childInfo.includes('黑色')&&!childInfo.includes('SZ25060 '));
    assert.match(await page.locator('.parent-shared').first().textContent(),/SZ25060（黑色）销售：李敏/);
    assert.equal(await page.locator('.identity-cell[rowspan] [data-code-tip^="SKC"]').count(),0);
    assert.ok(childInfo.includes('生命周期：成熟款')&&childInfo.includes('库存：偏紧'));
    for(const selector of ['.parent-owner','.parent-color [data-hint]','.size-value','.product-tags .pill.blue','.product-tags .pill.amber']){
      await page.locator(selector).first().hover();await page.locator('#codeTooltip:not([hidden])').waitFor();
      assert.equal(await page.locator('[role="tooltip"]:visible').count(),1);
      assert.ok((await page.locator('#codeTooltip').textContent()).length>3);
    }
    await page.mouse.move(1150,70); await shot('v018-default');
    console.log('product hierarchy, role/category hints and independent sizes PASS');

    await page.locator('[data-note-edit="B08MDW2H86"]').click();
    await page.locator('[data-note-input="B08MDW2H86"]').fill(note);
    await page.locator('[data-note-save="B08MDW2H86"]').click();
    assert.equal(await page.locator('[data-note-edit="B08MDW2H86"] .note-text').textContent(),note);
    await page.reload();
    assert.equal(await page.locator('[data-note-edit="B08MDW2H86"] .note-text').textContent(),note);
    await page.locator('[data-note-edit="B08MDW2H86"]').click();
    await page.locator('[data-note-input]').fill('取消的备注');
    await page.locator('[data-note-cancel]').click();
    assert.equal(await page.locator('[data-note-edit="B08MDW2H86"] .note-text').textContent(),note);
    await page.locator('[data-note-edit="B08MDW2H86"]').click();
    await page.locator('[data-note-input]').fill('');await page.locator('[data-note-save]').click();
    assert.equal(await page.locator('[data-note-edit="B08MDW2H86"] .note-text').textContent(),'添加备注');
    console.log('notes save/reload/cancel/clear and text escaping PASS');

    for(const [i,value] of [[0,'35'],[1,'0'],[2,'35']]){await manual(i).click();await page.locator('[data-manual]').fill(value);await page.locator('[data-manual]').press('Enter');}
    assert.equal((await final(1).innerText()).replace(/\s/g,''),'0人工');
    assert.equal((await final(2).innerText()).replace(/\s/g,''),'80活动');
    const handle=await page.locator('[data-resize-column="date:2026-10-21"]').boundingBox();
    await page.mouse.move(handle.x+3,handle.y+10);await page.mouse.down();await page.mouse.move(handle.x+23,handle.y+10);await page.mouse.up();
    const dayWidth=await page.locator('col[data-column="date:2026-10-21"]').evaluate(e=>e.style.width);
    await page.locator('[data-row-check="B08MDW2H86"]').check();
    await toggle('2026-W43').click();
    assert.equal(await page.locator('.date-head').count(),10);
    const rows=await page.locator('td[data-time-column="week:2026-W43"]').allTextContents();
    assert.deepEqual(rows.slice(0,5).map(s=>s.replace(/\s/g,'')),['321','161','70已填3/5天','80已填1/5天','180混合']);
    assert.equal(await page.locator('td.week-total.entry-cell').count(),0);
    assert.equal(await page.locator('[data-row-check="B08MDW2H86"]').isChecked(),true);
    await shot('v018-week-collapsed');
    await page.locator('td.week-total.line-manual').first().hover();
    const cross=await page.locator('.focus-cross-cell').evaluate(e=>({row:getComputedStyle(e).getPropertyValue('--cross-row'),column:getComputedStyle(e).getPropertyValue('--cross-column')}));
    assert.notEqual(cross.row.trim(),'transparent');assert.notEqual(cross.column.trim(),'transparent');
    assert.ok(await page.locator('.line-final.focus-cross-column').count()>0);
    await page.locator('[data-week-detail="2026-W43"][data-asin="B08MDW2H86"]').click();
    assert.equal(await page.locator('.mapping-table tbody tr').count(),6);
    assert.match(await page.locator('.mapping-table tbody tr').last().textContent(),/合计1617080180/);
    await page.keyboard.press('Escape');
    await toggle('2026-W43').click();
    assert.equal(await page.locator('col[data-column="date:2026-10-21"]').evaluate(e=>e.style.width),dayWidth);
    assert.equal((await final(1).innerText()).replace(/\s/g,''),'0人工');
    await toggle('2026-W43').click();await toggle('2026-W44').click();await toggle('2026-W45').click();
    assert.equal(await page.locator('.date-head').count(),3);
    assert.equal(await page.locator('.week-head').count(),3);
    assert.equal(await page.locator('td.week-boundary').first().evaluate(e=>getComputedStyle(e).borderLeftWidth),'2px');
    console.log('week folding: partial week, zero/blank, priority before sum, group totals, selection and widths PASS');

    await page.getByRole('button',{name:'选择当前查看窗口',exact:true}).click();
    assert.equal(await page.locator('.calendar-month').count(),2);
    assert.equal(await page.locator('.calendar-day.endpoint').count(),2);
    assert.deepEqual(await page.locator('.calendar-head strong').allTextContents(),['2026 年 10 月','2026 年 11 月']);
    assert.equal(await day('2026/10/20').isEnabled(),false);
    await shot('v018-date-range-picker');
    await day('2026/10/24').click();assert.equal(await range(),'2026/10/21 - 2026/11/03');
    await page.locator('[data-calendar-apply]').click();assert.match(await page.locator('.calendar-selection').textContent(),/请选择结束日期/);
    await day('2026/11/08').click();await page.locator('[data-calendar-cancel]').click();
    assert.equal(await range(),'2026/10/21 - 2026/11/03');
    await page.getByRole('button',{name:'选择当前查看窗口',exact:true}).click();
    await day('2026/11/05').click();await day('2026/10/28').click();await page.locator('[data-calendar-apply]').click();
    assert.equal(await range(),'2026/10/28 - 2026/11/05');
    await page.getByRole('button',{name:'选择当前查看窗口',exact:true}).click();
    await page.locator('[data-calendar-shift="1"]').click();await page.locator('[data-calendar-shift="1"]').click();
    await day('2026/12/28').click();await day('2027/01/10').click();await page.locator('[data-calendar-apply]').click();
    assert.equal(await range(),'2026/12/28 - 2027/01/10');
    assert.deepEqual(await page.locator('.week-toggle').evaluateAll(els=>els.map(e=>e.dataset.weekToggle)),['2026-W53','2027-W1']);
    await toggle('2026-W53').click();await toggle('2027-W1').click();assert.equal(await page.locator('.date-head').count(),2);
    await page.getByRole('button',{name:'选择当前查看窗口',exact:true}).click();
    await page.locator('[data-calendar-preset="all"]').click();await page.locator('[data-calendar-apply]').click();
    assert.equal(await range(),'2026/10/21 - 2027/04/20');
    await page.getByRole('button',{name:'选择当前查看窗口',exact:true}).click();
    await page.locator('[data-calendar-preset="14"]').click();await page.locator('[data-calendar-apply]').click();
    assert.equal(await range(),'2026/10/21 - 2026/11/03');
    await page.getByRole('button',{name:'选择当前查看窗口',exact:true}).click();
    await day('2026/10/25').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await page.locator('[data-calendar-apply]').click();
    assert.equal(await range(),'2026/10/26 - 2026/10/27');
    console.log('dual calendars: bounds, draft/confirm/cancel, reversed selection, year crossing, shortcuts and keyboard PASS');

    await page.reload();
    for(const width of [1366,1440,1920]){
      await page.setViewportSize({width,height:width===1366?768:900});
      const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,footer:document.querySelector('.list-footer').getBoundingClientRect().bottom,height:innerHeight,size:document.querySelector('.size-head').getBoundingClientRect().width,bar:document.querySelector('.range-bar').getBoundingClientRect().height}));
      assert.equal(layout.overflow,false);assert.equal(layout.footer,layout.height);assert.equal(layout.size,60);assert.ok(layout.bar<=46);
      await page.getByRole('button',{name:'选择当前查看窗口',exact:true}).click();
      const popup=await page.locator('#rangeEditor').boundingBox();assert.ok(popup.x>=0&&popup.x+popup.width<=width&&popup.y+popup.height<=layout.height);
      await page.keyboard.press('Escape');
    }
    assert.deepEqual(errors,[]);console.log('1366/1440/1920 layouts, popup bounds, fixed footer and no page errors PASS');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
