const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage(),errors=[];
  page.setDefaultTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const shot=name=>page.screenshot({path:path.join(__dirname,'evidence','v032-'+name+'.png'),animations:'disabled'});
  const style=(locator,property)=>locator.evaluate((el,p)=>getComputedStyle(el)[p],property);
  const width=locator=>locator.evaluate(el=>Math.round(el.getBoundingClientRect().width));
  const id='US-B0GRG5DRWW',root='http://127.0.0.1:8800';
  try{
    await page.goto(root+'/?v=0.3.2',{waitUntil:'networkidle'});
    await page.locator('[data-presentation-version="0.3.2"]').waitFor();
    await page.locator('[data-tag-category]').first().waitFor();
    assert.deepEqual(errors,[]);
    assert.equal(await width(page.locator('th.identity-head')),306);
    assert.equal(await width(page.locator('th.date-head').first()),72);
    const snapshot=await page.evaluate(()=>({footer:document.querySelector('.list-footer').getBoundingClientRect().toJSON(),header:[...document.querySelectorAll('thead tr')].slice(0,2).map(el=>el.getBoundingClientRect().height),summary:document.querySelector('.forecast-page-total').textContent,parents:filteredGroups().length,children:filteredGroups().flatMap(g=>g.children).length,heights:[...document.querySelectorAll('tr[data-forecast-line]')].slice(0,4).map(r=>[r.dataset.forecastLine,r.getBoundingClientRect().height])}));
    console.log('initial',JSON.stringify(snapshot));
    assert.equal(snapshot.footer.bottom,900);
    assert.match(snapshot.summary,/6 个父ASIN \/ 13 个子ASIN，当前页 13 个子ASIN/);
    assert.equal(await page.getByRole('spinbutton',{name:'跳转页码'}).isVisible(),true);
    assert.equal(await style(page.locator('.size-value').first(),'fontWeight'),'400');
    const typography=await page.evaluate(()=>Object.fromEntries(['.child-asin-line .code-text','.product-identifiers .code-text','.child-store','.product-meta','.product-action','.product-note > span','.parent-strip .code-text','.parent-site','.size-value','.line-cell','.metric strong','[data-tag-category]','#coverageRange','#browse-range-start','#browse-range-end'].map(selector=>{const s=getComputedStyle(document.querySelector(selector));return [selector,{size:s.fontSize,weight:s.fontWeight}];})));
    console.log('typography',JSON.stringify(typography));
    Object.values(typography).forEach(s=>{assert.equal(s.size,'12px');assert.equal(s.weight,'400');});
    assert.equal(await page.locator('.current-week-label,.current-forecast-week').count(),0);
    assert.equal(await page.locator('.range-section-separator').textContent(),'丨');
    const range=await page.evaluate(()=>{
      const start=document.querySelector('#browse-range-start'),end=document.querySelector('#browse-range-end'),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=getComputedStyle(start).font;
      return {start:start.value,end:end.value,gap:end.getBoundingClientRect().left-start.getBoundingClientRect().left-ctx.measureText(start.value).width,width:start.closest('.forecast-range-picker-host').getBoundingClientRect().width,startClipped:start.scrollWidth>start.clientWidth,endClipped:end.scrollWidth>end.clientWidth};
    });
    console.log('range',JSON.stringify(range));
    assert.equal(range.width,184);assert.ok(range.gap<40);assert.equal(range.startClipped,false);assert.equal(range.endClipped,false);
    const divider=await page.evaluate(()=>{
      const head=document.querySelector('th.line-head'),band=document.querySelector('.parent-band'),overlay=document.querySelector('#forecastFixedDivider');
      return {head:head.getBoundingClientRect().right,band:band.getBoundingClientRect().right,overlay:overlay.getBoundingClientRect().right,width:overlay.getBoundingClientRect().width,headBorder:getComputedStyle(head).borderRightColor,bandBorder:getComputedStyle(band).borderRightColor,firstBorder:getComputedStyle(document.querySelector('td[data-focus-index="0"]')).borderLeftWidth,pseudo:getComputedStyle(head,'::before').content};
    });
    console.log('divider',JSON.stringify(divider));
    assert.equal(divider.width,1);assert.ok(Math.abs(divider.head-divider.band)<1);assert.ok(Math.abs(divider.head-divider.overlay)<1);assert.equal(divider.firstBorder,'0px');assert.equal(divider.headBorder,'rgba(0, 0, 0, 0)');assert.equal(divider.bandBorder,'rgba(0, 0, 0, 0)');assert.equal(divider.pseudo,'none');
    for(const line of ['system','manual','activity','final'])assert.equal(await style(page.locator(`[data-forecast-line="${line}"] .date-col`).first(),'backgroundColor'),'rgb(255, 255, 255)');
    const product=page.locator(`[data-record-id="${id}"]`);
    const protectedStyles=await product.evaluate(el=>[...el.querySelectorAll('[data-tag-category],.thumb,.product-box')].map(n=>({tag:n.dataset.tagCategory||n.className,color:getComputedStyle(n).color,bg:getComputedStyle(n).backgroundColor,width:getComputedStyle(n).width,height:getComputedStyle(n).height})));
    await shot('default');
    await page.locator('[data-forecast-toggle-button="all"]').click();
    assert.equal(await style(page.locator('[data-forecast-line="summary"] .date-col').first(),'backgroundColor'),'rgb(255, 255, 255)');
    await shot('collapsed');
    await page.locator('[data-forecast-toggle-button="all"]').click();
    assert.equal(await product.isVisible(),true);

    await page.locator('.forecast-pagination').getByTitle('20 条/页',{exact:true}).click();
    await page.getByTitle('5 条/页',{exact:true}).click();
    assert.equal(await page.evaluate(()=>state.pageSize),5);
    await page.getByRole('spinbutton',{name:'跳转页码'}).fill('3');
    await page.getByRole('spinbutton',{name:'跳转页码'}).press('Enter');
    await page.waitForFunction(()=>state.page===3);
    assert.match(await page.locator('.forecast-page-total').textContent(),/当前页 3 个子ASIN/);
    await page.locator('.forecast-pagination').getByTitle('上一页',{exact:true}).click();
    await page.waitForFunction(()=>state.page===2);
    await page.getByRole('spinbutton',{name:'跳转页码'}).fill('1');
    await page.getByRole('spinbutton',{name:'跳转页码'}).press('Enter');
    await page.waitForFunction(()=>state.page===1);

    const dateIndex=await page.evaluate(()=>indexForDate('2026-10-21'));
    const manualCell=page.locator(`[data-edit-manual="${id}"][data-index="${dateIndex}"]`);
    assert.equal(await manualCell.locator('.entry-number').textContent(),'');
    await manualCell.click();
    const manualDialog=page.getByRole('dialog',{name:'人工预测',exact:true});
    await manualDialog.getByRole('spinbutton',{name:'预测销量'}).fill('0');
    await manualDialog.getByRole('textbox',{name:'人工预测原因'}).fill('本周暂停推广资源，结合流量和转化率重新评估预测；待活动资源确认后恢复。此处长原因用于检查窄列省略与白色浮层完整展示。');
    await manualDialog.getByRole('button',{name:'保存',exact:true}).click();
    await manualDialog.waitFor({state:'hidden'});
    assert.equal((await page.locator(`[data-final="${id}"]`).first().textContent()).replace(/\s/g,''),'0(人工)');
    const reason=page.locator(`[data-reason-host="${id}"][data-reason-kind="manual"]`).first().locator('.cell-reason');
    assert.equal(await style(reason,'cursor'),'default');
    assert.equal(await style(reason,'whiteSpace'),'nowrap');
    await reason.hover();
    const popover=page.locator('.ant-popover:visible');
    await popover.waitFor();
    await page.waitForTimeout(300);
    assert.match(await popover.textContent(),/本周暂停推广资源/);
    assert.equal(await popover.locator('.ant-popover-arrow').count(),1);
    assert.equal(await popover.locator('.ant-popover-arrow').evaluate(el=>getComputedStyle(el,'::before').backgroundColor),'rgb(255, 255, 255)');
    assert.equal(await style(popover.locator('.ant-popover-inner'),'backgroundColor'),'rgb(255, 255, 255)');
    const triggerBounds=await reason.boundingBox(),popupBounds=await popover.boundingBox();
    assert.ok(popupBounds.y+popupBounds.height<=triggerBounds.y+1,JSON.stringify({triggerBounds,popupBounds}));
    assert.ok(popupBounds.y+popupBounds.height<=(await manualCell.boundingBox()).y,JSON.stringify({triggerBounds,popupBounds}));
    await shot('manual-popover');
    await page.keyboard.press('Escape');
    await popover.waitFor({state:'hidden'});
    await page.mouse.move(100,100);

    await page.locator(`[data-event="${id}"]`).first().click();
    const activityDialog=page.getByRole('dialog',{name:'活动预测',exact:true});
    await activityDialog.getByRole('spinbutton',{name:'预测销量'}).fill('1080');
    await activityDialog.getByRole('textbox',{name:'活动名称'}).fill('秋季大促');
    await activityDialog.getByRole('textbox',{name:'备注说明'}).fill('活动资源位、站内流量与素材联动的补充说明；数据仍按活动覆盖人工及AI规则取值，原因全文在这里完整展示。');
    await activityDialog.getByRole('button',{name:'保存',exact:true}).click();
    await activityDialog.waitFor({state:'hidden'});
    assert.equal((await page.locator(`[data-final="${id}"]`).first().textContent()).replace(/\s/g,''),'1,080(活动)');
    const activityReason=page.locator(`[data-reason-host="${id}"][data-reason-kind="activity"]`).first().locator('.cell-reason');
    await activityReason.focus();
    await popover.waitFor();
    await page.waitForTimeout(300);
    assert.match(await popover.textContent(),/秋季大促/);
    assert.equal(await popover.locator('.ant-popover-arrow').count(),1);
    await shot('activity-popover');
    await page.keyboard.press('Escape');
    await popover.waitFor({state:'hidden'});

    // Surface changes must retain both Excel-style crosshair layers.
    await manualCell.hover();
    const cross=await manualCell.evaluate(button=>{const el=button.closest('td');return {row:getComputedStyle(el).getPropertyValue('--cross-row'),column:getComputedStyle(el).getPropertyValue('--cross-column'),images:getComputedStyle(el).backgroundImage,focus:el.classList.contains('focus-cross-cell')};});
    assert.ok(cross.row.includes('0.045'),JSON.stringify(cross));
    assert.ok(cross.column.includes('0.045'),JSON.stringify(cross));
    assert.ok(cross.focus&&cross.images.includes('gradient'));
    await page.mouse.move(100,100);
    // Width and header alignment remain stable when the viewing window changes.
    await page.getByRole('button',{name:'30天',exact:true}).click();
    assert.equal(await width(page.locator('th.date-head').first()),72);
    await page.getByRole('button',{name:'14天',exact:true}).click();
    await page.locator('[data-week-toggle]').first().click();
    assert.equal(await width(page.locator('col[data-column^="week:"]').first()),112);
    await shot('week-collapsed');
    await page.locator('[data-week-toggle]').first().click();
    const aligned=await page.evaluate(()=>{
      const header=document.querySelector('th.date-head'),cell=document.querySelector('[data-forecast-line="system"] .date-col');
      return [header,cell].map(el=>el.getBoundingClientRect().left+parseFloat(getComputedStyle(el).paddingLeft));
    });
    assert.ok(Math.abs(aligned[0]-aligned[1])<1,JSON.stringify(aligned));
    for(const name of ['销售趋势','预测分析','SKU映射']){
      await product.getByRole('button',{name,exact:true}).click();
      const drawer=page.getByRole('dialog');
      await drawer.getByRole('tab',{name,exact:true}).waitFor();
      assert.equal(await drawer.getByRole('tab',{name,exact:true}).getAttribute('aria-selected'),'true');
      assert.equal(await drawer.getByRole('tab').count(),3);
      await page.keyboard.press('Escape');
      await drawer.waitFor({state:'hidden'});
    }
    for(const viewport of [{width:1366,height:768},{width:1920,height:900}]){
      await page.setViewportSize(viewport);
      await page.locator('#workbench').evaluate(el=>{el.scrollTop=180;});
      const layout=await page.evaluate(()=>({footer:document.querySelector('.list-footer').getBoundingClientRect().toJSON(),scrollbar:document.querySelector('.horizontal-scrollbar').getBoundingClientRect().toJSON(),header:document.querySelector('th.date-head').getBoundingClientRect().toJSON(),workbench:document.querySelector('#workbench').getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth,jump:document.querySelector('.forecast-page-jump').getBoundingClientRect().toJSON()}));
      assert.equal(layout.footer.bottom,viewport.height);
      assert.ok(Math.abs(layout.scrollbar.bottom-layout.footer.top)<1);
      assert.ok(Math.abs(layout.header.top-layout.workbench.top-28)<2,JSON.stringify(layout));
      assert.equal(layout.overflow,false);
      assert.ok(layout.jump.right<=viewport.width);
      const clipping=await page.locator('.parent-strip').evaluateAll(nodes=>nodes.filter(el=>el.scrollWidth>el.clientWidth).map(el=>({text:el.textContent,width:el.clientWidth,scrollWidth:el.scrollWidth})));
      assert.deepEqual(clipping,[]);
      await page.locator('#workbench').evaluate(el=>{el.scrollTop=0;});
      await shot(viewport.width+'x'+viewport.height);
    }
    await page.evaluate(()=>localStorage.setItem('pmc-forecast-column-widths-v024',JSON.stringify({identity:330,size:52,context:158,line:126,dates:{'2026-10-21':117},weeks:{}})));
    await page.reload({waitUntil:'networkidle'});
    assert.equal(await width(page.locator('th.identity-head')),330);
    assert.equal(await width(page.locator('th.line-head')),126);
    assert.equal(await width(page.locator('th.date-head').first()),117);
    assert.equal((await page.locator(`[data-final="${id}"]`).first().textContent()).replace(/\s/g,''),'1,080(活动)');
    await page.getByRole('textbox',{name:'编码或商品名称'}).fill('B0GY4KJPF4');
    await page.getByRole('button',{name:'查询',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.forecast-page-total').textContent.includes('共 1 个父ASIN / 2 个子ASIN'));
    await page.getByRole('button',{name:'重置',exact:true}).click();
    await page.locator(`[data-record-id="${id}"] [data-tag-category]`).first().waitFor();
    // Compare approved product surfaces directly against the archived baseline.
    const surfaceSignature=()=>page.evaluate(()=>[...document.querySelector('[data-record-id="US-B0GRG5DRWW"]').querySelectorAll('[data-tag-category]')].map(el=>({text:el.textContent,color:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor})).concat([...document.querySelectorAll('.context-section')].slice(0,2).map(el=>({bg:getComputedStyle(el).backgroundColor,padding:getComputedStyle(el).padding}))));
    const currentSurfaces=await surfaceSignature();
    await page.goto(root+'/index.v0.3.1.html',{waitUntil:'networkidle'});
    await page.locator(`[data-record-id="${id}"] [data-tag-category]`).first().waitFor();
    assert.deepEqual(await surfaceSignature(),currentSurfaces);
    assert.equal(await page.locator('script[src*="v032"],link[href*="v032"]').count(),0);
    console.log('protectedStyles',JSON.stringify(protectedStyles));
    console.log('PASS typography / compact date range / single fixed boundary / white rows / white Popover arrow / light crosshair / no current-week emphasis / pagination / blank-zero precedence / drawer / viewport / widths / protected colors / archive');
    assert.deepEqual(errors,[]);
  }catch(error){console.error(error);console.error(errors);await shot('failure');process.exitCode=1;}
  finally{await browser.close();}
})();
