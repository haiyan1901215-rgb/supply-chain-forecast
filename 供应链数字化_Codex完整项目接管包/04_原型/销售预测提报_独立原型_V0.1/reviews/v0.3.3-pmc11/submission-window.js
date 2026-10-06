/* Batch window configuration is independent from the forecast coverage range. */
(() => {
  const fallback=Object.freeze({title:'2026年9月销售预测',startsAt:'2026-09-29T09:00:00+08:00',deadlineAt:'2026-10-03T18:00:00+08:00',freezesAt:'2026-10-04T00:00:00+08:00'});
  let activeBatchId=null,syncing=false;
  const resolveConfig=()=>{
    const contract=window.ForecastBatchContract,batch=contract?.getBatchMeta?.(activeBatchId)||contract?.getCurrentMeta?.()||contract?.getCurrent?.(),batchWindow=contract?.getWindow?.(batch?.id);
    return Object.freeze({title:batch?.name||fallback.title,startsAt:batchWindow?.submissionStartTime||fallback.startsAt,deadlineAt:batchWindow?.submissionDeadlineTime||fallback.deadlineAt,freezesAt:batchWindow?.submissionFreezeTime||fallback.freezesAt,effectiveAt:batchWindow?.ruleEffectiveTime||null,calendarVersion:batchWindow?.calendarVersion||null,batchId:batchWindow?.batchId||batch?.id||null,batchVersion:batchWindow?.batchVersion||batch?.batchVersion||null});
  };
  function statusAt(now=Date.now(),locked=false,config=resolveConfig()){
    if(locked||now>=Date.parse(config.freezesAt))return {key:'frozen',label:'已冻结',badge:'default',editable:false};
    if(now>=Date.parse(config.deadlineAt))return {key:'closed',label:'已截止',badge:'warning',editable:false};
    if(now<Date.parse(config.startsAt))return {key:'waiting',label:'尚未开始',badge:'default',editable:false};
    return {key:'open',label:'销售填报中',badge:'processing',editable:true};
  }
  const states={waiting:{key:'waiting',label:'待发起销售填报',badge:'default',editable:false},scheduled:{key:'scheduled',label:'尚未开始',badge:'default',editable:false},open:{key:'open',label:'销售填报中',badge:'processing',editable:true},closed:{key:'closed',label:'已截止，等待冻结',badge:'warning',editable:false},frozen:{key:'frozen',label:'已冻结',badge:'default',editable:false}};
  const batchMeta=()=>window.ForecastBatchContract?.getBatchMeta?.(activeBatchId)||window.ForecastBatchContract?.getCurrentMeta?.()||window.ForecastBatchContract?.getCurrent?.();
  function sync(now=Date.now()){
    if(syncing)return false;
    const batch=batchMeta(),config=resolveConfig();
    if(batch?.submissionState!=='填报中'||now<Date.parse(config.freezesAt))return false;
    syncing=true;
    try{
      const snapshot=window.pmcWorkflow?.getSalesForecastSnapshot?.(batch.id)||null;
      window.ForecastBatchContract?.freeze?.(batch.id,'销售填报窗口到期，系统自动冻结',snapshot,new Date(now).toISOString());
      return true;
    }finally{syncing=false;}
  }
  const current=(now=Date.now())=>{
    sync(now);
    const submissionState=batchMeta()?.submissionState;
    if(submissionState==='已冻结')return states.frozen;
    if(submissionState==='已截止')return states.closed;
    if(submissionState==='填报中'){
      const timed=statusAt(now,false,resolveConfig());
      return timed.key==='waiting'?states.scheduled:timed;
    }
    if(!submissionState||submissionState==='待发布'||submissionState==='待发起销售填报')return states.waiting;
    return states.waiting;
  };
  const windowApi={statusAt,current,sync,isOpen:()=>current().editable,setBatchId:batchId=>{const next=batchId||null;if(activeBatchId===next)return;activeBatchId=next;refresh(true);},getBatchId:()=>activeBatchId};
  Object.defineProperty(windowApi,'config',{enumerable:true,get:resolveConfig});
  window.ForecastWindow=windowApi;
  activeBatchId=window.ForecastBatchContract?.getCurrentMeta?.()?.id||null;
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
  setInterval(refresh,30000);
  refresh(true);
})();
