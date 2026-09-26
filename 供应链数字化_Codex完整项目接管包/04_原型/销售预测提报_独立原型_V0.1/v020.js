/* V0.2.0: single-scene history, compact identity bands and number presentation. */
state.reviewOpen=new Set();state.reviewRanges={};state.reviewBatches={};
const reviewEarliest='2026-09-09',reviewLatest='2026-10-20';
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
const v020HistoryRows=historyRows;
historyRows=function(c){return v020HistoryRows(c).map(row=>row.batch&&row.kind==='final'?{...row,label:formatKey(row.batch)+' 提报',relative:row.relative==='上批次'?'上次':row.relative==='上上批次'?'上上次':'更早提报'}:row.kind==='actual'?{...row,label:'实际销量'}:row.kind==='error'?{...row,label:'预测 − 实销'}:row);};
const v020HistoryHTML=historyRowHTML;
historyRowHTML=function(c,row){return v020HistoryHTML(c,row).replace(' · 最终预测',' · 同一销售日期').replaceAll('本次差值','').replace('>实际销量</td>','>实际销量<small>截至 2026/10/20</small></td>').replaceAll('class="delta ', 'data-hint="差值 = 本次预测 − 该次预测，按同一销售日期比较" class="delta ');};
const v020ProductCell=productCell;
productCell=function(g,c,span){let html=v020ProductCell(g,c,span);if(state.historyOpen.has(c.id))html=html.replace('</td>',`<div class="review-entry"><button class="toolbar-link" data-review-inline="${c.id}" aria-expanded="${state.reviewOpen.has(c.id)}">${state.reviewOpen.has(c.id)?'收起实销核对':'历史预测与实销核对'}</button></div></td>`);return html;};
function reviewRange(c){return state.reviewRanges[c.id]||['2026-10-14','2026-10-20'];}
function reviewDays(c){const [from,to]=reviewRange(c);return Array.from({length:dayDistance(to,from)+1},(_,i)=>parseDay(shiftDay(from,i)));}
function reviewBatch(c){return state.reviewBatches[c.id]||'2026-10-14';}
function retrospectiveHTML(c){
  const days=reviewDays(c),batch=reviewBatch(c),lineTypes=[['ai','AI预测'],['manual','人工修正'],['activity','活动提报'],['final','当时最终预测'],['actual','实际销量'],['error','预测 − 实销']];
  return inlineRow(`<section class="retro-panel" data-review-panel="${c.id}"><div class="retro-heading"><strong>历史预测与实销核对</strong><span>${c.asin}</span><button class="toolbar-link" data-review-inline="${c.id}">收起</button></div><div class="retro-controls" data-review-controls="${c.id}"></div><div class="retro-table-scroll"><table class="retro-table" aria-label="${c.asin} 历史预测与实际销量"><thead><tr><th>指标 / 销售日期</th>${days.map(d=>`<th>${fullDate(d)}<small>周${weekLabel(d)}</small></th>`).join('')}</tr></thead><tbody>${lineTypes.map(([kind,label])=>`<tr class="retro-${kind}"><th>${label}${kind==='final'?`<small>${formatKey(batch)} 提报</small>`:''}</th>${days.map(d=>{const key=dateKey(d),f=forecastAt(c,batch,key),actual=actualAt(c,key),v=kind==='actual'?actual:kind==='error'?f&&actual!=null?f.final-actual:null:kind==='activity'?f?.activity?.qty:f?.[kind],tag=kind==='final'&&f?` <span class="source-tag">(${f.activity?'活动':f.manual!=null?'人工':'AI'})</span>`:'';return `<td data-review-kind="${kind}" data-review-day="${key}">${v==null?'—':kind==='error'?signed(v):num(v)}${tag}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div><div class="retro-reasons"><span>当时调整依据</span>${[...new Set(days.map(d=>forecastAt(c,batch,dateKey(d))?.reason||'提报未覆盖此日期'))].map(reason=>`<span>${esc(reason)}</span>`).join(' · ')}</div></section>`,'retro-row');
}
const v020RenderTable=renderTable;
renderTable=function(){
  const wb=$('#workbench'),scrollTop=wb.scrollTop,scrollLeft=wb.scrollLeft;
  window.unmountReviewControls?.();v020RenderTable();
  $$('.site-row').forEach(row=>row.remove());
  $$('.history-gap').forEach(el=>{if(el.textContent==='—')el.setAttribute('aria-label','该日期尚无数据');});
  allChildren().filter(c=>state.reviewOpen.has(c.id)&&state.historyOpen.has(c.id)).forEach(c=>{
    const cell=$(`[data-record-id="${c.id}"]`);if(!cell)return;
    let row=cell.parentElement;for(let i=1;i<Number(cell.rowSpan);i++)row=row.nextElementSibling;
    row.insertAdjacentHTML('afterend',retrospectiveHTML(c));
  });
  wb.scrollTop=scrollTop;wb.scrollLeft=scrollLeft;
  window.mountReviewControls?.();window.refreshForecastControls?.();syncHorizontalScrollbar();
};
function toggleReview(id){state.reviewOpen.has(id)?state.reviewOpen.delete(id):state.reviewOpen.add(id);renderTable();if(state.reviewOpen.has(id)){const panel=$(`[data-review-panel="${id}"]`),wb=$('#workbench');if(panel)wb.scrollTop+=panel.getBoundingClientRect().top-wb.getBoundingClientRect().top-80;}}
document.addEventListener('click',e=>{const t=e.target.closest('[data-review-inline]');if(t)toggleReview(t.dataset.reviewInline);});
function selectSubmission(batch){const same=state.batch===batch;if(same)return;state.batch=batch;state.view='batch';refreshDateScope();render();$('#workbench').scrollTop=0;window.refreshForecastControls?.();}
// Keep the old implementation available to the preserved 0.1.9 entry, but not in this UI.
$('.batch-toolbar').style.display='none';$('.filter-panel').style.display='none';
const filterHost=document.createElement('section');filterHost.className='filter-panel filter-v020';filterHost.id='filterControls';$('.filter-panel').before(filterHost);
const submissionHost=document.createElement('section');submissionHost.className='submission-toolbar';submissionHost.id='submissionControls';$('.range-bar').before(submissionHost);
const right=document.createElement('div');right.className='range-right';$('.range-bar').append(right);right.append($('.range-meta'));const configHost=document.createElement('span');configHost.id='columnIcon';right.append(configHost);
const uiHost=document.createElement('div');uiHost.id='antdControls';document.body.append(uiHost);
state.view='batch';render();
