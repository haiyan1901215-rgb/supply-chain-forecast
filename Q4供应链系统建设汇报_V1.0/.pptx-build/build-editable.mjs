import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, '.pptx-build');
const OUTPUT = path.join(ROOT, '可编辑文件');
const RUNTIME = '/Users/yan/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const SKILL = '/Users/yan/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.61513/skills/presentations';
Object.assign(process.env, {
  RUNTIME_NODE: `${RUNTIME}/node/bin/node`,
  RUNTIME_NODE_MODULES: `${RUNTIME}/node/node_modules`,
  RUNTIME_PYTHON: `${RUNTIME}/python/bin/python3`,
  RUNTIME_BIN_DIR: `${RUNTIME}/bin/override`,
});
const require = createRequire(`${RUNTIME}/node/node_modules/runtime.cjs`);
const { chromium } = require('playwright');
const { Presentation, PresentationFile, FileBlob } = await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
const { finalizePresentation, resolvePresentationFont } = await import(pathToFileURL(`${SKILL}/container_tools/artifact_tool_utils.mjs`).href);
const font = resolvePresentationFont({ fontFamily: 'Microsoft YaHei' });
await fs.mkdir(OUTPUT, { recursive: true });
const presentation = Presentation.create({ slideSize: { width: 2560, height: 1600 } });
const inputs = ['01_Q4供应链业务主链图_V1.0', '02_Q4供应链跨部门泳道图_V1.0'];
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const counts = [];

// The source contains only these explicit SVG path commands.
function parsePath(d) {
  const tokens = d.match(/[MLHVZ]|-?\d+(?:\.\d+)?/gi);
  let i=0, x=0, y=0, command;
  const points=[];
  while(i<tokens.length) {
    if(/[MLHVZ]/i.test(tokens[i])) command=tokens[i++].toUpperCase();
    if(command==='Z') { points.push({close:{}}); command=undefined; continue; }
    if(command==='M'||command==='L') { x=Number(tokens[i++]); y=Number(tokens[i++]); }
    else if(command==='H') x=Number(tokens[i++]);
    else if(command==='V') y=Number(tokens[i++]);
    else throw new Error(`Unsupported path: ${d}`);
    points.push({[command==='M'?'moveTo':'lineTo']:{x,y}});
    if(command==='M') command='L';
  }
  return points;
}

for(const [index, base] of inputs.entries()) {
  const page=await browser.newPage({viewport:{width:2700,height:1800}});
  await page.goto(pathToFileURL(path.join(ROOT,base+'.svg')).href);
  await page.evaluate(()=>document.fonts.ready);
  const source=await page.evaluate(()=>{
    const svg=document.querySelector('svg');
    return {width:svg.viewBox.baseVal.width,height:svg.viewBox.baseVal.height,elements:[...svg.children].filter(e=>['rect','text','path','circle'].includes(e.tagName)).map(e=>{const b=e.getBBox();return {tag:e.tagName,attrs:Object.fromEntries([...e.attributes].map(a=>[a.name,a.value])),text:e.textContent,bbox:{x:b.x,y:b.y,w:b.width,h:b.height}};})};
  });
  await page.close();
  const s=Math.min(2560/source.width,1600/source.height), dx=(2560-source.width*s)/2,dy=(1600-source.height*s)/2;
  const slide=presentation.slides.add();slide.background.fill='#FFFFFF';
  slide.shapes.add({geometry:'rect',name:'白色画布',position:{left:0,top:0,width:2560,height:1600},fill:'#FFFFFF',line:{fill:'none',width:0}});
  let shapeCount=0,textCount=0;
  for(const e of source.elements) {
    const a=e.attrs;
    const baseName=`${e.tag}-${++shapeCount}`;
    const stroke={fill:a.stroke||'none',width:Number(a['stroke-width']||0)*s,style:a['stroke-dasharray']?'dashed':'solid'};
    if(e.tag==='text') {
      const sz=Number(a['font-size'])*s;
      const anchor=a['text-anchor']||'start';
      const width=Math.max(e.bbox.w*s*1.04+10,sz*1.5);
      const x=Number(a.x)*s+dx;
      const left=anchor==='middle'?x-width/2:anchor==='end'?x-width:x;
      const sh=slide.shapes.add({geometry:'textbox',name:e.text,position:{left,top:Number(a.y)*s+dy-sz*1.04,width,height:sz*1.45},fill:'none',line:{fill:'none',width:0}});
      sh.text=e.text;
      sh.text.style={typeface:font,fontSize:sz,bold:Number(a['font-weight'])>=600,color:a.fill,alignment:anchor==='middle'?'center':anchor==='end'?'right':'left',verticalAlignment:'middle',wrap:'none',autoFit:'none',insets:{top:0,bottom:0,left:0,right:0}};
      textCount++; continue;
    }
    if(e.tag==='rect') {
      slide.shapes.add({geometry:Number(a.rx)?'roundRect':'rect',name:baseName,position:{left:Number(a.x||0)*s+dx,top:Number(a.y||0)*s+dy,width:Number(a.width)*s,height:Number(a.height)*s},fill:a.fill||'none',line:stroke,...(Number(a.rx)?{borderRadius:Number(a.rx)*s}:{})});continue;
    }
    if(e.tag==='circle') {
      slide.shapes.add({geometry:'ellipse',name:baseName,position:{left:(Number(a.cx)-Number(a.r))*s+dx,top:(Number(a.cy)-Number(a.r))*s+dy,width:Number(a.r)*2*s,height:Number(a.r)*2*s},fill:a.fill,line:stroke});continue;
    }
    const commands=parsePath(a.d), points=commands.filter(c=>!c.close).map(c=>c.moveTo||c.lineTo);
    const minX=Math.min(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y));
    const w=Math.max(...points.map(p=>p.x))-minX||0.05,h=Math.max(...points.map(p=>p.y))-minY||0.05;
    slide.shapes.add({geometry:'custom',name:baseName,position:{left:minX*s+dx,top:minY*s+dy,width:w*s,height:h*s},fill:a.fill||'none',line:stroke,customPaths:[{width:w,height:h,commands:commands.map(c=>c.close?c:{[c.moveTo?'moveTo':'lineTo']:{x:(c.moveTo||c.lineTo).x-minX,y:(c.moveTo||c.lineTo).y-minY}})}]});
    if(a['marker-end']) {
      const end=points.at(-1),prev=points.at(-2),vx=end.x-prev.x,vy=end.y-prev.y,len=Math.hypot(vx,vy),ux=vx/len,uy=vy/len;
      const length=Number(a['stroke-width']||2.5)*8,half=length/2;
      const ps=[end,{x:end.x-ux*length-uy*half,y:end.y-uy*length+ux*half},{x:end.x-ux*length+uy*half,y:end.y-uy*length-ux*half}];
      const mx=Math.min(...ps.map(p=>p.x)),my=Math.min(...ps.map(p=>p.y)),ww=Math.max(...ps.map(p=>p.x))-mx,hh=Math.max(...ps.map(p=>p.y))-my;
      slide.shapes.add({geometry:'custom',name:`arrowhead-${shapeCount}`,position:{left:mx*s+dx,top:my*s+dy,width:ww*s,height:hh*s},fill:a.stroke,line:{fill:'none',width:0},customPaths:[{width:ww,height:hh,commands:[...ps.map((p,j)=>({[j?'lineTo':'moveTo']:{x:p.x-mx,y:p.y-my}})),{close:{}}]}]});
    }
  }
  slide.speakerNotes.textFrame.setText(`来源：${base}.svg。业务依据：系统边界校准 V1、Q4供应链项目工作流与MVP边界 V0.1、PMC数据依赖与系统接口清单 V0.1及本次用户要求。所有文字与流程图元素为可编辑原生对象。MRP归属、正式PR审批、MES回传字段和库存来源保持待确认。`);
  counts.push({slide:index+1,texts:textCount,shapes:slide.shapes.items.length});
}
await browser.close();
const draft=path.join(BUILD,'candidate.pptx');
await (await PresentationFile.exportPptx(presentation)).save(draft);
const final=path.join(OUTPUT,'Q4供应链业务主链与泳道图_可编辑版_V1.2.pptx');
await finalizePresentation({workspaceDir:ROOT,candidatePath:draft,finalPath:final,explicitTotalSlideCount:2,pythonExecutable:process.env.RUNTIME_PYTHON,integrityValidatorPath:`${SKILL}/container_tools/inspect_presentation_package_integrity.py`,layoutValidatorPath:`${SKILL}/container_tools/inspect_presentation_layout_geometry.py`,layoutArgs:['--expected-slide-size-emu',`${2560*9525},${1600*9525}`,'--validate-heading-fit'],fontPolicy:{basis:'design',families:[font]},verifyArtifactToolImport:true,receiptPath:path.join(BUILD,'validation-v1.2.json')});
const check=await PresentationFile.importPptx(await FileBlob.load(final));
for(let i=0;i<check.slides.items.length;i++) {
  const png=await check.export({slide:check.slides.items[i],format:'png',scale:0.8});
  await fs.writeFile(path.join(BUILD,`slide-${i+1}.png`),new Uint8Array(await png.arrayBuffer()));
}
await fs.writeFile(path.join(BUILD,'editable-counts.json'),JSON.stringify(counts,null,2));
console.log(JSON.stringify({final,counts},null,2));
