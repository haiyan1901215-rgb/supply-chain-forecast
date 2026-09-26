/* Actual Ant Design islands around the existing forecast business grid. */
(() => {
  const h=React.createElement,{useState,useEffect,useReducer}=React;
  const {ConfigProvider,App,Select,Input,Button,Tooltip,Drawer,Checkbox,Tree,Space,Tag,Alert,DatePicker,Typography}=antd;
  const {SettingOutlined,HolderOutlined,VerticalAlignTopOutlined,CloseCircleOutlined,LockOutlined,QuestionCircleOutlined,SearchOutlined}=icons;
  const filterSpec=[
    ['platform','平台',[['Amazon','Amazon'],['Temu','Temu'],['SHEIN','SHEIN']]],
    ['market','国家 / 站点',[['','全部国家 / 站点'],['US','美国 / US'],['UK','英国 / UK']]],
    ['account','账号 / 店铺',[['','全部账号 / 店铺'],['BRABIC-US','BRABIC-US'],['BRABIC-UK','BRABIC-UK']]],
    ['owner','销售负责人',[['','全部销售负责人'],['李敏','李敏'],['周宁','周宁'],['陈洁','陈洁']]],
    ['tag','商品标签',[['','全部商品标签'],['成熟款','成熟款'],['活动款','活动款'],['库存偏紧','库存偏紧']]]
  ];
  const groupNames=[...new Set(fieldCatalog.map(f=>f.group))];
  const canOrder=f=>!f.required&&!positionFixedFields.has(f.key);
  const clone=value=>JSON.parse(JSON.stringify(value));
  const withApp=child=>h(ConfigProvider,{theme:enterpriseThemeV020,componentSize:'small',button:{autoInsertSpace:false}},h(App,null,child));

  function Filters(){
    const [draft,setDraft]=useState({...state.filters,query:state.query});
    const apply=values=>{state.filters={market:values.market,platform:values.platform,account:values.account,owner:values.owner,tag:values.tag};state.query=values.query;state.page=1;renderTable();$('#workbench').scrollTop=0;};
    const control=spec=>{const [key,label,options]=spec;return h(Select,{key,'aria-label':label,'data-testid':'filter-'+key,value:draft[key],showSearch:true,optionFilterProp:'label',options:options.map(([value,label])=>({value,label})),style:{width:'100%'},onChange:value=>setDraft(old=>({...old,[key]:value})),popupMatchSelectWidth:Math.max(key==='account'?180:160,0)});};
    return h('div',{className:'antd-filter-grid'},...filterSpec.slice(0,4).map(control),h(Input,{'aria-label':'编码或商品名称',placeholder:'ASIN / SKU / 业务识别码',allowClear:true,value:draft.query,onChange:e=>setDraft(old=>({...old,query:e.target.value})),onPressEnter:()=>apply(draft)}),control(filterSpec[4]),h(Button,{type:'primary',onClick:()=>apply(draft)},'查询'),h(Button,{onClick:()=>{const initial={market:'',platform:'Amazon',account:'',owner:'',tag:'',query:''};setDraft(initial);apply(initial);}},'重置'));
  }

  function ForecastEditor({edit,onClose}){
    const [form]=antd.Form.useForm(),[error,setError]=useState('');
    const {modal}=App.useApp(),c=findChild(edit.id),isNote=edit.kind==='note',isManual=edit.kind==='manual',event=c.activity[edit.key];
    const initial=isNote?{note:notes[c.id]||''}:isManual?{qty:c.manual[edit.key],reason:c.manualReasons[edit.key]||''}:{qty:event?.qty,name:event?.name||'',date:dayjs(edit.key),note:event?.note||''};
    const close=()=>{if(form.isFieldsTouched())modal.confirm({title:'放弃未保存的填写？',okText:'放弃修改',cancelText:'继续填写',onOk:onClose});else onClose();};
    const commit=(values,clear=false)=>{
      setError('');
      if(isNote){
        const next={...notes,[c.id]:(values.note||'').trim()};if(!next[c.id])delete next[c.id];
        try{localStorage.setItem(notesStorageKey,JSON.stringify(next));}catch{setError('保存失败，请检查浏览器存储权限');return;}notes=next;
      }else{
        const key=isManual?edit.key:values.date?.format('YYYY-MM-DD')||edit.key;
        if(!canEdit(key)){form.setFields([{name:'date',errors:['日期需在当前预测范围内']}]);return;}
        if(!isManual&&!clear&&key!==edit.key&&c.activity[key]){form.setFields([{name:'date',errors:['该日期已有活动预测，请选择其他日期']}]);return;}
        const previous={manual:{...c.manual},manualReasons:{...c.manualReasons},activity:{...c.activity},changes:[...c.changes]};
        if(isManual){
          if(clear){delete c.manual[edit.key];delete c.manualReasons[edit.key];}
          else{c.manual[edit.key]=values.qty;c.manualReasons[edit.key]=values.reason.trim();}
          c.changes.push({date:edit.key,line:'人工预测',before:previous.manual[edit.key]??null,after:clear?null:values.qty,reason:clear?'清除人工预测':values.reason.trim()});
        }else{
          if(clear||key!==edit.key)delete c.activity[edit.key];
          if(!clear)c.activity[key]={qty:values.qty,name:values.name.trim(),date:key,note:(values.note||'').trim()};
          c.changes.push({date:key,line:'活动预测',before:event?.qty??null,after:clear?null:values.qty,reason:clear?'清除活动预测':values.name.trim()});
        }
        if(!persistCurrent()){Object.assign(c,previous);setError('保存失败，填写内容仍保留，请重试');return;}
      }
      onClose();renderTable();toast(clear?'已清除预测':'已保存');
    };
    const item=(name,label,child,rules=[])=>h(antd.Form.Item,{name,label,rules,className:name==='reason'||name==='note'?'forecast-note-field':undefined},child);
    const count={showCount:true,maxLength:200,autoSize:{minRows:3,maxRows:5}};
    const qty=item('qty','预测销量',h(antd.InputNumber,{'aria-label':'预测销量',min:0,max:999999999,precision:0,style:{width:'100%'},autoFocus:true}),[{required:true,message:'请填写预测销量'},{type:'integer',min:0,message:'请输入大于等于0的整数'}]);
    const fields=isNote?[item('note','商品备注',h(Input.TextArea,{...count,'aria-label':'商品备注',autoFocus:true}),[{max:200,message:'最多200字'}])]:isManual?[qty,item('reason','人工预测原因',h(Input.TextArea,{...count,'aria-label':'人工预测原因',placeholder:'说明为什么调整AI预测，例如新增推广资源'}),[{required:true,whitespace:true,message:'请填写不采用AI预测的原因'},{max:200,message:'最多200字'}])]:[qty,item('name','活动名称',h(Input,{'aria-label':'活动名称',maxLength:50,showCount:true}),[{required:true,whitespace:true,message:'请填写活动名称'},{max:50,message:'最多50字'}]),item('date','活动日期',h(DatePicker,{'aria-label':'活动日期',format:'YYYY/MM/DD',allowClear:false,inputReadOnly:true,style:{width:'100%'},disabledDate:d=>!canEdit(d.format('YYYY-MM-DD'))}),[{required:true,message:'请选择活动日期'}]),item('note','备注说明',h(Input.TextArea,{...count,'aria-label':'备注说明'}),[{max:200,message:'最多200字'}])];
    if(isNote)return h('div',{className:'inline-note-editor'},h(antd.Form,{form,initialValues:initial,onFinish:values=>commit(values),validateTrigger:['onChange','onBlur']},
      h(antd.Form.Item,{name:'note',className:'forecast-note-field',rules:[{max:200,message:'最多200字'}]},h(Input.TextArea,{...count,'aria-label':'商品备注',autoFocus:true}))),
      error?h(Alert,{type:'error',message:error}):null,h('div',{className:'forecast-editor-footer'},h('span'),h(Space,null,h(Button,{onClick:close},'取消'),h(Button,{type:'primary',onClick:()=>form.submit()},'保存'))));
    return h(antd.Modal,{open:true,title:isNote?'商品备注':isManual?'人工预测':'活动预测',width:440,onCancel:close,maskClosable:false,destroyOnHidden:true,footer:h('div',{className:'forecast-editor-footer'},!isNote&&(isManual?c.manual[edit.key]!=null:Boolean(event))?h(Button,{danger:true,onClick:()=>commit({},true)},'清除预测'):h('span'),h(Space,null,h(Button,{onClick:close},'取消'),h(Button,{type:'primary',onClick:()=>form.submit()},'保存')))},
      h('div',{className:'forecast-editor-context'},c.asin+(edit.key?' · '+formatKey(edit.key):'')),
      h(antd.Form,{form,layout:'vertical',initialValues:initial,onFinish:values=>commit(values),scrollToFirstError:true,validateTrigger:['onChange','onBlur']},...fields),error?h(Alert,{type:'error',message:error,showIcon:true}):null);
  }
  function Controls(){
    const [,force]=useReducer(n=>n+1,0),[open,setOpen]=useState(false),[draft,setDraft]=useState(null),[search,setSearch]=useState(''),[template,setTemplate]=useState(undefined),[naming,setNaming]=useState(false),[name,setName]=useState(''),[error,setError]=useState('');
    const {modal}=App.useApp();
    const [message,messageHolder]=antd.message.useMessage({getContainer:()=>$('#forecastMessages'),top:0,maxCount:1});
    const [editor,setEditor]=useState(null);
    useEffect(()=>{window.openForecastEditor=e=>{message.destroy();setEditor({...e,token:Date.now()});};window.forecastMessage=(content,type)=>message.open({key:'forecast-feedback',content,type,duration:2.2});return()=>{delete window.openForecastEditor;delete window.forecastMessage;};},[message]);
    useEffect(()=>{window.refreshForecastControls=force;return()=>{delete window.refreshForecastControls;};},[]);
    const begin=()=>{hideCodeTooltip();closeCalendar();setDraft(clone(columnConfig));setOpen(true);setSearch('');setError('');setTemplate(undefined);setNaming(false);};
    const close=()=>{if(draft&&JSON.stringify(draft)!==JSON.stringify(columnConfig)){modal.confirm({title:'放弃未应用的列配置？',content:'当前列表仍保留原配置。',okText:'放弃修改',cancelText:'继续编辑',onOk:()=>setOpen(false)});}else setOpen(false);};
    const apply=()=>{try{localStorage.setItem(configStorageKey,JSON.stringify(draft));}catch{setError('保存失败，请检查浏览器存储权限后重试');return;}columnConfig=clone(draft);setOpen(false);renderTable();};
    const toggle=(key,checked)=>setDraft(old=>({...old,keys:checked?[...old.keys,key]:old.keys.filter(k=>k!==key)}));
    const reorder=(key,target,after=false)=>{const field=fieldCatalog.find(f=>f.key===key),to=fieldCatalog.find(f=>f.key===target);if(!field||!to||!canOrder(field)||!canOrder(to)||field.group!==to.group||key===target)return;setDraft(old=>{const keys=old.keys.filter(k=>k!==key),i=keys.indexOf(target);keys.splice(i+(after?1:0),0,key);return {...old,keys};});};
    const pin=field=>{const first=draft.keys.map(k=>fieldCatalog.find(f=>f.key===k)).find(f=>f.group===field.group&&canOrder(f));if(first)reorder(field.key,first.key);};
    const templateOptions=[{value:'default',label:'默认配置'},{value:'compact',label:'精简填报'},...(draft?.templates||[]).map((t,i)=>({value:'saved-'+i,label:t.name}))];
    const changeTemplate=value=>{setTemplate(value);setDraft(old=>({...old,keys:value==='default'?[...defaultFields]:value==='compact'?validFields(['spu','skc','owner','image','title','stock','doi']):[...old.templates[Number(value.slice(6))].keys]}));};
    const saveTemplate=()=>{const title=name.trim();if(!title){setError('请输入模板名称');return;}if(draft.templates.some(t=>t.name===title)){setError('模板名称已存在');return;}setDraft(old=>({...old,templates:[...old.templates,{name:title,keys:[...old.keys]}]}));setTemplate('saved-'+draft.templates.length);setNaming(false);setName('');setError('');message.success('模板随“保存并应用”一起保存');};
    const selectedTitle=(field,index,first)=>{
      const remove=h(Tooltip,{title:'移除'},h(Button,{type:'text',size:'small',icon:h(CloseCircleOutlined),'aria-label':'移除'+field.label,onClick:()=>toggle(field.key,false)}));
      const top=canOrder(field)?h(Tooltip,{title:'置顶（'+field.group+'组内）'},h(Button,{type:'text',size:'small',icon:h(VerticalAlignTopOutlined),disabled:field.key===first,'aria-label':'置顶'+field.label,onClick:()=>pin(field)})):h(Tooltip,{title:'位置固定，可隐藏'},h(LockOutlined));
      const tools=field.required?h(Tooltip,{title:'识别填报对象与预测口径的必选字段'},h(LockOutlined,{'aria-label':'必选字段'})):h('span',{className:'column-tools'},remove,top);
      return h('div',{className:'antd-column-item','data-selected-field':field.key},h('span',{className:'column-position'},index+1),h('span',{className:'column-name'},field.label),tools);
    };
    const drawerBody=draft?h(React.Fragment,null,h('div',{className:'antd-column-template'},h(Select,{'aria-label':'选择列配置模板',placeholder:'选择模板',value:template,options:templateOptions,onChange:changeTemplate,style:{width:190}}),naming?h(Space,null,h(Input,{'aria-label':'模板名称',placeholder:'模板名称',maxLength:20,value:name,onChange:e=>setName(e.target.value),onPressEnter:saveTemplate}),h(Button,{onClick:saveTemplate},'保存模板')):h(Button,{type:'link',onClick:()=>{setNaming(true);setName('');}},'保存为新模板')),h('div',{className:'antd-column-layout'},h('section',{className:'antd-column-available'},h(Input,{'aria-label':'搜索字段',placeholder:'搜索字段',prefix:h(SearchOutlined),allowClear:true,value:search,onChange:e=>setSearch(e.target.value)}),...groupNames.map(group=>{const fields=fieldCatalog.filter(f=>f.group===group&&f.label.toLowerCase().includes(search.toLowerCase()));if(!fields.length)return null;return h('div',{className:'antd-column-group',key:group},h('div',{className:'antd-column-group-title'},group,group==='必选字段'?h('span',null,'不可取消'):h(Button,{type:'link',onClick:()=>setDraft(old=>({...old,keys:[...new Set([...old.keys,...fields.map(f=>f.key)])]}))},'全选')),h('div',{className:'antd-column-options'},...fields.map(f=>h(Checkbox,{key:f.key,'data-antd-config-field':f.key,checked:draft.keys.includes(f.key),disabled:f.required,onChange:e=>toggle(f.key,e.target.checked)},f.label))));})),h('section',{className:'antd-column-selected','aria-label':'已选字段'},h(Typography.Text,{type:'secondary'},'已选（'+draft.keys.length+'）'),...groupNames.map(group=>{const fields=draft.keys.map(k=>fieldCatalog.find(f=>f.key===k)).filter(f=>f.group===group),first=fields.find(canOrder)?.key;if(!fields.length)return null;return h('div',{className:'antd-column-group',key:group},h('div',{className:'antd-column-group-title'},group),h(Tree,{blockNode:true,selectable:false,showIcon:false,switcherIcon:null,draggable:{icon:h(HolderOutlined),nodeDraggable:node=>canOrder(fieldCatalog.find(f=>f.key===node.key))},allowDrop:({dragNode,dropNode,dropPosition})=>dropPosition!==0&&canOrder(fieldCatalog.find(f=>f.key===dragNode.key))&&canOrder(fieldCatalog.find(f=>f.key===dropNode.key)),onDrop:info=>{const parts=info.node.pos.split('-');reorder(info.dragNode.key,info.node.key,info.dropPosition-Number(parts.at(-1))>0);},treeData:fields.map((f,i)=>({key:f.key,title:selectedTitle(f,i,first),isLeaf:true}))}));}))),error?h(Alert,{type:'error',showIcon:true,message:error}):null):null;
    const portals=[ReactDOM.createPortal(h(Filters),$('#filterControls'),'filters'),ReactDOM.createPortal(h(Tooltip,{title:'列配置'},h(Button,{id:'antdColumnButton',type:'text',icon:h(SettingOutlined),'aria-label':'列配置',onClick:begin})),$('#columnIcon'),'columns')];
    $$('[data-forecast-toggle]').forEach(host=>{
      const id=host.dataset.forecastToggle,c=findChild(id),expanded=state.expandedChildren.has(id),label=expanded?'收起预测线':'展开填报';
      portals.push(ReactDOM.createPortal(h(Tooltip,{title:label},h(Button,{type:'text',size:'small',icon:h(expanded?icons.MinusSquareOutlined:icons.PlusSquareOutlined),'aria-label':label+' '+c.asin,'aria-expanded':expanded,'data-forecast-toggle-button':id,onClick:()=>{expanded?state.expandedChildren.delete(id):state.expandedChildren.add(id);renderTable();requestAnimationFrame(()=>document.querySelector('[data-forecast-toggle-button="'+id+'"]')?.focus({preventScroll:true}));}},expanded?null:label)),host,'forecast-'+id));
    });
    $$('[data-reason-host]').forEach(host=>{
      const c=findChild(host.dataset.reasonHost),key=host.dataset.reasonDate,content=host.dataset.reasonKind==='manual'?c.manualReasons[key]:[c.activity[key]?.name,c.activity[key]?.note].filter(Boolean).join('\n');
      portals.push(ReactDOM.createPortal(h(Tooltip,{title:h('div',{className:'reason-full'},content),trigger:['hover','focus'],mouseEnterDelay:0.3},h('span',{className:'cell-reason',tabIndex:0,'aria-label':content},content)),host,'reason-'+c.id+'-'+host.dataset.reasonKind+'-'+key));
    });
    $$('[data-note-control]').forEach(host=>{
      const c=findChild(host.dataset.noteControl),active=editor?.kind==='note'&&editor.id===c.id;
      const content=active?h(ForecastEditor,{key:editor.token,edit:editor,onClose:()=>setEditor(null)}):h(Button,{type:'text',size:'small','data-note-edit':c.id,'aria-label':'编辑 '+c.asin+' 商品备注',icon:h(icons.EditOutlined),style:{height:'auto',padding:0,whiteSpace:'normal',textAlign:'left'}},notes[c.id]||'添加备注');
      portals.push(ReactDOM.createPortal(content,host,'note-'+c.id));
    });
    return h(React.Fragment,null,messageHolder,editor&&editor.kind!=='note'?h(ForecastEditor,{key:editor.token,edit:editor,onClose:()=>setEditor(null)}):null,...portals,h(Drawer,{title:'列配置','aria-label':'列配置',open,onClose:close,width:'min(860px,96vw)',destroyOnHidden:true,styles:{body:{display:'flex',flexDirection:'column',padding:'16px 20px',overflow:'hidden'}},footer:h('div',{className:'column-footer'},h(Button,{onClick:()=>{setDraft(old=>({...old,keys:[...defaultFields]}));setTemplate('default');}},'恢复默认'),h(Space,null,h(Button,{onClick:close},'取消'),h(Button,{type:'primary',onClick:apply},'保存并应用')))},drawerBody));
  }
  ReactDOM.createRoot($('#antdControls')).render(withApp(h(Controls)));
})();
