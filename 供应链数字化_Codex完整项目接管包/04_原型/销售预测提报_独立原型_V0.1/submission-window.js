/* Batch window configuration is independent from the forecast coverage range. */
(() => {
  const config=Object.freeze({
    title:'2026年10月销售预测',
    startsAt:'2026-10-21T09:00:00+08:00',
    deadlineAt:'2026-10-25T18:00:00+08:00',
    freezesAt:'2026-10-26T00:00:00+08:00'
  });
  function statusAt(now=Date.now(),locked=false){
    if(locked||now>=Date.parse(config.freezesAt))return {key:'frozen',label:'已冻结',badge:'default',editable:false};
    if(now>=Date.parse(config.deadlineAt))return {key:'closed',label:'已截止',badge:'warning',editable:false};
    if(now<Date.parse(config.startsAt))return {key:'waiting',label:'尚未开始',badge:'default',editable:false};
    return {key:'open',label:'填报中',badge:'processing',editable:true};
  }
  // Presentation-only override: never rewrites timestamps, submission records or lock storage.
  let mode='open';
  const demoTimes={waiting:'2026-10-21T08:00:00+08:00',open:'2026-10-23T12:00:00+08:00',closed:'2026-10-25T18:00:00+08:00',frozen:'2026-10-26T00:00:00+08:00'};
  const current=()=>mode==='auto'?statusAt(Date.now(),window.pmcWorkflow?.getState().locked):statusAt(Date.parse(demoTimes[mode]));
  const setMode=value=>{if(value!=='auto'&&!Object.hasOwn(demoTimes,value))return;mode=value;refresh();window.dispatchEvent(new Event('forecast-window-change'));};
  window.ForecastWindow={config,statusAt,current,isOpen:()=>current().editable,getMode:()=>mode,setMode};
  const priorCanEdit=canEdit;
  canEdit=key=>current().editable&&priorCanEdit(key);
  let lastKey;
  function refresh(){
    const status=current();
    if(lastKey!==status.key){lastKey=status.key;state.editing=null;renderTable();window.dispatchEvent(new Event('forecast-window-change'));}
  }
  window.addEventListener('forecast-workflow-change',refresh);
  document.addEventListener('visibilitychange',refresh);
  window.addEventListener('focus',refresh);
  setInterval(refresh,1000);
  refresh();
})();
