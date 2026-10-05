/* V0.1.9 — target-date keyed forecast ledger. Static prototype extension. */
const currentBatch = '2026-09-29';
const batchDates = [currentBatch,'2026-09-22','2026-09-15','2026-09-08','2026-09-01','2026-08-25','2026-08-18'];
const parseDay = key => new Date(...key.split('-').map((n,i)=>Number(n)-(i===1?1:0)));
const shiftDay = (key,n) => {const d=parseDay(key);d.setDate(d.getDate()+n);return dateKey(d);};
const dayDistance = (a,b) => Math.round((Date.parse(a)-Date.parse(b))/86400000);
const formatKey = key => key.replaceAll('-','/');
const activeForecastBatch = () => window.ForecastBatchContract?.getCurrentMeta?.() || window.ForecastBatchContract?.getCurrent?.() || null;
const activeForecastBatchDate = () => activeForecastBatch()?.batchDate || currentBatch;
const forecastBatch = batch => window.ForecastBatchContract?.getBatchMeta?.(batch) || window.ForecastBatchContract?.getBatch?.(batch) || null;
const forecastRange = batch => {
  const model=forecastBatch(batch);
  return {start:model?.forecastStartDate||batch,end:model?.forecastEndDate||shiftDay(batch,181)};
};
const covered = (batch,key) => {const range=forecastRange(batch);return key>=range.start&&key<=range.end;};
const availableForecastBatches = () => [...new Set([...(window.ForecastBatchContract?.listBatches?.()||[]).map(batch=>batch.batchDate),...batchDates])].sort((a,b)=>b.localeCompare(a));
function batchDraft(c,batch=activeForecastBatchDate()){
  if(batch===currentBatch)return c;
  c.forecastBatchDrafts ||= {};
  return c.forecastBatchDrafts[batch] ||= {manual:{},manualReasons:{},activity:{},reason:'',changes:[]};
}
const numberOrBlank = value => value==null?'':num(value);
const signed = value => value==null?'—':`${value>0?'+':''}${num(value)}`;
const sumValues = values => values.every(v=>v==null)?null:values.reduce((s,v)=>s+(v??0),0);
const resolveForecast = (ai,manual,activity) => activity!=null?activity:manual!=null?manual:ai;
const modelDefinitions = [
  ['B0GRGFFVVN','C0001','91','黑色','高腰塑形短裤','black-shaping-shorts.png','李敏',['B0GRG5DRWW','B0GRG6H2KL','B0GRG7J9MN']],
  ['B0H4QG3TLS','C0002','92','肤色','无痕提臀短裤','nude-lifting-shorts.png','周宁',['B0CVRKCC5M','B0H4QJ8L2P','B0H4QL9M3R']],
  ['B0GY4KJPF4','C0003','91','黑色','收腹塑形短裤','black-shaping-shorts.png','李敏',['B0GY4LY1D7','B0GY4PXNWR']],
  ['B0GJT623SK','C0004','92','肤色','轻塑提臀短裤','nude-lifting-shorts.png','陈洁',['B0GJZGTZZP','B0GJZHP4KL']],
  ['B0CP75XCTP','E0005','93','蓝色','高支撑运动文胸','blue-sports-bra.png','陈洁',['B0CKYMWV23','B0CKYMJ4NV','B0CKYP9WNG','B0CKYNCBDL']]
];
const skuExamples = ['A1B2C3D','1234567','ABCDEFG','8E2R5T0','7654321','ABC1234','M7N8P9Q','ZXCVBNM','2345678','H3J4K5L','Q7W8E9R','9876543','P1Q2R3S','T6U7V8W','LMN4567','C9D8E7F'];
let mockSequence=0;
const tagExamples=[
  ['成熟期','头部','畅款','正常'],
  ['新品','中坚','平款','正常'],
  ['成长期','中坚','爆款','暂停'],
  ['成熟期','维持','平款','正常'],
  ['IPD款','限期拯救','低销','停采']
];
modelDefinitions.forEach(([parent,spu,colorCode,color,name,asset,owner,asins],groupIndex)=>{
  const g={id:'US-'+parent,parent,spu,version:'A',colorCode,colors:[color],skc:spu+'A-'+colorCode,name,owner,image:'assets/'+asset,market:'US',platform:'Amazon',account:'BRABIC-US',brand:'N',channel:groupIndex===1?null:'0',businessVersion:groupIndex===3?null:'A',tags:tagExamples[groupIndex]||tagExamples[0],listedAt:'2026-01-15',listingDays:278};
  g.children=asins.map((asin,i)=>{
    const serial=mockSequence++,size=(asins.length===2?['M','L']:['S','M','L','XL'])[i];
    return {id:g.market+'-'+asin,asin,sku:skuExamples[serial],historicSku:'H'+String(serial+1).padStart(6,'0'),combo:'SC'+(serial+1).toString(36).toUpperCase().padStart(7,'0'),businessCode:g.brand+(g.channel??'')+spu+(g.businessVersion??'')+'-'+colorCode+'-'+size,size,color,serial,base:32-serial%6,stock:243-serial*4,fba:120,inbound:80,fbaInbound:60,doi:18.6+serial,exhausted:'11/02',arrival:'12/05',manual:{},activity:{},reason:'',changes:[]};
  });groups.push(g);
});
const ukGroup={...groups[0],id:'UK-'+groups[0].parent,market:'UK',account:'BRABIC-UK',channel:null};
ukGroup.children=groups[0].children.slice(0,2).map((child,i)=>({...child,id:'UK-'+child.asin,base:18-i,stock:166-i*8,doi:23.2+i,businessCode:'NC0001A-91-'+child.size,manual:{},manualReasons:{},activity:{},reason:'',changes:[]}));groups.push(ukGroup);

Object.assign(codeDescriptions,{SPU:'PLM商品款 / 开发款号；产品形态 + 4位开发流水号',SKC:'颜色商品单元；SPU版本 + 颜色主数据编码',SKU:'商品唯一编码；固定7位数字或大写字母','销售组合':'SC + 7位36进制流水号；独立于SKU','业务识别码':'品牌货盘 + 可选渠道 + SPU + 可选版本 - 颜色 - 尺码'});
const currentStorageKey='pmc-forecast-v019-current';
try {
  const saved=JSON.parse(localStorage.getItem(currentStorageKey)||'{}');
  allChildren().forEach(c=>{const old=saved[c.id];if(!old)return;
    c.manualReasons=Object.fromEntries(Object.entries(old.manualReasons||{}).filter(([k,v])=>covered(currentBatch,k)&&typeof v==='string'));
    c.manual=Object.fromEntries(Object.entries(old.manual||{}).filter(([k,v])=>covered(currentBatch,k)&&Number.isInteger(v)&&v>=0));
    c.activity=Object.fromEntries(Object.entries(old.activity||{}).filter(([k,v])=>covered(currentBatch,k)&&v&&Number.isInteger(v.qty)&&v.qty>=0&&typeof v.name==='string'));
    c.reason=typeof old.reason==='string'?old.reason:'';c.changes=Array.isArray(old.changes)?old.changes.slice(-30):[];
  });
} catch { /* A malformed cache does not replace the valid demonstration data. */ }
function persistCurrent() {if(activeForecastBatchDate()!==currentBatch)return true;try{localStorage.setItem(currentStorageKey,JSON.stringify(Object.fromEntries(allChildren().map(c=>[c.id,{manual:c.manual,manualReasons:c.manualReasons||{},activity:c.activity,reason:c.reason,changes:c.changes}]))));return true;}catch{toast('浏览器保存失败，当前修改仅在本次页面保留');return false;}}

// Freeze each historical component snapshot, indexed by batch + site/ASIN + target date.
const historicalSnapshots = {};
batchDates.slice(1).forEach((batch,bi)=>{
  const rows={};allChildren().forEach(c=>{const days={};for(let n=0;n<182;n++){
    const key=shiftDay(batch,n),ai=Math.max(1,c.base-2-bi+Math.abs(dayDistance(key,currentBatch)%5));
    const manual=(n+c.serial+bi)%4===0?ai+2+bi:null;
    const event=(n+c.serial)%17===9?{qty:ai+18,name:'站内资源活动',type:'站内资源',note:'活动资源确认'}:null;
    const reason=event?'站内活动资源增加':manual!=null?(bi%2?'恢复常规流速':'主推资源增加'):'沿用规则基准';
    days[key]=Object.freeze({ai,manual,activity:event?Object.freeze(event):null,final:resolveForecast(ai,manual,event?.qty),reason});
  }rows[c.id]=Object.freeze(days);});historicalSnapshots[batch]=Object.freeze(rows);
});Object.freeze(historicalSnapshots);
const actualSnapshots=Object.freeze(Object.fromEntries(allChildren().map(c=>{
  const actual={};const recent=salesHistory(c);for(let n=0;n<=dayDistance('2026-09-28',batchDates.at(-1));n++){
    const key=shiftDay(batchDates.at(-1),n),ri=dayDistance(key,'2026-08-30');actual[key]=ri>=0?recent[ri]:Math.max(0,c.base-4+(n+c.serial)%7);
  }return [c.id,Object.freeze(actual)];
})));
Object.assign(state,{batch:currentBatch,view:'batch',expandedChildren:new Set(allChildren().map(c=>c.id)),historyOpen:new Set(),historyCount:{},historyParts:new Set(),targetDates:{},page:1,pageSize:20,filters:{market:'',platform:'Amazon',owner:'',account:'',tag:''},identityWidth:330,sizeWidth:52,contextWidth:158,lineWidth:108});
function findChild(id){return allChildren().find(c=>c.id===id);}
function forecastAt(c,batch,key){
  if(!c||!covered(batch,key))return null;
  const draft=batchDraft(c,batch),planned=window.ForecastBatchContract?.getDailyForecast?.(batch,c.id,key)||null;
  if(planned){
    const ai=planned.ruleForecast??planned.ai??0,manual=draft.manual[key]??null,activity=draft.activity[key]??null;
    return {ai,manual,activity,final:resolveForecast(ai,manual,activity?.qty),reason:activity?(activity.note||activity.name):manual!=null?(draft.manualReasons?.[key]||draft.reason||'未填写调整原因'):(planned.reason||'沿用本批次拆解规则')};
  }
  if(forecastBatch(batch)){
    const start=forecastRange(batch).start,ai=Math.max(0,c.base+(dayDistance(key,start)%5===0?0:dayDistance(key,start)%3===0?1:0));
    const manual=draft.manual[key]??null,activity=draft.activity[key]??null;
    return {ai,manual,activity,final:resolveForecast(ai,manual,activity?.qty),reason:activity?(activity.note||activity.name):manual!=null?(draft.manualReasons?.[key]||draft.reason||'未填写调整原因'):'沿用规则基准'};
  }
  if(batch!==currentBatch)return historicalSnapshots[batch]?.[c.id]?.[key]??null;
  const ai=Math.max(0,c.base+(dayDistance(key,currentBatch)%5===0?0:dayDistance(key,currentBatch)%3===0?1:0));
  const manual=draft.manual[key]??null,activity=draft.activity[key]??null;
  return {ai,manual,activity,final:resolveForecast(ai,manual,activity?.qty),reason:activity?(activity.note||activity.name):manual!=null?(draft.manualReasons?.[key]||draft.reason||'未填写调整原因'):'沿用规则基准'};
}
function actualAt(c,key){return key>'2026-09-28'?null:actualSnapshots[c.id]?.[key]??null;}
function systemValue(c,i){return allDays[i]?forecastAt(c,state.batch,dateKey(allDays[i]))?.ai??null:null;}
function manualValue(c,i){return allDays[i]?forecastAt(c,state.batch,dateKey(allDays[i]))?.manual??null:null;}
function activityAt(c,d){return forecastAt(c,state.batch,dateKey(d))?.activity??null;}
function finalValue(c,d){return forecastAt(c,state.batch,dateKey(d))?.final??null;}
function source(c,d){const f=forecastAt(c,state.batch,dateKey(d));if(!f)return ['none','未覆盖'];const kind=window.ForecastLedgerValues?.sourceOf?.(f)||(f.activity!=null?'activity':f.manual!=null?'manual':'system');return [kind,window.ForecastLedgerValues?.sourceLabels?.[kind]||({system:'规则',manual:'人工',activity:'活动'}[kind])];}
function canEdit(key){const active=activeForecastBatchDate();return state.batch===active&&covered(active,key);}
function clampWindowStart(start){return Math.max(0,Math.min(allDays.length-1,start));}
function syncWindow(start=state.windowStart,end=null){state.windowStart=clampWindowStart(start);state.windowEnd=end==null?Math.min(allDays.length-1,state.windowStart+state.windowSize-1):Math.max(state.windowStart,Math.min(allDays.length-1,end));if(end!=null)state.windowSize=state.windowEnd-state.windowStart+1;state.offset=state.windowStart;}
function olderBatches(){const batches=availableForecastBatches(),index=batches.indexOf(state.batch);return index<0?batches.filter(batch=>batch<state.batch):batches.slice(index+1);}
function aggregate(c,batch,days,part='final'){return sumValues(days.map(d=>{const f=forecastAt(c,batch,dateKey(d));return part==='activity'?f?.activity?.qty:f?.[part];}));}
function alignedDelta(c,batch,comparison,days){if(!comparison)return null;const pairs=days.map(d=>[forecastAt(c,batch,dateKey(d))?.final,forecastAt(c,comparison,dateKey(d))?.final]).filter(p=>p.every(v=>v!=null));return pairs.length?pairs.reduce((s,[a,b])=>s+a-b,0):null;}
function weekValue(c,col,line){const values=col.days.map(d=>{const f=forecastAt(c,state.batch,dateKey(d));return line==='system'?f?.ai:line==='activity'?f?.activity?.qty:f?.[line];});return {value:sumValues(values),count:values.filter(v=>v!=null).length};}
function matches(c,g){const q=state.query.trim().toUpperCase(),f=state.filters,batch=forecastBatch(state.batch),scope=!batch||batch.childForecastResults.some(row=>row.childId===c.id||row.childASIN===c.asin);return scope&&(!q||[g.parent,g.spu,g.skc,g.name,c.asin,c.sku,c.businessCode,c.combo].some(v=>v.toUpperCase().includes(q)))&&(!f.market||g.market===f.market)&&(!f.platform||g.platform===f.platform)&&(!f.owner||g.owner===f.owner)&&(!f.account||g.account===f.account)&&(!f.tag||g.tags.includes(f.tag));}
function filteredGroups(){return groups.map(g=>({...g,children:g.children.filter(c=>matches(c,g))})).filter(g=>g.children.length);}
function displayGroups(){const found=filteredGroups(),ids=new Set(found.flatMap(g=>g.children).slice((state.page-1)*state.pageSize,state.page*state.pageSize).map(c=>c.id));return found.map(g=>({...g,children:g.children.filter(c=>ids.has(c.id))})).filter(g=>g.children.length);}
function refreshDateScope(startKey=null){
  const range=forecastRange(state.batch),first=state.view==='target'?availableForecastBatches().at(-1):range.start,last=range.end;
  allDays=Array.from({length:dayDistance(last,first)+1},(_,i)=>parseDay(shiftDay(first,i)));
  firstMonth=monthIndex(allDays[0]);lastMonth=monthIndex(allDays.at(-1));
  const size=[14,30].includes(state.windowSize)?state.windowSize:14;state.windowSize=size;
  syncWindow(Math.max(0,indexForDate(startKey||range.start)));state.editing=null;state.collapsedWeeks.clear();
}

const fieldCatalog=[
  ['identity','商品 / 父子ASIN','必选字段',true],['site','国家 / 站点','必选字段',true],['sku','SKU及业务识别码','必选字段',true],['size','尺码','必选字段',true],['forecast','日期及四条预测线','必选字段',true],
  ['spu','SPU','父体信息'],['skc','SKC及颜色','父体信息'],['owner','销售负责人','父体信息'],
  ['image','商品主图','商品信息'],['title','商品名称','商品信息'],['store','账号 / 店铺','商品信息'],['combo','销售组合','商品信息'],['tags','分类标签','商品信息'],['listing','上架时间','商品信息'],['actions','趋势 / 分析 / 档案','商品信息'],['notes','商品备注','商品信息'],
  ['today','7日ADU','销售与库存'],['adu7','14日ADU','销售与库存'],['adu30','30日ADU','销售与库存'],['stock','可售库存','销售与库存'],['transit','在途合计','销售与库存'],['doi','DOI','销售与库存'],['arrival','预计到货','销售与库存'],['warning','库存预警','销售与库存']
].map(([key,label,group,required=false])=>({key,label,group,required}));
const defaultFields=fieldCatalog.filter(f=>f.key!=='combo').map(f=>f.key);
const configStorageKey='pmc-forecast-v019-columns';
function validFields(keys){const unique=[...new Set((Array.isArray(keys)?keys:defaultFields).filter(k=>fieldCatalog.some(f=>f.key===k)))];fieldCatalog.filter(f=>f.required).forEach(f=>{if(!unique.includes(f.key))unique.unshift(f.key);});return unique;}
let columnConfig={keys:[...defaultFields],templates:[]},configDraft=null,configSearch='',configCategory='全部',configReturnTarget=null;
try{const saved=JSON.parse(localStorage.getItem(configStorageKey)||'null');if(saved)columnConfig={keys:validFields(saved.keys),templates:(saved.templates||[]).filter(t=>typeof t.name==='string').map(t=>({name:t.name,keys:validFields(t.keys)}))};}catch{}
const hasField=key=>columnConfig.keys.includes(key);
const orderedFields=group=>columnConfig.keys.map(k=>fieldCatalog.find(f=>f.key===k)).filter(f=>f.group===group);
const hasContext=()=>orderedFields('销售与库存').length>0;
const fixedCount=()=>hasContext()?5:4;
function businessCode(c,g){const hint=`业务识别码：品牌货盘 ${g.brand}${g.channel==null?'；渠道未单独纳入':`；独立渠道货盘 ${g.channel}`}；SPU ${g.spu}${g.businessVersion?`；实物版本 ${g.businessVersion}`:'；业务版本未单独纳入'}；颜色 ${g.colorCode}（${c.color}）；尺码 ${c.size}`;return `<span class="code-value biz-code" data-code-tip="${esc(hint)}"><span class="code-text" tabindex="0" aria-label="业务识别码：${c.businessCode}">${c.businessCode}</span><button class="copy-code" type="button" data-copy="${c.businessCode}" aria-label="复制业务识别码 ${c.businessCode}">${copyIcon}</button></span>`;}
const inheritedNoteContent=noteContent;
noteContent=function(c){return inheritedNoteContent({...c,asin:c.id});};
function productCell(g,c,rowspan){
  const expanded=state.expandedChildren.has(c.id),history=state.historyOpen.has(c.id);
  const title=hasField('title')?`<div class="product-title">${g.name}</div>`:'';
  const top=`<div class="product-box ${hasField('image')?'':'no-image'}">${hasField('image')?`<button class="thumb" type="button" data-preview="${g.image}" aria-label="放大${g.name}主图"><img src="${g.image}" alt="${g.name}"/></button>`:''}<div class="product-info">${title}<div class="child-asin-line">${copyable(c.asin,'Child ASIN')}</div><div class="product-identifiers">${copyable(c.sku,'SKU')}${businessCode(c,g)}</div></div></div>`;
  const fields={store:`<div class="product-meta"><span data-hint="账号 / 店铺：${g.account}" tabindex="0">${g.account}</span></div>`,combo:`<div class="product-sub">${copyable(c.combo,'销售组合')}</div>`,tags:`<div class="product-tags">${productTags(g)}</div>`,listing:`<div class="product-meta">上架 ${formatKey(g.listedAt)} · ${g.listingDays} 天</div>`,actions:`<div class="product-actions">${Object.entries(insightViews).map(([k,l])=>`<button class="product-action ${k}" data-insight="${k}" data-asin="${c.id}" type="button">${actionIcon(k)}${l}</button>`).join('')}</div>`,notes:`<div class="product-note" data-note-container="${c.id}"><span>备注：</span>${noteContent(c)}</div>`};
  const historyTools='';
  return `<td class="identity-cell" rowspan="${rowspan}" data-record-id="${c.id}">${top}${orderedFields('商品信息').map(f=>fields[f.key]||'').join('')}<button class="history-toggle" type="button" data-history-toggle="${c.id}" aria-expanded="${history}">${history?'▾ 收起历史对比':'▸ 历史对比'}</button>${historyTools}</td>`;
}
function contextCell(c,rowspan){if(!hasContext())return '';const metrics={today:['7日ADU',c.base,'近7日平均每日销量，件/天'],adu7:['14日ADU',c.base-1,'近14日平均每日销量，件/天'],adu30:['30日ADU',c.base-3,'近30日平均每日销量，件/天'],stock:['可售库存',c.stock+c.fba,'示例口径：国内仓 + FBA库存，件'],transit:['在途合计',c.inbound+c.fbaInbound,'采购在途 + FBA在途，件'],doi:['DOI',c.doi+' 天','系统库存周转天数'],arrival:['预计到货',c.arrival,'系统预计到货日期']};return `<td class="context-cell" rowspan="${rowspan}"><div class="metric-grid">${orderedFields('销售与库存').filter(f=>metrics[f.key]).map(f=>{const [label,value,hint]=metrics[f.key];return `<div class="metric" data-field="${f.key}"><label data-hint="${hint}" tabindex="0">${label}</label><strong>${value}</strong></div>`;}).join('')}</div>${hasField('warning')?`<div class="coverage-note ${c.doi<20?'risk':''}">${c.doi<20?'⚠ 到货前存在缺货风险':'库存覆盖正常'}<br/>预计耗尽 ${c.exhausted}</div>`:''}</td>`;}
function forecastToggleGlyph(expanded){return `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M2 6h8${expanded?'':'M6 2v8'}"/></svg>`;}
function parentBand(g){const collapsed=state.collapsed.has(g.id);const fields={spu:copyable(g.spu,'SPU'),skc:`<span class="parent-skc">${copyable(g.skc,'SKC')}<span tabindex="0" data-hint="颜色名称：${g.colors[0]}；颜色主数据编码：${g.colorCode}">（${g.colors[0]}）</span></span>`,owner:`<span class="parent-sales" tabindex="0" data-hint="销售负责人：${g.owner}">销售：${g.owner}</span>`};return `<td class="parent-band" colspan="${fixedCount()-1}"><div class="parent-strip"><button class="collapse" data-collapse="${g.id}" type="button" aria-expanded="${!collapsed}" aria-label="${collapsed?'展开':'收起'} ${g.parent}">${forecastToggleGlyph(!collapsed)}</button>${copyable(g.parent,'Parent ASIN')}${orderedFields('父体信息').map(f=>fields[f.key]).join('')}</div></td>`;}
function flag(market){return market==='US'?`<svg viewBox="0 0 30 20" aria-hidden="true"><path fill="#fff" d="M0 0h30v20H0z"/><path stroke="#bc3347" stroke-width="1.55" d="M0 1h30M0 4h30M0 7h30M0 10h30M0 13h30M0 16h30M0 19h30"/><path fill="#354b81" d="M0 0h13v11H0z"/><path stroke="#fff" stroke-dasharray="1 2" d="M2 2h9M2 4h9M2 6h9M2 8h9"/></svg>`:`<svg viewBox="0 0 30 20" aria-hidden="true"><path fill="#214375" d="M0 0h30v20H0z"/><path stroke="#fff" stroke-width="5" d="m0 0 30 20M0 20 30 0"/><path stroke="#c6374d" stroke-width="2" d="m0 0 30 20M0 20 30 0"/><path stroke="#fff" stroke-width="7" d="M15 0v20M0 10h30"/><path stroke="#c6374d" stroke-width="4" d="M15 0v20M0 10h30"/></svg>`;}
function deltaMarkup(value,label='较上批'){return `<span class="delta ${value==null||value===0?'flat':value>0?'up':'down'}">${label} ${signed(value)}</span>`;}
function dateCells(c,line){return visibleColumns().map((col,i)=>{
  const d=col.days[0],key=dateKey(d),index=indexForDate(key),f=forecastAt(c,state.batch,key),focus=`data-focus-index="${i}" data-time-column="${col.key}"`,cls=col.boundary?'week-boundary':'',field=line==='summary'?'final':line;
  const value=weekValue(c,col,field).value,kinds=col.days.map(day=>source(c,day)[0]),kind=window.ForecastLedgerValues?.sourceOfMany?.(kinds)||(kinds.includes('activity')?'activity':kinds.includes('manual')?'manual':'system'),label=window.ForecastLedgerValues?.sourceLabels?.[kind]||({system:'规则',manual:'人工',activity:'活动'}[kind]);
  if(field==='system')return `<td class="date-col num line-system ${cls}" ${focus}>${numberOrBlank(value)}</td>`;
  if(field==='manual'||field==='activity'){
    const editable=canEdit(key)&&col.type==='day',entryValue=field==='manual'?f?.manual:f?.activity?.qty,editing=editable&&field==='manual'&&state.editing===`${c.id}:${index}`;
    const attrs=field==='manual'?`data-edit-manual="${c.id}" data-index="${index}"`:`data-event="${c.id}" data-date="${key}"`;
    return `<td class="date-col num ${cls} ${field==='manual'?'line-manual':'line-event'} ${editable?'entry-cell':''}" ${focus} data-entry="${field}">${editable?(editing?`<div class="entry-input"><input class="cell-number" type="number" min="0" step="1" value="${entryValue??''}" data-manual="${c.id}" data-index="${index}" aria-label="${c.asin} ${dateLabel(d)} 人工预测"/></div>`:`<button class="${entryValue==null?'entry-icon':'entry-value'}" type="button" ${attrs} aria-label="${field==='manual'?'人工预测':'活动预测'} ${c.asin} ${dateLabel(d)}"><span class="entry-number">${entryValue??''}</span>${penIcon}</button>`):numberOrBlank(value)}</td>`;
  }
  const attrs=col.type==='week'?`data-week-detail="${col.week.key}" data-asin="${c.id}"`:`data-final="${c.id}" data-index="${index}"`;
  return `<td class="date-col num line-final ${cls}" ${focus}>${value==null?'<span class="history-gap" data-hint="该批次未覆盖此目标日期">—</span>':`<button class="cell-link final-value" type="button" ${attrs}><span>${num(value)}</span><span class="source-tag ${kind}">(${label})</span></button>${line==='summary'?deltaMarkup(alignedDelta(c,state.batch,olderBatches()[0],col.days),''):''}`}</td>`;
}).join('');}
function controlCells(){return visibleColumns().map(col=>`<td class="date-col control-blank ${col.boundary?'week-boundary':''}" aria-hidden="true"></td>`).join('');}

function historyRows(c){
  const batches=olderBatches().slice(0,state.historyCount[c.id]||2),rows=[];
  batches.forEach((batch,i)=>{
    rows.push({kind:'final',batch,label:`${formatKey(batch)} 批次`,relative:i===0?'上批次':i===1?'上上批次':'历史批次'});
    if(state.historyParts.has(c.id+'|'+batch))['ai','manual','activity'].forEach(kind=>rows.push({kind,batch,label:{ai:'规则预测',manual:'人工预测',activity:'活动预测'}[kind]}));
  });rows.push({kind:'actual',label:'实际销量'},{kind:'error',label:'预测偏差'});return rows;
}
function historyRowHTML(c,row){
  if(row.kind==='controls'){const draft=batchDraft(c,state.batch);return `<tr><td class="line-cell history-label">调整原因</td><td class="history-actions-cell" colspan="${visibleColumns().length}"><div class="history-controls">${state.batch===activeForecastBatchDate()?`<input class="reason-input" data-reason="${c.id}" aria-label="${c.asin} 本次调整原因" maxlength="120" placeholder="填写本次调整原因" value="${esc(draft.reason)}"/>`:`<small>${formatKey(state.batch)} 已冻结</small>`}${olderBatches().length>(state.historyCount[c.id]||2)?`<button data-more-history="${c.id}">＋ 更多历史批次</button>`:''}${(state.historyCount[c.id]||2)>2?`<button data-less-history="${c.id}">收起更多</button>`:''}<button data-reasons="${c.id}" aria-expanded="${state.historyParts.has(c.id+'|reasons')}">调整记录</button></div></td></tr>`;}
  const expanded=state.historyParts.has(c.id+'|'+row.batch),isBatch=row.kind==='final';
  const labels=isBatch?`<button type="button" data-history-part="${c.id}|${row.batch}" aria-expanded="${expanded}">${expanded?'−':'+'} ${row.label}</button><small>${row.relative} · 最终预测</small>`:row.label;
  const cells=visibleColumns().map((col,i)=>{
    let value=null,hint='';
    if(row.kind==='actual'){const values=col.days.map(d=>actualAt(c,dateKey(d)));value=sumValues(values);hint=value==null?'目标日期尚未发生或实际销量未回传':`实际销量已回传 ${values.filter(v=>v!=null).length}/${col.days.length}天`;}else if(row.kind==='error'){
      const pairs=col.days.map(d=>[forecastAt(c,state.batch,dateKey(d))?.final,actualAt(c,dateKey(d))]).filter(p=>p.every(v=>v!=null));value=pairs.length?pairs.reduce((s,[p,a])=>s+p-a,0):null;hint=`所选批次最终预测 − 实际销量；已匹配 ${pairs.length}/${col.days.length}天`;
    }else {value=aggregate(c,row.batch,col.days,row.kind);hint=col.days.map(d=>{const f=forecastAt(c,row.batch,dateKey(d));return `${dateLabel(d)}：${f?.reason||'批次未覆盖'}`;}).join('；');}
    return `<td class="date-col num ${col.boundary?'week-boundary':''}" data-time-column="${col.key}" data-focus-index="${i}" data-history-batch="${row.batch||''}" data-history-kind="${row.kind}"><span data-hint="${esc(hint)}" tabindex="0">${value==null?(row.kind==='manual'||row.kind==='activity'?'':'—'):row.kind==='error'?signed(value):num(value)}</span>${isBatch?deltaMarkup(alignedDelta(c,state.batch,row.batch,col.days),'本次差值'):''}</td>`;
  }).join('');
  return `<tr class="${row.kind==='actual'?'actual-row':row.kind==='error'?'deviation-row':isBatch?'history-row':'history-component'}" data-history-for="${c.id}"><td class="line-cell history-label">${labels}</td>${cells}</tr>`;
}
function reasonList(c){const isCurrent=state.batch===activeForecastBatchDate(),draft=batchDraft(c,state.batch),batches=isCurrent?olderBatches().slice(0,state.historyCount[c.id]||2):[state.batch,...olderBatches().slice(0,state.historyCount[c.id]||2)];return `<div class="change-list"><strong>${isCurrent?'本批次调整记录':'历史批次调整依据'}</strong>${isCurrent?(draft.changes.length?draft.changes.slice(-5).reverse().map(log=>`<p>${esc(log.date)} · ${esc(log.line)} ${esc(log.before??'空')} → ${esc(log.after??'空')} · ${esc(log.reason||'未填写调整原因')}</p>`).join(''):'<p>本批次暂无调整</p>'):''}${batches.map(b=>{const key=state.targetDates[c.id]||dateKey(visibleDays()[0]),f=forecastAt(c,b,key);return `<p>${formatKey(b)} 批次 · ${formatKey(key)} 目标日 · ${esc(f?.reason||'批次未覆盖')}</p>`;}).join('')}</div>`;}
function inlineRow(body,cls=''){return `<tr class="inline-history-row ${cls}"><td class="select-cell"></td><td class="inline-full-cell" colspan="${fixedCount()-1+visibleColumns().length}"><div class="inline-history-panel">${body}</div></td></tr>`;}
function targetPanel(c){
  let key=state.targetDates[c.id];if(!visibleDays().some(d=>dateKey(d)===key))key=dateKey(visibleDays()[0]);state.targetDates[c.id]=key;
  const batches=[state.batch,...olderBatches().slice(0,state.historyCount[c.id]||2)],actual=actualAt(c,key),selected=forecastAt(c,state.batch,key);
  const draft=batchDraft(c,state.batch),active=activeForecastBatchDate();
  return inlineRow(`<div class="target-toolbar"><strong>${c.asin} · 目标日期对比</strong><label>目标日期 <select class="control" data-target-day="${c.id}" aria-label="${c.asin} 对比目标日期">${visibleDays().map(d=>`<option value="${dateKey(d)}" ${dateKey(d)===key?'selected':''}>${fullDate(d)}</option>`).join('')}</select></label><span>实际销量截至 2026/09/28</span>${olderBatches().length>(state.historyCount[c.id]||2)?`<button class="toolbar-link" data-more-history="${c.id}">＋ 更多历史批次</button>`:''}</div><table class="target-table" aria-label="${c.asin} 同目标日期批次对比"><thead><tr><th>预测批次</th><th>规则预测</th><th>人工预测</th><th>活动预测</th><th>最终预测</th><th>本次差值</th><th>调整原因</th></tr></thead><tbody>${batches.map((batch,i)=>{const f=forecastAt(c,batch,key),delta=f&&selected?selected.final-f.final:null;return `<tr class="${i===0?'current':''}" data-target-batch="${batch}"><td>${formatKey(batch)}${batch===active?' · 本批次':' · 已冻结'}</td><td>${numberOrBlank(f?.ai)}</td><td>${numberOrBlank(f?.manual)}</td><td>${numberOrBlank(f?.activity?.qty)}</td><td>${f?num(f.final):'未覆盖'}</td><td>${i===0?'':signed(delta)}</td><td>${esc(f?.reason||'—')}</td></tr>`;}).join('')}</tbody></table><div class="target-actual"><span>实际销量 <b>${actual??'—'}</b></span><span>预测偏差 <b>${selected&&actual!=null?signed(selected.final-actual):'—'}</b></span><span>${actual==null?'尚无实际销量':`实际日期 ${formatKey(key)}`}</span>${state.batch===active&&covered(active,key)?`<input class="reason-input" data-reason="${c.id}" aria-label="${c.asin} 本次调整原因" placeholder="填写本次调整原因" maxlength="120" value="${esc(draft.reason)}"/>`:''}</div>${reasonList(c)}`,'target-panel-row');
}
function parentForecastMarkup(g,col){
  const value=sumValues(g.children.map(c=>aggregate(c,state.batch,col.days)));
  const statuses=g.children.flatMap(c=>col.days.map(d=>forecastAt(c,state.batch,dateKey(d))?.forecastStatus)).filter(Boolean);
  return numberOrBlank(value)+(statuses.length?'<span class="forecast-state">'+(value==null?esc([...new Set(statuses)].join('；')):'含待实际销量，不纳入合计')+'</span>':'');
}
function renderTable(){
  const cols=visibleColumns(),rows=displayGroups(),visible=rows.flatMap(g=>g.children),context=hasContext(),allProductsExpanded=rows.length>0&&rows.every(g=>!state.collapsed.has(g.id));
  const productToggleAction=allProductsExpanded?'collapse':'expand',productToggleLabel=allProductsExpanded?'收起全部父子ASIN':'展开全部父子ASIN';
  let html=`<table class="forecast-table"><colgroup><col style="width:40px"/><col data-column="identity"/><col data-column="size"/>${context?'<col data-column="context"/>':''}<col data-column="line"/>${cols.map(col=>`<col data-column="${col.key}"/>`).join('')}</colgroup><thead><tr><th class="select-head" rowspan="2"><input id="selectAll" type="checkbox" ${visible.length&&visible.every(c=>state.selected.has(c.id))?'checked':''} aria-label="选择当前页全部站点子ASIN"/></th><th class="identity-head" rowspan="2"><div class="head-goods">商品详情<button class="collapse forecast-tree-toggle" data-tree="${productToggleAction}" aria-label="一键${productToggleLabel}" aria-expanded="${allProductsExpanded}" data-hint="${productToggleLabel}">${forecastToggleGlyph(allProductsExpanded)}</button></div>${resizeHandle('identity','商品 / ASIN')}</th><th class="size-head" rowspan="2">尺码${resizeHandle('size','尺码')}</th>${context?`<th class="context-head" rowspan="2">销量 / 库存${resizeHandle('context','销量 / 库存')}</th>`:''}<th class="line-head" rowspan="2">${state.expandedChildren.size?'预测线':'当前预测'}${resizeHandle('line','预测线')}</th>${weekHeaders()}</tr><tr>${cols.map(dateHeader).join('')}</tr></thead><tbody>`;
  let site='';rows.forEach(g=>{
    if(site!==g.market){site=g.market;const count=rows.filter(r=>r.market===site).reduce((s,r)=>s+r.children.length,0);html+=`<tr class="site-row"><td class="site-band" colspan="${fixedCount()}"><div class="site-caption"><span class="country-flag" tabindex="0" data-hint="国家 / 站点：${site==='US'?'美国 / US':'英国 / UK'} · Amazon">${flag(site)}</span><span>${site==='US'?'美国 / US':'英国 / UK'} · Amazon</span><small>${count} 个子体</small></div></td><td colspan="${cols.length}"></td></tr>`;}
    const totalCells=cols.map((col,i)=>`<td class="date-col num ${col.boundary?'week-boundary':''}" data-focus-index="${i}" data-time-column="${col.key}">${parentForecastMarkup(g,col)}</td>`).join('');
    const any=g.children.some(c=>state.selected.has(c.id)),all=g.children.every(c=>state.selected.has(c.id));
    html+=`<tr class="parent-row" data-parent-id="${g.id}"><td class="select-cell"><input type="checkbox" data-parent-check="${g.id}" ${all?'checked':''} data-partial="${any&&!all}" aria-label="选择 ${g.market} ${g.parent} 下的子ASIN"/></td>${parentBand(g)}${totalCells}</tr>`;
    if(!state.collapsed.has(g.id))g.children.forEach(c=>{
      const expanded=state.expandedChildren.has(c.id),hist=state.historyOpen.has(c.id),hr=hist&&state.view==='batch'?historyRows(c):[],forecastLines=window.ForecastLedgerValues?.lines.sales||['system','manual','activity','final'],lines=[...forecastLines,'controls'],anchorLine=expanded?forecastLines[0]:'final',span=(expanded?forecastLines.length:1)+1+hr.length;
      const total=aggregate(c,state.batch,visibleDays()),baseline=aggregate(c,state.batch,visibleDays(),'ai'),change=alignedDelta(c,state.batch,olderBatches()[0],visibleDays());
      const summary=`<div class="summary-forecast"><span>最终预测</span><small>窗口合计</small><strong>${numberOrBlank(total)}<small> 件</small></strong></div>`;
      lines.forEach(line=>{const anchor=line===anchorLine,visible=expanded||line==='final'||line==='controls';html+=`<tr class="${anchor?'child-start':''} ${!expanded&&line==='final'?'forecast-collapsed':''}" data-child-row="${c.id}" data-forecast-line="${line}" ${visible?'':'hidden'}>${anchor?`<td class="select-cell" rowspan="${span}"><input type="checkbox" data-row-check="${c.id}" ${state.selected.has(c.id)?'checked':''} aria-label="选择 ${g.market} ${c.asin}"/></td>${productCell(g,c,span)}<td class="size-cell" rowspan="${span}"><span class="size-value" tabindex="0" data-hint="尺码：${c.size}">${c.size}</span></td>${contextCell(c,span)}`:''}<td class="line-cell ${line==='final'?'line-final':(line==='system'||line==='pmc')?'line-system':line==='manual'?'line-manual':line==='activity'?'line-event':'line-controls'}">${line==='controls'?`<div class="forecast-section-bar"><span class="forecast-toggle-host" data-forecast-toggle="${c.id}"></span></div>`:line==='summary'?summary:(window.ForecastLedgerValues?.labels||{system:'规则预测',pmc:'PMC基准',manual:'人工预测',activity:'活动预测',final:'最终预测'})[line]}</td>${line==='controls'?controlCells():dateCells(c,line)}</tr>`;});
      html+=hr.map(r=>historyRowHTML(c,r)).join('');
      if(hist&&state.view==='target')html+=targetPanel(c);
      if(hist&&state.view==='batch'&&state.historyParts.has(c.id+'|reasons'))html+=inlineRow(reasonList(c));
    });
    if(!state.collapsed.has(g.id))html+=`<tr class="summary-row"><td class="select-cell"></td><td class="parent-band" colspan="${fixedCount()-1}"><span>Parent 合计</span><span class="parent-meta"> · ${g.children.length} 个子体 · 当前窗口</span></td>${totalCells}</tr>`;
  });
  if(!rows.length)html+=`<tr><td class="empty-cell" colspan="${fixedCount()+cols.length}" style="height:180px">没有匹配的商品，请调整筛选条件。</td></tr>`;
  const wb=$('#workbench'),top=wb.scrollTop,left=wb.scrollLeft;hideCodeTooltip();hideImagePreview();wb.innerHTML=html+'</tbody></table>';applyColumnWidths();wb.scrollTop=top;wb.scrollLeft=left;syncHorizontalScrollbar();
  $$('[data-partial="true"]').forEach(el=>el.indeterminate=true);if($('#selectAll'))$('#selectAll').indeterminate=visible.some(c=>state.selected.has(c.id))&&!visible.every(c=>state.selected.has(c.id));renderPagination();
}
function applyColumnWidths(){const table=$('.forecast-table');if(!table)return;['identity','size','context','line'].forEach(key=>table.style.setProperty('--'+key+'-width',(key==='context'&&!hasContext()?0:state[key+'Width'])+'px'));const width=40+state.identityWidth+state.sizeWidth+(hasContext()?state.contextWidth:0)+state.lineWidth+visibleColumns().reduce((s,c)=>s+columnWidth(c.key),0);table.style.width=width+'px';table.style.minWidth=width+'px';table.style.setProperty('--inline-width',Math.max(450,$('#workbench').clientWidth-40)+'px');$$('col[data-column]',table).forEach(col=>col.style.width=columnWidth(col.dataset.column)+'px');$$('[data-resize-column]',table).forEach(el=>el.setAttribute('aria-valuenow',columnWidth(el.dataset.resizeColumn)));}
function renderPagination(){const count=filteredGroups().reduce((s,g)=>s+g.children.length,0),pages=Math.max(1,Math.ceil(count/state.pageSize));$('.pagination').innerHTML=`<span class="page-total">共 ${count} 条</span><button type="button" data-page="${state.page-1}" ${state.page===1?'disabled':''} aria-label="上一页">‹</button>${Array.from({length:pages},(_,i)=>`<button type="button" data-page="${i+1}" class="${state.page===i+1?'active':''}" aria-label="第${i+1}页">${i+1}</button>`).join('')}<button type="button" data-page="${state.page+1}" ${state.page===pages?'disabled':''} aria-label="下一页">›</button><select class="control" id="pageSize" aria-label="每页条数" style="width:82px;height:28px">${[5,20,50].map(n=>`<option value="${n}" ${state.pageSize===n?'selected':''}>${n} / 页</option>`).join('')}</select>`;}
const inheritedRender=render;
render=function(){inheritedRender();const select=$('#batchSelect'),active=activeForecastBatchDate(),batches=availableForecastBatches();if(select){select.innerHTML=batches.map(batch=>`<option value="${batch}">${formatKey(batch)} ${batch===active?'· 本批次':'历史批次'}</option>`).join('');select.value=state.batch;}$$('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===state.view);el.setAttribute('aria-pressed',el.dataset.view===state.view);});$('.range-title > span').textContent=state.view==='target'?'对比可查范围':'预测覆盖范围';$('#batchStatus').textContent=state.batch===active?'本批次 · 填报中':'历史批次 · 只读';};

function commitManual(input){const c=findChild(input.dataset.manual),key=allDays[Number(input.dataset.index)]&&dateKey(allDays[Number(input.dataset.index)]);if(!c||!canEdit(key)||window.canEditForecastDate?.(c.id,key)===false){state.editing=null;renderTable();return false;}const draft=batchDraft(c,state.batch),raw=input.value.trim(),value=raw===''?null:Number(raw);if(value!=null&&(!Number.isInteger(value)||value<0)){input.value=draft.manual[key]??'';toast('请输入大于等于0的整数');return false;}const before=draft.manual[key]??null;if(value==null)delete draft.manual[key];else draft.manual[key]=value;if(before!==value)draft.changes.push({date:key,line:'人工预测',before,after:value,reason:draft.reason});state.editing=null;persistCurrent();renderTable();return true;}
const inheritedOpenEvent=openEventModal;
openEventModal=function(id,key){if(!canEdit(key))return;const c=findChild(id),draft=batchDraft(c,state.batch),baseline={manual:c.manual,manualReasons:c.manualReasons,activity:c.activity,reason:c.reason,changes:c.changes};Object.assign(c,draft);inheritedOpenEvent(id,key);Object.assign(c,baseline);$('#modalTitle').textContent=draft.activity[key]?'编辑活动预测':'添加活动预测';$('#modalBody input[disabled]').value=c.asin;$('#modalBody').insertAdjacentHTML('beforeend','<div class="event-error" role="alert"></div>');if(draft.activity[key])$('#modalBody').insertAdjacentHTML('beforeend',`<button class="toolbar-link" type="button" data-delete-event="${id}" data-date="${key}">删除此活动预测</button>`);$('#eventQty').focus();};
applyModal=function(){if(state.modalMode!=='event')return;const {asin:id,date:key}=state.modalData,c=findChild(id);if(!c||!canEdit(key))return;const draft=batchDraft(c,state.batch),raw=$('#eventQty').value.trim(),qty=Number(raw),name=$('#eventName').value.trim();if(raw===''||!Number.isInteger(qty)||qty<0||!name){$('.event-error').textContent='请填写活动名称及大于等于0的整数销量';return;}const before=draft.activity[key]?.qty??null;draft.activity[key]={qty,name,type:$('#eventType').value,note:$('#eventNote').value.trim()};draft.changes.push({date:key,line:'活动预测',before,after:qty,reason:draft.activity[key].note||draft.reason||name});persistCurrent();closeOverlays();renderTable();};
function revealDrawer(title,sub,body){hideCodeTooltip();hideImagePreview();clearCross();$('#drawerTitle').textContent=title;$('#drawerSub').textContent=sub;$('#drawerBody').innerHTML=body;$('#drawerBody').scrollTop=0;$('#mask').classList.add('show');$('#drawer').classList.add('show');$('#drawer').setAttribute('aria-hidden','false');$('.drawer-head .close').focus();}
openDrawer=function(id,index){const c=findChild(id),d=allDays[index],f=forecastAt(c,state.batch,dateKey(d));if(!f)return;revealDrawer(`${fullDate(d)} 预测详情`,`${c.asin} · ${formatKey(state.batch)} 批次`,`<section class="drawer-section"><h3>取值关系</h3><div class="formula">${[['规则预测',f.ai],['人工预测',f.manual??'未填写'],['活动预测',f.activity?f.activity.qty+' · '+f.activity.name:'未填写'],['最终预测 · '+source(c,d)[1],f.final]].map(([k,v],i)=>`<div class="formula-row ${i===3?'total':''}"><span>${k}</span><strong>${esc(v)}</strong></div>`).join('')}</div></section><section class="drawer-section"><h3>SKU映射</h3><table class="mapping-table"><tr><th>SKU / 业务识别码</th><th>有效期</th></tr><tr><td>${copyable(c.sku,'SKU')}<br/>${businessCode(c,groups.find(g=>g.children.includes(c)))}</td><td>2026/09/01 - 2026/10/15</td></tr><tr><td>${copyable(c.historicSku,'SKU')}</td><td>2026/07/01 - 2026/08/31</td></tr></table></section>${insightDetails([['可售库存',num(c.stock+c.fba)],['DOI',c.doi+'天'],['预计耗尽',c.exhausted],['预计到货',c.arrival]])}`);};
const inheritedInsight=openInsight;
openInsight=function(id,view,trigger){const c=findChild(id),g=groups.find(g=>g.children.includes(c));if(!c)return;
  if(view==='mapping'){insightReturnTarget=trigger;return revealDrawer('SKU映射',`${c.asin} · ${g.market}`,`<table class="mapping-table"><tr><th>SKU / 业务识别码</th><th>有效期</th></tr><tr><td>${copyable(c.sku,'SKU')}<br/>${businessCode(c,g)}</td><td>2026/09/01 - 2026/10/15</td></tr><tr><td>${copyable(c.historicSku,'SKU')}</td><td>2026/07/01 - 2026/08/31</td></tr></table>`);}
  inheritedInsight(id,view,trigger);$$('#drawer [data-asin]').forEach(el=>el.dataset.asin=c.id);
  if(view==='product')$('.profile-codes').insertAdjacentHTML('beforeend',businessCode(c,g)+copyable(c.combo,'销售组合'));if(view==='product')$('#drawerBody').insertAdjacentHTML('beforeend',`<section class="drawer-section"><h3>销售组合组成</h3>${copyable(c.combo,'销售组合')}：${copyable(c.sku,'SKU')} × 2</section>`);
};
const inheritedWeekDetail=openWeekDetail;
openWeekDetail=function(id,key,trigger){inheritedWeekDetail(id,key,trigger);const c=findChild(id);if(c){$('#drawerSub').textContent=$('#drawerSub').textContent.replace(id,c.asin+' · '+id.split('-')[0]);$$('#drawerBody td').forEach(td=>{if(td.textContent==='null')td.textContent='—';});}};

$('.filter-panel').insertAdjacentHTML('afterend',`<section class="batch-toolbar" aria-label="批次及对比设置"><label class="batch-control">预测批次 <select class="control" id="batchSelect">${batchDates.map((b,i)=>`<option value="${b}">${formatKey(b)} ${i?'历史批次':'· 本批次'}</option>`).join('')}</select></label><span class="pill blue" id="batchStatus">本批次 · 填报中</span><div class="view-switch" role="group" aria-label="预测查看视角"><button type="button" class="active" data-view="batch">预测批次视角</button><button type="button" data-view="target">目标日期对比</button></div><div class="toolbar-right"><button class="toolbar-link" type="button" data-review-past>复盘已发生日期</button><button class="button columns-button" type="button" id="columnConfigButton" data-columns-open><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="3" width="16" height="14" rx="1"/><path d="M7 3v14M13 3v14"/></svg>列配置</button></div></section>`);
$('#market').innerHTML='<option value="">国家 / 站点：全部</option><option value="US">国家 / 站点：美国 / US</option><option value="UK">国家 / 站点：英国 / UK</option>';
$('#platform').innerHTML='<option value="Amazon">平台：Amazon</option><option value="Temu">平台：Temu</option><option value="SHEIN">平台：SHEIN</option>';
[['owner','销售负责人',['李敏','周宁','陈洁']],['account','账号 / 店铺',['BRABIC-US','BRABIC-UK']],['tagFilter','商品标签',['IPD款','新品','成长期','成熟期','头部','中坚','维持','限期拯救','退市','爆款','畅款','平款','低销']]].forEach(([id,label,options])=>{$('#'+id).innerHTML=`<option value="">${label}：全部</option>`+options.map(v=>`<option value="${v}">${label}：${v}</option>`).join('');});
$('#query').placeholder='ASIN / SKU / SPU / SKC / 业务识别码';$('#query').setAttribute('aria-label','编码或商品名称');
document.body.insertAdjacentHTML('beforeend',`<aside class="config-drawer" id="configDrawer" role="dialog" aria-modal="true" aria-labelledby="configTitle" aria-hidden="true"><header class="config-head"><h2 id="configTitle">列配置</h2><button class="close" type="button" data-config-close aria-label="关闭列配置">×</button></header><div class="config-template"><label for="configTemplate">选择模板</label><select class="control" id="configTemplate"></select><input class="control" id="templateName" aria-label="新模板名称" placeholder="新模板名称" maxlength="20"/><button class="toolbar-link" type="button" data-template-save>保存为新模板</button></div><div class="config-columns"><section class="config-available"><input class="control" id="configSearch" placeholder="搜索字段" aria-label="搜索字段"/><div id="configFields"></div></section><section class="config-selected"><h3 id="selectedCount"></h3><div id="configSelected"></div></section></div><div class="config-feedback" id="configFeedback" role="status"></div><footer class="config-foot"><button class="button config-reset" data-config-reset>恢复默认</button><button class="button" data-config-close>取消</button><button class="button primary" data-config-apply>保存并应用</button></footer></aside>`);
const positionFixedFields=new Set(['image','title','warning']);
function renderConfig(){
  const selected=configDraft.keys,q=configSearch.toLowerCase();
  $('#configFields').innerHTML=[...new Set(fieldCatalog.map(f=>f.group))].map(group=>{const fs=fieldCatalog.filter(f=>f.group===group&&f.label.toLowerCase().includes(q));if(!fs.length)return '';return `<div class="config-group"><div class="config-group-title">${group}${group==='必选字段'?'<span>不可取消</span>':`<button class="toolbar-link" data-config-all="${group}">全选</button>`}</div><div class="config-options">${fs.map(f=>`<label class="${f.required?'required':''}" ${f.required?'data-hint="用于识别填报对象与预测口径，不可隐藏"':''}><input type="checkbox" data-config-field="${f.key}" ${selected.includes(f.key)?'checked':''} ${f.required?'disabled':''}/>${f.label}${f.required?' · 必选':''}</label>`).join('')}</div></div>`;}).join('')||'<p>没有匹配字段</p>';
  $('#selectedCount').textContent=`已选（${selected.length}）· 同组内排序`;
  $('#configSelected').innerHTML=[...new Set(fieldCatalog.map(f=>f.group))].map(group=>{
    const fs=selected.map(k=>fieldCatalog.find(f=>f.key===k)).filter(f=>f.group===group);return `<div class="config-group-title">${group}</div>`+fs.map((f,i)=>`<div class="config-item" draggable="${!f.required&&!positionFixedFields.has(f.key)}" data-config-item="${f.key}"><span class="drag-handle">${f.required||positionFixedFields.has(f.key)?'▣':'⠿'}</span><span class="name">${f.label}</span>${f.required?'<small>必选</small>':`${positionFixedFields.has(f.key)?'<small data-hint="该字段位置固定，可设置显示或隐藏" tabindex="0">固定</small>':`<button data-config-move="${f.key}" data-step="-1" ${i===0||positionFixedFields.has(fs[i-1]?.key)?'disabled':''} aria-label="上移${f.label}">↑</button><button data-config-move="${f.key}" data-step="1" ${i===fs.length-1||positionFixedFields.has(fs[i+1]?.key)?'disabled':''} aria-label="下移${f.label}">↓</button>`}<button data-config-remove="${f.key}" aria-label="移除${f.label}">×</button>`}</div>`).join('');
  }).join('');
}
function renderTemplates(){const previous=$('#configTemplate').value;$('#configTemplate').innerHTML='<option value="default">默认模板</option><option value="compact">精简填报</option>'+configDraft.templates.map((t,i)=>`<option value="${i}">${esc(t.name)}</option>`).join('');$('#configTemplate').value=previous||'default';}
function openConfig(){closeCalendar();configReturnTarget=$('#columnConfigButton');configDraft=JSON.parse(JSON.stringify(columnConfig));configSearch='';$('#configSearch').value='';$('#configFeedback').textContent='';$('#templateName').value='';renderTemplates();renderConfig();$('#mask').classList.add('show');$('#configDrawer').classList.add('show');$('#configDrawer').setAttribute('aria-hidden','false');$('#configSearch').focus();}
function closeConfig(force=false){if(!configDraft)return;if(!force&&JSON.stringify(configDraft)!==JSON.stringify(columnConfig)){$('#configFeedback').innerHTML='列配置尚未应用。<button class="toolbar-link" data-config-discard>放弃修改并关闭</button> <button class="toolbar-link" data-config-continue>继续编辑</button>';return;}configDraft=null;$('#configDrawer').classList.remove('show');$('#configDrawer').setAttribute('aria-hidden','true');$('#mask').classList.remove('show');configReturnTarget?.focus();}
function reorderConfig(key,target){const f=fieldCatalog.find(f=>f.key===key),to=fieldCatalog.find(f=>f.key===target);if(!f||!to||f.required||to.required||positionFixedFields.has(key)||positionFixedFields.has(target)||f.group!==to.group)return;const fromIndex=configDraft.keys.indexOf(key),toIndex=configDraft.keys.indexOf(target);if(fromIndex<0||toIndex<0)return;configDraft.keys.splice(fromIndex,1);configDraft.keys.splice(toIndex,0,key);renderConfig();}
const inheritedClose=closeOverlays;
closeOverlays=function(){if(configDraft)return closeConfig();inheritedClose();};
let draggedField=null;
$('#configDrawer').addEventListener('dragstart',e=>{const item=e.target.closest('[data-config-item]');if(item?.draggable){draggedField=item.dataset.configItem;e.dataTransfer.setData('text/plain',draggedField);}});
$('#configDrawer').addEventListener('dragover',e=>{if(e.target.closest('[data-config-item]'))e.preventDefault();});
$('#configDrawer').addEventListener('drop',e=>{const target=e.target.closest('[data-config-item]');if(target&&draggedField){e.preventDefault();reorderConfig(draggedField,target.dataset.configItem);draggedField=null;}});
$('#configDrawer').addEventListener('keydown',e=>{if(e.key==='Tab'){const focusable=$$('button:not([disabled]),input:not([disabled]),select',$('#configDrawer')).filter(el=>el.offsetParent!==null),first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&e.target===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&e.target===last){e.preventDefault();first.focus();}}});
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-child-toggle],[data-history-toggle],[data-tree],[data-more-history],[data-less-history],[data-history-part],[data-reasons],[data-view],[data-review-past],[data-page],[data-columns-open],[data-config-close],[data-config-discard],[data-config-continue],[data-config-reset],[data-config-apply],[data-config-all],[data-config-move],[data-config-remove],[data-template-save],[data-delete-event]');
  if(t){
    if(t.hasAttribute('data-columns-open'))return openConfig();
    if(t.hasAttribute('data-config-close'))return closeConfig();
    if(t.hasAttribute('data-config-discard'))return closeConfig(true);
    if(t.hasAttribute('data-config-continue')){$('#configFeedback').textContent='';return;}
    if(t.hasAttribute('data-config-reset')){configDraft.keys=[...defaultFields];renderConfig();return;}
    if(t.hasAttribute('data-config-apply')){try{localStorage.setItem(configStorageKey,JSON.stringify(configDraft));}catch{$('#configFeedback').textContent='保存失败，请检查浏览器存储权限后重试';return;}columnConfig=JSON.parse(JSON.stringify(configDraft));closeConfig(true);renderTable();return;}
    if(t.dataset.configAll){fieldCatalog.filter(f=>f.group===t.dataset.configAll&&!configDraft.keys.includes(f.key)).forEach(f=>configDraft.keys.push(f.key));renderConfig();return;}
    if(t.dataset.configRemove){configDraft.keys=configDraft.keys.filter(k=>k!==t.dataset.configRemove);renderConfig();return;}
    if(t.dataset.configMove){const f=fieldCatalog.find(f=>f.key===t.dataset.configMove),siblings=configDraft.keys.filter(k=>fieldCatalog.find(f=>f.key===k).group===f.group),target=siblings[siblings.indexOf(f.key)+Number(t.dataset.step)];reorderConfig(f.key,target);return;}
    if(t.hasAttribute('data-template-save')){const name=$('#templateName').value.trim();if(!name){$('#configFeedback').textContent='请输入模板名称';return;}if(configDraft.templates.some(t=>t.name===name)){$('#configFeedback').textContent='模板名称已存在';return;}configDraft.templates.push({name,keys:[...configDraft.keys]});renderTemplates();$('#configTemplate').value=String(configDraft.templates.length-1);$('#configFeedback').textContent='模板将在保存并应用后保留';return;}
    if(t.dataset.deleteEvent){const c=findChild(t.dataset.deleteEvent),key=t.dataset.date,draft=batchDraft(c,state.batch);if(canEdit(key)){draft.changes.push({date:key,line:'活动预测',before:draft.activity[key].qty,after:null,reason:draft.reason||'取消活动'});delete draft.activity[key];persistCurrent();closeOverlays();renderTable();}return;}
    if(t.dataset.childToggle){const id=t.dataset.childToggle;state.expandedChildren.has(id)?state.expandedChildren.delete(id):state.expandedChildren.add(id);}
    if(t.dataset.historyToggle){const id=t.dataset.historyToggle;if(state.historyOpen.has(id))state.historyOpen.delete(id);else{state.historyOpen.add(id);state.expandedChildren.add(id);}}
    if(t.dataset.tree){const expand=t.dataset.tree==='expand';filteredGroups().forEach(g=>{expand?state.collapsed.delete(g.id):state.collapsed.add(g.id);g.children.forEach(c=>{expand?state.expandedChildren.add(c.id):state.expandedChildren.delete(c.id);if(!expand)state.historyOpen.delete(c.id);});});}
    if(t.dataset.moreHistory)state.historyCount[t.dataset.moreHistory]=(state.historyCount[t.dataset.moreHistory]||2)+2;
    if(t.dataset.lessHistory)state.historyCount[t.dataset.lessHistory]=2;
    if(t.dataset.historyPart){const key=t.dataset.historyPart;state.historyParts.has(key)?state.historyParts.delete(key):state.historyParts.add(key);}
    if(t.dataset.reasons){const key=t.dataset.reasons+'|reasons';state.historyParts.has(key)?state.historyParts.delete(key):state.historyParts.add(key);}
    if(t.dataset.page){state.page=Number(t.dataset.page);$('#workbench').scrollTop=0;}
    if(t.dataset.view&&['batch','target'].includes(t.dataset.view)){state.view=t.dataset.view;refreshDateScope();if(state.view==='target'&&!state.historyOpen.size){const c=displayGroups()[0]?.children[0];if(c){state.historyOpen.add(c.id);state.expandedChildren.add(c.id);}}render();if(state.view==='target')focusTargetPanel();return;}
    if(t.hasAttribute('data-review-past')){state.batch='2026-09-22';state.view='target';refreshDateScope('2026-09-22');syncWindow(indexForDate('2026-09-22'),indexForDate('2026-09-28'));const c=displayGroups()[0]?.children[0];if(c){state.collapsed.delete(groups.find(g=>g.children.includes(c)).id);state.historyOpen.add(c.id);state.expandedChildren.add(c.id);state.targetDates[c.id]='2026-09-28';}render();focusTargetPanel();return;}
    renderTable();return;
  }
  if(e.target===$('#mask')&&configDraft)closeConfig();
});
document.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='filter'||action==='reset'){
  e.stopImmediatePropagation();if(action==='reset'){['query','market','owner','account','tagFilter'].forEach(id=>$('#'+id).value='');$('#platform').value='Amazon';}
  state.query=$('#query').value;state.filters={market:$('#market').value,platform:$('#platform').value,owner:$('#owner').value,account:$('#account').value,tag:$('#tagFilter').value};state.page=1;renderTable();$('#workbench').scrollTop=0;
}},true);
document.addEventListener('change',e=>{const t=e.target;
  if(t.id==='batchSelect'){state.batch=t.value;refreshDateScope();render();}
  if(t.id==='pageSize'){state.pageSize=Number(t.value);state.page=1;renderTable();$('#workbench').scrollTop=0;}
  if(t.dataset.targetDay){state.targetDates[t.dataset.targetDay]=t.value;renderTable();}
  if(t.dataset.configField){const f=fieldCatalog.find(f=>f.key===t.dataset.configField);if(f.required)return;if(t.checked)configDraft.keys.push(f.key);else configDraft.keys=configDraft.keys.filter(k=>k!==f.key);renderConfig();}
  if(t.id==='configTemplate'){configDraft.keys=t.value==='default'?[...defaultFields]:t.value==='compact'?validFields(['spu','skc','owner','image','title','stock','doi']):[...configDraft.templates[Number(t.value)].keys];renderConfig();}
  if(t.dataset.reason){const c=findChild(t.dataset.reason),draft=batchDraft(c,state.batch);if(state.batch===activeForecastBatchDate()){draft.reason=t.value.trim();draft.changes.filter(log=>!log.reason).forEach(log=>log.reason=draft.reason);persistCurrent();}}
});
document.addEventListener('input',e=>{if(e.target.id==='configSearch'){configSearch=e.target.value;renderConfig();}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='query')$('[data-action="filter"]').click();});
function focusTargetPanel(){const panel=$('.target-panel-row'),wb=$('#workbench');if(panel)wb.scrollTop+=panel.getBoundingClientRect().top-wb.getBoundingClientRect().top-78;}
const inheritedCalendar=renderCalendar;
renderCalendar=function(){inheritedCalendar();$('[data-calendar-preset="all"]')?.remove();};
document.addEventListener('click',e=>{if(e.target.closest('[data-calendar-apply]')&&calendar.end!=null&&calendar.end-calendar.start+1>31){e.stopImmediatePropagation();$('.calendar-selection').textContent='单个查看窗口最多31天，请缩短日期区间';$('.calendar-selection').classList.add('incomplete');}},true);
window.addEventListener('resize',applyColumnWidths);
refreshDateScope();render();
window.addEventListener('forecast-batch-change',()=>{
  const active=activeForecastBatchDate(),range=forecastRange(active);
  state.batch=active;state.view='batch';state.page=1;
  refreshDateScope(range.start);render();
});
