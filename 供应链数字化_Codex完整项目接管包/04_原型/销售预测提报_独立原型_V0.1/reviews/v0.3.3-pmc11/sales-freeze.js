/* Frozen sales presentation; workflow state is owned by pmc-workflow.js. */
(() => {
  const antEditIcon='<span class="entry-edit-slot" aria-hidden="true"><span role="img" class="anticon anticon-edit edit-icon entry-ant-edit"><svg viewBox="64 64 896 896" focusable="false" data-icon="edit" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M257.7 752c2 0 4-.2 6-.5L431.9 722c2-.4 3.9-1.3 5.3-2.8l423.9-423.9c3.1-3.1 3.1-8.2 0-11.3L694.9 117.7c-1.5-1.5-3.5-2.3-5.6-2.3s-4.1.8-5.6 2.3L259.8 541.6c-1.5 1.5-2.4 3.3-2.8 5.3l-29.5 168.2a33.5 33.5 0 0 0 9.4 29.8c5.6 5.6 13.1 8.8 20.8 8.8zm42.1-182.1L689.3 180.2l108.5 108.5-389.6 389.6-136.2 24 27.8-132.4z"></path><path d="M880 836H144c-17.7 0-32 14.3-32 32v36c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-36c0-17.7-14.3-32-32-32z"></path></svg></span></span>';
  const previousProduct=productCell;
  productCell=function(g,c,span){
    const template=document.createElement('template');template.innerHTML='<table><tbody><tr>'+previousProduct(g,c,span)+'</tr></tbody></table>';
    const cell=template.content.querySelector('td'),info=cell.querySelector('.product-info'),tags=cell.querySelector('.product-tags');
    const listing=Array.from(cell.querySelectorAll('.product-meta')).find(el=>el.textContent.trim().startsWith('上架'));
    const line=cell.querySelector('.child-asin-line'),store=cell.querySelector('.child-store'),asin=line?.querySelector(':scope > .code-value');
    if(line&&store&&asin){
      line.classList.add('store-first-line');
      line.insertBefore(store,asin);
      store.insertAdjacentHTML('afterend',separator());
    }
    if(info){if(listing){listing.classList.add('sales-listing');listing.innerHTML=listing.innerHTML.replace(/上架\s*/, '上架时间：');info.append(listing);}if(tags){tags.classList.add('sales-tags');info.append(tags);}}
    return cell.outerHTML;
  };
  const separator=()=>'<span class="inline-separator" aria-hidden="true">丨</span>';
  const previousParentBand=parentBand;
  parentBand=function(g){
    const template=document.createElement('template');template.innerHTML='<table><tbody><tr>'+previousParentBand(g)+'</tr></tbody></table>';
    const strip=template.content.querySelector('.parent-strip');
    if(strip){
      const items=Array.from(strip.querySelectorAll(':scope > .code-value, :scope > .parent-skc, :scope > .parent-sales'));
      items.slice(1).forEach(item=>item.insertAdjacentHTML('beforebegin',separator()));
    }
    return template.content.querySelector('td').outerHTML;
  };
  function adjustmentEntry(c,key,kind,f,entryValue){
    if(entryValue==null)return '';
    const base=kind==='manual'?f?.ai:(f?.manual??f?.ai);
    if(base==null)return '';
    return `<span class="adjustment-entry" data-reason-host="${c.id}" data-reason-date="${key}" data-reason-kind="${kind}" data-reason-label="${signed(entryValue-base)}" aria-label="${kind==='manual'?'人工预测':'活动预测'}调整说明"></span>`;
  }
  historyRows=function(c){
    const batches=olderBatches().slice(0,state.historyCount[c.id]||2),rows=[];
    batches.forEach(batch=>{
      rows.push({kind:'final',batch,label:`${formatKey(batch)} 批次`});
      if(state.historyParts.has(c.id+'|'+batch))['ai','manual','activity'].forEach(kind=>rows.push({kind,batch,label:{ai:'规则预测',manual:'人工预测',activity:'活动预测'}[kind]}));
    });
    rows.push({kind:'actual',label:'实际销量'});
    return rows;
  };
  function historyHint(c,row,col){
    if(row.kind==='actual'){
      const values=col.days.map(d=>actualAt(c,dateKey(d)));
      return values.every(v=>v==null)?'目标日期尚未发生或实际销量未回传':`实际销量已回传 ${values.filter(v=>v!=null).length}/${col.days.length}天`;
    }
    return col.days.map(d=>{
      const f=forecastAt(c,row.batch,dateKey(d)),day=dateLabel(d);
      if(!f)return `${day}：批次未覆盖`;
      if(row.kind==='manual')return `${day}：人工预测 ${numberOrBlank(f.manual)}；原因 ${f.manual==null?'未填写人工预测':(f.reason||'未填写原因')}`;
      if(row.kind==='activity')return `${day}：活动预测 ${numberOrBlank(f.activity?.qty)}；活动 ${f.activity?.name||'未填写活动'}；备注 ${f.activity?.note||'未填写备注'}`;
      if(row.kind==='ai')return `${day}：规则预测 ${num(f.ai)}`;
      const source=f.activity?'活动':f.manual!=null?'人工':'规则';
      return `${day}：最终预测 ${num(f.final)}；来源 ${source}；原因 ${f.reason||'沿用规则基准'}`;
    }).join('；');
  }
  function historySource(c,row,col){
    if(row.kind!=='final')return '';
    if(col.type==='week')return 'mixed';
    const f=forecastAt(c,row.batch,dateKey(col.days[0]));
    return !f?'':f.activity?'activity':f.manual!=null?'manual':'system';
  }
  function historySourceLabel(kind){
    return {system:'规则',manual:'人工',activity:'活动',mixed:'混合'}[kind]||'';
  }
  historyRowHTML=function(c,row){
    const isBatch=row.kind==='final',expanded=isBatch&&state.historyParts.has(c.id+'|'+row.batch);
    const labels=isBatch?`<button type="button" class="history-part-toggle" data-history-part="${c.id}|${row.batch}" aria-expanded="${expanded}"><span class="history-part-icon" aria-hidden="true"></span><span>${row.label}</span></button>`:row.kind==='actual'?'实际销量':row.label;
    const cells=visibleColumns().map((col,i)=>{
      const value=row.kind==='actual'?sumValues(col.days.map(d=>actualAt(c,dateKey(d)))):aggregate(c,row.batch,col.days,row.kind),hint=historyHint(c,row,col);
      const label=value==null?'':num(value),preview=(label&&(row.kind==='manual'||row.kind==='activity'))?` data-history-preview-host="${c.id}" data-history-preview-batch="${row.batch}" data-history-preview-kind="${row.kind}" data-history-preview-label="${esc(label)}"`:'';
      const sourceKind=label?historySource(c,row,col):'',sourceText=historySourceLabel(sourceKind);
      const content=row.kind==='final'&&label?`<span class="history-final-value"><span class="history-number">${label}</span><span class="source-tag ${sourceKind}">(${sourceText})</span></span>`:(preview?'':label);
      return `<td class="date-col num ${col.boundary?'week-boundary':''}" data-time-column="${col.key}" data-focus-index="${i}" data-history-batch="${row.batch||''}" data-history-kind="${row.kind}"><span class="history-value" data-hint="${esc(hint)}"${preview} tabindex="0">${content}</span></td>`;
    }).join('');
    return `<tr class="${row.kind==='actual'?'actual-row':isBatch?'history-row':'history-component'}" data-history-for="${c.id}"><td class="line-cell history-label">${labels}</td>${cells}</tr>`;
  };
  dateCells=function(c,line){return visibleColumns().map((col,i)=>{
    const d=col.days[0],key=dateKey(d),index=indexForDate(key),f=forecastAt(c,state.batch,key),focus=`data-focus-index="${i}" data-time-column="${col.key}"`,cls=col.boundary?'week-boundary':'',field=line==='summary'?'final':line;
    const value=weekValue(c,col,field).value,kind=col.type==='week'?'mixed':source(c,d)[0],label={system:'规则',manual:'人工',activity:'活动',mixed:'混合',none:'未覆盖'}[kind];
    if(field==='system')return `<td class="date-col num line-system ${cls}" ${focus}>${numberOrBlank(value)}</td>`;
    if(field==='manual'||field==='activity'){
      const editable=canEdit(key)&&(!window.canEditForecastRecord||window.canEditForecastRecord(c.id))&&col.type==='day',entryValue=field==='manual'?f?.manual:f?.activity?.qty,editing=editable&&field==='manual'&&state.editing===`${c.id}:${index}`;
      const attrs=field==='manual'?`data-edit-manual="${c.id}" data-index="${index}"`:`data-event="${c.id}" data-date="${key}"`;
      const entry=editing
        ? `<div class="entry-input"><input class="cell-number" type="number" min="0" step="1" value="${entryValue??''}" data-manual="${c.id}" data-index="${index}" aria-label="${c.asin} ${dateLabel(d)} 人工预测"/></div>`
        : `<div class="forecast-entry-wrap"><button class="${entryValue==null?'entry-icon':'entry-value'}" type="button" ${attrs} aria-label="${field==='manual'?'人工预测':'活动预测'} ${c.asin} ${dateLabel(d)}"><span class="entry-number">${entryValue==null?'':num(entryValue)}</span>${antEditIcon}</button>${adjustmentEntry(c,key,field,f,entryValue)}</div>`;
      const readonly=col.type==='day'&&state.batch===currentBatch?`<div class="forecast-entry-wrap"><span class="entry-number">${numberOrBlank(entryValue)}</span>${adjustmentEntry(c,key,field,f,entryValue)}</div>`:numberOrBlank(value);
      return `<td class="date-col num ${cls} ${field==='manual'?'line-manual':'line-event'} ${entryValue!=null?'has-forecast':''} ${editable?'entry-cell':''}" ${focus} data-entry="${field}">${editable?entry:readonly}</td>`;
    }
    const attrs=col.type==='week'?`data-week-detail="${col.week.key}" data-asin="${c.id}"`:`data-final="${c.id}" data-index="${index}"`;
    return `<td class="date-col num line-final ${cls}" ${focus}>${value==null?'':`<button class="cell-link final-value" type="button" ${attrs}><span class="final-number">${num(value)}</span><span class="source-tag ${kind}">(${label})</span></button>${line==='summary'?deltaMarkup(alignedDelta(c,state.batch,olderBatches()[0],col.days),''):''}`}</td>`;
  }).join('');};
  renderTable();
})();
