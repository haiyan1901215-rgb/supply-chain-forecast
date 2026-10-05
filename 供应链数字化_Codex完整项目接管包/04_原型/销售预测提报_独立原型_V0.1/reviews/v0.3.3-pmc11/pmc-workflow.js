/* Local, versioned forecast submission -> PMC review -> replenishment demand. */
(() => {
  const h=React.createElement,{useState,useEffect}=React;
  const {ConfigProvider,App,Tabs,Table,Button,Space,Tag,Input,InputNumber,Form,Switch,Tooltip,Alert,Select,DatePicker,Modal,Popover}=antd;
  let db={schema:1,locked:false,records:{},demands:{}};
  let active='forecast-workbench',activeOrigin='top-forecast-workbench',refresh=()=>{},dirtyReview=false,guard=action=>action(),planningSystemTab={active:'base',batchId:null},forecastWorkbenchTab={active:'base',bindingsOpen:false},forecastNavigationContext=null;
  const salesBatch=()=>window.ForecastBatchContract?.getCurrentMeta?.()||window.ForecastBatchContract?.getCurrent?.()||null;
  const salesBatchDate=()=>salesBatch()?.batchDate||currentBatch;
  const salesRange=(batchId=salesBatchDate())=>{const batch=window.ForecastBatchContract?.getBatchMeta?.(batchId)||window.ForecastBatchContract?.getBatch?.(batchId);return {start:batch?.forecastStartDate||batchId,end:batch?.forecastEndDate||shiftDay(batchId,181)};};
  const salesDays=(batchId=salesBatchDate())=>{const range=salesRange(batchId);return Array.from({length:dayDistance(range.end,range.start)+1},(_,i)=>shiftDay(range.start,i));};
  const key=(c,batchId=salesBatchDate())=>batchId+'|'+c.id,statusOf=(c,batchId=salesBatchDate())=>db.records[key(c,batchId)]?.status||'draft';
  const statuses={draft:'待销售提报',pending:'待PMC审核',confirmed:'已确认',returned:'销售退回'};
  const colors={draft:'default',pending:'processing',confirmed:'success',returned:'warning'};
  const batchRecords=batchId=>Object.fromEntries(Object.entries(db.records).filter(([recordKey])=>recordKey.startsWith(batchId+'|')));
  const workflowState=()=>{const records=Object.values(batchRecords(salesBatchDate()));if(records.some(record=>record.status==='returned'))return{returned:true,key:'returned',label:'销售退回'};if(records.some(record=>record.status==='pending'))return{key:'pending',label:'待PMC审核'};if(records.length&&records.every(record=>record.status==='confirmed'))return{key:'confirmed',label:'已确认'};return{key:'draft',label:'待销售提报'};};
  const all=()=>{const rows=groups.flatMap(g=>g.children.map(c=>({g,c,id:c.id}))),batch=salesBatch();if(!batch)return rows;const ids=new Set(batch.childForecastResults.map(row=>row.childId));return rows.filter(row=>ids.has(row.c.id));};
  const total=(data,field)=>sumValues(Object.values(data||{}).map(d=>field==='activity'?d.activity?.qty:d[field]));
  const legacyForecastAt=forecastAt;
  const plannedForecastCache=new Map();
  const publishedGroupsCache=new Map();
  const originalFilteredGroups=filteredGroups;
  filteredGroups=function(){
    let projected=publishedGroupsCache.get(state.batch);
    if(!publishedGroupsCache.has(state.batch)){
      const index=window.ForecastBatchContract?.getForecastIndex?.(state.batch);
      if(index){
        const buckets=new Map();
        Object.values(index.children).forEach(row=>{
          const source=groups.find(group=>group.children.some(child=>child.id===row.childId));
          const child=source?.children.find(item=>item.id===row.childId);
          if(!source||!child)return;
          const key=[row.country,row.store,row.parentASIN].join('|');
          if(!buckets.has(key)){
            const template=groups.find(group=>group.market===row.country&&group.account===row.store&&group.parent===row.parentASIN)||source;
            buckets.set(key,{...template,id:key,parent:row.parentASIN,market:row.country,account:row.store,children:[]});
          }
          buckets.get(key).children.push(child);
        });
        projected=[...buckets.values()];
      }else projected=null;
      publishedGroupsCache.set(state.batch,projected);
    }
    return projected?projected.map(group=>({...group,children:group.children.filter(child=>matches(child,group))})).filter(group=>group.children.length):originalFilteredGroups();
  };
  let salesForecastDirty=false;
  const plannedAt=(batchId,childId,date)=>{
    const cacheKey=`${batchId}|${childId}|${date}`;
    if(plannedForecastCache.has(cacheKey))return plannedForecastCache.get(cacheKey);
    const value=window.ForecastBatchContract?.getDailyForecast?.(batchId,childId,date)||null;
    plannedForecastCache.set(cacheKey,value);
    return value;
  };
  window.addEventListener('forecast-batch-change',()=>{plannedForecastCache.clear();publishedGroupsCache.clear();salesForecastDirty=true;});
  forecastAt=function(c,batch,date){
    const live=legacyForecastAt(c,batch,date),planned=plannedAt(batch,c.id,date);
    if(!planned)return live?{...live,pmc:live.pmc??live.ai}:live;
    const ai=planned.systemForecast??planned.systemSplitForecast??null,pmc=planned.pmcBaseline??planned.ruleForecast??null,forecastStatus=planned.forecastStatus||null,manual=forecastStatus?null:live?.manual??null,activity=forecastStatus?null:live?.activity?JSON.parse(JSON.stringify(live.activity)):null;
    return {ai,pmc,forecastStatus,manual,activity,final:forecastStatus?null:resolveForecast(pmc,manual,activity?.qty),reason:forecastStatus||((activity!=null||manual!=null)?(live?.reason||planned.reason):planned.reason)};
  };
  window.canEditForecastDate=(childId,date)=>!plannedAt(state.batch,childId,date)?.forecastStatus;
  const snapshot=(c,batchId=salesBatchDate())=>Object.fromEntries(salesDays(batchId).map(date=>[date,JSON.parse(JSON.stringify(forecastAt(c,batchId,date)))]));
  const effective=(r,date)=>r.calibration?.[date]??r.sales[date].final;
  const effectiveTotal=r=>Object.keys(r.sales||{}).reduce((s,d)=>s+effective(r,d),0);
  function planningBatchLabel(batchId){const batch=window.ForecastBatchContract?.getBatch?.(batchId);return `${formatKey(batch?.batchDate||currentBatch)} 批次`;}
  function shellNotice(message){if(typeof window.toast==='function')window.toast(message);}
  function setPlanningMenuOpen(open){const group=$('[data-menu-group="planning"]'),toggle=$('[data-menu-toggle="planning"]'),submenu=$('#planning-submenu');if(!group||!toggle||!submenu)return;group.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));submenu.hidden=!open;}
  function updateShellMenu(view,origin){
    $$('[data-view]').forEach(item=>item.classList.toggle('active',item.dataset.view===view&&item.dataset.menuOrigin===origin));
    const group=$('[data-menu-group="planning"]');group?.classList.toggle('is-active',view==='decomposition');
    if(view==='decomposition')setPlanningMenuOpen(true);
  }
  function mountPortalIcons(){
    if(!window.ReactDOM?.createRoot||!window.icons)return;
    $$('[data-shell-icon]').forEach(node=>{const Icon=window.icons[node.dataset.shellIcon];if(!Icon||node.dataset.shellMounted)return;node.dataset.shellMounted='true';ReactDOM.createRoot(node).render(h(Icon,{className:'portal-shell-icon','aria-hidden':true}));});
  }
  function setupPortalShell(){
    mountPortalIcons();
    document.addEventListener('click',e=>{
      const target=e.target.closest?.('[data-shell-action]');
      const userMenu=$('.user-menu'),userButton=$('[data-shell-action="toggle-user"]');
      if(target){
        const action=target.dataset.shellAction;
        if(action==='toggle-user'){const open=userMenu?.hidden!==false;if(userMenu)userMenu.hidden=!open;userButton?.setAttribute('aria-expanded',String(open));e.preventDefault();e.stopPropagation();return;}
        if(userMenu){userMenu.hidden=true;userButton?.setAttribute('aria-expanded','false');}
        if(action==='refresh'){if(active==='sales'){renderTable();salesForecastDirty=false;syncHorizontalScrollbar();}else refresh();shellNotice('当前工作区已刷新');}
        if(action==='home')shellNotice('统一业务门户入口已保留在左上角企业 Logo');
        if(action==='profile')shellNotice('个人中心入口已就绪');
        if(action==='preferences')shellNotice('偏好设置入口已就绪');
        if(action==='logout')shellNotice('原型环境不执行真实退出登录');
        e.preventDefault();e.stopPropagation();return;
      }
      if(userMenu&&!e.target.closest('.user-menu-wrap')){userMenu.hidden=true;userButton?.setAttribute('aria-expanded','false');}
    });
    $('[data-menu-toggle="planning"]')?.addEventListener('click',e=>{e.preventDefault();const toggle=e.currentTarget;setPlanningMenuOpen(toggle.getAttribute('aria-expanded')!=='true');});
    $$('.menu [data-view]').forEach(item=>item.addEventListener('click',e=>{e.preventDefault();const view=item.dataset.view;if(view==='transfer'){shellNotice('调拨计划模块尚未接入当前原型');return;}selectView(view,{origin:item.dataset.menuOrigin});}));
    setPlanningMenuOpen(false);
  }
  const escapeTabLabel=value=>String(value||'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  function renderPlanningSystemTabs(){
    if(!window.portalWorkspaceTabsRender)return;
    const detailLabel=planningSystemTab.label||'预测批次详情';
    window.portalWorkspaceTabsRender({
      activeKey:planningSystemTab.active,
      items:[{key:'base',label:'预测批次列表',closable:false},...(planningSystemTab.batchId?[{key:'detail',label:detailLabel,closable:true}]:[])],
      onChange:key=>key==='detail'?showPlanningDetailTab():showPlanningBaseTab(),
      onEdit:(key,action)=>{if(action==='remove'&&key==='detail'){planningSystemTab={active:'base',batchId:null};showPlanningBaseTab();}}
    });
  }
  function showPlanningBaseTab(){planningSystemTab.active='base';window.ParentAsinModule?.openResultsList?.();renderPlanningSystemTabs();}
  function showPlanningDetailTab(){if(!planningSystemTab.batchId)return showPlanningBaseTab();planningSystemTab.active='detail';window.ParentAsinModule?.openSystemBatchDetail?.(planningSystemTab.batchId,'forecast');renderPlanningSystemTabs();}
  function openForecastResultBatch(batchId,label){
    const resolvedLabel=label||window.ParentAsinModule?.getBatchLabel?.(batchId)||planningBatchLabel(batchId);
    planningSystemTab={active:'detail',batchId,label:resolvedLabel};
    window.ParentAsinModule?.openSystemBatchDetail?.(batchId,'forecast');
    selectView('decomposition',{keepPlanningSystemTab:true});
  }
  function openPlanning(route){planningSystemTab={active:'base',batchId:null};window.ParentAsinModule?.navigate(route);selectView('decomposition');}
  function renderForecastWorkbenchTabs(){
    if(!window.portalWorkspaceTabsRender)return;
    window.portalWorkspaceTabsRender({
      activeKey:forecastWorkbenchTab.active,
      items:[{key:'base',label:'预测工作台',closable:false},...(forecastWorkbenchTab.bindingsOpen?[{key:'bindings',label:'变体关系管理',closable:true}]:[])],
      onChange:key=>key==='bindings'?openForecastBindings():showForecastWorkbenchBase(),
      onEdit:(key,action)=>{if(action==='remove'&&key==='bindings')closeForecastBindings();}
    });
  }
  function showForecastWorkbenchBase(){forecastWorkbenchTab.active='base';selectView('forecast-workbench',{keepForecastWorkbenchTab:true,origin:'top-forecast-workbench'});}
  function openForecastBindings(){forecastWorkbenchTab={active:'bindings',bindingsOpen:true};selectView('forecast-workbench',{keepForecastWorkbenchTab:true,origin:'top-forecast-workbench'});}
  function closeForecastBindings(){forecastWorkbenchTab={active:'base',bindingsOpen:false};showForecastWorkbenchBase();}
  function focusSalesForecast(context){
    const entity=context?.entity;if(!entity)return;
    const group=groups.find(item=>item.id===entity.groupId)||(groups.find(item=>item.parent===entity.parentAsin&&item.market===entity.market&&item.account===entity.account));
    state.batch=context.batchDate||salesBatchDate();
    state.view='batch';
    state.query=entity.childAsin||entity.parentAsin||'';
    state.filters={market:entity.market||'',platform:entity.platform||'Amazon',account:entity.account||'',owner:entity.owner||'',tag:''};
    state.page=1;
    if(group){
      state.collapsed.delete(group.id);
      const children=entity.childId?group.children.filter(child=>child.id===entity.childId):group.children;
      children.forEach(child=>state.expandedChildren.add(child.id));
    }
    refreshDateScope?.(context.windowStartDate||null);
    if(context.windowStartDate&&context.windowEndDate)syncWindow(indexForDate(context.windowStartDate),indexForDate(context.windowEndDate));
    render();
    window.dispatchEvent(new CustomEvent('sales-forecast-filter-sync',{detail:{filters:{...state.filters},query:state.query}}));
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const row=entity.childId?document.querySelector(`tr[data-child-row="${CSS.escape(entity.childId)}"]`):document.querySelector(`tr[data-parent-id="${CSS.escape(group?.id||entity.groupId||'')}"]`);
      row?.scrollIntoView({block:'center',behavior:'smooth'});
    }));
  }
  function openSalesFromForecast(context){
    forecastNavigationContext=context;
    selectView('sales',{origin:'top-sales',forecastContext:true});
    focusSalesForecast(context);
  }
  function returnToForecastContext(){
    if(!forecastNavigationContext)return selectView('forecast-workbench',{origin:'top-forecast-workbench'});
    selectView('forecast-workbench',{origin:'top-forecast-workbench',keepForecastWorkbenchTab:true,restoreForecastContext:true});
  }
  function transaction(change){const next=JSON.parse(JSON.stringify(db));change(next);db=next;refresh();renderTable();window.dispatchEvent(new Event('forecast-workflow-change'));}
  function editable(c){return (window.ForecastWindow?window.ForecastWindow.isOpen():!db.locked)&&['draft','returned'].includes(statusOf(c));}
  window.canEditForecastRecord=id=>editable(findChild(id));
  const priorProduct=productCell;
  productCell=function(g,c,span){const html=priorProduct(g,c,span),record=db.records[key(c)];if(!record)return html;return html.replace('</td>',`<div class="pmc-muted">${esc(statuses[record.status])}${record.returnReason&&record.status==='returned'?' · '+esc(record.returnReason):''}</div></td>`);};
  const priorCanEdit=canEdit;canEdit=function(date){return (window.ForecastWindow?window.ForecastWindow.isOpen():!db.locked)&&priorCanEdit(date);};
  // Capture before the legacy grid handler: submitted records are immutable.
  window.addEventListener('click',e=>{const target=e.target.closest('[data-edit-manual],[data-event]');if(!target)return;const c=findChild(target.dataset.editManual||target.dataset.event);if(c&&!editable(c)){e.preventDefault();e.stopImmediatePropagation();toast(db.locked?'本批次填报已冻结':'该预测已提交，退回后可重新填写');}},true);
  const host=document.createElement('section');host.className='pmc-workspace';host.hidden=true;host.setAttribute('aria-label','PMC销售预测工作台');$('.content').after(host);
  const bar=document.createElement('div');bar.id='pmcRoleBar';$('.content').before(bar);
  const root=ReactDOM.createRoot(host),barRoot=ReactDOM.createRoot(bar);
  const pmcTheme={...enterpriseThemeV020,token:{...enterpriseThemeV020.token,fontSize:12,fontSizeSM:11},components:{...enterpriseThemeV020.components,Button:{...enterpriseThemeV020.components.Button,fontSize:12,contentFontSize:12,contentFontSizeSM:12},Input:{...enterpriseThemeV020.components.Input,fontSize:12,inputFontSize:12,inputFontSizeSM:12},Select:{...enterpriseThemeV020.components.Select,fontSize:12,optionFontSize:12},Table:{...enterpriseThemeV020.components.Table,fontSize:12},Form:{...enterpriseThemeV020.components.Form,labelFontSize:11},Modal:{...enterpriseThemeV020.components.Modal,titleFontSize:13}}};
  const wrap=child=>h(ConfigProvider,{theme:pmcTheme,locale:{locale:'zh-cn',Pagination:{items_per_page:'条/页',jump_to:'跳至',jump_to_confirm:'确定',page:'页',prev_page:'上一页',next_page:'下一页'}},componentSize:'small',button:{autoInsertSpace:false}},h(App,{message:{maxCount:1,top:72}},child));
  function notifyError(message,error){message.error(error.message||'操作失败，请重试');}
  function SalesActions(){const {message,modal}=App.useApp();const candidates=all().filter(({c})=>editable(c)&&(!state.selected.size||state.selected.has(c.id)));
    const submitSales=()=>{
      if(window.ForecastWindow&&!window.ForecastWindow.isOpen())return message.warning('当前不在填报窗口，无法提交');
      if(!candidates.length)return message.warning('没有可提交的子ASIN');
      modal.confirm({title:'提交 '+candidates.length+' 个子ASIN供PMC审核？',content:'提交后保留本次每日预测快照，PMC退回后可重新填写。',okText:'提交',cancelText:'取消',onOk:()=>{try{if(candidates.some(({c})=>!editable(c)))throw Error('填报窗口已关闭或记录已提交');transaction(next=>candidates.forEach(({c,g})=>{const old=next.records[key(c)],sales=snapshot(c);next.records[key(c)]={status:'pending',revision:(old?.revision||0)+1,sales,calibration:{},logs:[...(old?.logs||[]),{at:new Date().toISOString(),action:'销售提交',reason:'',by:g.owner}],versions:[...(old?.versions||[]),...(old?[{revision:old.revision,sales:old.sales,calibration:old.calibration}]:[])]};}));message.success('已提交至PMC审核');}catch(e){notifyError(message,e);}}});
    };
    const windowApi=window.ForecastWindow,config=windowApi?.config,status=windowApi?.current()||{key:'open',label:'填报中'},format=value=>value.slice(0,16).replaceAll('-','/').replace('T',' ');
    const tip=config?`状态随计划配置操作自动更新 · 预测冻结：${format(config.freezesAt)}`:'状态随计划配置操作自动更新';
    return h('div',{className:'sales-window-actions'},
      config?h('span',{className:'sales-window-time'},'填报时间：'+format(config.startsAt)+' ~ '+format(config.deadlineAt)):null,
      h(Tooltip,{title:tip},h(Tag,{color:{initial:'processing',open:'processing',closed:'warning',waiting:'default',frozen:'default'}[status.key],className:'sales-window-state',style:{marginInlineEnd:0}},status.label)),
      h(Button,{type:'primary',disabled:!candidates.length||(windowApi&&!windowApi.isOpen()),onClick:submitSales},state.selected.size?'提交已选预测':'提交本批次'));
  }
  function Bar(){
    const {modal}=App.useApp(),flow=workflowState();
    guard=action=>{if(!dirtyReview)return action();modal.confirm({title:'放弃未保存的PMC校准？',okText:'放弃修改',cancelText:'继续填写',onOk:()=>{dirtyReview=false;action();}});};
    const context=active==='sales'&&forecastNavigationContext?h('div',{className:'sales-workbench-context'},
      h(Button,{type:'text',size:'small',icon:h(icons.LeftOutlined),'aria-label':'返回预测工作台并定位当前对象',onClick:returnToForecastContext},'返回预测工作台'),
      h('span',{className:'pmc-muted'},`当前对象：${forecastNavigationContext.entity?.label||'—'}`)
    ):null;
    return h('div',{className:'pmc-role-bar'},context,h('div',{className:'pmc-demo-state'},h('span',{className:'pmc-muted'},'流程状态'),h(Tag,{color:colors[flow.key]},flow.label)),active==='sales'?h(SalesActions):h('span',{className:'pmc-muted'},'当前批次 '+formatKey(salesBatchDate())+' · '+(active==='review'?'PMC计划员':'备货计划')));
  }
  function Review({row,onChanged}){
    const {message,modal}=App.useApp(),[form]=Form.useForm(),r=row.r||db.records[key(row.c)],readOnly=r?.status!=='pending';
    const days=salesDays();
    const [offset,setOffset]=useState(0),[dirty,setDirty]=useState(false),[returnOpen,setReturnOpen]=useState(false),[returnForm]=Form.useForm();
    useEffect(()=>{dirtyReview=dirty;return()=>{dirtyReview=false;};},[dirty]);
    const windowDays=days.slice(offset,offset+14);
    const initial={calibration:{...(r?.calibration||{})},reason:r?.reason||''};
    const save=values=>{if(statusOf(row.c)!=='pending')return;try{transaction(next=>{const rec=next.records[key(row.c)];rec.calibration=Object.fromEntries(Object.entries(values.calibration||{}).filter(([,v])=>v!=null));rec.reason=values.reason.trim();rec.logs.push({at:new Date().toISOString(),action:'PMC校准',reason:rec.reason,by:'PMC计划员'});});setDirty(false);message.success('校准已保存');onChanged();}catch(e){notifyError(message,e);}};
    const confirm=()=>{if(dirty)return message.warning('请先保存校准或恢复已保存数据');modal.confirm({title:'确认预测并生成备货需求？',content:'以PMC最终日级预测作为唯一需求来源，销售原始提报仍可追溯。',okText:'确认预测',cancelText:'取消',onOk:()=>{try{transaction(next=>{const rec=next.records[key(row.c)];if(rec.status!=='pending')throw Error('当前状态不可确认');rec.status='confirmed';rec.logs.push({at:new Date().toISOString(),action:'确认预测',by:'PMC计划员',reason:''});const batchDate=salesBatchDate(),range=salesRange(batchDate),id=key(row.c,batchDate)+'|'+rec.revision;next.demands[id]={id,recordKey:key(row.c,batchDate),batchDate,forecastStartDate:range.start,forecastEndDate:range.end,revision:rec.revision,asin:row.c.asin,site:row.g.market,name:row.g.name,parent:row.g.parent,qty:effectiveTotal(rec),daily:Object.fromEntries(days.map(d=>[d,effective(rec,d)])),createdAt:new Date().toISOString(),status:'待计划'};});message.success('预测已确认，备货需求已生成');onChanged();}catch(e){notifyError(message,e);}}});};
    if(!r)return h(Alert,{type:'info',message:'销售提交后可审核。'});
    const detailRows=[['ai','规则预测'],['manual','销售人工预测'],['activity','销售活动预测'],['final','销售最终预测'],['pmc','PMC校准'],['effective','PMC最终预测']].map(([id,label])=>({id,label}));
    return h('div',{className:'pmc-review'},h('div',{className:'pmc-review-head'},h('strong',null,row.c.asin+' · 预测审核'),...[['销售最终预测',total(r.sales,'final')],['PMC最终预测',effectiveTotal(r)],['当前库存',row.c.stock+row.c.fba],['在途',row.c.inbound+row.c.fbaInbound]].map(([label,value])=>h('div',{key:label},h('label',null,label),h('strong',null,num(value))))),
      h('div',{className:'pmc-toolbar'},h(Space,null,h(Button,{disabled:offset===0,onClick:()=>setOffset(Math.max(0,offset-14))},'‹'),formatKey(windowDays[0])+' ~ '+formatKey(windowDays.at(-1)),h(Button,{disabled:offset+14>=days.length,onClick:()=>setOffset(offset+14)},'›')),h('span',{className:'pmc-muted'},'单位：件 · 未校准日期沿用销售最终预测')),
      h(Form,{form,initialValues:initial,layout:'vertical',onValuesChange:()=>setDirty(true),onFinish:save},
        h(Table,{rowKey:'id',pagination:false,size:'small',scroll:{x:1650},dataSource:detailRows,columns:[{title:'预测线',dataIndex:'label',width:140,fixed:'left'},...windowDays.map(date=>({title:date.slice(5).replace('-','/'),key:date,width:100,render:(_,line)=>{
          const d=r.sales[date];if(line.id==='pmc')return readOnly?(r.calibration[date]==null?'':num(r.calibration[date])):h(Form.Item,{name:['calibration',date],style:{margin:0},rules:[{type:'integer',min:0,max:999999999,message:'请输入非负整数'}]},h(InputNumber,{min:0,max:999999999,precision:0,controls:false,'aria-label':date+' PMC校准',style:{width:84}}));
          if(line.id==='effective')return h(Form.Item,{noStyle:true,shouldUpdate:true},()=>h('strong',null,num(form.getFieldValue(['calibration',date])??d.final)));
          const value=line.id==='activity'?d.activity?.qty:d[line.id];return value==null?'':h('span',null,num(value),line.id==='final'?h('span',{className:'pmc-source'},'('+(d.activity?'活动':d.manual!=null?'人工':'规则')+')'):null);
        }}))]}),
        !readOnly?h(Form.Item,{name:'reason',label:'PMC校准原因',rules:[{required:true,whitespace:true,message:'请填写需求判断的调整原因'},{max:200,message:'最多200字'}],style:{marginTop:12,maxWidth:640}},h(Input.TextArea,{rows:2,maxLength:200,showCount:true,'aria-label':'PMC校准原因',styles:{textarea:{paddingBottom:24},count:{position:'absolute',bottom:4,right:8}}})):r.reason?h('p',null,'PMC校准原因：'+r.reason):null,
        !readOnly?h('div',{className:'pmc-review-actions'},h(Button,{danger:true,onClick:()=>setReturnOpen(true)},'退回销售'),h(Button,{onClick:()=>{form.resetFields();setDirty(false);}},'恢复已保存数据'),h(Button,{onClick:()=>form.submit()},'保存校准'),h(Button,{type:'primary',onClick:confirm},'确认预测')):null),
      h('div',{className:'pmc-history'},r.logs.map((log,i)=>h('div',{key:i},new Date(log.at).toLocaleString('zh-CN',{hour12:false})+' · '+log.by+' · '+log.action+(log.reason?'：'+log.reason:'')))),
      h(Modal,{open:returnOpen,title:'退回销售',okText:'确认退回',cancelText:'取消',onCancel:()=>setReturnOpen(false),onOk:()=>returnForm.submit()},h(Form,{form:returnForm,layout:'vertical',onFinish:values=>{try{transaction(next=>{const rec=next.records[key(row.c)];if(rec.status!=='pending')throw Error('当前状态不可退回');rec.status='returned';rec.returnReason=values.reason.trim();rec.logs.push({at:new Date().toISOString(),action:'退回销售',by:'PMC计划员',reason:rec.returnReason});});setReturnOpen(false);message.success('已退回销售');onChanged();}catch(e){notifyError(message,e);}}},h(Form.Item,{name:'reason',label:'退回原因',rules:[{required:true,whitespace:true,message:'请说明需要销售重新确认的内容'}]},h(Input.TextArea,{rows:3,maxLength:200,showCount:true,'aria-label':'退回原因'})))));
  }
  function Workspace(){
    const [viewportHeight,setViewportHeight]=useState(innerHeight);
    useEffect(()=>{const resize=()=>setViewportHeight(innerHeight);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
    const [status,setStatus]=useState('pending'),[query,setQuery]=useState(''),[expanded,setExpanded]=useState([]),[revision,bump]=useState(0),[site,setSite]=useState('all');
    if(active==='forecast-workbench'&&forecastWorkbenchTab.active==='bindings'&&window.ForecastBindingWorkspace)return h(window.ForecastBindingWorkspace,{onBack:showForecastWorkbenchBase});
    if(active==='forecast-workbench'&&window.ForecastWorkbench)return h(window.ForecastWorkbench,{onOpenSales:openSalesFromForecast,navigationContext:forecastNavigationContext,onOpenBatch:(batchId,label)=>openForecastResultBatch(batchId,label),onOpenBinding:openForecastBindings});
    if(active==='decomposition'&&window.ParentAsinModule?.ParentAsinWorkspace)return h(window.ParentAsinModule.ParentAsinWorkspace);
    const batchDate=salesBatchDate(),range=salesRange(batchDate),rows=all().map(row=>{const r=db.records[key(row.c,batchDate)],sales=r?.sales||snapshot(row.c,batchDate);return {...row,r,sales,status:statusOf(row.c,batchDate)};});
    const effectiveStatus=status;
    const selected=rows.filter(r=>(effectiveStatus==='all'||r.status===effectiveStatus)&&(site==='all'||r.g.market===site)&&(!query||[r.g.name,r.c.asin,r.g.parent].some(x=>x.toLowerCase().includes(query.toLowerCase()))));
    const number=(field,label)=>({title:label,key:field,width:110,render:(_,row)=>{const value=total(row.sales,field);return value==null?'':num(value);}});
    const columns=[{title:'商品 / 子ASIN',key:'product',width:228,fixed:'left',render:(_,row)=>h('div',null,h('strong',null,row.g.name),h('div',null,row.c.asin),h('span',{className:'pmc-muted'},row.g.market+' · '+row.g.account))},{title:'父ASIN',width:132,render:(_,row)=>row.g.parent},number('final','销售最终预测'),number('ai','规则预测'),{...number('manual','人工填写量'),title:h(Tooltip,{title:'仅统计有人工填写的日期，不与AI或活动相加'},'人工填写量')},{...number('activity','活动填写量'),title:h(Tooltip,{title:'活动日期的绝对销量覆盖值，不是增量'},'活动填写量')},{title:'库存 / 在途',width:110,render:(_,row)=>h('div',null,num(row.c.stock+row.c.fba)+' / '+num(row.c.inbound+row.c.fbaInbound))},{title:'DOI / 耗尽',width:110,render:(_,row)=>h('span',{style:{color:row.c.doi<20?enterpriseThemeV020.token.colorWarning:undefined}},row.c.doi+'天',h('br'),row.c.exhausted)},{title:'PMC最终预测',width:120,render:(_,row)=>row.r?h('strong',null,num(effectiveTotal(row.r))):''},{title:'状态',width:110,render:(_,row)=>h(Tooltip,{title:row.r?.returnReason},h(Tag,{color:colors[row.status]},statuses[row.status]))},{title:'操作',width:100,fixed:'right',render:(_,row)=>h(Button,{type:'link',disabled:row.status==='draft',onClick:()=>setExpanded(expanded.includes(row.id)?[]:[row.id])},expanded.includes(row.id)?'收起':row.status==='pending'?'审核 / 校准':'查看记录')}];
    if(active==='plans')return h(React.Fragment,null,h('div',{className:'pmc-toolbar'},h('h2',{className:'pmc-title'},'备货计划 · 备货需求'),h('span',{className:'pmc-muted'},'来源：已确认的PMC日级预测')),
      h(Table,{rowKey:'id',size:'small',scroll:{x:1150,y:Math.max(260,viewportHeight-235)},pagination:{showSizeChanger:true,showQuickJumper:true,showTotal:n=>'共 '+n+' 条'},locale:{emptyText:'暂无备货需求，确认销售预测后自动形成'},dataSource:Object.values(db.demands),columns:[{title:'商品',dataIndex:'name',width:180},{title:'国家 / 站点',dataIndex:'site',width:95},{title:'子ASIN',dataIndex:'asin',width:145},{title:'来源批次',dataIndex:'batchDate',render:formatKey,width:125},{title:'提报版本',dataIndex:'revision',width:85},{title:'需求范围',render:(_,row)=>formatKey(row.forecastStartDate)+' ~ '+formatKey(row.forecastEndDate),width:210},{title:'确认需求量',dataIndex:'qty',render:v=>h('strong',null,num(v)),width:120},{title:'计划状态',dataIndex:'status',render:v=>h(Tag,null,v),width:90}],expandable:{expandedRowRender:d=>h(Table,{size:'small',rowKey:'date',pagination:{pageSize:14,showSizeChanger:false},dataSource:Object.entries(d.daily).map(([date,qty])=>({date,qty})),columns:[{title:'需求日期',dataIndex:'date'},{title:'PMC确认需求',dataIndex:'qty',render:num}]})}}));
    return h(React.Fragment,null,h('div',{className:'pmc-toolbar'},h('h2',{className:'pmc-title'},'销售预测 · PMC审核'),h('span',{className:'pmc-muted'},'预测范围 '+formatKey(range.start)+' ~ '+formatKey(range.end))),
      h(Tabs,{activeKey:effectiveStatus,onChange:value=>{setStatus(value);setExpanded([]);},items:[...Object.entries(statuses).map(([key,label])=>({key,label:label+' '+rows.filter(r=>r.status===key).length})),{key:'all',label:'全部 '+rows.length}]}),
      h('div',{className:'pmc-toolbar'},h(Space,null,h(Input.Search,{placeholder:'商品名称 / 父子ASIN','aria-label':'审核查询',allowClear:true,onSearch:setQuery,style:{width:300}}),h(Select,{value:site,onChange:setSite,'aria-label':'审核国家站点',style:{width:150},options:[{value:'all',label:'全部国家 / 站点'},{value:'US',label:'🇺🇸 美国 / US'},{value:'UK',label:'🇬🇧 英国 / UK'}]})),h('span',{className:'pmc-muted'},'汇总口径：整个预测范围 · 件')),
      h(Table,{size:'small',rowKey:'id',dataSource:selected,columns,scroll:{x:1440,y:Math.max(260,viewportHeight-350)},pagination:{showSizeChanger:true,showQuickJumper:true,showTotal:n=>'共 '+n+' 个子ASIN'},locale:{emptyText:effectiveStatus==='pending'?'暂无待审核预测，请先在销售填报中提交':'暂无符合条件的预测'},expandable:{showExpandColumn:false,expandedRowKeys:expanded,expandedRowRender:row=>h(Review,{key:row.id+'|'+row.status,row,onChanged:()=>bump(revision+1)})}}));
  }
  function selectView(view,options={}){guard(()=>{if(view==='sales'&&!options.forecastContext)forecastNavigationContext=null;if(view==='forecast-workbench'&&!options.restoreForecastContext)forecastNavigationContext=null;active=view;activeOrigin=options.origin||({sales:'top-sales',plans:'top-plans',decomposition:'plan-batches','forecast-workbench':'top-forecast-workbench'}[view]||activeOrigin);const isSales=view==='sales',isDecomposition=view==='decomposition',isForecastWorkbench=view==='forecast-workbench';if(isDecomposition&&!options.keepPlanningSystemTab)planningSystemTab={active:'base',batchId:null};if(isForecastWorkbench&&!options.keepForecastWorkbenchTab)forecastWorkbenchTab={active:'base',bindingsOpen:false};if(isSales&&salesForecastDirty){renderTable();salesForecastDirty=false;}$('.content').hidden=!isSales;$('.content').style.display=isSales?'':'none';host.hidden=isSales;host.classList.toggle('planning-workspace',isDecomposition);host.classList.toggle('forecast-workbench-view',isForecastWorkbench);bar.hidden=isDecomposition||isForecastWorkbench;const systemTabs=$('.workspace-tabs-v028'),routeLabel=$('.topbar-route-label');if(systemTabs){systemTabs.style.display=(isSales||isDecomposition||isForecastWorkbench)?'':'none';if(isSales)window.forecastWorkspaceTabsRedraw?.();if(isDecomposition)renderPlanningSystemTabs();if(isForecastWorkbench)renderForecastWorkbenchTabs();}if(routeLabel){routeLabel.textContent=isSales?'':isDecomposition?'计划配置':isForecastWorkbench?'预测工作台':view==='plans'?'备货计划':'PMC工作区';routeLabel.hidden=isSales||isForecastWorkbench;}$('.crumb b').textContent=isDecomposition?'预测批次列表':isForecastWorkbench?(forecastWorkbenchTab.active==='bindings'?'变体关系管理':'预测工作台'):view==='plans'?'备货计划':view==='sales'?'销售预测':'PMC审核';updateShellMenu(view,activeOrigin);refresh();if(isSales){syncHorizontalScrollbar();}});}
  refresh=()=>{
    barRoot.render(wrap(h(Bar)));
    if(active!=='sales')root.render(wrap(h(Workspace,{key:active})));
  };
  setupPortalShell();
  document.addEventListener('change',e=>{if(e.target.matches('[data-row-check],[data-select-all]'))refresh();});
  window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#sku=')){bar.hidden=true;host.hidden=true;}else{bar.hidden=false;selectView(active);}});
  window.addEventListener('beforeunload',e=>{if(dirtyReview){e.preventDefault();e.returnValue='';}});
  window.addEventListener('click',e=>{if(!dirtyReview||!e.target.closest('.pmc-workspace')||e.target.closest('.pmc-review'))return;const control=e.target.closest('button,[role="tab"]');if(control){e.preventDefault();e.stopImmediatePropagation();guard(()=>control.click());}},true);
  submit=()=>{active='sales';refresh();};
  const getBatchState=batchId=>{
    const batch=window.ForecastBatchContract?.getBatchMeta?.(batchId)||window.ForecastBatchContract?.getBatch?.(batchId),batchDate=batch?.batchDate||batchId||salesBatchDate(),records=batchRecords(batchDate),values=Object.values(records);
    return {batchId:batch?.id||batchId||null,batchDate,records:JSON.parse(JSON.stringify(records)),submitted:values.length,pending:values.filter(record=>record.status==='pending').length,confirmed:values.filter(record=>record.status==='confirmed').length,returned:values.filter(record=>record.status==='returned').length};
  };
  window.pmcWorkflow={getState:()=>JSON.parse(JSON.stringify(db)),getBatchState,selectView,openPlanning,openForecastResultBatch,showPlanningBaseTab,openForecastBindings,showForecastWorkbenchBase};
  window.addEventListener('forecast-window-change',refresh);
  refresh();updateShellMenu(active,activeOrigin);if(location.hash==='#pmc')selectView('review');else if(location.hash==='#plans')selectView('plans');else if(location.hash.startsWith('#sku='))selectView('sales',{origin:'top-sales'});else selectView('forecast-workbench',{origin:'top-forecast-workbench'});
})();
