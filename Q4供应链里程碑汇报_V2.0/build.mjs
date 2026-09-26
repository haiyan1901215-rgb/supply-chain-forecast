import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {milestones as M,source} from './milestones.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url)),BUILD=path.join(ROOT,'.build');
const R='/Users/yan/.cache/codex-runtimes/codex-primary-runtime/dependencies',SKILL='/Users/yan/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.61513/skills/presentations';
Object.assign(process.env,{RUNTIME_NODE:`${R}/node/bin/node`,RUNTIME_NODE_MODULES:`${R}/node/node_modules`,RUNTIME_PYTHON:`${R}/python/bin/python3`,RUNTIME_BIN_DIR:`${R}/bin/override`});
const req=createRequire(`${R}/node/node_modules/runtime.cjs`);
const {Presentation,PresentationFile,FileBlob}=await import(pathToFileURL(req.resolve('@oai/artifact-tool')).href);
const {finalizePresentation,resolvePresentationFont}=await import(pathToFileURL(`${SKILL}/container_tools/artifact_tool_utils.mjs`).href);
const font=resolvePresentationFont({fontFamily:'Microsoft YaHei'});
await fs.mkdir(BUILD,{recursive:true});await fs.mkdir(path.join(ROOT,'可编辑文件'),{recursive:true});await fs.mkdir(path.join(ROOT,'预览图片'),{recursive:true});
const P=Presentation.create({slideSize:{width:2560,height:1440}}),meta=[];
const C={blue:'#008DD5',ink:'#18384E',text:'#3C566B',muted:'#6B7F90',line:'#D5E1E9',teal:'#078E99',green:'#54963C',orange:'#DC8226',purple:'#7B60A8'};
function rect(s,x,y,w,h,fill){return s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:'none',width:0}});}
function text(s,x,y,w,h,t,size=31,color=C.text,bold=false,align='left'){const q=s.shapes.add({geometry:'textbox',name:t,position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});q.text=t;q.text.style={typeface:font,fontSize:size,color,bold,alignment:align,verticalAlignment:'middle',wrap:'none',autoFit:'none',insets:{top:0,bottom:0,left:0,right:0}};return q;}
function base(title,sub){const s=P.slides.add();s.background.fill='#FFFFFF';rect(s,64,57,9,64,C.blue);text(s,95,48,1960,82,title,49,C.blue,true);text(s,2070,63,426,50,'2026 Q4 / 里程碑V2.0',25,C.muted,false,'right');rect(s,64,145,2432,2,C.blue);text(s,64,170,2432,65,sub,30);rect(s,64,1384,2432,1.5,C.line);text(s,64,1395,2150,38,'管理层建议里程碑 · 4名开发共享投入 · 首批场景交付，分阶段扩围',22,C.muted);text(s,2330,1395,166,38,`${meta.length+1} / 4`,22,C.blue,false,'right');meta.push({title,tables:0});return s;}
function table(s,heads,rows,widths,{y=285,rh=120,size=30,hh=76}={}){const v=[heads,...rows];const t=s.tables.add({rows:v.length,columns:heads.length,left:64,top:y,width:2432,height:hh+rh*rows.length,columnWidths:widths,values:v});t.borders.assign({fill:C.line,width:1});t.cells.block({row:0,column:0,rowCount:v.length,columnCount:heads.length}).assign({margins:{top:12,bottom:12,left:18,right:18},anchor:'center'});for(let r=0;r<v.length;r++){t.rows[r].height=r?rh:hh;for(let c=0;c<heads.length;c++){const cell=t.getCell(r,c);cell.fill=r===0?'#EAF4FB':r%2?'#FFFFFF':'#F7FAFC';cell.text.style={typeface:font,fontSize:size,color:r===0?C.blue:C.text,bold:r===0,verticalAlignment:'middle',wrap:'word',insets:{top:12,bottom:12,left:18,right:18}};}}meta.at(-1).tables++;return t;}
function note(s,t,y=1290,size=28){text(s,64,y,2432,68,t,size,C.muted);}
function strip(s,t,y=1185){rect(s,64,y,2432,87,'#F1F7FB');text(s,90,y+9,2380,67,t,31,C.blue,true);}

// Executive milestones: completion dates, artifacts and business value.
{
const s=base('Q4供应链系统建设里程碑','9月底启动门户与权限，10月中完成前置底座，四个业务节点按交付成果推进');
table(s,['建议完成日','大节点','对应交付物','业务成果'],M.map(m=>[m.date,m.domain,m.deliver,m.outcome]),[260,360,1160,652],{y:278,rh:124,size:30});
note(s,'9/28启动前置建设；10/19起推进业务模块；12/25—12/31稳定观察与季度收口。',1275);
}
// Time windows, deliberately separating work preparation from phase acceptance.
{
const s=base('阶段安排与并行关系','门户和权限先行；PMC形成计划，SCM承接采购，MRP并行计算物料，MES接入已有生产能力');
const heads=['建设节点','9月底—10/16','10/19—11/13','11/16—11/30','12/01—12/18','12/21—12/31'];
const rows=[
 ['公司门户','9/28启动\n10/15交付','后续模块按规范接入','接入支持','接入支持','运行交接'],
 ['统一权限','9/28启动\n10/16联验','PMC/SCM权限接入','MRP权限接入','MES协同权限接入','权限与审计复核'],
 ['PMC计划','前置底座建设','重点建设\n11/13交付','与SCM联调','试点与差异修正','12/24整体验收'],
 ['MRP物料计划','前置底座建设','BOM/库存口径准备','11/16启动样板','12/11交付\n样例对账通过','12/24整体验收'],
 ['SCM采购','前置底座建设','接口/状态契约及框架','重点建设\n11/30交付','供应商执行试点','12/24整体验收'],
 ['MES生产协同','前置底座建设','接入范围与接口准备','试点工厂/环境就绪','12/01启动接入\n12/18交付','12/24整体验收']
];
table(s,heads,rows,[340,416,430,416,430,400],{y:280,rh:143,size:28});
strip(s,'4人按阶段集中投入和交叉协作；表内并行表示任务可重叠，不代表每个模块各配置一支团队。',1240);
}
// Conditions of completion, to support executive questioning.
{
const s=base('各大节点的交付判定','交付以可运行、可核对、可交接为准，每个节点保留对应验收证据');
table(s,['大节点','交付验收证据','关键前提'],M.slice(0,6).map(m=>[m.domain,m.accept,m.dependency]),[380,1350,702],{y:278,rh:149,size:30});
note(s,'统一权限10/16交付底座与首批接入；PMC、MRP、SCM、MES各自上线前仍须通过业务权限验收。',1295);
}
// Capacity, holiday constraints and the conditions of commitment.
{
const s=base('节假日、资源与交付边界','门户和权限占用同一组4名开发，新增前置工作已经从Q4业务建设窗口中扣除');
table(s,['时间范围','工作日 / 人','4人人日上限','安排内容'],[
 ['9/28—9/30', '3', '12', '门户、权限启动与建设；属于Q3前置投入'],
 ['10/08—10/16', '8', '32', '门户、权限一期完成与联验，含10/10补班'],
 ['10/19—12/31', '54', '216', 'PMC / MRP / SCM / MES建设、联调、试点与收口']
],[640,390,430,972],{y:285,rh:128,size:31});
strip(s,'Q4仍为248人日：前置底座32 + 业务窗口216。9月底12人日单列，不计入Q4。',830);
text(s,64,964,1170,58,'日历约束',35,C.ink,true);
text(s,64,1030,1190,60,'中秋9/25—9/27、国庆10/01—10/07放假。',29);
text(s,64,1094,1190,60,'10/10补班已计入；9/20在本次启动前，未计入。',29);
text(s,64,1158,1190,60,'12/24验收，12/25—12/31保留5天稳定窗口。',29);
text(s,1320,964,1170,58,'计划成立的条件',35,C.ink,true);
text(s,1320,1030,1170,60,'门户/权限复用现有认证与组织人员基础。',29);
text(s,1320,1094,1170,60,'SCM、MES复用已有能力，首批场景/系统先行。',29);
text(s,1320,1158,1170,60,'业务、数仓、PLM及接口责任人按时支持联验。',29);
note(s,'需确认：4人实际投入、门户/权限首批接入清单及试点范围。前置未通过时重排业务日期。',1285);
}
const speakerCommon=`业务范围依据用户附件《Q4供应链系统建设.pptx》（${source.scheme}）的PMC预测/备货、MRP物料需求、SCM采购/供应商执行、已有MES协同边界。新增门户与统一权限来自2026-09-17用户要求。所有里程碑日期、首批范围与资源分配均为本次建议，不是附件既定承诺。${source.assumption} 节假日来源：${source.holiday}（2026-09-17核对）。9/25-27中秋，10/1-7国庆，10/10补班；9/28-30为3工作日，10/8-16为8工作日，10/19-12/31为54工作日。业务建设216人日可建议分为功能132、联调验收44、预留40，技术评审后锁定。`;
P.slides.items.forEach((s,i)=>s.speakerNotes.textFrame.setText(meta[i].title+'\n'+speakerCommon));
const pptName='2026年Q4供应链建设里程碑_管理层汇报_V2.0.pptx',candidate=path.join(BUILD,'candidate.pptx'),final=path.join(ROOT,'可编辑文件',pptName);
await (await PresentationFile.exportPptx(P)).save(candidate);
await finalizePresentation({workspaceDir:ROOT,candidatePath:candidate,finalPath:final,explicitTotalSlideCount:4,requiredNativeTableOwnerSlides:[1,2,3,4],pythonExecutable:process.env.RUNTIME_PYTHON,integrityValidatorPath:`${SKILL}/container_tools/inspect_presentation_package_integrity.py`,layoutValidatorPath:`${SKILL}/container_tools/inspect_presentation_layout_geometry.py`,layoutArgs:['--expected-slide-size-emu',`${2560*9525},${1440*9525}`,'--validate-heading-fit',...[1,2,3,4].flatMap(n=>['--require-native-table-slide',String(n)])],fontPolicy:{basis:'design',families:[font]},verifyArtifactToolImport:true,receiptPath:path.join(BUILD,'validation-v2.json')});
const deck=await PresentationFile.importPptx(await FileBlob.load(final));
for(let i=0;i<deck.slides.items.length;i++){const b=await deck.export({slide:deck.slides.items[i],format:'png',scale:1});await fs.writeFile(path.join(ROOT,'预览图片',`${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await b.arrayBuffer()));}
const mdtable=(h,rows)=>[h,h.map(()=>'---'),...rows].map(r=>'| '+r.map(v=>String(v).replaceAll('\n','；')).join(' | ')+' |').join('\n');
let md=`# Q4供应链建设里程碑（管理层汇报版）\n\n版本：V2.0，2026-09-17。以下为建议交付节点，结合4名开发共享投入重排。\n\n## 一句话汇报\n\n9月底启动公司门户和统一权限，10月中完成前置底座；11月完成PMC计划与SCM采购主链，12月完成MRP物料计划和已有MES协同的首批场景交付，12月24日完成季度闭环验收，月底完成稳定与交接。\n\n## 里程碑总表\n\n${mdtable(['建议完成日','大节点','对应交付物','业务成果'],M.map(m=>['2026/'+m.date,m.domain,m.deliver,m.outcome]))}\n\n9月28日启动门户与权限。公司门户10月15日交付、统一权限10月16日完成首批联验后，业务模块自10月19日起推进。上述日期为建议目标，不代表现有系统已达到生产交付条件。\n\n## 开始时间与并行安排\n\n${mdtable(['节点','建议建设窗口','安排说明'],[
 ['公司门户','9/28—10/15','公司级统一入口一期，先接入已确认的既有系统'],
 ['统一权限','9/28—10/16','公共底座与首批系统联验，后续模块随业务接入'],
 ['PMC','10/19—11/13','优先投入，日级预测、审核、备货及采购需求'],
 ['SCM','10/19—11/30','前期接口/状态契约及框架，11/16起集中完成采购执行增量'],
 ['MRP','11/16—12/11','PMC确认计划后开展样板建设，与SCM采购并行'],
 ['MES','12/01—12/18','此前完成接口准备，12月接入已有生产进度能力'],
 ['总体联验','12/21—12/24','首批业务贯通、对账、验收、运行交接'],
 ['稳定收口','12/25—12/31','5个工作日用于观察、修复及下一季度扩展排期']
 ])}\n\n四个节点是交付责任划分，不是四支独立开发团队。业务上MRP与成衣采购并行，不作为SCM成衣PR/PO执行的必经前置。MES复用已有系统，接入开发可依据接口成熟度与其他任务重叠，不重建整套MES。\n\n## 每个节点交付到什么程度\n\n`;
for(const m of M){md+=`### ${m.domain}（${m.date}）\n\n交付物：${m.deliver.replaceAll('\n','；')}。\n\n验收证据：${m.accept.replaceAll('\n','；')}。\n\n关键前提：${m.dependency}。\n\n范围边界：${m.boundary}\n\n`;}
md+=`## 新增门户与权限对资源的影响\n\n上一版10月8日即安排供应链业务。本版将10月8—16日的8个工作日、32人日转为门户与权限前置交付。供应链业务窗口因此调整为10月19日—12月31日，共54个工作日、216理论人日。9月28—30日另有3个工作日、12人日，是Q3前置投入，不与Q4容量重复计算。\n\n${mdtable(['范围','工作日/人','4人理论上限','用途'],[['9/28—9/30',3,12,'门户/权限启动（Q3）'],['10/08—10/16',8,32,'门户/权限完成（Q4）'],['10/19—12/31',54,216,'四个业务节点及联验'],['Q4合计',62,248,'前置32 + 业务216']])}\n\n业务窗口216人日建议先按功能建设132、联调验收44、风险预留40分配。仅用于容量约束，不是已确认的研发估算。前置门户/权限总共44理论人日，同样须包含测试、权限验证及交接，不可全按新功能开发使用。\n\n4名开发按全职共享投入估算，技能组合和实际投入比例待确认；不额外假设4个系统各有专职开发团队或独立测试团队。产品、业务验收、组织人员、数仓、PLM/BOM、SCM及MES责任人须提供协同支持。未扣公司年假、临时项目或兼职投入。\n\n## 节假日口径\n\n- 9月25—27日中秋放假，前置工作从节后9月28日开始。\n- 10月1—7日国庆放假，不安排正常开发或正式验收。\n- 10月10日周六补班计入8个前置工作日。9月20日补班早于本次启动，不计入本次投入。\n- 11—12月按国内双休计算，12月25日不是国内法定假日，此处是主动安排稳定期。\n- 公司额外休假、海外协作方日历或后续新增跨年调休需要重新校准。\n\n来源：[国务院办公厅2026年部分节假日安排](${source.holiday})，2026-09-17核对。\n\n## 向老板说明的交付边界\n\n门户和权限为公司级公共底座，但10月中的交付是一期底座和首批系统接入，并不等于全公司所有存量系统全部改造。已有认证与组织人员来源可复用，是此窗口成立的关键条件；若需要从零建设认证中心或改造所有存量系统，应另行估算，不能沿用44人日上限直接承诺。\n\nPMC与SCM为主链交付，MRP、MES按数据和接口就绪的首批品类/工厂开展交付。QC、库存及执行反馈按明确的协同节点接入，不扩展为完整WMS、OMS、PMS或质量系统重建。附件中的完整业务蓝图继续作为后续扩围目标。\n\n前置权限未验收通过、源数据无法支持正确数量计算或关键采购接口未就绪时，须调整后续日期或试点范围，不能以仅隐藏按钮、人工重复录入或展示Mock数据替代交付。\n\n## 需确认事项\n\n1. 4名开发在9月28日至12月31日的投入比例与技能组合。\n2. 公司门户与权限一期首批接入系统清单、认证/组织人员复用能力。\n3. PMC/采购、数仓、PLM/BOM、MES及业务验收责任人。\n4. 首批渠道/品类/供应商/工厂范围，以及12月24日整体验收标准。\n\n业务依据为本次附件《Q4供应链系统建设.pptx》；门户/权限前置为本次新增需求。日期、阶段安排、首批范围与容量分配均为本次建议，需业务与研发评审锁定。\n`;
await fs.writeFile(path.join(ROOT,'Q4里程碑汇报.md'),md);
await fs.writeFile(path.join(ROOT,'里程碑数据.json'),JSON.stringify({source,milestones:M},null,2));
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Q4供应链里程碑汇报</title><style>body{margin:0;background:#f3f6f8;color:#18384e;font:16px/1.7 -apple-system,'PingFang SC',sans-serif}header,main{max-width:1340px;margin:auto;padding:24px}h1{font-size:27px;margin:0}a{color:#007dbd;margin-right:24px}section{background:white;margin-bottom:28px;border:1px solid #d5e1e9}h2{font-size:18px;margin:12px 20px}img{display:block;width:100%}</style><header><h1>Q4供应链建设里程碑 · 管理层汇报版</h1><p>两项前置交付 + PMC / MRP / SCM / MES四个业务节点 + 季度验收</p><a href="可编辑文件/${pptName}">可编辑PPTX</a><a href="Q4里程碑汇报.md">完整文字稿</a><a href="预览图片/01.png">里程碑一页图</a></header><main>${meta.map((m,i)=>`<section><h2>${i+1}. ${m.title}</h2><img src="预览图片/${String(i+1).padStart(2,'0')}.png" alt="${m.title}"></section>`).join('')}</main></html>`;
await fs.writeFile(path.join(ROOT,'index.html'),html);await fs.writeFile(path.join(BUILD,'meta.json'),JSON.stringify(meta,null,2));
console.log(JSON.stringify({file:final,slides:4,editableTables:4},null,2));
