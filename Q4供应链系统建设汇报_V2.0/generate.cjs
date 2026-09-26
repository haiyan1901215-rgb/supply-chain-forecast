const fs=require('fs'),path=require('path');
const {chromium}=require('/Users/yan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const OUT=__dirname,W=2880,H=1800;
const C={blue:'#008DD5',ink:'#18384E',text:'#3C566B',muted:'#6B7F90',line:'#D5E1E9',teal:'#078E99',green:'#54963C',orange:'#DC8226',purple:'#7B60A8'};
let p=[],nodes=[];
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function rect(x,y,w,h,fill='white',stroke='none',r=0,dash=false){p.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2" ${dash?'stroke-dasharray="8 6"':''}/>`);}
function text(x,y,t,size=27,color=C.text,weight=400,anchor='start'){p.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}">${esc(t)}</text>`);}
function lines(x,y,a,size=27,color=C.text,gap=43,anchor='start',weight=400){a.forEach((t,i)=>text(x,y+i*gap,t,size,color,weight,anchor));}
function line(a,color='blue',dash=false,arrow=true,width=2.6){p.push(`<path d="${a.map((v,i)=>(i?'L':'M')+v.join(' ')).join(' ')}" fill="none" stroke="${C[color]}" stroke-width="${width}" ${dash?'stroke-dasharray="8 6"':''} ${arrow?`marker-end="url(#arrow-${color})"`:''}/>`);}
function label(x,y,t,color=C.muted,size=21){const w=[...t].reduce((a,c)=>a+(/[\x00-\x7F]/.test(c)?0.56:1),0)*size+18;rect(x-w/2,y-size+1,w,size+9);text(x,y,t,size,color,500,'middle');}
function begin(title,sub,page){p=[`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><defs>${Object.entries(C).map(([k,c])=>`<marker id="arrow-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="${c}"/></marker>`).join('')}</defs><style>text{font-family:"PingFang SC","Microsoft YaHei",sans-serif}</style>`];nodes=[];rect(0,0,W,H);rect(64,58,9,64,C.blue);text(95,108,title,51,C.blue,650);text(W-64,96,'2026 Q4 / V2.0',25,C.muted,500,'end');line([[64,145],[W-64,145]],'blue',false,false,3);text(64,193,sub,27,C.text);text(W-64,193,page,23,C.muted,400,'end');}
function footer(){line([[64,1742],[W-64,1742]],'line',false,false,1.4);text(64,1778,'依据：本次《第四季度供应链系统建设方案》 · 目标业务蓝图与分级建设范围 · 2026.09.16',22,C.muted);text(W-64,1778,'供应链数字化',22,C.blue,500,'end');}
function node(id,x,y,w,h,title,sub,color='blue'){rect(x,y,w,h,'white',C[color],5);rect(x,y,5,h,C[color]);text(x+w/2,y+29,title,25,C.ink,600,'middle');const a=Array.isArray(sub)?sub:[sub];lines(x+w/2,y+(a.length>1?60:70),a,20,C.text,27,'middle');nodes.push({id,x,y,w,h});}
function save(base){fs.writeFileSync(path.join(OUT,base+'.svg'),p.join('\n')+'\n</svg>\n');return {base,nodes:[...nodes]};}

function business(){
 begin('Q4供应链建设｜业务主流程','P0打通PMC计划至SCM采购与供应商执行；P1同步建设MRP，并接入MES执行数据','01 / 方案校准版');
 rect(64,225,2752,128,'#F3F8FB');
 text(90,264,'统一业务依据',27,C.ink,600);
 text(352,264,'商品主数据 / PLM：SKU、版本、商品关系、BOM与技术资料',26,C.teal);
 text(1500,264,'领星 / 库存 / 数仓：销量、库存、在途、AI基准与到货事实',26,C.teal);
 text(352,313,'供应商数据：产能、交期、成本、准交率与质量；PMC调用，采购结合这些依据进行分配',26,C.text);
 line([[64,390],[1779,390]],'blue',false,false,5);text(64,378,'P0 必须打通：计划 → PR → PO → 供应商执行状态',25,C.blue,600);
 line([[1804,390],[2816,390]],'green',false,false,5);text(1804,378,'执行协同：接入已有能力，按节点分阶段落地',25,C.green,600);
 const stages=[
 ['销量预测','销售 / PMC · 计划平台','blue',['周期发起、日级填报','AI基准、人工修正与活动','销售确认、PMC审核'],'预测单 / 预测版本'],
 ['备货计划','PMC · 计划中枢','blue',['校准库存、在途与时效','水位、SKU版本拆解','供货能力校准、计划审批'],'最终计划单 / 采购需求'],
 ['采购需求 / PR','PMC确认 · SCM管理','blue',['计划需求进入采购计划','PR生成、审核与状态','拆分 / 合并、PR转PO'],'已确认PR'],
 ['采购分配 / PO','采购 · SCM','orange',['产能、成本、交期分配','版本、工厂库存与包装','PO审核、交期确认'],'采购订单PO'],
 ['供应商执行','供应商 · SCM协同','orange',['接单及要求货期确认','BOM、工艺与技术资料','到料、执行状态及异常'],'接单 / 交期 / 执行状态'],
 ['生产 / MES','工厂 · 已有MES协同','green',['订单关联、下达与开工','扫菲 / 工序进度同步','延期预警、完工回传'],'生产订单 / 进度'],
 ['品控与发货','QC / 供应商 · 执行协同','teal',['首扎、中期、尾期检验','成品检验、问题与退货','质量放行、供应商发货'],'质量记录 / 发货单'],
 ['收货与入库','仓储 · 库存 / 领星等','teal',['仓库收货、到货核对','入库检验、库存更新','到货与库存事实回流'],'入库单 / 库存结果']
 ];
 const cw=335,g=10,x0=64;
 stages.forEach((a,i)=>{const x=x0+i*(cw+g);p.push(`<path d="M ${x} 413 H ${x+cw-25} L ${x+cw} 462 L ${x+cw-25} 511 H ${x} L ${x+22} 462 Z" fill="${C[a[2]]}"/>`);text(x+cw/2+4,474,a[0],31,'white',600,'middle');text(x+cw/2,552,a[1],23,C[a[2]],600,'middle');lines(x+12,604,a[3],26,C.text,43);line([[x+12,717],[x+cw-12,717]],'line',false,false,1.2);text(x+12,750,'核心交付物',21,C.muted);text(x+12,790,a[4],25,C.ink,600);});
 line([[2638,808],[2638,853],[565,853],[565,808]],'teal',true);
 label(1640,860,'订单、交期、到料、生产、质量及库存回流 → PMC滚动校准下一轮计划',C.teal,25);
 rect(64,910,2752,324,'#FBF9FE','#AE99C7',6);
 text(92,959,'P1同步建设｜MRP面辅料计划域',32,C.purple,650);
 text(799,959,'由成衣采购计划驱动，与SCM采购执行、工厂齐料衔接',27,C.text);
 const items=[['成衣采购计划 + BOM',['统一物料身份、规格','供应商与采购 / 备料周期']],['MRP需求计算',['物料库存、在途、安全库存','损耗率 → 净需求与建议']],['面辅料需求计划',['面料 / 辅料需求','采购建议、备料与发料需求']],['SCM物料采购',['供应商选择、PO与交期','材料供应商接单、到货跟进']],['到料 / 齐料 / 发料',['来料IQC、预计 / 实际到料','缺料预警，发往成衣工厂']]];
 items.forEach((a,i)=>{const x=94+i*548;text(x,1030,a[0],30,C.ink,600);lines(x,1080,a[1],26,C.text,44);if(i<4)line([[x+455,1038],[x+516,1038]],'purple');});
 text(94,1192,'责任：MRP计算净需求并组织备料 / 发料；有净缺口交SCM采购，现有可用物料直接备料；到料与齐料支撑生产。',26,C.purple,500);
 text(64,1300,'四个建设域与交付重点',34,C.blue,650);
 const domains=[['PMC计划域','P0','预测、备货、审批与计划执行','日级预测 → 最终备货计划','blue'],['MRP面辅料计划域','P1','主数据、需求计算、备料与发料','成衣计划 → 面辅料需求计划','purple'],['SCM采购域','P0','采购计划、PR / PO、供应商分配','需求承接 → 可执行采购订单','orange'],['供应商执行与生产协同','P0状态 / P1 MES','接单、技术资料、生产、QC与发货','执行状态 → 质量 / 入库反馈','green']];
 domains.forEach((a,i)=>{const x=64+i*693;line([[x,1328],[x+661,1328]],a[4],false,false,4);text(x,1378,a[0],31,C.ink,650);text(x,1422,a[1],24,C[a[4]],600);lines(x,1470,a.slice(2,4),27,C.text,47);});
 text(64,1598,'单据闭环',28,C.blue,600);text(265,1598,'预测单 → 计划单 → PR → PO → 生产订单 → 发货单 → 入库单',29,C.ink,600);
 text(64,1650,'范围控制',26,C.orange,600);text(265,1650,'Q4先跑通计划、采购与供应商执行；MRP同步建设，MES利用已有系统，QC / 入库按关键节点接入。',25,C.text);
 text(265,1695,'不建设完整WMS、OMS、PMS；不在PMC建设数据清洗平台。审批以单据状态流转承载。',25,C.muted);
 footer();return save('01_Q4供应链业务主流程图_V2.0');
}

function swimlane(){
 begin('Q4供应链建设｜跨部门业务泳道','以预测单、计划单、PR、PO及执行单据衔接责任；展示目标闭环，具体上线节点按P0 / P1推进','02 / 方案校准版');
 const gx=260,gy=262,cw=282,rh=145;
 ['数据准备','预测填报','审核校准','计划 / PR','采购分配 / PO','面辅料交付','接单 / 生产','品控 / 发货','入库 / 回流'].forEach((t,i)=>{rect(gx+i*cw,219,cw,43,'#EDF5FA');text(gx+i*cw+cw/2,249,t,24,C.blue,600,'middle');});
 const lanes=[['数据责任方','商品主数据 / PLM / 数仓','teal'],['销售 / 运营','日级填报、确认与修改','blue'],['PMC计划','预测、备货、计划确认','blue'],['采购 / SCM','PR / PO与供应商分配','orange'],['材料计划 / MRP','P1需求、备料与发料','purple'],['供应商','成衣 / 面辅料执行','orange'],['工厂 / MES','P1订单关联与生产回传','green'],['品控 / QC','来料、产中、成品质量','teal'],['仓储 / 库存','库存 / 领星等事实来源','teal']];
 lanes.forEach((a,i)=>{const y=gy+i*rh;rect(64,y,196,rh,i===2?'#E7F3FC':i===4?'#F3EDFA':'#F1F6F9');rect(gx,y,cw*9,rh,i===2?'#F4FAFE':i===4?'#FCFAFF':i%2?'#FAFCFD':'white');text(83,y+60,a[0],26,C.ink,600);text(83,y+97,a[1],16,C[a[2]]);line([[64,y+rh],[gx+cw*9,y+rh]],'line',false,false,1.2);});
 for(let i=0;i<=9;i++)line([[gx+i*cw,gy],[gx+i*cw,gy+rh*9]],'line',false,false,0.7);
 const N={};function n(id,c,r,t,a,col='blue'){const x=gx+c*cw+18,y=gy+r*rh+30;node(id,x,y,234,100,t,a,col);N[id]={x,y};}
 n('mdm',0,0,'商品与BOM资料',['SKU / 版本 / 商品关系','BOM、工艺、物料规格'],'teal');
 n('fact',2,0,'经营与库存事实',['销量 / AI基准 / 在途','库存、运输与预计到货'],'teal');
 n('cap',4,0,'供应商能力依据',['产能 / 交期 / 成本','交付、质量、工厂库存'],'teal');
 n('sales',1,1,'填报并销售确认',['人工修正、活动影响','最终日级预测 / 周汇总']);
 n('open',1,2,'开启预测周期',['月份 / W周数 / 窗口','计划日历与预测版本']);
 n('review',2,2,'PMC审核与调整',['库存 / 在途 / 水位校准','差异说明、退回或确认']);
 n('final',3,2,'最终备货计划',['SKU版本与供货校准','PMC确认采购需求']);
 n('next',8,2,'执行反馈与再计划',['交期 / 数量 / 质量偏差','滚动修正下一轮计划']);
 n('pr',3,3,'PR管理与承接',['PMC确认PR，SCM管理','审核 / 拆并 / 状态流转'],'orange');
 n('po',4,3,'分配供应商 / PO',['产能、成本、库存、版本','交期校准 / PO审核'],'orange');
 n('mpo',5,3,'面辅料采购执行',['供应商选择 / 物料PO','接单、交期及到货跟进'],'orange');
 n('mrp',3,4,'MRP计算',['BOM / 物料库存 / 在途','安全库存 / 损耗 / 周期'],'purple');
 n('mplan',4,4,'面辅料需求计划',['采购建议、备料需求','发料计划 / 缺料预警'],'purple');
 n('kit',6,4,'到料 / 齐料 / 发料',['预计与实际到料','检验结果、缺料跟进'],'purple');
 n('msupplier',5,5,'面辅料供应商',['接单、备料、发货','送往成衣工厂 / 指定仓'],'orange');
 n('gsupplier',6,5,'成衣供应商接单',['要求货期、SKU与数量','BOM / 工艺 / 包装资料'],'orange');
 n('ship',7,5,'供应商发货',['QC放行、形成发货单','发货数量 / 日期 / 去向'],'orange');
 n('mes',6,6,'生产执行 / MES',['订单关联、开工与扫菲','进度 / 延期预警 / 完工'],'green');
 n('iqc',5,7,'来料检验 IQC',['来料质量、问题处理','检验结果反馈齐料'],'teal');
 n('process',6,7,'生产过程检验',['首扎 / 中期 / 尾期','问题跟进与返工'],'teal');
 n('fqc',7,7,'成品检验与放行',['成品质量、缺陷、退货','沉淀供应商质量档案'],'teal');
 n('stock',8,8,'收货 / 质检入库',['收货核对、入库检验','库存与到货事实更新'],'teal');
 // Forecast initiation and review, with data dependencies distinct from control flow.
 line([[512,342],[531,342],[531,487],[560,487]],'teal',true);label(422,423,'商品身份与关系',C.teal,20);
 line([[959,392],[959,582]],'teal',true);label(1033,510,'取数依据',C.teal,20);
 line([[677,582],[677,537]],'blue');label(744,565,'开启窗口',C.blue,19);
 line([[794,487],[825,487],[825,632],[842,632]],'blue');label(862,556,'提交',C.blue,19);
 line([[919,582],[919,449],[794,449]],'orange',true);label(957,450,'退回修改',C.orange,19);
 line([[1076,632],[1124,632]],'blue');
 line([[1241,682],[1241,727]],'blue');label(1336,711,'采购需求',C.blue,19);
 line([[1358,777],[1406,777]],'orange');
 // Garment purchase order to supplier, routed outside the material handoff.
 line([[1523,727],[1523,710],[2220,710],[2220,1067],[2204,1067]],'orange');label(2030,710,'成衣PO / 技术资料',C.orange,21);
 // MRP is triggered by the garment procurement plan, before material purchasing.
 line([[1124,659],[1103,659],[1103,922],[1124,922]],'purple');label(1018,861,'成衣采购计划',C.purple,20);
 line([[1358,922],[1406,922]],'purple');
 line([[1640,922],[1663,922],[1663,800],[1688,800]],'purple');label(1701,866,'净缺口采购建议',C.purple,19);
 line([[1805,827],[1805,1017]],'orange');label(1878,990,'物料PO',C.orange,20);
 line([[1805,1117],[1805,1307]],'teal');label(1859,1231,'到料送检',C.teal,19);
 line([[1922,1357],[1941,1357],[1941,922],[1970,922]],'teal',true);label(1950,1165,'检验结果',C.teal,18);
 line([[2087,972],[2087,995],[1953,995],[1953,1185],[1970,1185]],'purple');label(2045,995,'齐料支持开工',C.purple,19);
 line([[2087,1117],[2087,1162]],'green');label(2160,1149,'生产任务',C.green,19);
 line([[2087,1262],[2087,1307]],'green');label(2160,1296,'过程送检',C.green,19);
 line([[2204,1357],[2252,1357]],'teal');
 line([[2369,1307],[2369,1117]],'teal');label(2435,1188,'质量放行',C.teal,20);
 line([[2486,1067],[2512,1067],[2512,1502],[2534,1502]],'orange');label(2512,1431,'发货单',C.orange,20);
 // All business facts feed a single next-cycle planning node.
 line([[2651,1452],[2651,682]],'teal',true);label(2694,1135,'入库 / 库存',C.teal,20);
 line([[2204,1223],[2240,1223],[2240,1281],[2651,1281]],'green',true);label(2502,1288,'进度 / 延期回传',C.green,20);
 line([[2140,1117],[2140,1134],[2651,1134]],'orange',true);label(2450,1141,'接单 / 交期状态',C.orange,20);
 line([[2534,632],[2494,632],[2494,692],[994,692],[994,682]],'teal',true);label(2240,692,'反馈校准 / 二次确认',C.teal,20);
 // Quality rejection loop, independent from the main release path.
 line([[2369,1407],[2369,1432],[1961,1432],[1961,1245],[1970,1245]],'orange',true);label(2197,1439,'不合格 → 返工 / 退货处理',C.orange,20);
 text(64,1613,'线型',23,C.ink,600);line([[131,1605],[196,1605]],'blue');text(209,1613,'业务交接',22,C.text);line([[401,1605],[466,1605]],'teal',true);text(481,1613,'数据引用 / 状态回传',22,C.text);line([[810,1605],[875,1605]],'orange',true);text(891,1613,'退回与异常',22,C.text);
 text(64,1660,'建设口径',25,C.blue,600);text(241,1660,'P0：PMC → PR → PO → 供应商执行状态；P1：MRP同步建设、MES接入。QC / 入库展示目标闭环，节点分批联评。',24,C.text);
 text(241,1704,'PR由PMC业务确认、SCM承载管理；各级审批权限及生成接口待细化。库存、商品与供应商事实由责任方提供，PMC不承担清洗。',23,C.muted);
 footer();return save('02_Q4供应链跨部门泳道图_V2.0');
}

async function main(){const items=[business(),swimlane()];const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const report=[];for(const item of items){const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1.25});await page.goto('file://'+path.join(OUT,item.base+'.svg'));await page.evaluate(()=>document.fonts.ready);const checks=await page.evaluate(nodes=>{const texts=[...document.querySelectorAll('text')].map(e=>{const b=e.getBBox();return {text:e.textContent,x:b.x,y:b.y,w:b.width,h:b.height}});const overlap=[],overflow=[],nodeOverflow=[];for(let i=0;i<texts.length;i++){const a=texts[i];if(a.x<0||a.y<0||a.x+a.w>2880||a.y+a.h>1800)overflow.push(a.text);for(let j=i+1;j<texts.length;j++){const b=texts[j];if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>3&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>3)overlap.push([a.text,b.text]);}for(const n of nodes)if(Math.abs(a.x+a.w/2-n.x-n.w/2)<1&&a.y>=n.y&&a.y<n.y+n.h&&(a.x<n.x+7||a.x+a.w>n.x+n.w-7||a.y+a.h>n.y+n.h-3))nodeOverflow.push({node:n.id,text:a.text});}return {textCount:texts.length,overflow,overlap,nodeOverflow};},item.nodes);await page.locator('svg').screenshot({path:path.join(OUT,item.base+'.png')});report.push({file:item.base,...checks});await page.close();}await browser.close();fs.mkdirSync(path.join(OUT,'.build'),{recursive:true});fs.writeFileSync(path.join(OUT,'.build/verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
main().catch(e=>{console.error(e);process.exit(1)});
