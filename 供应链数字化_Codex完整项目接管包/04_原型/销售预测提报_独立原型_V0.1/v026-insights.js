/* V0.2.6: three persistent tabs and copy actions revealed on hover/focus. */
(() => {
  delete insightViews.product;
  const h=React.createElement,{useState,useEffect,useRef}=React;
  const {App,ConfigProvider,Drawer,Tabs,DatePicker,Radio,Checkbox,Descriptions,Table,Empty,Alert}=antd;
  const tokens=enterpriseThemeV020.token,cutoff=dayjs(dateKey(dataAsOf)),today=cutoff.add(1,'day'),snapshotActualAt=actualAt;
  const earliest=dayjs('2023-01-01'),key=d=>d.format('YYYY-MM-DD'),display=d=>d.format('YYYY/MM/DD');
  const theme={...enterpriseThemeV020,token:{...tokens,fontSize:12}};
  const calendarLocale={lang:{locale:'zh_CN',placeholder:'请选择日期',rangePlaceholder:['开始日期','结束日期'],today:'今天',now:'此刻',backToToday:'返回今天',ok:'确定',clear:'清除',month:'月',year:'年',previousMonth:'上个月',nextMonth:'下个月',monthSelect:'选择月份',yearSelect:'选择年份',decadeSelect:'选择年代',yearFormat:'YYYY年',cellYearFormat:'YYYY年',monthFormat:'M月',shortWeekDays:['日','一','二','三','四','五','六'],shortMonths:['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],previousYear:'上一年',nextYear:'下一年',previousDecade:'上一年代',nextDecade:'下一年代',previousCentury:'上一世纪',nextCentury:'下一世纪',monthBeforeYear:false},timePickerLocale:{placeholder:'请选择时间'}};
  const initialGroup=groups.find(g=>g.id==='US-B0GRGFFVVN');
  if(initialGroup){initialGroup.listedAt='2024-01-15';initialGroup.listingDays=cutoff.diff(dayjs(initialGroup.listedAt),'day');}
  const presetRanges=()=>[
    ...[7,14,30].map(n=>({label:'过去'+n+'天',value:[today.subtract(n,'day'),cutoff]})),
    {label:'本月',value:[today.startOf('month'),cutoff]},
    {label:'上月',value:[today.subtract(1,'month').startOf('month'),today.subtract(1,'month').endOf('month').startOf('day')]},
    {label:'今年',value:[today.startOf('year'),cutoff]},
    {label:'去年',value:[today.subtract(1,'year').startOf('year'),today.subtract(1,'year').endOf('year').startOf('day')]}
  ].filter(p=>!p.value[0].isAfter(p.value[1]));
  const daysBetween=(a,b)=>Array.from({length:b.diff(a,'day')+1},(_,i)=>key(a.add(i,'day')));
  function priorYear(k){const d=dayjs(k),previous=d.subtract(1,'year');return previous.month()===d.month()&&previous.date()===d.date()?key(previous):null;}
  function salesAt(c,g,k){
    if(!k||k<key(earliest)||k>key(cutoff)||k<g.listedAt)return null;
    const actual=snapshotActualAt(c,k);if(actual!=null)return actual;
    const n=dayjs(k).diff(earliest,'day'),growth=1+(dayjs(k).year()-2026)*.1;
    return Math.max(0,Math.round(c.base*growth*(1+.14*Math.sin(n*.81+c.serial)+.09*Math.cos(n*.17))));
  }
  function buildSales(c,g,range){
    const dates=daysBetween(...range),n=dates.length;
    const previous=daysBetween(range[0].subtract(n,'day'),range[0].subtract(1,'day')),year=dates.map(priorYear);
    return [dates,previous,year].map((keys,i)=>({name:['销量','上期销量','去年同期销量'][i],keys,values:keys.map(k=>salesAt(c,g,k))}));
  }
  function comparison(current,other){
    const pairs=current.values.map((v,i)=>[v,other.values[i]]).filter(p=>p.every(v=>v!=null));
    if(!pairs.length)return {count:0,delta:null,rate:null};
    const now=pairs.reduce((s,p)=>s+p[0],0),before=pairs.reduce((s,p)=>s+p[1],0);
    return {count:pairs.length,delta:now-before,rate:before===0?null:(now-before)/before*100};
  }
  window.forecastInsights={cutoff:key(cutoff),today:key(today),presetRanges,priorYear,buildSales,comparison,salesAt,calendarLocale};
  function Chart({series,dates,label}){
    const host=useRef(null),chart=useRef(null),option=useRef(null),[failed,setFailed]=useState(false);
    useEffect(()=>{
      if(!window.echarts){setFailed(true);return;}
      const el=host.current;
      const ensure=()=>{if(!el.clientWidth||!el.clientHeight)return;if(!chart.current){chart.current=echarts.init(el,null,{renderer:'svg'});if(option.current)chart.current.setOption(option.current,{notMerge:true});}chart.current.resize();};
      const observer=new ResizeObserver(ensure);observer.observe(el);ensure();
      return()=>{observer.disconnect();chart.current?.dispose();chart.current=null;};
    },[]);
    useEffect(()=>{
      const colors=series.map(s=>s.name==='去年同期销量'?'#70ad62':s.name==='上期销量'||s.name==='最终预测'?'#e48ba2':tokens.colorPrimary);
      option.current={animation:false,backgroundColor:'transparent',textStyle:{fontFamily:tokens.fontFamily,fontSize:12},
        color:[tokens.colorPrimary,'#e48ba2','#70ad62'],
        legend:{top:8,left:12,itemWidth:23,itemHeight:8,selectedMode:false,data:series.map(s=>s.name),textStyle:{fontSize:12,color:tokens.colorTextSecondary}},
        grid:{left:58,right:26,top:78,bottom:84},
        tooltip:{trigger:'axis',confine:true,axisPointer:{type:'cross',label:{backgroundColor:tokens.colorTextSecondary}},
          formatter:params=>{const i=params[0]?.dataIndex;if(i==null)return '';return '<div class="sales-chart-tooltip"><strong>销售日期 '+esc(dates[i].replaceAll('-','/'))+'</strong>'+series.map((s,j)=>'<div><span style="color:'+colors[j]+'">●</span> '+esc(s.name)+' <span>'+esc(s.keys[i]?.replaceAll('-','/')||'无对应日期')+'</span><b>'+ (s.values[i]==null?'暂无数据':num(s.values[i])+' 件')+'</b></div>').join('')+'</div>';}
        },
        xAxis:{type:'category',boundaryGap:false,data:dates,axisLine:{lineStyle:{color:tokens.colorBorderSecondary}},axisTick:{show:false},axisLabel:{color:tokens.colorTextTertiary,hideOverlap:true,formatter:value=>dayjs(value).format('MM/DD')},splitLine:{show:false}},
        yAxis:{type:'value',name:'销量（件）',min:0,minInterval:1,nameTextStyle:{color:tokens.colorTextTertiary},axisLabel:{color:tokens.colorTextTertiary,formatter:value=>num(value)},splitLine:{lineStyle:{type:'dashed',color:tokens.colorBorderSecondary}}},
        dataZoom:[{type:'inside',filterMode:'none',zoomOnMouseWheel:'ctrl'},{type:'slider',height:20,bottom:18,start:0,end:100,borderColor:tokens.colorBorderSecondary,showDetail:true}],
        series:series.map((s,i)=>({name:s.name,type:'line',data:s.values,connectNulls:false,showSymbol:false,symbol:'circle',symbolSize:6,itemStyle:{color:colors[i]},lineStyle:{color:colors[i],width:2,type:i?'dashed':'solid'},emphasis:{focus:'series'},smooth:false})),
        aria:{enabled:true,description:label}
      };chart.current?.setOption(option.current,{notMerge:true});
    },[series,dates,label]);
    if(failed)return h(Alert,{type:'error',showIcon:true,message:'图表组件加载失败，请刷新后重试'});
    return h('div',{ref:host,className:'sales-echart','data-testid':'sales-chart',role:'img','aria-label':label});
  }
  const fmtRange=range=>range.map(display).join(' - ');
  const seriesRange=s=>{const dates=s.keys.filter(Boolean);return dates.length?dates[0].replaceAll('-','/')+' - '+dates.at(-1).replaceAll('-','/'):'无对应日期';};
  function Sales({c,g,prefs,onChange,onCalendarOpenChange}){
    const range=prefs.range.map(v=>dayjs(v)),all=buildSales(c,g,range),series=all.filter((s,i)=>i===0||prefs.compare.includes(i)),dates=all[0].keys;
    const presets=presetRanges(),chosen=presets.find(p=>key(p.value[0])===prefs.range[0]&&key(p.value[1])===prefs.range[1])?.label;
    const setRange=values=>{if(values?.every(Boolean)&&!values[1].isAfter(cutoff,'day'))onChange({...prefs,range:values.map(key)});};
    return h('section',{className:'sales-panel'},
      h('div',{className:'sales-date-toolbar'},h('label',{htmlFor:'sales-range-start'},'销量日期'),
        h(DatePicker.RangePicker,{id:{start:'sales-range-start',end:'sales-range-end'},locale:calendarLocale,value:range,format:'YYYY/MM/DD',allowClear:false,inputReadOnly:true,minDate:earliest,maxDate:cutoff,disabledDate:d=>d.isAfter(cutoff,'day')||d.isBefore(earliest,'day'),presets,onChange:setRange,onOpenChange:onCalendarOpenChange,style:{width:270},'aria-label':'销量日期范围'}),
        h('span',{className:'sales-cutoff'},'数据截至 '+display(cutoff)+' · T+1')),
      h('div',{className:'sales-chart-controls'},h(Radio.Group,{size:'small',value:chosen,optionType:'button',options:presets.map(p=>({label:p.label,value:p.label})),onChange:e=>setRange(presets.find(p=>p.label===e.target.value).value),'aria-label':'销量快捷时间'}),
        h('div',{className:'sales-compare-options'},h(Checkbox,{checked:prefs.compare.includes(1),onChange:e=>onChange({...prefs,compare:e.target.checked?[...prefs.compare,1]:prefs.compare.filter(i=>i!==1)})},'对比上期'),h(Checkbox,{checked:prefs.compare.includes(2),onChange:e=>onChange({...prefs,compare:e.target.checked?[...prefs.compare,2]:prefs.compare.filter(i=>i!==2)})},'对比去年同期'))),
      h('div',{className:'sales-summary'},...series.map(s=>{
        const i=all.indexOf(s),present=s.values.filter(v=>v!=null),total=present.length?present.reduce((a,b)=>a+b,0):null,change=i?comparison(all[0],s):null;
        return h('div',{className:'sales-summary-item',key:s.name},h('span',null,i===0?'本期销量':s.name),h('strong',null,total==null?'暂无数据':num(total),total==null?null:h('small',null,' 件')),
          h('small',null,'有数 '+present.length+' / '+dates.length+' 天'),change?h('span',{className:'sales-comparison-result'},!change.count?'无可比数据':h(React.Fragment,null,'本期较'+(i===1?'上期':'去年同期')+' '+(change.delta>0?'+':'')+num(change.delta)+'件',h('small',null,change.rate==null?'基期为0，不计算变化率':(change.rate>0?'+':'')+num(change.rate)+'%'),' · 可比'+change.count+'天')):null);
      })),
      h('div',{className:'sales-comparison-ranges'},...series.slice(1).map(s=>h('span',{key:s.name},s.name.replace('销量','')+'：'+seriesRange(s)))),
      series.every(s=>s.values.every(v=>v==null))?h(Empty,{image:Empty.PRESENTED_IMAGE_SIMPLE,description:'所选区间暂无销量数据'}):h(Chart,{series,dates,label:'销量趋势：'+fmtRange(range)+'；'+series.map(s=>s.name).join('、')}));
  }
  function CopyCode({value,label}){
    return h('span',{className:'insight-copy-code',tabIndex:0,'aria-label':label+'：'+value},value,
      h('span',{className:'insight-copy-action'},h(antd.Tooltip,{title:'复制'+label},h(antd.Button,{type:'text',size:'small',icon:h(icons.CopyOutlined),'aria-label':'复制'+label,style:{width:20,minWidth:20,height:20,padding:0,color:tokens.colorPrimary},onClick:async()=>{try{await navigator.clipboard.writeText(value);toast('已复制');}catch{toast('复制失败，请重试');}}}))));
  }
  const code=(value,label)=>h(CopyCode,{value,label});
  const details=items=>h(Descriptions,{size:'small',column:2,items:items.map(([label,children],i)=>({key:String(i),label,children}))});
  function Mapping({c,g}){
    return h('section',{className:'product-mapping'},h(Table,{size:'small',rowKey:'key',pagination:false,scroll:{x:650},columns:[
      {title:'SKU',dataIndex:'sku',width:140,render:v=>code(v,'SKU')},{title:'业务识别码',dataIndex:'biz',width:210,render:v=>v?code(v,'业务识别码'):''},{title:'有效期',dataIndex:'period',width:240},{title:'状态',dataIndex:'status',width:70}
    ],dataSource:[{key:'current',sku:c.sku,biz:c.businessCode,period:'2026/10/01 - 2026/11/15',status:'当前'},{key:'history',sku:c.historicSku,biz:null,period:'2026/08/01 - 2026/09/30',status:'历史'}]}));
  }
  function Analysis({c}){
    const dates=visibleDays().map(dateKey),forecasts=dates.map(k=>forecastAt(c,state.batch,k));
    if(forecasts.every(f=>f==null))return h(Empty,{image:Empty.PRESENTED_IMAGE_SIMPLE,description:'本批次未覆盖所选日期'});
    const series=[{name:'规则预测',keys:dates,values:forecasts.map(f=>f?.ai??null)},{name:'最终预测',keys:dates,values:forecasts.map(f=>f?.final??null)}];
    return h('section',null,h('p',{className:'insight-period'},'预测窗口 '+dates[0].replaceAll('-','/')+' - '+dates.at(-1).replaceAll('-','/')),
      details([['规则预测总量',num(sumValues(series[0].values))+' 件'],['最终预测总量',num(sumValues(series[1].values))+' 件'],['预测变化',sumValues(series[0].values)?num((sumValues(series[1].values)/sumValues(series[0].values)-1)*100)+'%':''],['采用规则预测',forecasts.filter(f=>f&&f.manual==null&&!f.activity).length+' 天'],['采用人工预测',forecasts.filter(f=>f?.manual!=null&&!f.activity).length+' 天'],['采用活动预测',forecasts.filter(f=>f?.activity).length+' 天']]),
      h(Chart,{series,dates,label:'规则预测与最终预测趋势'}));
  }
  function ProductInsights(){
    const [selection,setSelection]=useState({open:false,id:null,tab:'sales'}),[preferences,setPreferences]=useState({}),[calendarOpen,setCalendarOpen]=useState(false),returnTarget=useRef(null);
    const close=()=>{setCalendarOpen(false);setSelection(old=>({...old,open:false}));};
    useEffect(()=>{
      const open=(id,tab,trigger)=>{if(!findChild(id)||!insightViews[tab])return;hideCodeTooltip();hideImagePreview();clearCross();if(trigger)returnTarget.current=trigger;setSelection({open:true,id,tab});};
      openInsight=open;
      const handle=e=>{const entry=e.target.closest('[data-insight]');if(!entry)return;e.preventDefault();e.stopImmediatePropagation();open(entry.dataset.asin,entry.dataset.insight,entry);};
      document.addEventListener('click',handle,true);return()=>document.removeEventListener('click',handle,true);
    },[]);
    const c=findChild(selection.id),g=groups.find(g=>g.children.includes(c));
    const prefs=preferences[selection.id]||{range:presetRanges().find(p=>p.label==='过去30天').value.map(key),compare:[1,2]};
    const content=()=>selection.tab==='sales'?h(Sales,{c,g,prefs,onCalendarOpenChange:setCalendarOpen,onChange:p=>setPreferences(old=>({...old,[c.id]:p}))}):selection.tab==='analysis'?h(Analysis,{c}):h(Mapping,{c,g});
    return h(Drawer,{open:selection.open,onClose:close,keyboard:!calendarOpen,title:'商品详情','aria-label':'商品详情',width:'min(1000px,94vw)',destroyOnHidden:true,styles:{body:{display:'flex',flexDirection:'column',padding:'16px 24px',overflow:'hidden'}},afterOpenChange:open=>{if(!open&&returnTarget.current?.isConnected)returnTarget.current.focus({preventScroll:true});}},
      c?h(React.Fragment,null,h('div',{className:'insight-identity'},code(c.asin,'Child ASIN'),h('span',null,g.market+' / '+g.account),h('span',null,g.name+' · '+c.color+' / '+c.size)),
        h(Tabs,{size:'small',style:{minHeight:0},activeKey:selection.tab,onChange:tab=>{setCalendarOpen(false);setSelection(old=>({...old,tab}));},items:Object.entries(insightViews).map(([key,label])=>({key,label,children:key===selection.tab&&selection.open?h('div',{className:'insight-content','data-insight-panel':key},content()):null}))})):null);
  }
  const host=document.createElement('div');host.id='productInsights';document.body.append(host);
  ReactDOM.createRoot(host).render(h(ConfigProvider,{theme,componentSize:'small'},h(App,null,h(ProductInsights))));
  renderTable();
})();
