/* V0.2.6: independent browse dates, header forecast toggle, in-record history tools. */
(() => {
  const h=React.createElement,{useState,useEffect}=React,{ConfigProvider,App,DatePicker}=antd;
  const firstKey='2023-01-01',lastKey=shiftDay(currentBatch,181),today=dayjs(currentBatch),cutoff=today.subtract(1,'day');
  const format=d=>d.format('YYYY-MM-DD');
  const presets=()=>[...[7,14,30,60,90].map(n=>({label:'过去'+n+'天',value:[today.subtract(n,'day'),cutoff]})),
    {label:'本月',value:[today.startOf('month'),cutoff]},{label:'上月',value:[today.subtract(1,'month').startOf('month'),today.subtract(1,'month').endOf('month')]},
    {label:'今年',value:[today.startOf('year'),cutoff]},{label:'去年',value:[today.subtract(1,'year').startOf('year'),today.subtract(1,'year').endOf('year')]}];
  window.forecastBrowsePresets=presets;
  const startKey=dateKey(visibleDays()[0]),endKey=dateKey(visibleDays().at(-1));
  allDays=Array.from({length:dayDistance(lastKey,firstKey)+1},(_,i)=>parseDay(shiftDay(firstKey,i)));
  firstMonth=monthIndex(allDays[0]);lastMonth=monthIndex(allDays.at(-1));syncWindow(indexForDate(startKey),indexForDate(endKey));
  actualAt=function(c,k){const g=groups.find(g=>g.children.includes(c));return g?forecastInsights.salesAt(c,g,k):null;};
  historyRows=function(c){return v023HistoryRows(c);};
  const baseHistoryRow=historyRowHTML;
  historyRowHTML=function(c,row){
    let html=baseHistoryRow(c,row),rows=historyRows(c),last=rows[rows.findIndex(r=>r.kind==='actual')-1];
    if(last&&row.kind===last.kind&&row.batch===last.batch){
      html=html.replace('<tr class="','<tr class="history-tail ');
      html=html.replace('<td class="line-cell history-label">',`<td class="line-cell history-label history-loader-anchor"><span class="history-loader-floating" data-history-loader="${c.id}"></span>`);
    }return html;
  };
  const baseProductCell=productCell;
  productCell=function(g,c,span){return baseProductCell(g,c,span).replaceAll('历史对比','历史提报记录');};
  const baseRenderTable=renderTable;
  renderTable=function(){
    baseRenderTable();
    $$('[data-forecast-line="controls"]').forEach(row=>{
      const id=row.dataset.childRow,first=$(`[data-child-row="${id}"]`);
      if(first)Array.from(first.children).filter(td=>td.hasAttribute('rowspan')).forEach(td=>td.rowSpan=Math.max(1,td.rowSpan-1));row.remove();
    });
    const head=$('.line-head');if(head){const resize=head.querySelector('[data-resize-column]');head.textContent='';const title=document.createElement('div');title.className='forecast-line-heading';title.innerHTML='<span>预测线</span><span data-forecast-toggle="all"></span>';head.append(title);if(resize)head.append(resize);}
    window.refreshForecastControls?.();syncHorizontalScrollbar();positionForecastDivider();
  };
  const baseRender=render;
  render=function(){baseRender();$('.range-title > span').textContent='预测范围';$('#coverageRange').textContent=formatKey(currentBatch)+' - '+formatKey(lastKey);window.refreshBrowseRange?.();};
  const baseSyncWindow=syncWindow;
  syncWindow=function(start=state.windowStart,end=null){
    baseSyncWindow(start,end);state.collapsedWeeks.clear();if(visibleDays().length>31)visibleDays().forEach(d=>state.collapsedWeeks.add(isoWeekKey(d)));
    if(dateKey(visibleDays()[0])<currentBatch)allChildren().forEach(c=>state.historyOpen.add(c.id));
  };
  const host=document.createElement('span');host.className='forecast-range-picker-host';$('#rangeDisplay').after(host);
  function BrowseRange(){
    const [value,setValue]=useState(visibleDays().filter((_,i,a)=>i===0||i===a.length-1).map(d=>dayjs(dateKey(d))));
    useEffect(()=>{window.refreshBrowseRange=()=>setValue([dayjs(dateKey(visibleDays()[0])),dayjs(dateKey(visibleDays().at(-1)))]);return()=>delete window.refreshBrowseRange;},[]);
    return h(DatePicker.RangePicker,{value,format:'YYYY/MM/DD',locale:forecastInsights.calendarLocale,allowClear:false,inputReadOnly:true,presets:presets(),minDate:dayjs(firstKey),maxDate:dayjs(lastKey),variant:'borderless',id:{start:'browse-range-start',end:'browse-range-end'},'aria-label':'当前查看窗口',style:{width:254,fontWeight:600,paddingInline:0},onChange:range=>{if(!range?.every(Boolean))return;syncWindow(indexForDate(format(range[0])),indexForDate(format(range[1])));state.editing=null;$('#workbench').scrollTo(0,0);render();}});
  }
  ReactDOM.createRoot(host).render(h(ConfigProvider,{theme:{...enterpriseThemeV020,token:{...enterpriseThemeV020.token,fontSize:12}},componentSize:'small'},h(App,null,h(BrowseRange))));
  render();
})();
