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
  function Submission(){
    const current=state.batch===currentBatch;
    return h('div',{className:'submission-controls'},h('div',{className:'submission-current'},h('span',null,current?'正在填报：':'正在查看：'),h('strong',null,formatKey(state.batch)+' 提报'),!current?h(Tag,null,'历史只读'):null,h(Tooltip,{title:'提报日期表示哪一次填写；列表表头日期表示预计哪一天销售。历史对比按同一销售日期对齐。'},h(QuestionCircleOutlined,{'aria-label':'提报日期与销售日期的区别',tabIndex:0}))),h('div',{className:'submission-history'},!current?h(Button,{type:'link',onClick:()=>selectSubmission(currentBatch)},'返回本次填报'):null,h(Select,{'aria-label':'查看历史提报',placeholder:'查看历史提报',allowClear:true,value:current?undefined:state.batch,options:batchDates.slice(1).map(b=>({value:b,label:formatKey(b)+' 提报'})),style:{width:180},onChange:batch=>selectSubmission(batch||currentBatch)})));
  }
  function ReviewControls({child}){
    const [error,setError]=useState('');
    return h(React.Fragment,null,h('div',{className:'retro-control-row'},h('label',null,'销售日期',h(DatePicker.RangePicker,{'aria-label':'历史实销销售日期',value:reviewRange(child).map(key=>dayjs(key)),format:'YYYY/MM/DD',allowClear:false,inputReadOnly:true,disabledDate:(date,info)=>{const key=date.format('YYYY-MM-DD');return key<reviewEarliest||key>reviewLatest||(info?.from&&Math.abs(date.diff(info.from,'day'))>13);},onChange:dates=>{if(!dates)return;const range=dates.map(d=>d.format('YYYY-MM-DD'));if(dayDistance(range[1],range[0])>13){setError('一次最多核对14天，请缩短日期范围');return;}state.reviewRanges[child.id]=range;setError('');renderTable();}})),h('label',null,'对比哪次提报',h(Select,{'aria-label':child.asin+' 对比提报日期',value:reviewBatch(child),options:batchDates.slice(1).map(b=>({value:b,label:formatKey(b)+' 提报'})),style:{width:168},onChange:batch=>{state.reviewBatches[child.id]=batch;renderTable();}})),h('span',{className:'retro-asof'},'实际销量截至 2026/10/20')),error?h(Alert,{type:'error',message:error,showIcon:true}):null);
  }
  function Controls(){
    const [,force]=useReducer(n=>n+1,0),[open,setOpen]=useState(false),[draft,setDraft]=useState(null),[search,setSearch]=useState(''),[template,setTemplate]=useState(undefined),[naming,setNaming]=useState(false),[name,setName]=useState(''),[error,setError]=useState('');
    const {modal,message}=App.useApp();
    useEffect(()=>{window.refreshForecastControls=force;window.mountReviewControls=force;return()=>{delete window.refreshForecastControls;delete window.mountReviewControls;};},[]);
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
    const portals=[ReactDOM.createPortal(h(Filters),$('#filterControls'),'filters'),ReactDOM.createPortal(h(Submission),$('#submissionControls'),'submission'),ReactDOM.createPortal(h(Tooltip,{title:'列配置'},h(Button,{id:'antdColumnButton',type:'text',icon:h(SettingOutlined),'aria-label':'列配置',onClick:begin})),$('#columnIcon'),'columns')];
    $$('[data-review-controls]').forEach(host=>{const c=findChild(host.dataset.reviewControls);if(c)portals.push(ReactDOM.createPortal(h(ReviewControls,{child:c}),host,host.dataset.reviewControls));});
    return h(React.Fragment,null,...portals,h(Drawer,{title:'列配置','aria-label':'列配置',open,onClose:close,width:'min(860px,96vw)',destroyOnHidden:true,styles:{body:{display:'flex',flexDirection:'column',padding:'16px 20px',overflow:'hidden'}},footer:h('div',{className:'column-footer'},h(Button,{onClick:()=>{setDraft(old=>({...old,keys:[...defaultFields]}));setTemplate('default');}},'恢复默认'),h(Space,null,h(Button,{onClick:close},'取消'),h(Button,{type:'primary',onClick:apply},'保存并应用')))},drawerBody));
  }
  ReactDOM.createRoot($('#antdControls')).render(withApp(h(Controls)));
})();
