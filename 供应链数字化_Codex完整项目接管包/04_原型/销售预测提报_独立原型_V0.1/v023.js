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
