import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {plan} from './plan-data.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url)), BUILD=path.join(ROOT,'.build');
const RUNTIME='/Users/yan/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const SKILL='/Users/yan/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.61513/skills/presentations';
Object.assign(process.env,{RUNTIME_NODE:`${RUNTIME}/node/bin/node`,RUNTIME_NODE_MODULES:`${RUNTIME}/node/node_modules`,RUNTIME_PYTHON:`${RUNTIME}/python/bin/python3`,RUNTIME_BIN_DIR:`${RUNTIME}/bin/override`});
const req=createRequire(`${RUNTIME}/node/node_modules/runtime.cjs`);
const {Presentation,PresentationFile,FileBlob}=await import(pathToFileURL(req.resolve('@oai/artifact-tool')).href);
const {finalizePresentation,resolvePresentationFont}=await import(pathToFileURL(`${SKILL}/container_tools/artifact_tool_utils.mjs`).href);
const font=resolvePresentationFont({fontFamily:'Microsoft YaHei'});
await fs.mkdir(BUILD,{recursive:true});await fs.mkdir(path.join(ROOT,'可编辑文件'),{recursive:true});await fs.mkdir(path.join(ROOT,'预览图片'),{recursive:true});
const C={blue:'#008DD5',ink:'#18384E',text:'#3C566B',muted:'#6B7F90',line:'#D5E1E9',teal:'#078E99',green:'#54963C',orange:'#DC8226',purple:'#7B60A8'};
const pres=Presentation.create({slideSize:{width:2560,height:1440}}),meta=[];
const sum=a=>a.reduce((x,y)=>x+y,0);
const calendar=[];
for(let ms=Date.UTC(2026,9,1);ms<=Date.UTC(2026,11,31);ms+=86400000){const d=new Date(ms),date=d.toISOString().slice(0,10);const holiday=date>='2026-10-01'&&date<='2026-10-07',makeup=date==='2026-10-10';calendar.push({date,weekday:d.getUTCDay(),working:!holiday&&(d.getUTCDay()>0&&d.getUTCDay()<6||makeup),reason:holiday?'国庆放假':makeup?'调休补班':d.getUTCDay()===0||d.getUTCDay()===6?'周末':'工作日'});}
for(const [i,m] of plan.months.entries()){
  const count=calendar.filter(d=>d.date.startsWith(`2026-${10+i}`)&&d.working).length;
  if(count!==m.days||m.capacity!==m.days*4||m.feature+m.quality+m.reserve!==m.capacity)throw Error('Monthly capacity mismatch');
  const key=['oct','nov','dec'][i];
  for(let k=0;k<3;k++)if(sum(plan.people.map(p=>p[key][k]))!==m[['feature','quality','reserve'][k]])throw Error('People allocation mismatch');
  if(sum(plan.packages.map(p=>p[key]))!==m.feature)throw Error('Package allocation mismatch');
}
for(const p of plan.people)for(const [i,k] of ['oct','nov','dec'].entries())if(sum(p[k])!==plan.months[i].days)throw Error('Person overload');
for(const p of plan.phases){if(calendar.filter(d=>d.date>=p.start&&d.date<=p.end&&d.working).length!==p.days)throw Error('Phase calendar mismatch');}
await fs.writeFile(path.join(ROOT,'工作日与资源测算.json'),JSON.stringify({calendar,plan},null,2));

function box(s,x,y,w,h,fill,stroke='none'){return s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:stroke,width:stroke==='none'?0:1.5}});}
function tx(s,x,y,w,h,t,size=31,color=C.text,bold=false,align='left'){
 const sh=s.shapes.add({geometry:'textbox',name:t,position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});sh.text=t;sh.text.style={typeface:font,fontSize:size,color,bold,alignment:align,verticalAlignment:'middle',wrap:'none',autoFit:'none',insets:{top:0,bottom:0,left:0,right:0}};return sh;
}
function rule(s,x,y,w,color=C.line){box(s,x,y,w,2,color);}
function base(title,subtitle){const s=pres.slides.add();s.background.fill='#FFFFFF';box(s,64,57,9,64,C.blue);tx(s,95,50,2000,78,title,49,C.blue,true);tx(s,2136,60,360,52,'2026 Q4 / 计划V1.0',25,C.muted,false,'right');rule(s,64,144,2432,C.blue);tx(s,64,164,2432,65,subtitle,29);rule(s,64,1384,2432);tx(s,64,1396,2200,36,'建议排期 · 4名开发 · 接续业务蓝图V3.0 · 10/10技术评审后锁定基线',22,C.muted);tx(s,2360,1396,136,36,`${String(meta.length+1).padStart(2,'0')} / 10`,22,C.blue,false,'right');meta.push({title,tables:0});return s;}
function note(s,t,y=1300,color=C.muted){tx(s,64,y,2432,70,t,27,color);}
function table(s,heads,rows,widths,{y=300,rowH=110,fontSize=30}={}){
 const values=[heads,...rows].map(row=>row.map(String)),h=76+rows.length*rowH;
 const t=s.tables.add({rows:values.length,columns:heads.length,left:64,top:y,width:2432,height:h,columnWidths:widths,values});
 t.borders.assign({fill:C.line,width:1});
 t.cells.block({row:0,column:0,rowCount:values.length,columnCount:heads.length}).assign({margins:{top:14,bottom:14,left:18,right:18},anchor:'center'});
 for(let r=0;r<values.length;r++){
  t.rows[r].height=r===0?76:rowH;
  for(let c=0;c<heads.length;c++){
    const cell=t.getCell(r,c);cell.fill=r===0?'#EAF4FB':r%2?'#FFFFFF':'#F7FAFC';
    cell.text.style={typeface:font,fontSize:fontSize,bold:r===0,color:r===0?C.blue:C.text,verticalAlignment:'middle',wrap:'word',insets:{top:14,bottom:14,left:18,right:18}};
  }
 }
 meta.at(-1).tables++;return t;
}
function heading(s,x,y,t,color=C.ink){tx(s,x,y,1150,58,t,35,color,true);}
function bullets(s,x,y,items,w=1160,size=30,gap=69){items.forEach((t,i)=>tx(s,x,y+i*gap,w,60,t,size));}
function strip(s,t,y=1180,color=C.blue){box(s,64,y,2432,88,'#F1F7FB');tx(s,90,y+10,2378,65,t,31,color,true);}

// 1. Quarterly delivery, without recapping the previous ten-slide blueprint.
{
const s=base('第四季度建设计划','10月建立计划能力，11月贯通采购主链，12月完成试点与稳定交付');
table(s,['阶段','建设内容','可验收交付','建议节点'],[
 ['10月 · 18工作日','必要配置与接口契约\n日级预测闭环、备货基础','销售填报、PMC审核与退回可运行\n备货数据口径与接口样例就绪','10/30\nG1'],
 ['11月 · 21工作日','备货需求、PR/PO承接\n供应商关键状态、端到端联调','预测到采购单据关联可追溯\n完成PMC与采购联合UAT','11/30\nG2'],
 ['12月 · 23工作日','P0限定试点与稳定\nMRP / MES有条件样板接入','真实任务验证、异常处理与回滚\nP1独立联评，季度验收与交接','12/24验收\n12/31收口']
],[330,760,1010,332],{y:295,rowH:194,fontSize:32});
heading(s,64,1040,'P0保底：计划—采购—供应商执行状态',C.blue);
tx(s,64,1108,2432,70,'P1：MRP限定场景与已有MES最小接入，依赖就绪且不挤占P0稳定性工作。',31);
note(s,'本计划为4人团队的建议基线；复用既有系统，不把原型可演示等同于生产系统已完成。');
}
// 2. Calendar and capacity.
{
const s=base('节假日与可用工作量','国庆10/01—10/07放假，10/10周六补班；9/20补班在Q4之外，不计入资源');
table(s,['月份','工作日 / 人','4人理论人日','功能建设','联调与质量','风险预留'],[
 ...plan.months.map(m=>[m.name,m.days,m.capacity,m.feature,m.quality,m.reserve]),
 ['合计',62,248,148,52,48]
],[340,400,420,400,440,432],{y:300,rowH:125,fontSize:34});
strip(s,'已安排200人日（81%）：功能148 + 联调质量52；另保留48人日（19%）处理不确定性。',945);
bullets(s,64,1068,[
 '52人日涵盖交叉测试、联调、回归、缺陷修复、发布和试点支持，由4名开发承担。',
 '48人日暂不分配新功能；公司年假、临时支持、接口阻塞或返工将消耗这部分资源。',
 '11—12月按国内双休基线排期；海外协作方休假和跨年新调休需另行核对。'
],2432,29,67);
note(s,'工作日按国务院2026年节假日通知计算；人日分配为本次计划假设。');
}
// 3. Editable timeline.
{
const s=base('10—12月实施路线图','主链优先，按验收结果进入下一阶段；MRP与SCM并行业务关系不因排期改变');
const x0=530,y0=342,cw=630;
['10月 · 基础与预测','11月 · 主链贯通','12月 · 试点与收口'].forEach((t,i)=>{box(s,x0+i*cw,270,cw-12,63,'#EAF4FB');tx(s,x0+i*cw+15,277,cw-42,45,t,31,C.blue,true);});
const rows=[
 ['公共基础 / 配置',['10/08—10/16 定版与实现','口径变更按版本控制','仅修复和必要维护'],'blue'],
 ['PMC预测 / 备货',['10/12—10/30 预测与计划基础','11/02—11/27 备货与UAT','12/01—12/24 试点修复'],'blue'],
 ['SCM / 供应商',['数据与接口契约准备','11/02—11/30 PR/PO主链','关键状态补齐，稳定运行'],'orange'],
 ['MRP限定样板',['10/30前锁定BOM和库存样例','11月数据就绪后启动','12/18前样例对账与联评'],'purple'],
 ['已有MES接入',['范围与接口责任人明确','11/13前接口/环境就绪','12/01—12/18 最小接入'],'green'],
 ['验收 / 试点',['G1 10/30：预测闭环','G2 11/30：P0试点准入','G3 12/24：验收与冻结'],'teal']
];
rows.forEach(([title,months,col],r)=>{const y=y0+r*127;tx(s,64,y+15,446,83,title,31,C.ink,true);months.forEach((t,i)=>{const x=x0+i*cw;box(s,x,y+15,cw-12,86,r===3?'#F5F1FA':'#F5F9FC');box(s,x,y+15,5,86,C[col]);tx(s,x+18,y+29,cw-49,54,t,26,C[col]);});rule(s,64,y+115,2432);});
strip(s,'12/25—12/31：观察与缺陷收尾，归档Q4交付并确定Q1待办；不安排常规大版本上线。',1170);
note(s,'具体起止日期为建议；P1仅对完成数据及接口准备的试点场景开展，不承诺全渠道/全工厂覆盖。');
}
// 4. Work packages.
{
const s=base('建设范围与功能人日预算','148人日用于功能建设；联调质量52人日、风险预留48人日另计');
table(s,['工作包','级别','本季度交付边界','10月','11月','12月','合计'],plan.packages.map(p=>[p.name,p.priority,p.scope,p.oct,p.nov,p.dec,p.total]),[390,120,1170,188,188,188,188],{y:280,rowH:124,fontSize:29});
strip(s,'P0功能预算120人日，P1样板预算28人日；若P0或基础接口超出预算，先缩减P1扩展范围。',1140);
note(s,'不含完整WMS/OMS/PMS、算法平台、全量历史治理或完整QC系统重建；配置仅建设试点必需项。');
}
// 5. Allocation of the four people.
{
const s=base('4名开发的建议分工','暂按1名前端、2名后端、1名全栈/接口配置；不额外假设专职测试开发');
table(s,['开发角色','主要责任','10月\n功能/质量/预留','11月\n功能/质量/预留','12月\n功能/质量/预留'],plan.people.map(p=>[`${p.id} · ${p.role}`,p.focus,p.oct.join(' / '),p.nov.join(' / '),p.dec.join(' / ')]),[420,920,364,364,364],{y:300,rowH:162,fontSize:30});
strip(s,'每人按18 / 21 / 23工作日排期，季度合计62人日；预留已经包含在表内，不能重复计算。',1080);
bullets(s,64,1190,['D1和D2共同交付PMC，D3承接SCM，D4按“数据接入 → MRP样板 → MES最小接入”推进。','模块负责人不代表单人独立完成；统一契约、自测与交叉评审，按周检查实际投入和剩余工作量。'],2432,29,66);
}
// 6-8. Monthly phase breakdown.
for(const [i,title,subtitle] of [
 [0,'10月计划：预测闭环与数据基础','10/08启动开发，10/10补班用于评审和契约校准，国庆假期不安排正常开发任务'],
 [1,'11月计划：PMC到SCM主链贯通','完成真实接口联调与业务UAT，11/30评审通过后进入12月限定试点'],
 [2,'12月计划：限定试点与季度验收','先稳定P0，再验证MRP与MES限定场景；12/24冻结常规变更，月底留出观察时间']
]){
 const s=base(title,subtitle),m=plan.months[i],ps=plan.phases.filter(p=>p.month===m.name);
 table(s,['时间 / 工作日','建设工作','交付物','验收节点'],ps.map(p=>[`${p.start.slice(5)}—${p.end.slice(5)}\n${p.days}个工作日`,p.work,p.output,p.gate]),[350,745,760,577],{y:285,rowH:ps.length===3?216:182,fontSize:30});
 const texts=[
 ['G1验收：填报、草稿、提交只读、退回修改、重提、PMC确认及审计链路可运行。','10月交付不等于正式上线；规则、库存口径、BOM和接口缺口纳入11月准入清单。'],
 ['G2验收：确认计划能追溯PR/PO，重复请求不重复建单，异常可补偿，关键执行状态可回流。','若只实现导出再导入，只可算业务过渡方案，不算PMC—SCM自动闭环通过。'],
 ['试点建议：1个渠道/站点、1个品类、1—2家供应商及1家MES工厂，名单由业务确定。','P1交付为限定样板；BOM、库存或MES接口未就绪时，保留差距清单并列入Q1。']
 ][i];
 bullets(s,64,1145,texts,2432,29,70);
 note(s,`${m.name}资源：${m.capacity}人日 = 功能${m.feature} + 联调质量${m.quality} + 预留${m.reserve}。`,1310);
}
// 9. Dependencies.
{
const s=base('关键依赖与延误处理','4人交付能力依赖现有系统复用、数据就绪和业务验收支持；按具体日期检查');
table(s,['最晚检查点','依赖项','协同责任方（建议）','未就绪处理'],plan.dependencies,[300,790,600,742],{y:285,rowH:137,fontSize:28});
note(s,'以上为跨团队配合要求，未将这些责任方计入4名开发的人日；需在10/10评审时落实到具体人员。');
}
// 10. Acceptance and decisions.
{
const s=base('季度交付标准与资源决策','12/24按已批准试点范围验收，12/31完成交接；新增需求通过变更评审调整日期或范围');
table(s,['验收对象','通过标准','建议证据'],[
 ['P0业务闭环','预测、计划、PR/PO及供应商状态关联可追溯\n权限、退回、重复请求、异常回补验证通过','业务UAT签字\n真实试点单据及日志'],
 ['数据与规则','销量/库存/在途来源明确，SKU版本与规则可追溯\n数量或状态差异有业务确认与处理记录','数据对账清单\n接口及版本说明'],
 ['P1限定样板','MRP样例与业务复核一致；MES试点订单状态可回传\n数据/接口未就绪项单列，不包装为全面上线','样例对账结果\n接口回传和差距清单'],
 ['运行与交接','无阻断上线或影响核心数量/权限的未解决缺陷\n完成回滚演练、责任交接和遗留事项排期','发布/回滚记录\n培训、运维及Q1待办']
],[350,1450,632],{y:285,rowH:167,fontSize:30});
heading(s,64,1100,'请管理层确认',C.blue);
tx(s,64,1165,2432,60,'4人投入比例与技能组合；试点范围及协同人员；P0优先、P1按依赖就绪推进的交付策略。',31);
note(s,'如1人整季仅投入50%，资源减少31人日；需重排范围，不能继续按248人日承诺。');
}

const commonNotes=`依据用户提供的《第四季度供应链系统建设方案》和业务蓝图V3.0。2026年10—12月，4名开发为用户给定约束。所有分工、人日、里程碑、试点范围和验收安排均为本次建议，尚未获团队承诺。人员默认全职、1前端+2后端+1全栈，复用既有基础框架与SCM/MES接口；产品及业务验收由外部责任人配合。法定日历来源：${plan.holidaySource}（国务院办公厅2025年11月4日通知，2026年9月16日检索）。10/1—10/7放假，10/10补班；11—12月按双休计，未扣公司年假。计算得到18+21+23=62工作日，4人248人日；功能148，联调质量52，预留48。`;
pres.slides.items.forEach((s,i)=>s.speakerNotes.textFrame.setText(`${meta[i].title}\n${commonNotes}`));
const finalName='2026年Q4供应链建设实施计划_4人团队_V1.0.pptx';
const candidate=path.join(BUILD,'candidate.pptx'),final=path.join(ROOT,'可编辑文件',finalName);
await (await PresentationFile.exportPptx(pres)).save(candidate);
const tableSlides=meta.map((m,i)=>m.tables?i+1:null).filter(Boolean);
await finalizePresentation({workspaceDir:ROOT,candidatePath:candidate,finalPath:final,explicitTotalSlideCount:10,requiredNativeTableOwnerSlides:tableSlides,pythonExecutable:process.env.RUNTIME_PYTHON,integrityValidatorPath:`${SKILL}/container_tools/inspect_presentation_package_integrity.py`,layoutValidatorPath:`${SKILL}/container_tools/inspect_presentation_layout_geometry.py`,layoutArgs:['--expected-slide-size-emu',`${2560*9525},${1440*9525}`,'--validate-heading-fit',...tableSlides.flatMap(n=>['--require-native-table-slide',String(n)])],fontPolicy:{basis:'design',families:[font]},verifyArtifactToolImport:true,receiptPath:path.join(BUILD,'validation-v1.json')});
const imported=await PresentationFile.importPptx(await FileBlob.load(final));
for(let i=0;i<imported.slides.items.length;i++){
 const png=await imported.export({slide:imported.slides.items[i],format:'png',scale:1});await fs.writeFile(path.join(ROOT,'预览图片',`${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
}
await fs.writeFile(path.join(BUILD,'meta.json'),JSON.stringify(meta,null,2));
// Report text shares the same plan data and calculations as the deck.
const mdTable=(h,rows)=>[h.join(' | '),h.map(()=>'---').join(' | '),...rows.map(r=>r.map(v=>String(v).replaceAll('\n','；')).join(' | '))].map(r=>'| '+r+' |').join('\n');
let md=`# 2026年第四季度供应链建设实施计划\n\n版本：V1.0，建议基线，接续业务蓝图V3.0。\n\n## 汇报主张\n\n10月完成预测闭环与计划基础；11月贯通PMC—SCM采购主链并完成业务UAT；12月开展限定试点、验证MRP与已有MES样板能力，完成稳定与季度交接。\n\n在4名开发约束下，P0主链优先。P1同步做准备并按依赖就绪推进，不承诺全品类、全渠道或全工厂一次性上线。原型不作为已完成生产开发的证据。\n\n## 排期假设\n\n${plan.assumptions.map(t=>'- '+t).join('\n')}\n\n## 日历与资源\n\n国庆10月1—7日放假，10月10日（周六）补班；9月20日补班在本季度之外。来源：[国务院办公厅2026年节假日通知](${plan.holidaySource})，2026-09-16检索。11—12月按国内双休计算。未扣除个人年假、公司额外休假与兼职投入；涉及海外协同和后续公布的跨年调休时再更新。\n\n${mdTable(['月份','工作日/人','4人人日','功能建设','联调质量','风险预留'],[...plan.months.map(m=>[m.name,m.days,m.capacity,m.feature,m.quality,m.reserve]),['合计',62,248,148,52,48]])}\n\n安排200人日，占80.6%；暂留48人日，占19.4%。52人日质量预算由4名开发承担，含自测以外的交叉测试、接口联调、回归、修复、发布和试点支持。48人日不预先塞入新功能，可覆盖临时支持、返工、请假和风险处置；不与工作包或质量预算重复计算。\n\n如1名开发全季度仅投入50%，减少31人日，理论资源降至217人日，原计划只剩17人日预留，需压缩P1或延后部分范围。\n\n## 建设工作包（功能预算）\n\n${mdTable(['工作包','优先级','范围','10月','11月','12月','合计'],plan.packages.map(p=>[p.name,p.priority,p.scope,p.oct,p.nov,p.dec,p.total]))}\n\nP0功能120人日，P1样板28人日。所有数字是容量约束下的初始分配，不是已有研发估算。10/10完成代码复用及接口评审后，按拆解结果锁定或修订。\n\n必要配置包括预测周期/日历、角色审计、试点商品映射、规则版本、MOQ/水位/时效等被试点流程实际使用的项。全量配置中心、复杂算法平台、全量历史清洗、完整WMS/OMS/PMS及完整QC重建不纳入本期4人基线。SCM/MES已有能力复用，只估算承接、增量和接口，不从头重做原系统。\n\n## 人员安排\n\n每格为“功能 / 联调质量 / 预留”人日。开发编号是占位角色，不代表已分配到实名。\n\n${mdTable(['开发','建议能力','职责','10月','11月','12月'],plan.people.map(p=>[p.id,p.role,p.focus,p.oct.join('/'),p.nov.join('/'),p.dec.join('/')]))}\n\nD1/D2共同负责PMC，D3负责SCM与采购协同，D4按事实数据接入、MRP样板、MES最小接入安排先后。跨模块交叉测试不占用额外第五人。业务测试、接口提供和规则签字仍需对应部门投入时间。\n\n## 按月实施\n\n`;
for(const m of plan.months){md+=`### ${m.name}：${m.goal}\n\n`+mdTable(['日期','工作日','工作内容','交付物','检查点'],plan.phases.filter(p=>p.month===m.name).map(p=>[p.start+'—'+p.end,p.days,p.work,p.output,p.gate]))+'\n\n';}
md+=`## 四个里程碑\n\n- G1 10/30：预测的开启、日级填报、草稿、提交只读、审核、退回重提、确认及留痕可运行。完成备货基础与数据契约准备，尚不等于正式上线。\n- G2 11/30：P0端到端联调与PMC/采购UAT通过，预测/计划/PR/PO关联可追溯，重复请求防重建单、错误补偿、执行状态回流通过，试点与回滚方案明确。\n- 12/01：只有G2通过后才启动限定试点，建议1个渠道/站点、1个品类、1—2家供应商及1家MES工厂，名单由业务确定。\n- G3 12/24：按获批试点范围完成验收。无影响核心数量、权限和流程的阻断缺陷。P1独立验收，未通过项不包装为全量上线。常规变更进入冻结期。\n- G4 12/31：完成观察、缺陷收尾、培训/运维交接及Q1遗留事项排期，不安排常规大版本。12/25不是国内法定休假，此处为项目主动保留的稳定窗口。\n\n## 依赖与风险\n\n${mdTable(['最晚检查点','依赖项','建议协同责任方','未就绪处理'],plan.dependencies)}\n\n数仓负责数据准备与清洗，商品主数据负责身份关系，PLM/BOM负责技术及物料版本；PMC消费数据并形成计划。开发团队可以做接口校验、错误提示和隔离，不能替代业务规则确认或源数据治理。MRP与SCM成衣采购并行，不作为所有PR的串行前置。MES复用已有系统。QC与入库只纳入本期已明确的关键协同节点。\n\n如P0延期，先压缩P1接入覆盖面；若关键数据、权限、数量口径或SCM接口不能满足安全运行要求，推迟上线，不以人工导入伪装自动闭环。每周复核剩余人日，新增范围须同步说明对P0、日期及预留的影响。\n\n## 季度验收与管理决策\n\n验收证据包括业务UAT记录、真实试点单据链、对账及差异处理记录、接口和规则版本说明、发布/回滚演练记录、培训和运维交接，以及Q1待办。MRP需样例对账与业务复核，MES需订单关联及进度/完工回传证据。\n\n请管理层确认：4人实际投入和技能组合；产品、数仓、SCM、MES及业务验收支持人员；限定试点范围；P0优先且P1按依赖就绪推进的策略。确认后由研发在10/10评审中锁定人日和节点。\n`;
await fs.writeFile(path.join(ROOT,'第四季度计划内容汇报.md'),md);
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>2026 Q4供应链实施计划</title><style>body{margin:0;background:#f3f6f8;color:#18384e;font:16px/1.7 -apple-system,'PingFang SC',sans-serif}header,main{max-width:1320px;margin:auto;padding:24px}h1{font-size:26px;margin:0}a{color:#007dbd;margin-right:22px}section{margin-bottom:26px;background:white;border:1px solid #d5e1e9}h2{font-size:17px;margin:12px 20px}img{width:100%;display:block}</style><header><h1>2026年Q4供应链建设实施计划</h1><p>4名开发 · 10—12月 · 62工作日 · 建议基线V1.0</p><a href="可编辑文件/${finalName}">下载可编辑PPTX</a><a href="第四季度计划内容汇报.md">查看文字汇报</a><a href="工作日与资源测算.json">查看资源测算</a><a href="${plan.holidaySource}">节假日来源</a></header><main>${meta.map((m,i)=>`<section><h2>${i+1}. ${m.title}</h2><img src="预览图片/${String(i+1).padStart(2,'0')}.png" alt="${m.title}"></section>`).join('')}</main></html>`;
await fs.writeFile(path.join(ROOT,'index.html'),html);
console.log(JSON.stringify({final,slides:meta.length,nativeTableSlides:tableSlides,capacity:248,scheduled:200,reserve:48},null,2));
