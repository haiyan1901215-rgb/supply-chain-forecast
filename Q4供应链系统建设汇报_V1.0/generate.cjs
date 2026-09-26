const fs = require('fs');
const path = require('path');
const { chromium } = require('/Users/yan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const OUT = __dirname;
const C = { blue:'#008DD5', ink:'#17364B', text:'#39546A', muted:'#6C7E8E', line:'#CEDCE5', pale:'#F4F8FB', teal:'#128D96', green:'#54983E', orange:'#DF8525', purple:'#7964AA' };
let parts = [], boxes = [];
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function begin(w,h,title) {
  parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}"><defs>${Object.entries(C).map(([k,v])=>`<marker id="arrow-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="${v}"/></marker>`).join('')}</defs><style>text{font-family:"PingFang SC","Microsoft YaHei",sans-serif;letter-spacing:0} .mono{font-family:Arial,sans-serif}</style><rect width="${w}" height="${h}" fill="white"/>`];
  boxes=[];
}
function rect(x,y,w,h,fill='white',stroke='none',radius=0,dashed=false) { parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="2" ${dashed?'stroke-dasharray="8 6"':''}/>`); }
function text(x,y,str,size=26,color=C.text,weight=400,anchor='start') { parts.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}">${esc(str)}</text>`); }
function lines(x,y,items,size=26,color=C.text,gap=41,anchor='start',weight=400) { items.forEach((s,i)=>text(x,y+i*gap,s,size,color,weight,anchor)); }
function line(points,color='blue',dash=false,arrow=true,width=2.5) { parts.push(`<path d="${points.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ')}" fill="none" stroke="${C[color]}" stroke-width="${width}" stroke-linejoin="round" ${dash?'stroke-dasharray="8 6"':''} ${arrow?`marker-end="url(#arrow-${color})"`:''}/>`); }
function label(x,y,str,color=C.muted,size=21,anchor='middle') { const width=[...str].reduce((n,c)=>n+(/[\x00-\x7F]/.test(c)?0.56:1),0)*size+18; rect(anchor==='middle'?x-width/2:x-7,y-size+1,width,size+10,'white');text(x,y,str,size,color,500,anchor); }
function header(w,title,sub,page) { rect(60,54,9,66,C.blue);text(92,103,title,50,C.blue,650);text(w-65,91,'2026 Q4  /  V1.0',23,C.muted,500,'end');line([[60,137],[w-60,137]],'blue',false,false,3);text(64,179,sub,25,C.text);text(w-65,179,page,22,C.muted,400,'end'); }
function footer(w,h) { line([[60,h-67],[w-60,h-67]],'line',false,false,1.5);text(64,h-31,'汇报讨论稿  ·  业务主链表示协同关系，Q4工作流并行推进  ·  2026.09.16',21,C.muted);text(w-64,h-31,'供应链数字化',21,C.blue,500,'end'); }
function node(id,x,y,w,h,title,sub,color='blue',dashed=false) { rect(x,y,w,h,'white',C[color],6,dashed);rect(x,y,5,h,C[color]);text(x+w/2,y+26,title,24,C.ink,600,'middle');const a=Array.isArray(sub)?sub:[sub];lines(x+w/2,y+(a.length>1?54:64),a,18,C.text,24,'middle');boxes.push({id,x,y,w,h});return {x,y,w,h,cx:x+w/2,cy:y+h/2}; }
function finish(name) { const svg=parts.join('\n')+'\n</svg>\n';fs.writeFileSync(path.join(OUT,name+'.svg'),svg);return {name,boxes:[...boxes]}; }

function business() {
  const W=2240,H=1260;begin(W,H,'Q4供应链系统建设：业务主链');
  header(W,'Q4供应链系统建设｜业务主链','以PMC为计划中枢，贯通需求、采购、生产与库存反馈','01 / 业务全景');
  const stages=[
    ['商品数据准备','商品 / 研发 · MDM / PLM','teal',['统一SKU与版本关系','准备BOM、工艺资料','明确数据责任与版本'],'可用的商品资料'],
    ['销售需求','销售运营 · 计划平台','blue',['PMC开启预测周期','按W周、逐日修正与填活动','销售提交、PMC审核'],'审核后的销售需求'],
    ['PMC计划','PMC · 计划中枢','blue',['读取需求、库存与在途','测算缺口、备货与过货','人工校准、审批与留痕'],'采购需求 / 过货计划'],
    ['采购执行','采购 / 供应商 · SCM','orange',['承接并确认采购需求','采购决策、PO / 大货单','供应商交期与发货跟踪'],'订单 / 交期 / 执行状态'],
    ['生产协同','工厂 / 生产 · MES','green',['承接生产任务与工艺','排产执行、报工与进度','异常处理、完工回传'],'生产进度 / 完工结果'],
    ['入库与库存回流','质检 / 仓储 · 库存来源系统','teal',['质检放行、收货入库','更新库存与在途事实','反馈到货、数量与质量'],'库存快照 / 到货结果'],
    ['下一轮计划','PMC / 销售 · 滚动计划','blue',['对比计划与执行差异','处理缺货、延期等异常','更新预测与补货安排'],'新一轮需求与供给计划']
  ];
  const x0=64,cw=294,gap=8;
  stages.forEach((s,i)=>{const x=x0+i*(cw+gap);parts.push(`<path d="M ${x} 224 H ${x+cw-25} L ${x+cw} 269 L ${x+cw-25} 314 H ${x} L ${x+23} 269 Z" fill="${C[s[2]]}"/>`);text(x+cw/2+4,280,s[0],31,'white',600,'middle');text(x+cw/2,358,s[1],21,C[s[2]],600,'middle');lines(x+20,410,s[3],24,C.text,43);line([[x+20,523],[x+cw-15,523]],'line',false,false,1.3);text(x+20,554,'阶段交付',19,C.muted);text(x+20,590,s[4],23,C.ink,600);});
  line([[x0+5*(cw+gap)+cw/2,610],[x0+5*(cw+gap)+cw/2,637],[x0+2*(cw+gap)+cw/2,637],[x0+2*(cw+gap)+cw/2,611]],'teal',true);
  label(1350,644,'订单、进度、到货与库存事实持续回流',C.teal,22);
  rect(64,688,W-128,202,'#FFFCF7','#E0AE71',6,true);
  text(90,731,'MRP物料协同支线',29,C.orange,650);text(405,731,'按需适用：涉及自采 / 发料的生产订单；责任主体与系统归属待确认',24,C.text);
  const mx=[94,500,906,1312,1718];
  const mt=[['生产订单 + BOM','读取物料库存、在途与损耗'],['物料需求测算','输出物料缺口与到料需求'],['材料采购 / 发料','由采购、材料与供应商执行'],['到料与齐料确认','支撑生产开工与异常处理'],['物料状态反馈','回传缺口、到料与生产影响']];
  mt.forEach((a,i)=>{text(mx[i],786,a[0],28,C.ink,600);text(mx[i],830,a[1],23,C.text);if(i<4)line([[mx[i]+305,790],[mx[i]+366,790]],'orange',true);});
  text(94,868,'Q4定位：梳理BOM、物料口径、责任人与接口，评估最小闭环；完整MRP不作为本稿交付承诺。',22,C.muted);
  text(64,944,'Q4并行建设重点',31,C.blue,650);
  const tracks=[['01  计划MVP','预测填报、规则配置、计划审核','采购需求 / 过货结果可追溯','blue'],['02  SCM承接','现有能力盘点、关键问题修复','明确需求接收与执行状态反馈','orange'],['03  MES稳定化','现场问题修复、操作微调与推广','验证可用性及生产回传口径','green'],['04  协同基础梳理','MRP、QC、库存Owner与接口','确认局部MVP及跨系统责任','teal']];
  tracks.forEach((t,i)=>{const x=64+i*541;line([[x,971],[x+510,971]],t[3],false,false,4);text(x,1015,t[0],29,C.ink,650);lines(x,1060,t.slice(1,3),25,C.text,39);});
  text(64,1157,'边界：PMC输出计划需求；正式PR创建与审批待确认。库存事实由来源系统提供；MES任务来源及回传字段待确认。',23,C.muted);
  footer(W,H);return finish('01_Q4供应链业务主链图_V1.0');
}

function swimlane() {
  const W=2560,H=1600;begin(W,H,'Q4供应链跨部门泳道流程');
  header(W,'Q4供应链系统建设｜跨部门泳道','明确谁发起、谁审核、谁执行、谁回传；按业务交付物衔接各系统','02 / 协同流程');
  const gx=256,gy=260,cw=278,rh=150,gw=2224;
  const phases=['数据与规则准备','需求填报','需求审核','计划与采购承接','物料协同','生产执行','质检与入库','回流与再计划'];
  phases.forEach((p,i)=>{rect(gx+i*cw,209,cw,51,i===3?'#DCEFFC':'#EDF4F8');text(gx+i*cw+cw/2,242,p,25,C.blue,600,'middle');});
  const lanes=[['商品 / 研发','MDM / PLM','teal'],['销售 / 运营','计划平台 · 日级填报','blue'],['PMC计划','计划平台 · 中枢','blue'],['采购 / 供应商','SCM · 采购执行','orange'],['材料协同','MRP · 归属待确认','orange'],['工厂 / 生产','MES · 生产执行','green'],['质检 / 仓储','QC / WMS / 领星等','teal']];
  lanes.forEach((a,i)=>{const y=gy+i*rh;rect(64,y,192,rh,i===2?'#E7F3FC':'#F1F6F9');rect(gx,y,gw,rh,i===2?'#F4FAFE':i%2?'#FAFCFD':'white');text(85,y+65,a[0],28,C.ink,600);text(85,y+102,a[1],19,C[a[2]]);line([[64,y+rh],[gx+gw,y+rh]],'line',false,false,1.2);});
  for(let i=0;i<=8;i++)line([[gx+i*cw,260],[gx+i*cw,1310]],'line',false,false,0.7);
  const pos=(col,row)=>[gx+col*cw+23,gy+row*rh+31];
  const N={};function n(id,col,row,title,sub,color='blue',dash=false){const [x,y]=pos(col,row);return N[id]=node(id,x,y,232,88,title,sub,color,dash);}
  n('data',0,0,'商品资料就绪',['SKU / 版本关系','BOM / 工艺资料'],'teal');
  n('sales',1,1,'逐日填报并提交',['人工修正基准','活动增量与调整原因']);
  n('config',0,2,'准备规则与依据',['规则版本 / 数仓预测','读取库存与在途']);
  n('start',1,2,'发起预测周期',['月份 / W周数','填报窗口']);
  n('review',2,2,'审核销售需求',['确认或退回','保留审核原因']);
  n('plan',3,2,'确认备货 / 过货',['测算缺口、人工校准','审批形成采购需求']);
  n('next',7,2,'滚动校准计划',['处理执行偏差','更新下一轮预测']);
  n('order',3,3,'采购决策与下单',['承接确认采购需求','PO / 大货单'],'orange');
  n('materialBuy',4,3,'物料采购 / 发料','按需采购，跟进交付','orange',true);
  n('mrp',4,4,'测算物料缺口',['订单 + BOM','物料库存 / 在途'],'orange',true);
  n('kit',5,4,'到料与齐料确认','缺料跟进、供料保障','orange',true);
  n('make',5,5,'生产执行与报工','进度 / 异常 / 完工结果','green');
  n('inbound',6,6,'质检放行与入库',['合格收货','异常返工 / 退货'],'teal');
  n('stock',7,6,'更新库存与在途',['实际到货','库存 / 在途事实'],'teal');
  // Place connectors in lane gaps, keeping task text unobstructed.
  line([[511,335],[523,335],[523,485],[557,485]],'teal');
  label(441,409,'商品与映射资料',C.teal,20);
  line([[511,635],[557,635]],'blue');
  line([[673,591],[673,529]],'blue');label(733,565,'开启窗口',C.blue,20);
  line([[789,485],[825,485],[825,635],[835,635]],'blue');
  label(865,548,'提交',C.blue,20);
  line([[920,591],[920,447],[789,447]],'orange',true);label(960,468,'退回修改',C.orange,20);
  line([[1067,635],[1113,635]],'blue');
  line([[1229,679],[1229,741]],'blue');label(1326,717,'采购需求',C.blue,20);
  line([[1345,785],[1368,785],[1368,935],[1391,935]],'orange',true);label(1325,871,'订单依据',C.orange,20);
  line([[1507,891],[1507,829]],'orange',true);label(1578,865,'物料需求',C.orange,20);
  line([[1623,785],[1785,785],[1785,891]],'orange',true);label(1796,851,'采购 / 到料反馈',C.orange,20);
  line([[1785,979],[1785,1041]],'orange',true);label(1880,1014,'齐料可开工',C.orange,20);
  // Production tasks originate from the confirmed execution order, not MRP.
  line([[1229,829],[1229,1085],[1669,1085]],'green');label(1414,1077,'生产任务 / 委外订单',C.green,22);
  line([[1901,1085],[2063,1085],[2063,1191]],'green');label(2073,1159,'完工 / 发货',C.green,20);
  line([[2179,1235],[2225,1235]],'teal');
  line([[2341,1191],[2341,679]],'teal',true);label(2341,970,'到货 / 库存事实',C.teal,21);
  line([[1901,1117],[2341,1117]],'green',true);label(2109,1123,'进度 / 异常回传',C.green,20);
  parts.push(`<circle cx="2341" cy="1117" r="5" fill="${C.teal}"/>`);
  line([[1262,741],[1262,710],[2341,710]],'teal',true);label(1550,717,'订单 / 交期反馈',C.teal,20);
  line([[2225,635],[2205,635],[2205,689],[951,689],[951,679]],'teal',true);label(1800,696,'按反馈滚动调整、再审核',C.teal,20);
  line([[2063,1279],[2063,1296],[1785,1296],[1785,1129]],'orange',true);label(1850,1288,'不合格：返工 / 异常处理',C.orange,20);
  text(65,1360,'线型',23,C.ink,600);line([[130,1351],[197,1351]],'blue');text(211,1360,'主流程 / 业务交接',22,C.text);
  line([[492,1351],[559,1351]],'teal',true);text(573,1360,'数据回流',22,C.text);
  line([[770,1351],[837,1351]],'orange',true);text(851,1360,'条件支线 / 退回',22,C.text);
  rect(1190,1338,39,25,'white',C.orange,3,true);text(1248,1360,'虚线节点：MRP相关能力待确认',22,C.text);
  text(64,1417,'协同约定',27,C.blue,650);
  text(229,1417,'数仓读取规则与业务事实，提供预测和缺口计算；PMC承载计划决策与人工调整。',24,C.text);
  text(64,1462,'待确认',24,C.orange,650);text(229,1462,'正式PR创建与审批归属；MRP / 齐料Owner；MES任务来源与回传字段；QC节点及库存事实来源。',23,C.text);
  text(229,1502,'MRP仅在涉及物料采购 / 发料的订单适用；质检流程及回流接口为目标协同关系，落地范围需联评。',22,C.muted);
  footer(W,H);return finish('02_Q4供应链跨部门泳道图_V1.0');
}

async function main(){
  const diagrams=[business(),swimlane()];
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const reports=[];
  for(const item of diagrams){
    const page=await browser.newPage({viewport:{width:2600,height:1700},deviceScaleFactor:1.5});
    await page.goto('file://'+path.join(OUT,item.name+'.svg'));
    await page.evaluate(()=>document.fonts.ready);
    const metrics=await page.evaluate((nodes)=>{
      const root=document.querySelector('svg'), w=root.viewBox.baseVal.width,h=root.viewBox.baseVal.height;
      const texts=[...document.querySelectorAll('text')].map(e=>{const b=e.getBBox();return {text:e.textContent,x:b.x,y:b.y,w:b.width,h:b.height};});
      const overflow=texts.filter(b=>b.x<0||b.y<0||b.x+b.w>w||b.y+b.h>h);
      const overlaps=[];
      for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){const a=texts[i],b=texts[j];if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>3&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>3)overlaps.push([a.text,b.text]);}
      const nodeOverflow=[];
      for(const node of nodes)for(const t of texts){const center=t.x+t.w/2;if(Math.abs(center-(node.x+node.w/2))<1&&t.y>=node.y&&t.y<node.y+node.h&&(t.x<node.x+10||t.x+t.w>node.x+node.w-10||t.y+t.h>node.y+node.h-4))nodeOverflow.push({node:node.id,text:t.text});}
      return {width:w,height:h,textCount:texts.length,overflow,overlaps,nodeOverflow};
    },item.boxes);
    await page.locator('svg').screenshot({path:path.join(OUT,item.name+'.png')});
    reports.push({name:item.name,...metrics});await page.close();
  }
  await browser.close();fs.writeFileSync(path.join(OUT,'verification.json'),JSON.stringify(reports,null,2)+'\n');console.log(JSON.stringify(reports,null,2));
}
main().catch(e=>{console.error(e);process.exit(1);});
