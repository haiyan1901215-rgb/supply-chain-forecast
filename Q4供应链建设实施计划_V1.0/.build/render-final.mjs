import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const runtime='/Users/yan/.cache/codex-runtimes/codex-primary-runtime/dependencies';
Object.assign(process.env,{RUNTIME_NODE:`${runtime}/node/bin/node`,RUNTIME_NODE_MODULES:`${runtime}/node/node_modules`,RUNTIME_PYTHON:`${runtime}/python/bin/python3`,RUNTIME_BIN_DIR:`${runtime}/bin/override`});
const req=createRequire(`${runtime}/node/node_modules/runtime.cjs`);
const {PresentationFile,FileBlob}=await import(pathToFileURL(req.resolve('@oai/artifact-tool')).href);
const root=new URL('../',import.meta.url);
const p=await PresentationFile.importPptx(await FileBlob.load(fileURLToPath(new URL('可编辑文件/2026年Q4供应链建设实施计划_4人团队_V1.0.pptx',root))));
for(let i=0;i<p.slides.items.length;i++){
const b=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(new URL(`预览图片/${String(i+1).padStart(2,'0')}.png`,root),new Uint8Array(await b.arrayBuffer()));
}
console.log('Rendered 10 final slides at native resolution');
