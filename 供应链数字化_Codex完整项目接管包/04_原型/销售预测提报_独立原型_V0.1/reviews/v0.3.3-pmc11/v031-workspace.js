/* V0.2.8: preserve the forecast workspace while adding concrete SKU navigation. */
(() => {
  const h=React.createElement,{ConfigProvider,App,Pagination,InputNumber,Tabs,Table,Input,Typography}=antd;
  const compactTheme={...enterpriseThemeV020,token:{...enterpriseThemeV020.token,fontSize:12},components:{...enterpriseThemeV020.components,Pagination:{...enterpriseThemeV020.components.Pagination,itemSizeSM:24},Select:{...enterpriseThemeV020.components.Select,fontSize:12,optionFontSize:12,controlHeightSM:24},InputNumber:{fontSize:12,inputFontSizeSM:12,controlHeightSM:24}}};
  const wrap=child=>h(ConfigProvider,{theme:compactTheme,componentSize:'small'},h(App,null,child));
  const oldProduct=productCell;
  productCell=function(g,c,span){
    const t=document.createElement('template');t.innerHTML='<table><tbody><tr>'+oldProduct(g,c,span)+'</tr></tbody></table>';
    const cell=t.content.querySelector('td'),store=Array.from(cell.querySelectorAll('.product-meta')).find(e=>e.querySelector('[data-hint^="账号 / 店铺"]'));
    if(store){const label=store.firstElementChild;label.classList.add('child-store');cell.querySelector('.child-asin-line').append(label);store.remove();}
    cell.querySelectorAll('.product-identifiers .code-text').forEach(el=>{const link=document.createElement('a');link.className='code-text sku-detail-link';link.href='#sku='+encodeURIComponent(c.sku);link.dataset.skuLink=c.sku;link.textContent=el.textContent;link.setAttribute('aria-label',el.getAttribute('aria-label')+'，查看SKU详情列表');el.replaceWith(link);});
    return cell.outerHTML;
  };
  const previousWidth=columnWidth;
  columnWidth=function(key){if(key.startsWith('date:'))return state.dateWidths[key.slice(5)]??104;if(key.startsWith('week:'))return state.weekWidths[key.slice(5)]??128;return previousWidth(key);};
  const previousDateHeader=dateHeader;
  dateHeader=function(col,i){if(col.type!=='week')return previousDateHeader(col,i);return `<th class="date-head date-col week-boundary week-collapsed" data-focus-index="${i}"><div>${weekRange(col.days)}</div>${resizeHandle(col.key,'W'+col.week.number+'日期区间')}</th>`;};

  const paginationHost=$('.pagination');paginationHost.className='forecast-pagination';const paginationRoot=ReactDOM.createRoot(paginationHost);
  const locale={items_per_page:'条/页',jump_to:'跳至',jump_to_confirm:'确定',page:'页',prev_page:'上一页',next_page:'下一页',prev_5:'向前5页',next_5:'向后5页',page_size:'每页条数'};
  function PaginationBar({current,pageSize,total,parentCount,visible}){
    const [destination,setDestination]=React.useState(null);
    React.useEffect(()=>setDestination(null),[current,pageSize,total]);
    const change=(page,size=pageSize)=>{state.page=size!==pageSize?1:page;state.pageSize=size;$('#workbench').scrollTop=0;renderTable();};
    const jump=()=>{if(destination==null)return;change(Math.max(1,Math.min(Math.ceil(total/pageSize)||1,Math.trunc(destination))));setDestination(null);};
    return h('div',{className:'forecast-pagination-bar'},
      h(Pagination,{current,pageSize,total,size:'small',locale,showSizeChanger:true,showQuickJumper:false,hideOnSinglePage:false,pageSizeOptions:[5,20,50],
        showTotal:()=>h('span',{className:'forecast-page-total'},'共 ',h('b',null,num(parentCount)),' 个父ASIN / ',h('b',null,num(total)),' 个子ASIN，当前页 ',h('b',null,num(visible)),' 个子ASIN'),
        onChange:change}),
      h('label',{className:'forecast-page-jump'},'跳至',h(InputNumber,{'aria-label':'跳转页码',min:1,max:Math.max(1,Math.ceil(total/pageSize)),precision:0,controls:false,disabled:!total,value:destination,onChange:setDestination,onPressEnter:jump,onBlur:jump,style:{width:44},size:'small'}),'页'));
  }
  renderPagination=function(){
    const all=filteredGroups(),total=all.reduce((s,g)=>s+g.children.length,0),visible=displayGroups().reduce((s,g)=>s+g.children.length,0);
    paginationRoot.render(wrap(h(PaginationBar,{current:state.page,pageSize:state.pageSize,total,parentCount:all.length,visible})));
  };

  // Official workspace tabs; the forecast tree is retained when the read-only SKU page is active.
  const oldTabs=$('.workspace-tabs'),tabs=document.createElement('div');tabs.className='workspace-tabs-v028';oldTabs.replaceWith(tabs);
  const content=$('.content'),skuHost=document.createElement('section');skuHost.className='sku-workspace';skuHost.hidden=true;skuHost.setAttribute('aria-label','SKU详情列表');content.after(skuHost);
  const tabsRoot=ReactDOM.createRoot(tabs),skuRoot=ReactDOM.createRoot(skuHost);
  let skuOpen=false,currentSku='',active='forecast',returnTarget=null;
  const skuRows=()=>{const seen=new Set();return groups.flatMap(g=>g.children.map(c=>({key:c.sku,sku:c.sku,businessCode:c.businessCode,name:g.name,spu:g.spu,skc:g.skc,color:c.color,size:c.size}))).filter(r=>{if(seen.has(r.sku))return false;seen.add(r.sku);return true;});};
  function SkuList({sku}){
    const [draft,setDraft]=React.useState(sku),[query,setQuery]=React.useState(sku);
    const data=skuRows().filter(r=>!query||[r.sku,r.businessCode].some(v=>v.includes(query.toUpperCase())));
    return h('div',{className:'sku-list-surface'},h('div',{className:'sku-list-toolbar'},h('h2',null,'SKU详情列表'),h(Input.Search,{value:draft,onChange:e=>setDraft(e.target.value),onSearch:v=>setQuery(v.trim()),allowClear:true,'aria-label':'搜索SKU或业务识别码',placeholder:'SKU / 业务识别码',style:{width:300}}),h(Typography.Link,{href:'#forecast'},'返回销售预测')),
      h(Table,{size:'small',rowKey:'sku',pagination:false,scroll:{x:1080},locale:{emptyText:'没有匹配的SKU'},dataSource:data,columns:[
        {title:'SKU',dataIndex:'sku',width:110},{title:'业务识别码',dataIndex:'businessCode',width:190},{title:'商品名称',dataIndex:'name',width:180},{title:'SPU',dataIndex:'spu',width:100},{title:'SKC',dataIndex:'skc',width:130},{title:'颜色',dataIndex:'color',width:90},{title:'尺码',dataIndex:'size',width:70}],
        expandable:{defaultExpandedRowKeys:skuRows().some(r=>r.sku===sku)?[sku]:[],expandedRowRender:r=>h(Table,{size:'small',rowKey:'id',pagination:false,dataSource:groups.flatMap(g=>g.children.filter(c=>c.sku===r.sku).map(c=>({id:c.id,site:g.market,account:g.account,parent:g.parent,child:c.asin}))),columns:[{title:'国家 / 站点',dataIndex:'site'},{title:'账号 / 店铺',dataIndex:'account'},{title:'父ASIN',dataIndex:'parent'},{title:'子ASIN',dataIndex:'child'}]})}}));
  }
  function drawRoute(){
    tabs.classList.remove('planning-system-tabs');
    const isSku=active==='sku';document.body.dataset.workspace=active;content.classList.toggle('is-route-hidden',isSku);skuHost.hidden=!isSku;$('.crumb b').textContent=isSku?'SKU详情列表':'销售预测';
    tabsRoot.render(wrap(h(Tabs,{type:'editable-card',size:'small',hideAdd:true,activeKey:active,tabBarStyle:{margin:0},items:[{key:'forecast',label:'销售预测',closable:false},...(skuOpen?[{key:'sku',label:'SKU详情列表',closable:true}]:[])],onChange:key=>{location.hash=key==='sku'?'sku='+encodeURIComponent(currentSku):'forecast';},onEdit:(key,action)=>{if(action==='remove'&&key==='sku'){skuOpen=false;location.hash='forecast';if(active==='forecast')drawRoute();}}})));
    if(isSku)skuRoot.render(wrap(h(SkuList,{key:currentSku,sku:currentSku})));else requestAnimationFrame(()=>{syncHorizontalScrollbar();positionForecastDivider();returnTarget?.isConnected&&returnTarget.focus({preventScroll:true});});
  }
  function route(){const m=location.hash.match(/^#sku=(.*)$/);if(m){try{currentSku=decodeURIComponent(m[1]);}catch{currentSku='';}active='sku';skuOpen=true;hideCodeTooltip();hideImagePreview();}else active='forecast';drawRoute();}
  document.addEventListener('click',e=>{const a=e.target.closest('[data-sku-link]');if(a&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){returnTarget=a;if(location.hash===a.getAttribute('href'))route();}});
  window.forecastWorkspaceTabsRedraw=drawRoute;
  window.addEventListener('hashchange',route);render();route();
})();
