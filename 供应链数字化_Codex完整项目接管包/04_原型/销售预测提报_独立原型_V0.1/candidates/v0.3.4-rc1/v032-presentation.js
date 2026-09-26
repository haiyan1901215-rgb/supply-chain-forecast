/* Compact semantic layers without changing forecast values or stored preferences. */
(() => {
  const h=React.createElement,{ConfigProvider,Tag}=antd,host=document.createElement('div');host.id='presentationV029';document.body.append(host);
  const root=ReactDOM.createRoot(host),theme={...enterpriseThemeV020,token:{...enterpriseThemeV020.token,fontSize:12}};
  productTags=g=>`<span class="product-status-tags" data-status-tags="${esc(g.id)}"></span>`;
  weekRange=days=>`${dateLabel(days[0])} ~ ${dateLabel(days.at(-1))}`;
  const previousProduct=productCell;
  productCell=function(g,c,span){const t=document.createElement('template');t.innerHTML='<table><tbody><tr>'+previousProduct(g,c,span)+'</tr></tbody></table>';const cell=t.content.querySelector('td'),store=cell.querySelector('.child-store');if(store)store.innerHTML=`<span class="store-icon" data-store-icon aria-hidden="true"></span><span class="store-name">${esc(g.account)}</span>`;return cell.outerHTML;};
  const previousContext=contextCell;
  contextCell=function(c,span){const t=document.createElement('template');t.innerHTML='<table><tbody><tr>'+previousContext(c,span)+'</tr></tbody></table>';const cell=t.content.querySelector('td');if(!cell)return '';cell.querySelectorAll('.context-section').forEach(section=>{section.dataset.section=section.querySelector('.context-section-title').textContent==='销量'?'sales':'stock';});return cell.outerHTML;};
  const previousParent=parentBand;
  parentBand=function(g){const t=document.createElement('template');t.innerHTML='<table><tbody><tr>'+previousParent(g)+'</tr></tbody></table>';const cell=t.content.querySelector('td'),code=cell.querySelector('.code-value:not(.parent-skc)'),count=document.createElement('span');count.className='parent-child-count';count.textContent='('+g.children.length+')';count.setAttribute('aria-label','当前页该父ASIN下 '+g.children.length+' 个子ASIN');code.querySelector('.code-text').after(count);return cell.outerHTML;};
  const refresh=()=>{
    const portals=[];
    $$('[data-status-tags]').forEach((el,i)=>{const g=groups.find(g=>g.id===el.dataset.statusTags);if(!g)return;const tags=['已上架',...g.tags].map(value=>{const t=tagDefinitions[value]||{category:'商品',value},color={green:'success',blue:'processing',amber:'warning',purple:'default'}[t.tone]||'default';return h(Tag,{key:value,color,'data-tag-category':t.category,style:{fontSize:12,lineHeight:'18px',fontWeight:400,paddingInline:3,marginInlineEnd:0,borderRadius:3}},t.category+'：'+t.value);});portals.push(ReactDOM.createPortal(tags,el,'tags-'+i));});
    $$('[data-store-icon]').forEach((el,i)=>portals.push(ReactDOM.createPortal(h(icons.ShopOutlined),el,'store-'+i)));
    root.render(h(ConfigProvider,{theme,componentSize:'small'},h(React.Fragment,null,...portals)));
  };
  const previousRender=renderTable;
  renderTable=function(){const wb=$('#workbench'),top=wb.scrollTop,left=wb.scrollLeft;previousRender();$$('.summary-row',wb).forEach(row=>row.remove());wb.scrollTop=top;wb.scrollLeft=left;syncHorizontalScrollbar();positionForecastDivider();refresh();};
  render();
})();
