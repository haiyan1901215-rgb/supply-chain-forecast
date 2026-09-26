const assert=require('node:assert/strict'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),ctx=await browser.newContext({viewport:{width:1440,height:900},permissions:['clipboard-read','clipboard-write']}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.setDefaultTimeout(10000);
 const id='US-B0GRG5DRWW',reason='新增推广资源，AI预测未包含本次新增投放。\n'+('预计需求增长，结合近期转化调整。'.repeat(5));
 const shot=async n=>{const d=page.getByRole('dialog');if(await d.count()===1)await d.getByRole('button',{name:'取消',exact:true}).hover();return page.screenshot({path:path.join(__dirname,'evidence','v023-'+n+'.png'),animations:'disabled'});};
 const manual=i=>page.locator('[data-edit-manual="'+id+'"][data-index="'+i+'"]');
 const dialog=name=>page.getByRole('dialog',{name,exact:true});
 const save=async(name)=>{await dialog(name).getByRole('button',{name:'保存',exact:true}).click();await dialog(name).waitFor({state:'hidden'});};
 try{
  await page.goto('http://127.0.0.1:8800/?v=0.2.3');await page.locator('#antdColumnButton').waitFor();assert.deepEqual(errors,[]);
  assert.equal(await page.locator('.line-system [data-forecast-toggle-button]').count(),0);assert.equal(await page.locator('.forecast-section-bar [data-forecast-toggle-button]').count(),13);
  const align=await page.locator('[data-child-row="'+id+'"] > .line-cell').evaluateAll(els=>els.filter(e=>!e.querySelector('.forecast-section-bar')).map(e=>{const r=document.createRange();r.selectNodeContents(e);return r.getBoundingClientRect().left;}));assert.ok(Math.max(...align)-Math.min(...align)<1);
  assert.equal(await page.getByText('添加备注',{exact:true}).count(),0);
  assert.equal(await page.locator('[data-note-edit="'+id+'"]').evaluate(e=>getComputedStyle(e).color),'rgb(31, 111, 235)');
  for(const name of ['查询','重置'])assert.equal(await page.getByRole('button',{name,exact:true}).evaluate(e=>getComputedStyle(e).fontSize),'12px');
  assert.equal(await page.getByRole('textbox',{name:'编码或商品名称'}).evaluate(e=>getComputedStyle(e).fontSize),'12px');
  await page.getByTestId('filter-market').click();assert.equal(await page.getByTitle('英国 / UK',{exact:true}).evaluate(e=>getComputedStyle(e).fontSize),'12px');await page.getByRole('combobox',{name:'国家 / 站点',exact:true}).press('Escape');
  await page.locator('[data-history-toggle="'+id+'"]').click();const loadMore=()=>page.getByRole('button',{name:'加载更多历史批次 B0GRG5DRWW',exact:true});
  assert.equal(await page.locator('.identity-cell [data-more-history]').count(),0);assert.equal(await loadMore().evaluate(e=>Boolean(e.closest('.history-load-row'))),true);
  assert.equal(await page.locator('.history-row').count(),2);await loadMore().click();assert.equal(await page.locator('.history-row').count(),4);await loadMore().click();assert.equal(await page.locator('.history-row').count(),6);assert.equal(await page.getByRole('button',{name:'历史批次已全部加载 B0GRG5DRWW',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'收起更多历史批次 B0GRG5DRWW',exact:true}).click();assert.equal(await page.locator('.history-row').count(),2);await shot('history-load');
  await page.locator('[data-history-toggle="'+id+'"]').click();
  const toggle=page.locator('[data-forecast-toggle-button="'+id+'"]');assert.equal(await toggle.textContent(),'收起填报');await toggle.click();assert.equal(await toggle.textContent(),'展开填报');await toggle.click();
  await manual(0).click();await dialog('人工预测').waitFor();await page.getByRole('spinbutton',{name:'预测销量'}).fill('1234');await dialog('人工预测').getByRole('button',{name:'保存',exact:true}).click();await page.getByText('请填写不采用AI预测的原因',{exact:true}).waitFor();
  await page.getByRole('textbox',{name:'人工预测原因'}).fill('字'.repeat(201));assert.equal((await page.getByRole('textbox',{name:'人工预测原因'}).inputValue()).length,200);await dialog('人工预测').getByText('200 / 200',{exact:true}).waitFor();
  await page.getByRole('textbox',{name:'人工预测原因'}).fill(reason);await dialog('人工预测').getByText(reason.length+' / 200',{exact:true}).waitFor();const area=await page.getByRole('textbox',{name:'人工预测原因'}).boundingBox(),counter=await dialog('人工预测').getByText(reason.length+' / 200',{exact:true}).boundingBox();assert.ok(counter.y>=area.y&&counter.y+counter.height<=area.y+area.height);assert.ok(counter.x+counter.width<=area.x+area.width);await shot('manual-editor');await save('人工预测');
  assert.equal(await manual(0).locator('.entry-number').textContent(),'1,234');const snippet=page.locator('[data-reason-host="'+id+'"][data-reason-kind="manual"]').first().locator('.cell-reason');assert.equal(await snippet.textContent(),reason);
  assert.ok(await snippet.evaluate(e=>e.scrollHeight>e.clientHeight&&e.clientHeight<=33));await snippet.focus();await page.getByRole('tooltip').filter({hasText:'新增推广资源'}).waitFor();await shot('reason-full');await page.locator('.range-meta').click();
  await manual(0).click();await page.getByRole('textbox',{name:'人工预测原因'}).fill('未保存修改');await dialog('人工预测').getByRole('button',{name:'取消',exact:true}).click();await page.getByRole('button',{name:'放弃修改',exact:true}).click();await dialog('人工预测').waitFor({state:'hidden'});assert.equal(await snippet.textContent(),reason);
  await manual(1).click();await page.getByRole('spinbutton',{name:'预测销量'}).fill('0');await page.getByRole('textbox',{name:'人工预测原因'}).fill('暂停推广');await save('人工预测');assert.equal(await manual(1).locator('.entry-number').textContent(),'0');
  await page.locator('[data-event="'+id+'"][data-date="2026-10-21"]').click();await dialog('活动预测').waitFor();assert.equal(await dialog('活动预测').getByText('活动类型',{exact:true}).count(),0);
  await page.getByRole('spinbutton',{name:'预测销量'}).fill('2345');await page.getByRole('textbox',{name:'活动名称'}).fill('秋季促销');await page.getByRole('textbox',{name:'备注说明'}).fill('新增站内资源位');assert.equal(await page.getByRole('textbox',{name:'活动日期'}).inputValue(),'2026/10/21');await shot('activity-editor');await save('活动预测');
  assert.equal((await page.locator('[data-final="'+id+'"][data-index="0"]').textContent()).replace(/\s/g,''),'2,345(活动)');
  await page.locator('[data-note-edit="'+id+'"]').click();await page.getByRole('textbox',{name:'商品备注',exact:true}).fill('需关注活动影响');await page.locator('.inline-note-editor').getByText('7 / 200',{exact:true}).waitFor();await shot('note-editor');await page.locator('.inline-note-editor').getByRole('button',{name:'保存',exact:true}).click();await page.locator('.inline-note-editor').waitFor({state:'hidden'});
  await page.reload();await page.locator('#antdColumnButton').waitFor();assert.equal(await snippet.textContent(),reason);assert.match(await page.locator('[data-note-control="'+id+'"]').textContent(),/需关注活动影响/);
  await manual(1).click();await dialog('人工预测').getByRole('button',{name:'清除预测',exact:true}).click();await dialog('人工预测').waitFor({state:'hidden'});assert.equal(await manual(1).locator('.entry-number').textContent(),'');assert.equal(await page.locator('[data-reason-kind="manual"][data-reason-date="2026-10-22"]').count(),0);
  const skc=page.locator('.parent-skc').first();await skc.hover();await skc.locator('.copy-code').click();await page.getByText('已复制',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'C0001A-91');
  const msg=await page.getByText('已复制',{exact:true}).boundingBox(),wb=await page.locator('#workbench').boundingBox();assert.ok(Math.abs(msg.x+msg.width/2-(wb.x+wb.width/2))<25);assert.ok(msg.y<wb.y+10);await shot('copy-feedback');
  for(const [width,height] of [[1366,768],[1440,900],[1920,900]]){
   await page.setViewportSize({width,height});assert.equal(await page.locator('.list-footer').evaluate(e=>e.getBoundingClientRect().bottom),height);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.evaluate(()=>{document.querySelector('#workbench').scrollLeft=300;});const border=await page.locator('[data-child-row="'+id+'"] > .line-cell').first().evaluate(e=>{const s=getComputedStyle(e,'::before');return {width:s.width,color:s.backgroundColor,right:s.right};});assert.equal(border.width,'1px');assert.equal(border.right,'0px');await shot('layout-'+width);
  }
  assert.deepEqual(errors,[]);console.log('PASS: compact fonts, inside counters, history loading relocation, blue note icon, explicit toggles/borders, manual reason validation/persistence/truncation/focus, simplified activity metadata, notes, zero/clear, cancel guard, line-label alignment, top-centered clipboard feedback and 3 desktop sizes.');
 }catch(e){console.error(e);console.error(errors);await shot('failure');process.exitCode=1;}finally{await browser.close();}
})();
