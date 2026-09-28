/* Batch window configuration is independent from the forecast coverage range. */
(() => {
  const fallback=Object.freeze({title:'2026年10月销售预测',startsAt:'2026-10-21T09:00:00+08:00',deadlineAt:'2026-10-25T18:00:00+08:00',freezesAt:'2026-10-26T00:00:00+08:00'});
  const resolveConfig=()=>{
    const contract=window.ForecastBatchContract,batchWindow=contract?.getWindow?.(),batch=contract?.getCurrent?.();
    return Object.freeze({title:batch?.name||fallback.title,startsAt:batchWindow?.submissionStartTime||fallback.startsAt,deadlineAt:batchWindow?.submissionDeadlineTime||fallback.deadlineAt,freezesAt:batchWindow?.submissionFreezeTime||fallback.freezesAt,batchId:batchWindow?.batchId||null,batchVersion:batchWindow?.batchVersion||null});
  };
  function statusAt(now=Date.now(),locked=false,config=resolveConfig()){
    if(locked||now>=Date.parse(config.freezesAt))return {key:'frozen',label:'已冻结',badge:'default',editable:false};
    if(now>=Date.parse(config.deadlineAt))return {key:'closed',label:'已截止',badge:'warning',editable:false};
    if(now<Date.parse(config.startsAt))return {key:'waiting',label:'尚未开始',badge:'default',editable:false};
    return {key:'open',label:'填报中',badge:'processing',editable:true};
  }
  const states={waiting:{key:'waiting',label:'待发布',badge:'default',editable:false},open:{key:'open',label:'填报中',badge:'processing',editable:true},closed:{key:'closed',label:'已截止',badge:'warning',editable:false},frozen:{key:'frozen',label:'已冻结',badge:'default',editable:false}};
  const current=()=>{
    const submissionState=window.ForecastBatchContract?.getCurrent?.()?.submissionState;
    if(submissionState==='已冻结')return states.frozen;
    if(submissionState==='已截止')return states.closed;
    if(submissionState==='填报中')return states.open;
    return states.waiting;
  };
  const windowApi={statusAt,current,isOpen:()=>current().editable};
  Object.defineProperty(windowApi,'config',{enumerable:true,get:resolveConfig});
  window.ForecastWindow=windowApi;
  const priorCanEdit=canEdit;
  canEdit=key=>current().editable&&priorCanEdit(key);
  let lastKey;
  function refresh(force=false){
    const status=current();
    if(lastKey!==status.key){lastKey=status.key;state.editing=null;renderTable();}
    if(force)window.dispatchEvent(new Event('forecast-window-change'));
  }
  window.addEventListener('forecast-workflow-change',refresh);
  window.addEventListener('forecast-batch-change',()=>refresh(true));
  refresh(true);
})();
