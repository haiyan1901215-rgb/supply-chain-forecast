const columnWidthStorageKey='pmc-forecast-column-widths-v024';
try {
  const widths=JSON.parse(forecastStorage.getItem(columnWidthStorageKey)||'null');
  if(widths){for(const key of ['identity','size','context','line'])if(Number.isFinite(widths[key]))setColumnWidth(key,widths[key]);for(const [key,value] of Object.entries(widths.dates||{}))if(Number.isFinite(value))setColumnWidth('date:'+key,value);for(const [key,value] of Object.entries(widths.weeks||{}))if(Number.isFinite(value))setColumnWidth('week:'+key,value);}
} catch {}
const v024SetColumnWidth=setColumnWidth;
setColumnWidth=function(key,width){v024SetColumnWidth(key,width);try{forecastStorage.setItem(columnWidthStorageKey,JSON.stringify({identity:state.identityWidth,size:state.sizeWidth,context:state.contextWidth,line:state.lineWidth,dates:state.dateWidths,weeks:state.weekWidths}));}catch{}};
try {const saved=JSON.parse(forecastStorage.getItem(configStorageKey)||'{}');const pins=(values,keys)=>(Array.isArray(values)?values:[]).filter(k=>keys.includes(k)&&!fieldCatalog.find(f=>f.key===k)?.required&&!positionFixedFields.has(k)).slice(0,7);columnConfig.pinned=pins(saved.pinned,columnConfig.keys);columnConfig.templates.forEach(t=>{t.pinned=pins(saved.templates?.find(old=>old.name===t.name)?.pinned,t.keys);});}catch{columnConfig.pinned=[];}
const v023HistoryRows=historyRows;
historyRows=function(c){const rows=v023HistoryRows(c),index=rows.findIndex(r=>r.kind==='actual');rows.splice(index,0,{kind:'load'});return rows;};
const v023HistoryHTML=historyRowHTML;
historyRowHTML=function(c,row){
  if(row.kind!=='load')return v023HistoryHTML(c,row);
  return `<tr class="history-load-row" data-history-for="${c.id}"><td class="line-cell"><span data-history-loader="${c.id}"></span></td><td class="history-load-fill" colspan="${visibleColumns().length}"></td></tr>`;
};
const forecastDivider=document.createElement('div');forecastDivider.id='forecastFixedDivider';forecastDivider.setAttribute('aria-hidden','true');document.body.append(forecastDivider);
function positionForecastDivider(){
  const head=$('.forecast-table .line-head'),wb=$('#workbench');if(!head)return;
  const h=head.getBoundingClientRect(),w=wb.getBoundingClientRect();
  forecastDivider.style.display=h.right>w.right?'none':'block';
  forecastDivider.style.left=(h.right-1)+'px';forecastDivider.style.top=w.top+'px';forecastDivider.style.height=w.height+'px';
}
const v023ApplyWidths=applyColumnWidths;
applyColumnWidths=function(){v023ApplyWidths();positionForecastDivider();};
new ResizeObserver(positionForecastDivider).observe($('#workbench'));window.addEventListener('resize',positionForecastDivider);
renderTable();
