const fs=require('fs'),path=require('path');
const {chromium}=require('/Users/yan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const OUT=__dirname,W=2560,H=1440;
const C={blue:'#008DD5',ink:'#18384E',text:'#3C566B',muted:'#6B7F90',line:'#D5E1E9',teal:'#078E99',green:'#54963C',orange:'#DC8226',purple:'#7B60A8'};
let p=[],nodes=[];const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function rect(x,y,w,h,fill='white',stroke='none',r=0,dash=false){p.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2" ${dash?'stroke-dasharray="8 6"':''}/>`);}
function text(x,y,t,size=29,color=C.text,weight=400,anchor='start'){p.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}">${esc(t)}</text>`);}
function lines(x,y,a,size=29,color=C.text,gap=49,anchor='start',weight=400){a.forEach((t,i)=>text(x,y+i*gap,t,size,color,weight,anchor));}
function line(a,color='blue',dash=false,arrow=true,width=3){p.push(`<path d="${a.map((v,i)=>(i?'L':'M')+v.join(' ')).join(' ')}" fill="none" stroke="${C[color]}" stroke-width="${width}" ${dash?'stroke-dasharray="8 6"':''} ${arrow?`marker-end="url(#arrow-${color})"`:''}/>`);}
function label(x,y,t,color=C.muted,size=24){const w=[...t].reduce((a,c)=>a+(/[\x00-\x7F]/.test(c)?0.56:1),0)*size+24;rect(x-w/2,y-size+1,w,size+11);text(x,y,t,size,color,500,'middle');}
function begin(title,sub,page){p=[`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><defs>${Object.entries(C).map(([k,c])=>`<marker id="arrow-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="${c}"/></marker>`).join('')}</defs><style>text{font-family:"PingFang SC","Microsoft YaHei",sans-serif}</style>`];nodes=[];rect(0,0,W,H);rect(64,57,9,64,C.blue);text(95,107,title,49,C.blue,650);text(W-64,94,'2026 Q4 / V3.0',25,C.muted,500,'end');line([[64,144],[W-64,144]],'blue',false,false,3);text(64,193,sub,27,C.text);text(W-64,193,page,23,C.muted,400,'end');}
function footer(n){line([[64,1384],[W-64,1384]],'line',false,false,1.3);text(64,1420,'Q4供应链产品建设方案 · 汇报分层版 · 目标业务蓝图，按P0 / P1推进',22,C.muted);text(W-64,1420,String(n).padStart(2,'0')+' / 10',22,C.blue,500,'end');}
function node(id,x,y,w,h,title,sub,color='blue',large=false){rect(x,y,w,h,'white',C[color],5);rect(x,y,5,h,C[color]);const sz=large?34:25;text(x+w/2,y+(large?46:31),title,sz,C.ink,600,'middle');const a=Array.isArray(sub)?sub:[sub];lines(x+w/2,y+(large?96:65),a,large?27:20,C.text,large?39:28,'middle');nodes.push({id,x,y,w,h});}
function save(base){fs.writeFileSync(path.join(OUT,base+'.svg'),p.join('\n')+'\n</svg>\n');return {base,nodes:[...nodes]};}

function overview(){
 begin('Q4供应链建设全景','以PMC计划为起点，打通需求、计划、采购、执行、交付与库存的滚动闭环','01 / 先看全局');
 const chain=[['需求预测','销售 / PMC','blue'],['备货计划','PMC','blue'],['采购执行','SCM','orange'],['供应商协同','SCM / 供应商','orange'],['生产','已有MES / 工厂','green'],['交付','QC / 供应商','teal'],['库存','仓储 / 领星','teal']];
 chain.forEach((a,i)=>{const x=80+i*344;p.push(`<path d="M ${x} 314 H ${x+303} L ${x+330} 377 L ${x+303} 440 H ${x} L ${x+25} 377 Z" fill="${C[a[2]]}"/>`);text(x+172,390,a[0],39,'white',600,'middle');text(x+165,502,a[1],29,C[a[2]],500,'middle');});
 line([[80,271],[1430,271]],'blue',false,false,5);text(80,253,'P0：计划 → 采购 → 供应商执行状态',28,C.blue,600);
 line([[1470,271],[2480,271]],'green',false,false,5);text(1470,253,'已有能力协同接入，按阶段落地',28,C.green,600);
 node('next',112,649,450,142,'下一轮滚动计划',['用实际执行结果校准需求与供给'],'blue',true);
 line([[2440,440],[2440,720],[562,720]],'teal',false,true,5);
 label(1470,713,'实际销量 / 库存 / 在途 / 交期 / 生产 / 质量',C.teal,31);
 line([[112,720],[64,720],[64,377],[80,377]],'blue',false,true,4);
 text(64,886,'四个建设域，共同承接一条业务链',34,C.ink,650);
 const domains=[['PMC计划','P0 · 需求与备货决策','blue'],['MRP面辅料计划','P1 · 与成衣采购并行','purple'],['SCM采购','P0 · PR / PO与供应商协同','orange'],['执行与生产协同','P0状态 · P1已有MES协同','green']];
 domains.forEach((a,i)=>{const x=64+i*616;line([[x,917],[x+579,917]],a[2],false,false,4);text(x,977,a[0],33,C.ink,650);text(x,1030,a[1],28,C[a[2]]);});
 rect(64,1120,2432,174,'#F3F8FB');text(90,1163,'数据基础层',29,C.ink,600);
 const facts=[['商品主数据','商品身份 / SKU版本'],['PLM / BOM','技术与物料资料'],['领星 / 库存 / 数仓','销量 / 库存 / 在途'],['供应商数据','产能 / 交期 / 成本']];
 facts.forEach((a,i)=>{const x=356+i*531;text(x,1175,a[0],28,C.teal,600);text(x,1222,a[1],26,C.text);});
 text(356,1266,'为PMC / MRP / SCM提供依据；数据正确性与清洗由来源系统及数据责任方承担。',25,C.muted);
 text(64,1342,'范围：不重建完整WMS、OMS、PMS；QC与入库能力按关键节点协同接入。',26,C.muted);
 footer(1);return save('01_Q4供应链建设全景_V3.0');
}

function boundary(){
 begin('系统与职责边界','PMC确定买什么、买多少、什么时候要；采购决定向谁买、如何分配及以什么PO执行','02 / 识别边界');
 node('sales',170,280,470,150,'销售 / 运营',['提供日级需求、活动与人工判断'],'blue',true);
 node('pmc',1000,264,540,162,'PMC计划中枢',['审核需求、形成最终备货计划','输出成衣采购需求'],'blue',true);
 line([[640,355],[1000,355]],'blue');label(814,347,'预测需求',C.blue,28);
 node('mrp',430,552,570,154,'MRP面辅料计划',['需要多少面辅料','净需求、备料与发料计划'],'purple',true);
 node('scm',1740,552,570,154,'SCM / 采购',['PR / PO、供应商分配','采购执行与交期协同'],'orange',true);
 line([[1270,426],[1270,482],[715,482],[715,552]],'purple');
 line([[1270,482],[2025,482],[2025,552]],'orange');
 label(815,478,'成衣采购计划 + BOM',C.purple,26);label(1917,478,'成衣采购需求 / PR',C.orange,26);
 text(1120,518,'并行承接',29,C.ink,650);
 line([[1000,631],[1740,631]],'purple');label(1370,623,'净缺口 → 物料采购需求',C.purple,26);
 node('factory',430,810,570,154,'成衣工厂 / 已有MES',['生产执行、进度与延期回传'],'green',true);
 node('supplier',1740,810,570,154,'供应商执行',['接单、交期、资料与交付协同'],'orange',true);
 line([[715,706],[715,810]],'purple');label(848,768,'备料 / 发料支持',C.purple,25);
 line([[2025,706],[2025,810]],'orange');label(2127,768,'PO与任务',C.orange,25);
 line([[1740,887],[1000,887]],'orange');label(1365,879,'订单、交期与技术资料',C.orange,27);
 node('result',1040,1082,600,150,'QC / 入库 / 经营事实',['质量、交付、库存与销量结果','协同接入，按阶段落地'],'teal',true);
 line([[715,964],[715,1026],[1340,1026],[1340,1082]],'green');label(976,1022,'完工、检验与交付',C.green,26);
 line([[1640,1157],[2460,1157],[2460,346],[1540,346]],'teal',false,true,5);label(2170,1139,'执行结果回流PMC',C.teal,29);label(2130,338,'下一轮滚动计划',C.teal,28);
 rect(64,1290,2432,66,'#F3F8FB');text(90,1333,'数据基础：商品主数据 / PLM-BOM / 领星-库存-数仓 / 供应商数据；支撑各系统，不作为串行业务节点。',26,C.text);
 footer(2);return save('02_Q4系统职责边界_V3.0');
}

function swimlane(){
 begin('核心业务泳道｜六个角色','谁发起、谁计算、谁审核、谁执行、谁反馈；PR是PMC计划与SCM采购的交接点','03 / 对齐责任');
 const gx=245,gy=275,cw=276,rh=155;
 ['需求填报','预测审核','最终计划','需求 / PR','供应商分配','PO / 接单','生产 / 交付','库存 / 回流'].forEach((t,i)=>{rect(gx+i*cw,232,cw,43,'#EDF5FA');text(gx+i*cw+cw/2,262,t,25,C.blue,600,'middle');});
 const roles=[['销售 / 运营','需求填报与确认','blue'],['PMC','计划决策 · P0','blue'],['MRP','物料计划 · P1','purple'],['SCM / 采购','采购执行 · P0','orange'],['供应商 / MES','履约与已有MES协同','green'],['仓储 / 库存','事实结果回传','teal']];
 roles.forEach((a,i)=>{const y=gy+i*rh;rect(64,y,181,rh,i===1?'#E7F3FC':i===2?'#F3EDFA':'#F1F6F9');rect(gx,y,cw*8,rh,i===1?'#F4FAFE':i===2?'#FCFAFF':i%2?'#FAFCFD':'white');text(82,y+62,a[0],25,C.ink,600);text(82,y+102,a[1],18,C[a[2]]);line([[64,y+rh],[2453,y+rh]],'line',false,false,1);});
 for(let i=0;i<=8;i++)line([[gx+i*cw,gy],[gx+i*cw,gy+6*rh]],'line',false,false,0.7);
 function n(id,c,r,t,a,col='blue'){node(id,gx+c*cw+18,gy+r*rh+27,238,108,t,a,col);}
 n('sales',0,0,'日级预测与确认',['活动预测、人工调整','提交确认']);
 n('start',0,1,'开启预测周期',['月份、W周期、窗口']);
 n('review',1,1,'审核与校准',['预测、库存、在途、水位']);
 n('final',2,1,'最终采购需求',['SKU版本、供货能力','买什么 / 多少 / 何时要']);
 n('next',7,1,'下一轮滚动计划',['执行偏差反馈','更新需求与备货判断']);
 n('mrp',2,2,'物料需求计算',['成衣计划 + BOM','库存 / 在途 → 净需求'],'purple');
 n('mplan',3,2,'面辅料需求计划',['外购 / 备料 / 发料分流'],'purple');
 n('kit',5,2,'备料 / 发料',['现有料或到料后执行','支撑齐料与开工'],'purple');
 n('pr',3,3,'PR承接与管理',['PMC确认PR','SCM管理需求单据'],'orange');
 n('alloc',4,3,'供应商分配',['产能 / 成本 / 交期','决定向谁买、如何分配'],'orange');
 n('po',5,3,'PO与交期确认',['以采购订单组织执行'],'orange');
 n('supplier',5,4,'接单与货期确认',['供应商承接任务与资料'],'orange');
 n('production',6,4,'生产 / QC / 发货',['MES进度与延期反馈','质量放行、交付执行'],'green');
 n('stock',7,5,'收货 / 入库',['质检、库存更新','库存与到货事实回传'],'teal');
 line([[382,457],[382,410]],'blue');label(454,445,'发起',C.blue,20);
 line([[501,356],[524,356],[524,511],[539,511]],'blue');
 line([[777,511],[815,511]],'blue');
 line([[934,565],[934,612]],'purple');label(1011,596,'成衣计划',C.purple,20);
 line([[1053,511],[1072,511],[1072,821],[1091,821]],'orange');label(1119,746,'成衣采购需求',C.orange,20);
 line([[1053,666],[1091,666]],'purple');
 line([[1210,720],[1210,767]],'purple');label(1285,752,'净缺口采购',C.purple,20);
 line([[1329,666],[1643,666]],'purple');label(1486,656,'可用料直接备料',C.purple,20);
 line([[1329,821],[1367,821]],'orange');line([[1605,821],[1643,821]],'orange');
 line([[1762,875],[1762,922]],'orange');
 line([[1881,976],[1919,976]],'green');
 line([[1762,720],[1762,742],[1896,742],[1896,944],[1919,944]],'purple');label(1919,904,'齐料支持',C.purple,20);
 line([[2157,976],[2176,976],[2176,1131],[2195,1131]],'green');label(2227,1057,'交付',C.green,21);
 line([[2433,1131],[2480,1131],[2480,511],[2433,511]],'teal',false,true,5);label(2370,999,'执行结果回流',C.teal,23);
 line([[2195,511],[2178,511],[2178,575],[658,575],[658,565]],'teal',false,true,4);label(1780,573,'销量 / 库存 / 在途 / 交期 / 生产 / 质量',C.teal,22);
 text(64,1254,'边界：PMC确认采购需求，SCM负责供应商分配与PR / PO执行；MRP与成衣采购并行。',26,C.text);
 text(64,1302,'QC为执行协同节点，汇报版合并展示；具体检验、生产及库存接口按阶段接入。',25,C.muted);
 text(64,1347,'数据基础由商品主数据、PLM / BOM、领星 / 库存 / 数仓及供应商数据提供，不另设业务泳道。',25,C.muted);
 footer(3);return save('03_Q4核心业务六角色泳道_V3.0');
}

const DETAILS=[
 {n:4,base:'04_PMC预测详细流程_V3.0',title:'PMC预测｜从日级填报到确认版本',sub:'W周管理任务，天是销售填报单位；系统给基准，销售补充业务判断',color:'blue',steps:[['开启预测周期',['PMC确定月份、W周与窗口','日期引用计划日历']],['维护日级预测',['系统基准只读','人工修正、结构化活动']],['销售确认',['逐日核对最终预测','提交本W周期']],['PMC审核',['查看差异与调整原因','确认或退回销售修改']],['确认预测版本',['保留来源、原因与版本','作为备货需求输入']]],aTitle:'三条输入与一个最终结果',a:['系统基准：引用数仓 / 预测模型结果','人工修正：未调整时沿用系统基准','活动影响：结构化记录类型、名称与增量','最终预测 = 选用基准 + 活动增量'],bTitle:'状态与追溯',b:['销售提交后只读，退回后恢复修改','人工修改必须说明原因','保留原值、调整值、操作人和时间','预测版本用于追溯，不新增版本菜单'],out:'确认后的日级预测及周汇总，交给PMC备货计划',note:'退回沿用同一周期与商品任务；不重复创建一轮预测。',loop:'审核退回 → 修改并重新提交'},
 {n:5,base:'05_PMC备货详细流程_V3.0',title:'PMC备货｜从预测需求到采购需求',sub:'PMC确定采购对象、数量与需求日期，采购部门决定最终供应商分配',color:'blue',steps:[['汇总确认需求',['引用预测版本','明确渠道、商品与时间']],['库存与时效校准',['库存、在途、DOI与水位','安全库存、运输及到货期']],['拆解SKU版本',['子ASIN映射至SKU版本','区分老版本库存与新版本']],['校准供货能力',['引用产能、交期与约束','调整需求量和计划日期']],['确认最终计划',['保留调整依据与审批','形成采购需求并确认PR']]],aTitle:'商品与库存关系',a:['父子ASIN及变更关系来自商品映射','子ASIN与各SKU版本关系保留生效口径','老SKU库存、新SKU供给分别识别','库存与在途只按明确口径参与覆盖'],bTitle:'业务判断与采购边界',b:['系统测算需求，PMC判断是否及如何调整','供货能力用于校准可执行性','采购负责向谁买、如何拆并及PO执行','计划变更应留痕并同步下游需求'],out:'最终备货计划并行驱动SCM采购与MRP面辅料计划',note:'MOQ、运输时效等使用配置与来源数据，不在图中新增算法或固定阈值。',loop:'执行偏差 → PMC重新校准需求与计划'},
 {n:6,base:'06_MRP详细流程_V3.0',title:'MRP｜成衣计划驱动物料准备',sub:'P1同步建设；MRP计算需要多少面辅料，SCM负责物料采购与供应商执行',color:'purple',steps:[['成衣计划与BOM',['读取成衣采购计划','物料规格、用量与版本']],['计算物料净需求',['扣减库存及有效在途','纳入安全库存与损耗']],['分流物料需求',['形成采购建议','形成备料、发料需求']],['SCM物料采购',['按净缺口采购','供应商、PO、交期跟进']],['齐料与发料',['预计 / 实际到料、IQC','缺料预警与开工支持']]],aTitle:'计算所需输入',a:['成衣采购计划与BOM版本','物料库存、在途与安全库存','损耗率、采购周期及备料周期','输入数据及参数有来源和责任人'],bTitle:'并行关系与执行边界',b:['成衣采购需求直接进入SCM主链','MRP同时形成物料需求与准备计划','可用库存覆盖部分直接备料 / 发料','物料采购和供应商分配由SCM执行'],out:'面辅料需求、备料 / 发料计划及缺料状态，支撑成衣工厂生产',note:'MRP作为明确建设域，不据此假设必须独立部署一套新系统。',loop:'现有可用物料 → 直接备料 / 发料，跳过外购'},
 {n:7,base:'07_SCM采购详细流程_V3.0',title:'SCM采购｜PR承接至PO执行',sub:'P0核心链路；PMC确认PR，SCM管理单据，采购依据供应商能力组织执行',color:'orange',steps:[['承接采购需求',['成衣需求来自PMC','物料需求来自MRP']],['PR管理',['PMC业务确认','审核、拆并、状态追溯']],['供应商分配',['产能、成本、交期与绩效','库存、商品版本、包装']],['PO与供应商接单',['PR转PO、审批与货期','订单资料和任务交付']],['执行与单据关闭',['执行状态和异常回传','整单 / SKU / 尾数关闭']]],aTitle:'PMC与采购的交接',a:['PMC：买什么、买多少、什么时候要','采购：向谁买、如何拆分和合并','SCM：以PR / PO承载审核及执行状态','需求变化返回计划侧确认，保留关联'],bTitle:'Q4重点治理',b:['PO整单、SKU和尾数关闭口径','供应商接单撤销及异常流转','多PR合并、一PR拆多PO的关系追溯','执行状态反馈PMC，减少重复录入'],out:'供应商可执行的PO、交期与任务，并持续返回执行状态',note:'PR生成接口、审核层级和权限在实施设计中细化，业务职责不再整体标为待定。',loop:'供货或交期不满足 → 反馈PMC协调计划'},
 {n:8,base:'08_供应商执行详细流程_V3.0',title:'供应商执行｜从接单到交付',sub:'用订单及执行状态承接采购要求，减少群聊、库存表和重复核对',color:'orange',steps:[['接单与货期确认',['确认PO、SKU与数量','确认承诺交期']],['技术资料就绪',['BOM、工艺、纸样、尺寸','包装与发货要求']],['物料与交期协同',['预计 / 实际到料','缺料与交付风险反馈']],['生产与质量协同',['与MES关联生产状态','按QC结果处理与放行']],['发货履约',['形成发货单','数量、日期与目的地']]],aTitle:'供应商需要明确的任务',a:['采购订单、商品与版本、需求数量','要求货期与供应商承诺货期','有效的BOM、工艺和包装技术资料','发货要求及异常反馈责任'],bTitle:'质量与异常协同',b:['来料、首扎、中期、尾期及成品节点','质量问题、返工、退货与放行结果','供应商质量档案与交付表现','具体QC系统接入节点分阶段联评'],out:'供应商交期、到料、生产、质量与发货状态进入统一执行反馈',note:'图中QC表示业务协同，不表示本季度重建完整质量管理系统。',loop:'延期、缺料、质量异常 → 采购协调并反馈PMC'},
 {n:9,base:'09_MES协同详细流程_V3.0',title:'MES协同｜接入已有生产执行能力',sub:'P1已有系统协同；订单关联、进度同步与延期预警，同时推进推广和问题治理',color:'green',steps:[['关联SCM订单',['明确生产任务来源','建立订单与SKU对应']],['下达任务与开工',['工厂承接生产要求','结合物料准备与齐料']],['生产执行与扫菲',['采集工序及生产进度','保留生产异常']],['进度与延期反馈',['对比计划与实际进度','协同处理延期风险']],['完工结果回传',['完工数量与时间','连接QC、发货和计划反馈']]],aTitle:'Q4建设重点',a:['复用已有MES，推进工厂使用与培训','订单接入及与SCM的业务关联','生产开始、进度、延期和完工状态','修复现场问题，形成持续治理清单'],bTitle:'接口需落到执行口径',b:['生产任务来源及订单关联标识','进度、完工和异常字段定义','回传频率、责任人及异常补报','QC结果与生产返工节点如何联动'],out:'可追溯的生产进度、延期及完工数据，反馈SCM与PMC',note:'MES属于已有能力协同，不画成必须等待PMC / MRP完工后才启动的重建项目。',loop:'生产延期与完工差异 → 采购与PMC协调交期'},
 {n:10,base:'10_库存回流详细流程_V3.0',title:'库存与执行回流｜进入下一轮计划',sub:'结果回流是滚动计划体系的组成部分；库存事实和清洗由来源系统负责',color:'teal',steps:[['收货与入库',['按发货与订单核对','质检、收货及入库结果']],['更新库存事实',['库存、在途与到货变化','保留业务来源与时间']],['汇集执行结果',['销量、采购与供应商状态','生产、交期和质量结果']],['PMC校准偏差',['对比需求、库存与供给','识别缺货、延期与数量差异']],['下一轮预测与计划',['调整销售需求判断','更新备货和采购需求']]],aTitle:'PMC需要消费的事实',a:['南沙、工厂、海外仓及平台可用库存','采购在途、头程在途与预计到货','供应商履约、生产进度、交期与质量','实际销量及经营结果'],bTitle:'数据责任与计划责任',b:['领星、库存系统及数仓提供事实','商品主数据负责身份与商品关系','PMC引用事实，形成计划判断和调整','原始销售、库存及映射清洗不放在PMC'],out:'实际结果持续进入下一轮预测、备货与采购计划',note:'Q4不重建完整WMS、OMS、PMS；接口与库存口径按来源和业务责任落实。',loop:'下一轮计划 → 采购与执行 → 新的事实结果，再次循环'}
];
function detail(d){
 begin(d.title,d.sub,String(d.n).padStart(2,'0')+' / 模块展开');
 text(64,283,'业务动作',32,C.ink,650);
 const y=348,cw=452,step=493;
 d.steps.forEach((a,i)=>{const x=64+i*step;node('step'+i,x,y,cw,172,a[0],a[1],d.color,true);text(x,322,String(i+1).padStart(2,'0'),24,C[d.color],650);if(i<4)line([[x+cw,434],[x+step,434]],d.color);});
 if(d.n===6){line([[1276,520],[1276,636],[2262,636],[2262,520]],'purple',false,true,4);label(1750,629,d.loop,C.purple,25);}else if(d.n===4){line([[1769,520],[1769,634],[783,634],[783,520]],'teal',false,true,4);label(1270,627,d.loop,C.teal,26);}else{line([[2262,520],[2262,634],[290,634],[290,520]],'teal',false,true,4);label(1270,627,d.loop,C.teal,26);}
 line([[64,746],[1212,746]],d.color,false,false,3);line([[1324,746],[2496,746]],d.color,false,false,3);
 text(64,799,d.aTitle,33,C.ink,650);text(1324,799,d.bTitle,33,C.ink,650);
 lines(64,864,d.a,29,C.text,62);lines(1324,864,d.b,29,C.text,62);
 rect(64,1165,2432,100,'#F3F8FB');text(91,1228,'交接结果',30,C[d.color],650);text(300,1228,d.out,29,C.ink,600);
 text(64,1331,d.note,25,C.muted);footer(d.n);return save(d.base);
}

async function main(){const items=[overview(),boundary(),swimlane(),...DETAILS.map(detail)];const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const report=[];for(const item of items){const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1.25});await page.goto('file://'+path.join(OUT,item.base+'.svg'));await page.evaluate(()=>document.fonts.ready);const checks=await page.evaluate(nodes=>{const ts=[...document.querySelectorAll('text')].map(e=>{const b=e.getBBox();return {text:e.textContent,x:b.x,y:b.y,w:b.width,h:b.height}});const overlap=[],overflow=[],nodeOverflow=[];for(let i=0;i<ts.length;i++){const a=ts[i];if(a.x<0||a.y<0||a.x+a.w>2560||a.y+a.h>1440)overflow.push(a.text);for(let j=i+1;j<ts.length;j++){const b=ts[j];if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>3&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>3)overlap.push([a.text,b.text]);}for(const n of nodes)if(Math.abs(a.x+a.w/2-n.x-n.w/2)<1&&a.y>=n.y&&a.y<n.y+n.h&&(a.x<n.x+7||a.x+a.w>n.x+n.w-7||a.y+a.h>n.y+n.h-3))nodeOverflow.push({node:n.id,text:a.text});}return {textCount:ts.length,overflow,overlap,nodeOverflow};},item.nodes);await page.locator('svg').screenshot({path:path.join(OUT,item.base+'.png')});report.push({file:item.base,...checks});await page.close();}await browser.close();fs.mkdirSync(path.join(OUT,'.build'),{recursive:true});fs.writeFileSync(path.join(OUT,'.build/verification.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(OUT,'pages.json'),JSON.stringify(items.map(i=>i.base),null,2));console.log(JSON.stringify(report,null,2));}
main().catch(e=>{console.error(e);process.exit(1)});
