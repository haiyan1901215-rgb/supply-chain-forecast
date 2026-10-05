/* V0.2.1: one inline comparison, explicit deltas and expanded forecast entry. */
const v020ColumnWidth=columnWidth;
columnWidth=function(key){if(key.startsWith('date:'))return state.dateWidths[key.slice(5)]??128;if(key.startsWith('week:'))return state.weekWidths[key.slice(5)]??144;return v020ColumnWidth(key);};
const v020DateCells=dateCells;
dateCells=function(c,line){return v020DateCells(c,line).replace(/(<span class="source-tag [^"]+">)([^<]+)(<\/span>)/g,(_,a,b,z)=>a+'('+b+')'+z).replace(/(<span class="entry-number">)(\d+(?:\.\d+)?)(<\/span>)/g,(_,a,n,z)=>a+num(Number(n))+z);};
const v020ContextCell=contextCell;
contextCell=function(c,span){return v020ContextCell(c,span).replace(/(<strong>)(\d+(?:\.\d+)?)( 天)?(<\/strong>)/g,(_,a,n,unit,z)=>a+num(Number(n))+(unit||'')+z);};
positionFixedFields.add('owner');
parentBand=function(g){
  const label=g.market==='US'?'美国 / US':'英国 / UK',collapsed=state.collapsed.has(g.id);
  const fields={spu:copyable(g.spu,'SPU'),skc:`<span class="parent-skc code-value" data-code-tip="SKC · 颜色商品单元；颜色：${esc(g.colors[0])}；颜色编码：${esc(g.colorCode)}"><span class="code-text" tabindex="0" aria-label="SKC：${esc(g.skc)}">${esc(g.skc)}</span><span class="skc-color">（${esc(g.colors[0])}）</span><button class="copy-code" type="button" data-copy="${esc(g.skc)}" aria-label="复制SKC ${esc(g.skc)}">${copyIcon}</button></span>`};
  return `<td class="parent-band" colspan="${fixedCount()-1}"><div class="parent-strip"><span class="parent-site" tabindex="0" data-hint="国家 / 站点：${label}；平台：Amazon"><span class="country-flag">${flag(g.market)}</span>${label} · Amazon</span><button class="collapse" data-collapse="${g.id}" type="button" aria-expanded="${!collapsed}" aria-label="${collapsed?'展开':'收起'} ${g.parent}"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 6h8${collapsed?'M6 2v8':''}"/></svg></button>${copyable(g.parent,'Parent ASIN')}${orderedFields('父体信息').filter(f=>f.key!=='owner').map(f=>fields[f.key]||'').join('')}${hasField('owner')?`<span class="parent-sales" tabindex="0" data-hint="销售负责人：${esc(g.owner)}">销售：${esc(g.owner)}</span>`:''}</div></td>`;
};

historyRows=function(c){
  const rows=[];
  olderBatches().slice(0,state.historyCount[c.id]||2).forEach(batch=>{
    rows.push({kind:'final',batch,label:formatKey(batch)+' 提报'});
    if(state.historyParts.has(c.id+'|'+batch))['ai','manual','activity'].forEach(kind=>rows.push({kind,batch,label:{ai:'规则预测',manual:'人工预测',activity:'活动预测'}[kind]}));
  });
  rows.push({kind:'actual',label:'实际销量'},{kind:'error',label:'预测与实销差异'});
  return rows;
};
const differenceHelp='按同一销售日期比较：本次最终预测减去该批最终预测；正数表示本次增加，负数表示本次减少。';
deltaMarkup=function(value,label='较前次提报'){return value==null?'':`<span class="delta ${value===0?'flat':value>0?'up':'down'}">${label?label+' ':''}${signed(value)}</span>`;};
historyRowHTML=function(c,row){
  const expanded=state.historyParts.has(c.id+'|'+row.batch),isBatch=row.kind==='final';
  const labels=isBatch?`<button type="button" data-history-part="${c.id}|${row.batch}" aria-expanded="${expanded}">${expanded?'−':'+'} ${row.label}</button><small tabindex="0" data-hint="${differenceHelp}">本次较该批增减</small>`:row.kind==='error'?`预测与实销差异<small tabindex="0" data-hint="当前批次最终预测减去实际销量；正数表示预测偏高，负数表示预测偏低。仅比较双方都有数据的日期。">正数偏高 · 负数偏低</small>`:row.kind==='actual'?'实际销量<small>截至 2026/09/28</small>':row.label;
  const cells=visibleColumns().map((col,i)=>{
    let value=null,hint='';
    if(row.kind==='actual'){
      const values=col.days.map(d=>actualAt(c,dateKey(d)));value=sumValues(values);
      hint=value==null?'实际销量尚未回传或日期尚未发生':`实际销量已回传 ${values.filter(v=>v!=null).length}/${col.days.length}天`;
    }else if(row.kind==='error'){
      const pairs=col.days.map(d=>[forecastAt(c,state.batch,dateKey(d))?.final,actualAt(c,dateKey(d))]).filter(p=>p.every(v=>v!=null));
      value=pairs.length?pairs.reduce((s,[p,a])=>s+p-a,0):null;
      hint=`当前最终预测与实际销量的差异，正数偏高、负数偏低；已匹配 ${pairs.length}/${col.days.length}天`;
    }else{
      value=aggregate(c,row.batch,col.days,row.kind);
      hint=col.days.map(d=>`${dateLabel(d)}：${forecastAt(c,row.batch,dateKey(d))?.reason||'该批次未覆盖'}`).join('；');
    }
    const delta=isBatch?alignedDelta(c,state.batch,row.batch,col.days):null;
    return `<td class="date-col num ${col.boundary?'week-boundary':''}" data-time-column="${col.key}" data-focus-index="${i}" data-history-batch="${row.batch||''}" data-history-kind="${row.kind}"><span class="history-value" data-hint="${esc(hint)}" tabindex="0">${value==null?'':row.kind==='error'?signed(value):num(value)}</span>${delta==null?'':`<span class="delta ${delta===0?'flat':delta>0?'up':'down'}" tabindex="0" data-hint="${differenceHelp}">${signed(delta)}</span>`}</td>`;
  }).join('');
  return `<tr class="${row.kind==='actual'?'actual-row':row.kind==='error'?'deviation-row':isBatch?'history-row':'history-component'}" data-history-for="${c.id}"><td class="line-cell history-label">${labels}</td>${cells}</tr>`;
};
const v021DateCells=dateCells;
dateCells=function(c,line){return v021DateCells(c,line).replaceAll('>—<','><');};
const v021RenderTable=renderTable;
renderTable=function(){
  const wb=$('#workbench'),top=wb.scrollTop,left=wb.scrollLeft;
  v021RenderTable();
  $$('.site-row').forEach(row=>row.remove());
  wb.scrollTop=top;wb.scrollLeft=left;
  window.refreshForecastControls?.();syncHorizontalScrollbar();
};
const v021RevealDrawer=revealDrawer;
revealDrawer=function(title,sub,body){return v021RevealDrawer(title.replaceAll('人工修正','人工预测').replaceAll('活动提报','活动预测'),sub,body.replaceAll('人工修正','人工预测').replaceAll('活动提报','活动预测'));};
$('.batch-toolbar').style.display='none';$('.filter-panel').style.display='none';
const filterHost=document.createElement('section');filterHost.className='filter-panel filter-v020';filterHost.id='filterControls';$('.filter-panel').before(filterHost);
const right=document.createElement('div');right.className='range-right';$('.range-bar').append(right);const rangeMeta=$('.range-meta');if(rangeMeta)right.append(rangeMeta);const configHost=document.createElement('span');configHost.id='columnIcon';right.append(configHost);
const uiHost=document.createElement('div');uiHost.id='antdControls';document.body.append(uiHost);
state.view='batch';render();
