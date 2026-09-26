import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const req=createRequire('/Users/yan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/runtime.cjs');
const {Presentation}=await import(pathToFileURL(req.resolve('@oai/artifact-tool')).href);
const p=Presentation.create({slideSize:{width:1000,height:500}}),s=p.slides.add();s.background.fill='#FFFFFF';
for(const [i,size] of [48,49,50,52].entries()){
const q=s.shapes.add({geometry:'textbox',position:{left:50,top:20+i*110,width:900,height:90},fill:'none',line:{fill:'none',width:0}});q.text=`${size} 第四季度建设计划`;q.text.style={fontSize:size,typeface:'Microsoft YaHei',bold:true,color:'#008DD5',wrap:'none'};
}
const b=await p.export({slide:s,format:'png',scale:1});await fs.writeFile(new URL('./font-check.png',import.meta.url),new Uint8Array(await b.arrayBuffer()));
