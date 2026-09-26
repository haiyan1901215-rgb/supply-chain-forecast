/* V0.2.2 business additions; old entries keep their original resources. */
allChildren().forEach(c=>{c.manualReasons=c.manualReasons||{};});
noteContent=function(c){return `<span class="note-control-host" data-note-control="${c.id}"></span>`;};
const v022Cells=dateCells;
dateCells=function(c,line){
  if(line==='controls')return `<td class="forecast-section-fill" colspan="${visibleColumns().length}"></td>`;
  if(line!=='manual'&&line!=='activity')return v022Cells(c,line);
  const template=document.createElement('template');template.innerHTML='<table><tbody><tr>'+v022Cells(c,line)+'</tr></tbody></table>';
  template.content.querySelectorAll('td').forEach((td,i)=>{
    const col=visibleColumns()[i];if(col.type!=='day')return;
    const key=dateKey(col.days[0]),reason=line==='manual'?c.manualReasons[key]:[c.activity[key]?.name,c.activity[key]?.note].filter(Boolean).join('\n');
    if(reason)td.insertAdjacentHTML('beforeend',`<span class="reason-host" data-reason-host="${c.id}" data-reason-kind="${line}" data-reason-date="${key}"></span>`);
  });
  return template.content.querySelector('tr').innerHTML;
};
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-edit-manual],[data-event],[data-note-edit]');if(!t)return;
  e.preventDefault();e.stopImmediatePropagation();hideCodeTooltip();hideImagePreview();
  if(t.dataset.editManual)window.openForecastEditor?.({kind:'manual',id:t.dataset.editManual,key:dateKey(allDays[Number(t.dataset.index)])});
  else if(t.dataset.event)window.openForecastEditor?.({kind:'activity',id:t.dataset.event,key:t.dataset.date});
  else window.openForecastEditor?.({kind:'note',id:t.dataset.noteEdit});
},true);
const messageHost=document.createElement('div');messageHost.id='forecastMessages';document.body.append(messageHost);
function positionForecastMessages(){const workbench=$('#workbench').getBoundingClientRect(),r=workbench.width?workbench:$('.main').getBoundingClientRect();messageHost.style.left=r.left+'px';messageHost.style.width=r.width+'px';messageHost.style.top=Math.max(64,r.top-44)+'px';}
new ResizeObserver(positionForecastMessages).observe($('#workbench'));window.addEventListener('resize',positionForecastMessages);positionForecastMessages();
toast=function(text){positionForecastMessages();window.forecastMessage?.(text,/失败|错误|重试/.test(text)?'error':'success');};
renderTable();
