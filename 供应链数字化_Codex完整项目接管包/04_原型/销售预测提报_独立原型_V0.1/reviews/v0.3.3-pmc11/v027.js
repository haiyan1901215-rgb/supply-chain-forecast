/* Compatible density and hierarchy changes; forecast data and editor rules remain untouched. */
(() => {
  fieldCatalog.find(f=>f.key==='actions').label='趋势 / 分析 / SKU映射';
  historyRowHTML=function(c,row){return v023HistoryHTML(c,row);};
  const previousProduct=productCell;
  productCell=function(g,c,span){return previousProduct(g,c,span).replace(/<button class="history-toggle"[\s\S]*?<\/button>/,`<span data-history-management="${c.id}"></span>`);};
  contextCell=function(c,span){
    if(!hasContext())return '';
    const metrics={today:['7日ADU',c.base,'近7日平均每日销量，件/天'],adu7:['14日ADU',c.base-1,'近14日平均每日销量，件/天'],adu30:['30日ADU',c.base-3,'近30日平均每日销量，件/天'],stock:['可售库存',c.stock+c.fba,'国内仓与FBA可售库存合计，件'],transit:['在途合计',c.inbound+c.fbaInbound,'采购在途与FBA在途合计，件'],doi:['DOI',c.doi,'系统库存周转天数'],arrival:['预计到货',c.arrival,'系统预计到货日期']};
    const selected=orderedFields('销售与库存').filter(f=>metrics[f.key]);
    // Preserve the exact configured order, including moves between sales and stock metrics.
    const sections=[];
    selected.forEach(f=>{const label=['today','adu7','adu30','weighted'].includes(f.key)?'销量':'库存';if(sections.at(-1)?.label!==label)sections.push({label,fields:[]});sections.at(-1).fields.push(f);});
    const section=({label,fields})=>`<section class="context-section"><div class="context-section-title">${label}</div><div class="metric-grid">${fields.map(f=>{const [name,value,hint]=metrics[f.key];return `<div class="metric" data-field="${f.key}"><label tabindex="0" data-hint="${hint}">${name}</label><strong>${value==null?'':typeof value==='number'?num(value)+(f.key==='doi'?' 天':''):esc(value)}</strong></div>`;}).join('')}</div></section>`;
    return `<td class="context-cell" rowspan="${span}">${sections.map(section).join('')}${hasField('warning')&&c.doi!=null&&c.doi<20?`<div class="coverage-note risk" tabindex="0" data-hint="预计库存耗尽 ${c.exhausted}，早于预计到货 ${c.arrival}；系统只读背景">⚠ 预计缺货 ${esc(c.exhausted)}</div>`:''}</td>`;
  };
  const previousWeekHeaders=weekHeaders;
  weekHeaders=function(){
    const template=document.createElement('template');template.innerHTML='<table><thead><tr>'+previousWeekHeaders()+'</tr></thead></table>';
    const now=isoWeekKey(parseDay(activeForecastBatchDate()));
    const button=template.content.querySelector(`[data-week-toggle="${now}"]`);
    if(button){const cell=button.closest('th');cell.classList.add('current-forecast-week');cell.querySelector('.week-heading').insertAdjacentHTML('beforeend','<span class="current-week-label">当前周</span>');}
    return template.content.querySelector('tr').innerHTML;
  };
  const previousRender=renderTable;
  renderTable=function(){previousRender();
    const labels={system:'规则预测，只读规则建议',manual:'人工预测，可填写销量与原因',activity:'活动预测，可填写活动销量与活动说明',final:'最终预测，只读；活动预测优先于人工预测，人工预测优先于规则预测'};
    $$('[data-forecast-line]').forEach(row=>{const cell=row.querySelector('.line-cell'),hint=labels[row.dataset.forecastLine];if(cell&&hint){cell.dataset.hint=hint;cell.tabIndex=0;}});
    window.refreshForecastControls?.();
  };
  render();
})();
