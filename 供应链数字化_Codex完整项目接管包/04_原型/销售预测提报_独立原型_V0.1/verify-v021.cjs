const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:900}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.setDefaultTimeout(10000);
 const id='US-B0GRG5DRWW';
 const shot=async name=>{await page.locator('#toast.show').waitFor({state:'hidden'});await page.screenshot({path:path.join(__dirname,'evidence','v021-'+name+'.png'),animations:'disabled'});};
 const toggle=()=>page.locator('[data-forecast-toggle-button="'+id+'"]');
 const edit=async(i,v)=>{await page.locator('[data-edit-manual="'+id+'"][data-index="'+i+'"]').click();await page.locator('[data-manual]').fill(v);await page.locator('[data-manual]').press('Enter');};
 const final=i=>page.locator('[data-final="'+id+'"][data-index="'+i+'"]');
 const hist=(kind,batch='')=>page.locator('[data-history-for="'+id+'"] [data-history-kind="'+kind+'"][data-history-batch="'+batch+'"]').first();
 try{
  await page.goto('http://127.0.0.1:8800/?v=0.2.1');await toggle().waitFor();
  assert.equal(await page.locator('[data-forecast-toggle-button][aria-expanded="true"]').count(),13);
  assert.equal(await page.locator('.identity-cell [data-child-toggle],.identity-cell [data-forecast-toggle-button]').count(),0);
  assert.equal(await page.getByRole('combobox',{name:'查看历史提报'}).count(),0);assert.equal(await page.locator('.submission-toolbar').count(),0);
  const labels=await page.locator('[data-child-row="'+id+'"] .line-cell').allTextContents();assert.deepEqual(labels,['AI预测','人工预测','活动预测','最终预测']);
  assert.equal(await toggle().evaluate(el=>Boolean(el.closest('.line-cell'))),true);
  await shot('default');
  await toggle().click();assert.equal(await page.locator('[data-child-row="'+id+'"]').count(),1);assert.equal(await toggle().getAttribute('aria-expanded'),'false');
  await page.locator('[data-range-size="30"]').click();assert.equal(await toggle().getAttribute('aria-expanded'),'false');await page.locator('[data-range-size="14"]').click();await toggle().press('Enter');
  await edit(0,'1234');await edit(1,'0');assert.equal((await final(0).textContent()).replace(/\s/g,''),'1,234(人工)');assert.equal((await final(1).textContent()).replace(/\s/g,''),'0(人工)');
  await page.locator('[data-event="'+id+'"][data-date="2026-10-21"]').click();await page.locator('#eventQty').fill('2345');await page.locator('#eventName').fill('活动预测验证');await page.locator('[data-action="modal-confirm"]').click();assert.equal((await final(0).textContent()).replace(/\s/g,''),'2,345(活动)');
  await page.locator('[data-history-toggle="'+id+'"]').click();
  assert.equal(await page.locator('[data-reason]:visible,[data-reasons]:visible,[data-review-inline]:visible,.retro-panel').count(),0);
  const history=hist('final','2026-10-14');assert.equal(await history.locator('.history-value').textContent(),'30');assert.equal(await history.locator('.delta').textContent(),'+2,315');
  assert.equal(await history.locator('.history-value').evaluate(el=>getComputedStyle(el).fontSize),'12px');assert.equal(await history.locator('.delta').evaluate(el=>getComputedStyle(el).fontSize),'11px');
  assert.match(await history.locator('.delta').getAttribute('data-hint'),/正数表示本次增加，负数表示本次减少/);
  const historyLabels=await page.locator('.history-label').allTextContents();assert.ok(historyLabels.some(t=>t.includes('本次较该批增减')));assert.ok(historyLabels.every(t=>!t.includes('上次')&&!t.includes('上上次')&&!t.includes('预测 − 实销')));
  assert.equal((await hist('actual').textContent()).trim(),'');assert.equal((await hist('error').textContent()).trim(),'');
  assert.equal(await page.locator('.date-col').evaluateAll(els=>els.filter(e=>/^[—-]$/.test(e.textContent.trim())).length),0);
  await page.locator('[data-history-part="'+id+'|2026-10-14"]').click();assert.ok((await page.locator('.history-component .history-label').allTextContents()).includes('人工预测'));
  await page.locator('[data-more-history="'+id+'"]').click();assert.equal(await page.locator('.history-row').count(),4);
  await shot('history');
  // Test fixtures model returned actual sales and an unavailable historical snapshot; never persist them.
  await page.evaluate(id=>{window.restoreActual=actualAt;actualAt=(c,key)=>c.id===id&&key==='2026-10-21'?0:restoreActual(c,key);renderTable();},id);
  assert.equal((await hist('actual').textContent()).trim(),'0');assert.equal((await hist('error').textContent()).trim(),'+2,345');
  await page.evaluate(()=>{actualAt=window.restoreActual;window.restoreForecast=forecastAt;forecastAt=(c,b,key)=>b==='2026-10-14'&&key==='2026-10-21'?null:restoreForecast(c,b,key);renderTable();});
  assert.equal((await hist('final','2026-10-14').textContent()).trim(),'');
  await page.evaluate(()=>{forecastAt=window.restoreForecast;renderTable();});
  await page.locator('[data-history-toggle="'+id+'"]').click();await edit(2,'0');await edit(2,'');assert.equal(await page.locator('[data-edit-manual="'+id+'"][data-index="2"] .entry-number').textContent(),'');
  await page.locator('[data-note-edit="'+id+'"]').click();await page.locator('[data-note-input="'+id+'"]').fill('活动资源增加，调整需求预测');await page.locator('[data-note-save="'+id+'"]').click();await page.reload();await toggle().waitFor();assert.match(await page.locator('[data-note-edit="'+id+'"]').textContent(),/活动资源增加/);assert.equal(await toggle().getAttribute('aria-expanded'),'true');
  await page.locator('#antdColumnButton').click();await page.getByRole('dialog',{name:'列配置',exact:true}).waitFor();assert.equal(await page.locator('.antd-column-options input:disabled').count(),5);await page.getByRole('checkbox',{name:'销售组合',exact:true}).check();await page.getByRole('button',{name:'保存并应用',exact:true}).click();await page.getByRole('dialog',{name:'列配置',exact:true}).waitFor({state:'hidden'});assert.equal(await page.locator('[data-code-tip^="销售组合"]').count(),13);
  const before=await page.locator('col[data-column="identity"]').getAttribute('style');await page.locator('[data-range-size="30"]').click();assert.equal(await page.locator('col[data-column="identity"]').getAttribute('style'),before);await page.locator('[data-range-size="14"]').click();await page.locator('[data-week-toggle="2026-W43"]').click();assert.equal(await page.locator('.date-head').count(),10);await page.locator('[data-week-toggle="2026-W43"]').click();
  for(const [w,h] of [[1366,768],[1440,900],[1920,900]]){
   await page.setViewportSize({width:w,height:h});const bounds=await page.evaluate(()=>({body:document.documentElement.scrollWidth,footer:document.querySelector('.list-footer').getBoundingClientRect().bottom,scroll:document.querySelector('#horizontalScrollbar').getBoundingClientRect().bottom,footerTop:document.querySelector('.list-footer').getBoundingClientRect().top,range:document.querySelector('.range-bar').getBoundingClientRect().height}));assert.ok(bounds.body<=w);assert.equal(bounds.footer,h);assert.ok(Math.abs(bounds.scroll-bounds.footerTop)<1);assert.ok(bounds.range<50);await shot('layout-'+w);
  }
  assert.deepEqual(errors,[]);console.log('PASS: default expansion, AntD line toggles, copywriting, 11px deltas, blank vs zero, same-date comparison, removed duplicate actions, notes persistence, priority, column settings and three desktop sizes. Zero browser errors.');
 }catch(e){console.error(e);console.error(errors);await shot('failure');process.exitCode=1;}finally{await browser.close();}
})();
