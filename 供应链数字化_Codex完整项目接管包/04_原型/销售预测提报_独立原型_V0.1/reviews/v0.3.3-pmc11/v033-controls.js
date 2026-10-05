/* Actual Ant Design islands around the existing forecast business grid. */
(() => {
  const h=React.createElement,{useState,useEffect,useReducer}=React;
  const {ConfigProvider,App,Select,Input,Button,Tooltip,Popover,Drawer,Checkbox,List,Space,Tag,Alert,DatePicker,Typography}=antd;
  const {SettingOutlined,HolderOutlined,VerticalAlignTopOutlined,CloseCircleOutlined,LockOutlined,PushpinOutlined,QuestionCircleOutlined,SearchOutlined,EditOutlined}=icons;
  const filterSpec=[
    ['platform','平台',[['Amazon','Amazon'],['Temu','Temu'],['SHEIN','SHEIN']]],
    ['market','国家 / 站点',[['','全部国家 / 站点'],['US','美国 / US'],['UK','英国 / UK']]],
    ['account','账号 / 店铺',[['','全部账号 / 店铺'],['BRABIC-US','BRABIC-US'],['BRABIC-UK','BRABIC-UK']]],
    ['owner','销售负责人',[['','全部销售负责人'],['李敏','李敏'],['周宁','周宁'],['陈洁','陈洁']]],
    ['tag','商品标签',[['','全部商品标签'],['IPD款','IPD款'],['新品','新品'],['成长期','成长期'],['成熟期','成熟期'],['头部','头部'],['中坚','中坚'],['维持','维持'],['限期拯救','限期拯救'],['退市','退市'],['爆款','爆款'],['畅款','畅款'],['平款','平款'],['低销','低销'],['正常','正常'],['暂停','暂停'],['停采','停采']]]
  ];
  const groupNames=[...new Set(fieldCatalog.map(f=>f.group))];
  const canOrder=f=>!f.required&&!positionFixedFields.has(f.key);
  const clone=value=>JSON.parse(JSON.stringify(value));
  const titleFont=13,businessFont=12,helpFont=11;
  const compactTheme={...enterpriseThemeV020,token:{...enterpriseThemeV020.token,fontSize:businessFont,fontSizeSM:helpFont},components:{...enterpriseThemeV020.components,
    Button:{...enterpriseThemeV020.components.Button,fontSize:businessFont,contentFontSize:businessFont,contentFontSizeSM:businessFont},
    Input:{...enterpriseThemeV020.components.Input,fontSize:businessFont,inputFontSize:businessFont,inputFontSizeSM:businessFont},
    Select:{...enterpriseThemeV020.components.Select,fontSize:businessFont,optionFontSize:businessFont},
    InputNumber:{fontSize:businessFont,inputFontSize:businessFont,inputFontSizeSM:businessFont},
    DatePicker:{fontSize:businessFont,inputFontSize:businessFont,inputFontSizeSM:businessFont},
    Form:{...enterpriseThemeV020.components.Form,labelFontSize:helpFont},
    Modal:{...enterpriseThemeV020.components.Modal,titleFontSize:titleFont}}};
  const withApp=child=>h(ConfigProvider,{theme:compactTheme,componentSize:'small',button:{autoInsertSpace:false}},h(App,null,child));

  const forecastCountProps={showCount:true,maxLength:200,autoSize:{minRows:3,maxRows:5},styles:{textarea:{paddingBottom:24},count:{position:'absolute',bottom:5,right:10,margin:0,lineHeight:'16px',fontSize:helpFont,pointerEvents:'none'}}};
  const forecastPreviewCountProps={showCount:true,maxLength:200,autoSize:{minRows:2,maxRows:3},styles:{textarea:{paddingBottom:24,overflow:'hidden',resize:'none'},count:{position:'absolute',bottom:5,right:10,margin:0,lineHeight:'16px',fontSize:helpFont,pointerEvents:'none'}}};
  function ForecastToggleIcon({expanded=false}){
    return h('svg',{viewBox:'0 0 12 12',fill:'none',stroke:'currentColor',strokeWidth:1.3,'aria-hidden':true},h('path',{d:`M2 6h8${expanded?'':'M6 2v8'}`}));
  }
  window.ForecastToggleIcon=ForecastToggleIcon;
  window.ForecastEditorStandards=Object.freeze({countedTextAreaProps:forecastCountProps,previewCountedTextAreaProps:forecastPreviewCountProps});
  function toggleForecastRowsInPlace(children,nextExpanded){
    const table=$('.forecast-table');
    if(!table||!children.length)return false;
    const records=children.map(child=>{
      const rows=[...table.querySelectorAll('tr[data-child-row][data-forecast-line]')].filter(row=>row.dataset.childRow===child.id);
      const byLine=Object.fromEntries(rows.map(row=>[row.dataset.forecastLine,row]));
      return {child,rows,byLine};
    });
    if(records.some(({byLine})=>!byLine.system||!byLine.manual||!byLine.activity||!byLine.final))return false;
    records.forEach(({child,rows,byLine})=>{
      const source=nextExpanded?byLine.final:byLine.system;
      const target=nextExpanded?byLine.system:byLine.final;
      const fixedCells=[...source.children].filter(cell=>cell.hasAttribute('rowspan'));
      const anchor=target.querySelector('.line-cell');
      const historyCount=table.querySelectorAll(`tr[data-history-for="${child.id}"]`).length;
      fixedCells.forEach(cell=>{cell.rowSpan=(nextExpanded?4:1)+historyCount;target.insertBefore(cell,anchor);});
      rows.forEach(row=>{
        const visible=nextExpanded||row===byLine.final;
        row.hidden=!visible;
        row.classList.toggle('forecast-collapsed',!nextExpanded&&row===byLine.final);
        row.classList.toggle('child-start',row===(nextExpanded?byLine.system:byLine.final));
      });
    });
    window.refreshForecastControls?.();
    syncHorizontalScrollbar();
    positionForecastDivider();
    return true;
  }
  function forecastFields(kind,preview=false){
    const item=(name,label,child,rules=[])=>h(antd.Form.Item,{name,label,rules:preview?[]:rules,className:name==='reason'||name==='note'?'forecast-note-field':undefined},child);
    const qty=item('qty','预测销量',h(antd.InputNumber,{'aria-label':'预测销量',min:0,max:999999999,precision:0,readOnly:preview,controls:!preview,style:{width:'100%'},autoFocus:!preview,formatter:preview?v=>v==null||v===''?'':num(Number(v)):undefined}),[{required:true,message:'请填写预测销量'},{type:'integer',min:0,message:'请输入大于等于0的整数'}]);
    const area=(label,props={})=>h(Input.TextArea,{...(preview?forecastPreviewCountProps:forecastCountProps),'aria-label':label,readOnly:preview,...props});
    if(kind==='note')return [item('note','商品备注',area('商品备注',{autoFocus:!preview}),[{max:200,message:'最多200字'}])];
    if(kind==='manual')return [qty,item('reason','人工预测原因',area('人工预测原因',{placeholder:preview?undefined:'说明为什么调整规则预测，例如新增推广资源'}),[{required:true,whitespace:true,message:'请填写不采用规则预测的原因'},{max:200,message:'最多200字'}])];
    return [qty,item('name','活动名称',h(Input,{'aria-label':'活动名称',maxLength:50,showCount:true,readOnly:preview}),[{required:true,whitespace:true,message:'请填写活动名称'},{max:50,message:'最多50字'}]),item('date','活动日期',h(DatePicker,{'aria-label':'活动日期',format:'YYYY/MM/DD',allowClear:false,inputReadOnly:true,open:preview?false:undefined,style:{width:'100%'},disabledDate:d=>!canEdit(d.format('YYYY-MM-DD'))}),[{required:true,message:'请选择活动日期'}]),item('note','备注说明',area('备注说明'),[{max:200,message:'最多200字'}])];
  }

  function ForecastAdjustmentPopover({content,label,ariaLabel,details}){
    const [open,setOpen]=useState(false),trigger=React.useRef(null);
    const changeOpen=next=>setOpen(next);
    useEffect(()=>{
      if(!open)return;
      const close=()=>setOpen(false),escape=e=>{if(e.key==='Escape')close();};
      const onScroll=()=>close();
      const onPointerDown=e=>{if(trigger.current?.contains(e.target)||e.target.closest?.('.reason-preview'))return;close();};
      document.addEventListener('keydown',escape);
      document.addEventListener('scroll',onScroll,true);
      document.addEventListener('pointerdown',onPointerDown,true);
      return()=>{document.removeEventListener('keydown',escape);document.removeEventListener('scroll',onScroll,true);document.removeEventListener('pointerdown',onPointerDown,true);};
    },[open]);
    const preview=h('div',{className:'reason-preview activity-preview-compact','aria-label':ariaLabel},...details.map(([field,value])=>h('div',{key:field,className:'activity-preview-field'},h('span',null,field),h('div',null,value))));
    return h(Popover,{open,onOpenChange:changeOpen,content:preview,placement:'top',autoAdjustOverflow:true,arrow:{pointAtCenter:true},trigger:['hover','focus','click'],mouseEnterDelay:0.2,styles:{body:{width:320,maxWidth:'calc(100vw - 32px)',maxHeight:'min(360px, calc(100vh - 48px))',overflow:'hidden',padding:12,background:enterpriseThemeV020.token.colorBgElevated,color:enterpriseThemeV020.token.colorText,boxShadow:enterpriseThemeV020.token.boxShadowSecondary}}},h('span',{ref:trigger,className:'cell-reason',tabIndex:0,'aria-label':content,onClick:e=>e.stopPropagation()},label||content));
  }
  window.ForecastAdjustmentPopover=ForecastAdjustmentPopover;

  function ForecastEditableValue({value,valueText,ariaLabel,onEdit,className='',buttonClassName='',adjustmentClassName='',adjustmentLabel=null,adjustmentContent='',adjustmentAriaLabel='',adjustmentDetails=[]}){
    const empty=value==null;
    const button=h('button',{
      type:'button',
      className:`${empty?'entry-icon':'entry-value'} ${buttonClassName}`.trim(),
      'aria-label':ariaLabel,
      onClick:onEdit
    },
    h('span',{className:'entry-number'},empty?'':valueText),
    h('span',{className:'entry-edit-slot','aria-hidden':true},h(EditOutlined,{className:'edit-icon entry-ant-edit'})));
    const adjustment=!empty&&adjustmentLabel!=null?h('span',{className:`adjustment-entry forecast-adjustment-entry ${adjustmentClassName}`.trim()},
      h(ForecastAdjustmentPopover,{content:adjustmentContent,label:adjustmentLabel,ariaLabel:adjustmentAriaLabel,details:adjustmentDetails})
    ):null;
    return h('div',{className:`forecast-entry-wrap forecast-entry-stack ${className}`.trim()},button,adjustment);
  }
  window.ForecastEditableValue=ForecastEditableValue;

  function ReasonPopover({content,label,c,date,kind}){
    const draft=batchDraft(c,state.batch),event=draft.activity[date],manual=kind==='manual';
    const change=[...(draft.changes||[])].reverse().find(item=>item.date===date&&item.line===(manual?'人工预测':'活动预测'));
    const changeTime=change?.at?dayjs(change.at).format('YYYY/MM/DD HH:mm'):'';
    const details=(manual?[
      ['预测日期',formatKey(date)],['人工预测销量',num(draft.manual[date])],['调整原因',draft.manualReasons[date]||'']
    ]:[
      ['活动日期',formatKey(date)],['活动预测销量',num(event?.qty??0)],['活动名称',event?.name||''],['备注',event?.note||'']
    ]).concat([['调整人',change?.by||''],['调整时间',changeTime]]);
    return h(ForecastAdjustmentPopover,{content,label,ariaLabel:manual?'人工预测详情':'活动预测详情',details});
  }

  function HistoryForecastPopover({host,c,batch,kind}){
    const [open,setOpen]=useState(false),trigger=React.useRef(null);
    useEffect(()=>{
      if(!open)return;
      const close=()=>setOpen(false),escape=e=>{if(e.key==='Escape')close();};
      const onScroll=()=>close();
      const onPointerDown=e=>{if(trigger.current?.contains(e.target)||e.target.closest?.('.reason-preview'))return;close();};
      document.addEventListener('keydown',escape);
      document.addEventListener('scroll',onScroll,true);
      document.addEventListener('pointerdown',onPointerDown,true);
      return()=>{document.removeEventListener('keydown',escape);document.removeEventListener('scroll',onScroll,true);document.removeEventListener('pointerdown',onPointerDown,true);};
    },[open]);
    const col=visibleColumns().find(col=>col.key===host.closest('td')?.dataset.timeColumn),manual=kind==='manual';
    const rows=(col?.days||[]).map(d=>{
      const key=dateKey(d),f=forecastAt(c,batch,key);
      if(!f)return null;
      if(manual){
        if(f.manual==null)return null;
        return {date:key,qty:f.manual,reason:f.reason||''};
      }
      if(!f.activity)return null;
      return {date:key,qty:f.activity.qty,name:f.activity.name||'',note:f.activity.note||''};
    }).filter(Boolean);
    const fallback=col?.days?.[0]&&formatKey(dateKey(col.days[0]))||formatKey(batch);
    const preview=h('div',{className:'reason-preview activity-preview-compact','aria-label':manual?'历史人工预测详情':'历史活动预测详情'},rows.length?rows.flatMap(item=>manual?[
      h('div',{key:item.date+'-date',className:'activity-preview-field'},h('span',null,'预测日期'),h('div',null,formatKey(item.date))),
      h('div',{key:item.date+'-qty',className:'activity-preview-field'},h('span',null,'人工预测销量'),h('div',null,num(item.qty))),
      h('div',{key:item.date+'-reason',className:'activity-preview-field'},h('span',null,'调整原因'),h('div',null,item.reason||'未填写原因')),
      h('div',{key:item.date+'-batch',className:'activity-preview-field'},h('span',null,'填报批次'),h('div',null,formatKey(batch)))
    ]:[
      h('div',{key:item.date+'-date',className:'activity-preview-field'},h('span',null,'活动日期'),h('div',null,formatKey(item.date))),
      h('div',{key:item.date+'-qty',className:'activity-preview-field'},h('span',null,'活动预测销量'),h('div',null,num(item.qty))),
      h('div',{key:item.date+'-name',className:'activity-preview-field'},h('span',null,'活动名称'),h('div',null,item.name||'未填写活动名称')),
      h('div',{key:item.date+'-note',className:'activity-preview-field'},h('span',null,'备注'),h('div',null,item.note||'未填写备注')),
      h('div',{key:item.date+'-batch',className:'activity-preview-field'},h('span',null,'填报批次'),h('div',null,formatKey(batch)))
    ]):[h('div',{key:'empty',className:'activity-preview-field'},h('span',null,manual?'人工预测':'活动预测'),h('div',null,`${fallback} 未填写${manual?'人工预测':'活动预测'}`))]);
    return h(Popover,{open,onOpenChange:setOpen,content:preview,placement:'top',autoAdjustOverflow:true,arrow:{pointAtCenter:true},trigger:['hover','focus','click'],mouseEnterDelay:0.2,styles:{body:{width:320,maxWidth:'calc(100vw - 32px)',maxHeight:'min(360px, calc(100vh - 48px))',overflow:'hidden',padding:12,background:enterpriseThemeV020.token.colorBgElevated,color:enterpriseThemeV020.token.colorText,boxShadow:enterpriseThemeV020.token.boxShadowSecondary}}},h('span',{ref:trigger,className:'history-popover-trigger',tabIndex:0,'aria-label':manual?'历史人工预测详情':'历史活动预测详情',onClick:e=>e.stopPropagation()},host.dataset.historyPreviewLabel||''));
  }

  function Filters(){
    const [draft,setDraft]=useState({...state.filters,query:state.query});
    useEffect(()=>{
      const sync=event=>setDraft({...state.filters,...(event.detail?.filters||{}),query:event.detail?.query??state.query});
      window.addEventListener('sales-forecast-filter-sync',sync);
      return()=>window.removeEventListener('sales-forecast-filter-sync',sync);
    },[]);
    const apply=values=>{state.filters={market:values.market,platform:values.platform,account:values.account,owner:values.owner,tag:values.tag};state.query=values.query;state.page=1;renderTable();$('#workbench').scrollTop=0;};
    const control=spec=>{const [key,label,options]=spec;return h(Select,{key,'aria-label':label,'data-testid':'filter-'+key,value:draft[key],showSearch:true,optionFilterProp:'label',options:options.map(([value,label])=>({value,label})),style:{width:'100%'},onChange:value=>setDraft(old=>({...old,[key]:value})),popupMatchSelectWidth:Math.max(key==='account'?180:160,0)});};
    return h('div',{className:'antd-filter-grid'},...filterSpec.slice(0,4).map(control),h(Input,{'aria-label':'编码或商品名称',placeholder:'ASIN / SKU / 业务识别码',allowClear:true,value:draft.query,onChange:e=>setDraft(old=>({...old,query:e.target.value})),onPressEnter:()=>apply(draft)}),control(filterSpec[4]),h(Button,{type:'primary',onClick:()=>apply(draft)},'查询'),h(Button,{onClick:()=>{const initial={market:'',platform:'Amazon',account:'',owner:'',tag:'',query:''};setDraft(initial);apply(initial);}},'重置'));
  }

  function ForecastEditor({edit,onClose}){
    const [form]=antd.Form.useForm(),[error,setError]=useState('');
    const {modal}=App.useApp(),targets=(edit.ids||[edit.id]).map(findChild).filter(Boolean),c=targets[0],isAggregate=targets.length>1,drafts=targets.map(child=>batchDraft(child,state.batch)),draft=drafts[0],isNote=edit.kind==='note',isManual=edit.kind==='manual';
    if(!c||!draft)return null;
    const events=drafts.map(item=>item.activity[edit.key]).filter(Boolean),event=events[0],manualValues=drafts.map(item=>item.manual[edit.key]).filter(value=>value!=null);
    const aggregateManual=isAggregate&&manualValues.length?manualValues.reduce((sum,value)=>sum+value,0):draft.manual[edit.key];
    const aggregateActivity=isAggregate&&events.length?events.reduce((sum,item)=>sum+(Number(item.qty)||0),0):event?.qty;
    const commonActivityName=events.length&&events.every(item=>item.name===event?.name)?event?.name:(isAggregate?`${edit.label||'父ASIN'}活动`:event?.name);
    const commonActivityNote=events.length&&events.every(item=>item.note===event?.note)?event?.note:'';
    const initial=isNote?{note:notes[c.id]||''}:isManual?{qty:aggregateManual,reason:isAggregate?(drafts.map(item=>item.manualReasons[edit.key]).find(Boolean)||''):(draft.manualReasons[edit.key]||'')}:{qty:aggregateActivity,name:commonActivityName||'',date:dayjs(edit.key),note:commonActivityNote||''};
    const distribute=value=>{
      if(!isAggregate)return[value];
      const weights=targets.map((child,index)=>Math.max(0,Number(edit.weights?.[index])||Number(child.base)||0)),sum=weights.reduce((total,weight)=>total+weight,0)||targets.length;
      const exact=weights.map(weight=>(sum===targets.length&&!weights.some(Boolean)?1:weight)/sum*value),result=exact.map(Math.floor);
      let remainder=value-result.reduce((total,item)=>total+item,0);
      exact.map((item,index)=>({index,fraction:item-result[index]})).sort((a,b)=>b.fraction-a.fraction||a.index-b.index).forEach(item=>{if(remainder>0){result[item.index]+=1;remainder-=1;}});
      return result;
    };
    const close=()=>{if(form.isFieldsTouched())modal.confirm({title:'放弃未保存的填写？',okText:'放弃修改',cancelText:'继续填写',onOk:onClose});else onClose();};
    const commit=(values,clear=false)=>{
      setError('');
      if(!isNote&&window.ForecastWindow&&!window.ForecastWindow.isOpen()){setError('当前'+window.ForecastWindow.current().label+'，无法保存预测');return;}
      if(!isNote&&window.canEditForecastRecord&&targets.some(child=>!window.canEditForecastRecord(child.id))){setError('该记录已冻结或提交，无法修改');return;}
      if(isNote){
        const next={...notes,[c.id]:(values.note||'').trim()};if(!next[c.id])delete next[c.id];
        try{localStorage.setItem(notesStorageKey,JSON.stringify(next));}catch{setError('保存失败，请检查浏览器存储权限');return;}notes=next;
      }else{
        const key=isManual?edit.key:values.date?.format('YYYY-MM-DD')||edit.key;
        if(targets.some(child=>window.canEditForecastDate?.(child.id,key)===false)){setError('人工启动（待实际销量），当前日期不可填报或活动覆盖');return;}
        if(!canEdit(key)){form.setFields([{name:'date',errors:['日期需在当前预测范围内']}]);return;}
        if(!isManual&&!clear&&key!==edit.key&&drafts.some(item=>item.activity[key])){form.setFields([{name:'date',errors:['该日期已有活动预测，请选择其他日期']}]);return;}
        const previous=drafts.map(item=>({manual:{...item.manual},manualReasons:{...item.manualReasons},activity:{...item.activity},changes:[...item.changes]}));
        const allocated=clear?targets.map(()=>null):distribute(values.qty);
        drafts.forEach((item,index)=>{
          if(isManual){
            if(clear){delete item.manual[edit.key];delete item.manualReasons[edit.key];}
            else{item.manual[edit.key]=allocated[index];item.manualReasons[edit.key]=values.reason.trim();}
            item.changes.push({date:edit.key,line:'人工预测',before:previous[index].manual[edit.key]??null,after:clear?null:allocated[index],reason:clear?'清除人工预测':values.reason.trim()});
          }else{
            if(clear||key!==edit.key)delete item.activity[edit.key];
            if(!clear)item.activity[key]={qty:allocated[index],name:values.name.trim(),date:key,note:(values.note||'').trim()};
            item.changes.push({date:key,line:'活动预测',before:previous[index].activity[edit.key]?.qty??null,after:clear?null:allocated[index],reason:clear?'清除活动预测':values.name.trim()});
          }
          Object.assign(item.changes[item.changes.length-1],{by:groups.find(g=>g.children.some(child=>child.id===targets[index].id))?.owner||'',at:new Date().toISOString()});
        });
        if(!persistCurrent()){drafts.forEach((item,index)=>Object.assign(item,previous[index]));setError('保存失败，填写内容仍保留，请重试');return;}
      }
      onClose();renderTable();window.dispatchEvent(new Event('forecast-values-change'));toast(clear?'已清除预测':'已保存');
    };
    const count=forecastCountProps,fields=forecastFields(edit.kind);
    if(isNote)return h('div',{className:'inline-note-editor'},h(antd.Form,{form,initialValues:initial,onFinish:values=>commit(values),validateTrigger:['onChange','onBlur']},
      h(antd.Form.Item,{name:'note',className:'forecast-note-field',rules:[{max:200,message:'最多200字'}]},h(Input.TextArea,{...count,'aria-label':'商品备注',autoFocus:true}))),
      error?h(Alert,{type:'error',message:error}):null,h('div',{className:'forecast-editor-footer'},h('span'),h(Space,null,h(Button,{onClick:close},'取消'),h(Button,{type:'primary',onClick:()=>form.submit()},'保存'))));
    const hasExisting=isManual?manualValues.length>0:events.length>0;
    return h(antd.Modal,{open:true,title:isNote?'商品备注':isManual?'人工预测':'活动预测',width:440,onCancel:close,maskClosable:false,destroyOnHidden:true,footer:h('div',{className:'forecast-editor-footer'},!isNote&&hasExisting?h(Button,{danger:true,onClick:()=>commit({},true)},'清除预测'):h('span'),h(Space,null,h(Button,{onClick:close},'取消'),h(Button,{type:'primary',onClick:()=>form.submit()},'保存')))},
      h('div',{className:'forecast-editor-context'},(isAggregate?(edit.label||'父ASIN'):c.asin)+(edit.key?' · '+formatKey(edit.key):'')),
      h(antd.Form,{form,layout:'vertical',initialValues:initial,onFinish:values=>commit(values),scrollToFirstError:true,validateTrigger:['onChange','onBlur']},...fields),error?h(Alert,{type:'error',message:error,showIcon:true}):null);
  }
  function Controls(){
    const [,force]=useReducer(n=>n+1,0),[open,setOpen]=useState(false),[draft,setDraft]=useState(null),[search,setSearch]=useState(''),[template,setTemplate]=useState(undefined),[naming,setNaming]=useState(false),[name,setName]=useState(''),[error,setError]=useState('');
    const {modal}=App.useApp();
    const [message,messageHolder]=antd.message.useMessage({getContainer:()=>$('#forecastMessages'),top:0,maxCount:1});
    const [editor,setEditor]=useState(null),dragged=React.useRef(null),[dropKey,setDropKey]=useState(null);
    useEffect(()=>{window.openForecastEditor=e=>{message.destroy();setEditor({...e,token:Date.now()});};window.forecastMessage=(content,type)=>message.open({key:'forecast-feedback',content,type,duration:2.2});return()=>{delete window.openForecastEditor;delete window.forecastMessage;};},[message]);
    useEffect(()=>{window.refreshForecastControls=force;return()=>{delete window.refreshForecastControls;};},[]);
    const begin=()=>{hideCodeTooltip();closeCalendar();setDraft(clone(columnConfig));setOpen(true);setSearch('');setError('');setTemplate(undefined);setNaming(false);};
    const close=()=>{if(draft&&JSON.stringify(draft)!==JSON.stringify(columnConfig)){modal.confirm({title:'放弃未应用的列配置？',content:'当前列表仍保留原配置。',okText:'放弃修改',cancelText:'继续编辑',onOk:()=>setOpen(false)});}else setOpen(false);};
    const apply=()=>{try{localStorage.setItem(configStorageKey,JSON.stringify(draft));}catch{setError('保存失败，请检查浏览器存储权限后重试');return;}columnConfig=clone(draft);setOpen(false);renderTable();};
    const toggle=(key,checked)=>setDraft(old=>({...old,keys:checked?[...old.keys,key]:old.keys.filter(k=>k!==key),pinned:(old.pinned||[]).filter(k=>checked||k!==key)}));
    const reorder=(key,target,after=false)=>{
      const field=fieldCatalog.find(f=>f.key===key),to=fieldCatalog.find(f=>f.key===target);
      if(!field||!to||!canOrder(field)||!canOrder(to)||field.group!==to.group||key===target)return;
      setDraft(old=>{
        const movable=old.keys.filter(k=>{const f=fieldCatalog.find(f=>f.key===k);return f.group===field.group&&canOrder(f)&&!(old.pinned||[]).includes(k);});
        if(!movable.includes(key)||!movable.includes(target))return old;
        const ordered=movable.filter(k=>k!==key);ordered.splice(ordered.indexOf(target)+(after?1:0),0,key);
        let i=0;return {...old,keys:old.keys.map(k=>movable.includes(k)?ordered[i++]:k)};
      });
    };
    const toTop=field=>{const first=draft.keys.map(k=>fieldCatalog.find(f=>f.key===k)).find(f=>f.group===field.group&&canOrder(f)&&!(draft.pinned||[]).includes(f.key));if(first)reorder(field.key,first.key);};
    const templateOptions=[{value:'default',label:'默认配置'},{value:'compact',label:'精简填报'},...(draft?.templates||[]).map((t,i)=>({value:'saved-'+i,label:t.name}))];
    const changeTemplate=value=>{setTemplate(value);setDraft(old=>({...old,pinned:value.startsWith('saved-')?[...(old.templates[Number(value.slice(6))].pinned||[])]:[],keys:value==='default'?[...defaultFields]:value==='compact'?validFields(['spu','skc','owner','image','title','stock','doi']):[...old.templates[Number(value.slice(6))].keys]}));};
    const saveTemplate=()=>{const title=name.trim();if(!title){setError('请输入模板名称');return;}if(draft.templates.some(t=>t.name===title)){setError('模板名称已存在');return;}setDraft(old=>({...old,templates:[...old.templates,{name:title,keys:[...old.keys],pinned:[...(old.pinned||[])]}]}));setTemplate('saved-'+draft.templates.length);setNaming(false);setName('');setError('');message.success('模板随“保存并应用”一起保存');};
    const isPinned=key=>(draft?.pinned||[]).includes(key);
    const moveable=field=>canOrder(field)&&!isPinned(field.key);
    const togglePin=field=>{
      if(!isPinned(field.key)&&(draft.pinned||[]).length>=7){message.info('最多可固定7项');return;}
      setDraft(old=>({...old,pinned:isPinned(field.key)?old.pinned.filter(k=>k!==field.key):[...(old.pinned||[]),field.key]}));
    };
    const selectedTitle=(field,index,first)=>{
      const fixed=field.required||positionFixedFields.has(field.key);
      const action=(label,Icon,fn,disabled=false)=>h(React.Fragment,null,h(Button,{type:'text',size:'small',className:'column-quick-action',icon:h(Icon,{style:{fontSize:14}}),'aria-label':label+field.label,disabled,onClick:fn}));
      const tools=field.required
        ?h(Tooltip,{title:'必选字段，不可移除'},h(LockOutlined,{className:'column-fixed-icon','aria-label':'必选字段'}))
        :h(React.Fragment,null,action('移除',CloseCircleOutlined,()=>toggle(field.key,false)),
          action('置顶',VerticalAlignTopOutlined,()=>toTop(field),!moveable(field)||field.key===first),
          fixed?h(Tooltip,{title:'结构位置固定，可隐藏'},h(LockOutlined,{className:'column-fixed-icon','aria-label':'结构固定'}))
            :h(Tooltip,{title:isPinned(field.key)?'取消组内位置固定':'固定组内位置'},h(Button,{type:'text',size:'small',className:'column-quick-action'+(isPinned(field.key)?' is-pinned':''),icon:h(PushpinOutlined,{style:{fontSize:14}}),'aria-label':(isPinned(field.key)?'取消固定':'固定')+field.label,'aria-pressed':isPinned(field.key),onClick:()=>togglePin(field)})));
      return h('div',{
        className:'antd-selected-field-row'+(dropKey===field.key?' is-drop-target':''),
        'data-selected-field':field.key,tabIndex:0,draggable:moveable(field),
        onDragStart:e=>{dragged.current=field.key;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',field.key);},
        onDragOver:e=>{const source=fieldCatalog.find(f=>f.key===dragged.current);if(source&&source.group===field.group&&moveable(field)&&source.key!==field.key){e.preventDefault();setDropKey(field.key);}},
        onDrop:e=>{e.preventDefault();const source=fieldCatalog.find(f=>f.key===dragged.current);if(source&&moveable(source)&&moveable(field))reorder(source.key,field.key,e.clientY>e.currentTarget.getBoundingClientRect().top+18);dragged.current=null;setDropKey(null);},
        onDragEnd:()=>{dragged.current=null;setDropKey(null);},
        onKeyDown:e=>{if(!e.altKey||!['ArrowUp','ArrowDown'].includes(e.key)||!moveable(field))return;e.preventDefault();const siblings=draft.keys.map(k=>fieldCatalog.find(f=>f.key===k)).filter(f=>f.group===field.group&&moveable(f)),i=siblings.findIndex(f=>f.key===field.key),target=siblings[i+(e.key==='ArrowDown'?1:-1)];if(target)reorder(field.key,target.key,e.key==='ArrowDown');}
      },h('span',{className:'antd-selected-field-drag'+(moveable(field)?'':' is-locked'),'aria-hidden':true},h(HolderOutlined)),
        h('span',{className:'antd-selected-field-number'},index+1),
        h('span',{className:'antd-selected-field-name',title:field.label},field.label),
        h('span',{className:'antd-selected-field-tools'+(isPinned(field.key)?' has-pin':'')},tools));
    };
    let selectedIndex=0;
    const availablePane=draft?h('section',{className:'antd-column-available'},
      h(Input,{'aria-label':'搜索字段',placeholder:'搜索字段',suffix:h(SearchOutlined),allowClear:true,value:search,onChange:e=>setSearch(e.target.value)}),
      ...groupNames.map(group=>{
        const fields=fieldCatalog.filter(f=>f.group===group&&f.label.toLowerCase().includes(search.toLowerCase()));
        if(!fields.length)return null;
        const all=fields.every(f=>draft.keys.includes(f.key));
        return h('div',{className:'antd-column-group',key:group},
          h('div',{className:'antd-column-group-title'},group,group==='必选字段'?h('span',null,'不可取消'):h(Button,{type:'link',onClick:()=>setDraft(old=>({...old,keys:all?old.keys.filter(k=>!fields.some(f=>f.key===k)):[...new Set([...old.keys,...fields.map(f=>f.key)])],pinned:(old.pinned||[]).filter(k=>!all||!fields.some(f=>f.key===k))}))},all?'取消全选':'全选')),
          h('div',{className:'antd-column-options'},...fields.map(f=>h(Checkbox,{key:f.key,'data-antd-config-field':f.key,checked:draft.keys.includes(f.key),disabled:f.required,onChange:e=>toggle(f.key,e.target.checked)},f.label))));
      })):null;
    const selectedPane=draft?h('section',{className:'antd-column-selected','aria-label':'已选字段'},
      h('div',{className:'antd-column-selected-header'},h('strong',null,'已选（'+draft.keys.length+'）'),h('span',null,'最多可固定7项 · 组内位置')),
      h('div',{className:'antd-selected-scroll'},...groupNames.map(group=>{
        const fields=draft.keys.map(k=>fieldCatalog.find(f=>f.key===k)).filter(f=>f.group===group),first=fields.find(moveable)?.key;
        if(!fields.length)return null;
        const base=selectedIndex;selectedIndex+=fields.length;
        return h('div',{className:'antd-selected-group',key:group},h('div',{className:'antd-selected-group-title'},group),
          h(List,{split:false,dataSource:fields,renderItem:(f,i)=>h(List.Item,{key:f.key,style:{display:'block',padding:0}},selectedTitle(f,base+i,first))}));
      })),
      h('div',{className:'antd-column-selected-hint'},'拖拽调整组内顺序')):null;
    const drawerBody=draft?h(React.Fragment,null,
      h('div',{className:'antd-column-template'},
        h(Select,{'aria-label':'选择列配置模板',placeholder:'选择模板',value:template,options:templateOptions,onChange:changeTemplate,style:{width:190}}),
        naming?h(Space,null,h(Input,{'aria-label':'模板名称',placeholder:'模板名称',maxLength:20,value:name,onChange:e=>setName(e.target.value),onPressEnter:saveTemplate}),h(Button,{onClick:saveTemplate},'保存模板'))
          :h(Button,{type:'link',onClick:()=>{setNaming(true);setName('');}},'保存为新模板')),
      h('div',{className:'antd-column-layout'},availablePane,selectedPane),
      error?h(Alert,{type:'error',showIcon:true,message:error}):null):null;
    const portals=[ReactDOM.createPortal(h(Filters),$('#filterControls'),'filters'),ReactDOM.createPortal(h(Tooltip,{title:'列配置'},h(Button,{id:'antdColumnButton',type:'text',icon:h(SettingOutlined),'aria-label':'列配置',onClick:begin})),$('#columnIcon'),'columns')];
    $$('[data-forecast-toggle]').forEach(host=>{
      const id=host.dataset.forecastToggle,children=id==='all'?displayGroups().flatMap(g=>g.children):[findChild(id)],expanded=children.every(c=>state.expandedChildren.has(c.id)),label=expanded?'收起填报':'展开填报';
      portals.push(ReactDOM.createPortal(h(Tooltip,{title:(expanded?'收起':'展开')+'当前页填报明细'},h(Button,{type:'text',size:'small',disabled:!children.length,className:'forecast-state-toggle forecast-toggle-action',icon:h(ForecastToggleIcon,{expanded}),'aria-label':label,'aria-expanded':expanded,'data-forecast-toggle-button':id,onClick:()=>{children.forEach(c=>expanded?state.expandedChildren.delete(c.id):state.expandedChildren.add(c.id));if(!toggleForecastRowsInPlace(children,!expanded))renderTable();requestAnimationFrame(()=>document.querySelector('[data-forecast-toggle-button="'+id+'"]')?.focus({preventScroll:true}));}})),host,'forecast-'+id));
    });
    $$('[data-reason-host]').forEach(host=>{
      const c=findChild(host.dataset.reasonHost),key=host.dataset.reasonDate,draft=batchDraft(c,state.batch),content=host.dataset.reasonKind==='manual'?draft.manualReasons[key]:[draft.activity[key]?.name,draft.activity[key]?.note].filter(Boolean).join('\n');
      portals.push(ReactDOM.createPortal(h(ReasonPopover,{content,label:host.dataset.reasonLabel,c,date:key,kind:host.dataset.reasonKind}),host,'reason-'+c.id+'-'+host.dataset.reasonKind+'-'+key));
    });
    $$('[data-history-preview-host]').forEach(host=>{
      const c=findChild(host.dataset.historyPreviewHost);
      if(!c)return;
      portals.push(ReactDOM.createPortal(h(HistoryForecastPopover,{host,c,batch:host.dataset.historyPreviewBatch,kind:host.dataset.historyPreviewKind}),host,'history-preview-'+c.id+'-'+host.dataset.historyPreviewBatch+'-'+host.dataset.historyPreviewKind+'-'+host.closest('td')?.dataset.timeColumn));
    });
    $$('[data-note-control]').forEach(host=>{
      const c=findChild(host.dataset.noteControl),active=editor?.kind==='note'&&editor.id===c.id;
      const content=active?h(ForecastEditor,{key:editor.token,edit:editor,onClose:()=>setEditor(null)}):h('span',{className:'note-display'},notes[c.id]?h('span',{className:'note-saved-text'},notes[c.id]):null,h(Tooltip,{title:'编辑备注'},h(Button,{type:'link',size:'small','data-note-edit':c.id,'aria-label':'编辑 '+c.asin+' 商品备注',icon:h(icons.EditOutlined),style:{width:16,minWidth:16,height:22,padding:0,flexShrink:0}})));
      portals.push(ReactDOM.createPortal(content,host,'note-'+c.id));
    });
    $$('[data-history-management]').forEach(host=>{
      const id=host.dataset.historyManagement,total=olderBatches().length,count=Math.min(state.historyCount[id]||2,total),expanded=state.historyOpen.has(id),more=count<total;
      const focus=()=>requestAnimationFrame(()=>document.querySelector('[data-history-entry="'+id+'"]')?.focus({preventScroll:true}));
      const change=n=>{state.historyCount[id]=n;state.historyOpen.add(id);renderTable();focus();};
      const items=expanded?[...(more?[{key:'more',label:'再加载2批（剩余'+(total-count)+'批）'},{key:'all',label:'展开全部'+total+'批'}]:[]),...(count>2?[{key:'less',label:'仅保留最近2批'}]:[])]:[{key:'recent',label:'展开最近2批'},{key:'all',label:'展开全部'+total+'批'}];
      portals.push(ReactDOM.createPortal(h('span',{className:'history-management'},
        h(Button,{type:'link',size:'small',className:'history-entry-button',style:{fontSize:businessFont},icon:h(expanded?icons.DownOutlined:icons.RightOutlined),'data-history-entry':id,'aria-label':'历史提报记录 '+id,'aria-expanded':expanded,onClick:()=>{expanded?state.historyOpen.delete(id):state.historyOpen.add(id);renderTable();focus();}},'历史提报记录'),
        h(antd.Dropdown,{trigger:['click'],menu:{items,onClick:({key})=>change(key==='all'?total:key==='more'?Math.min(total,count+2):2)}},h(Button,{type:'text',size:'small',style:{padding:'0 4px',height:24,fontSize:helpFont,color:enterpriseThemeV020.token.colorPrimary},'data-history-count':id,'aria-label':'管理历史提报批次 '+id},(expanded?count+'/'+total:total+'批')+' ',h(icons.DownOutlined,{style:{fontSize:helpFont}})))),host,'history-'+id));
    });
    return h(React.Fragment,null,messageHolder,editor&&editor.kind!=='note'?h(ForecastEditor,{key:editor.token,edit:editor,onClose:()=>setEditor(null)}):null,...portals,h(Drawer,{title:'列配置','aria-label':'列配置',open,onClose:close,width:'min(860px,96vw)',destroyOnHidden:true,styles:{body:{display:'flex',flexDirection:'column',padding:'16px 20px',overflow:'hidden'}},footer:h('div',{className:'column-footer'},h(Button,{onClick:()=>{setDraft(old=>({...old,keys:[...defaultFields],pinned:[]}));setTemplate('default');}},'恢复默认'),h(Space,null,h(Button,{onClick:close},'取消'),h(Button,{type:'primary',onClick:apply},'保存并应用')))},drawerBody));
  }
  ReactDOM.createRoot($('#antdControls')).render(withApp(h(Controls)));
})();
