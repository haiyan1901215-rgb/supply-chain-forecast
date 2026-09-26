import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2),command=args[0]||'status';
const rootArg=args.indexOf('--root');
const root=rootArg<0?path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'):path.resolve(args[rootArg+1]);
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const state=read('versions.json');
if(state.baseline!=='releases/v0.3.3')throw Error('Unsupported version workspace');
const hasCandidate=typeof state.candidate==='string'&&/^candidates\/v0\.\d+\.\d+-rc\d+$/.test(state.candidate);
const candidateVersion=hasCandidate?(state.candidateVersion||state.candidate.match(/^candidates\/(v\d+\.\d+\.\d+)-rc\d+$/)?.[1]?.slice(1)):null;
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write=(rel,data)=>{const file=path.join(root,rel);fs.writeFileSync(file+'.pending',data);fs.renameSync(file+'.pending',file);};
function manifest(folder,excluded){const result=[];const walk=dir=>{for(const e of fs.readdirSync(path.join(root,folder,dir),{withFileTypes:true})){const rel=path.join(dir,e.name);if(e.isDirectory())walk(rel);else if(e.isFile()&&!excluded.includes(rel))result.push({file:rel,sha256:hash(path.join(root,folder,rel))});}};walk('');return {files:result.sort((a,b)=>a.file.localeCompare(b.file))};}
function verify(folder,file){const m=read(folder+'/'+file);for(const entry of m.files){if(hash(path.join(root,folder,entry.file))!==entry.sha256)throw Error('Changed frozen file: '+folder+'/'+entry.file);}return m;}
function verifyBaseline(){const m=verify(state.baseline,'runtime-manifest.json');if(state.active==='0.3.3'){for(const e of m.files){if(hash(path.join(root,e.file))!==e.sha256)throw Error('Active V0.3.3 changed: '+e.file);}}return m;}
if(command==='status'){console.log(JSON.stringify(state,null,2));}
else if(command==='seal'){
  if(!hasCandidate||!candidateVersion)throw Error('No pending candidate');
  verifyBaseline();const m=manifest(state.candidate,['candidate-manifest.json']);m.version=candidateVersion+'-rc1';m.status='pending_user_review';write(state.candidate+'/candidate-manifest.json',JSON.stringify(m,null,2)+'\n');console.log('Candidate sealed; active version remains '+state.active);
}else if(command==='verify'){
  const base=verifyBaseline();
  if(!hasCandidate||!candidateVersion){console.log('PASS baseline '+base.files.length+' files / no pending candidate / active '+state.active);process.exit(0);}
  const candidate=verify(state.candidate,'candidate-manifest.json');console.log('PASS baseline '+base.files.length+' files / candidate '+candidate.files.length+' files / active '+state.active);
}else if(command==='activate'||command==='rollback'){
  verifyBaseline();if(command==='activate'){if(!hasCandidate||!candidateVersion)throw Error('No pending candidate');verify(state.candidate,'candidate-manifest.json');}
  const target=command==='activate'?candidateVersion:'0.3.3';
  if(!args.includes('--user-approved')){console.log(JSON.stringify({dryRun:true,from:state.active,to:target,requires:'User approval in conversation; then --user-approved',data:'Use original active data keys; never promote preview values'},null,2));process.exit(0);}
  if(state.active===target){console.log('Already active: '+target);process.exit(0);}
  if(command==='activate'){
    const release='releases/v'+candidateVersion;
    if(!fs.existsSync(path.join(root,release))){fs.cpSync(path.join(root,state.candidate),path.join(root,release),{recursive:true,errorOnExist:true});fs.writeFileSync(path.join(root,release,'storage-config.js'),'window.forecastStorageScope = "";\n');const m=manifest(release,['candidate-manifest.json','runtime-manifest.json']);m.version=candidateVersion;write(release+'/runtime-manifest.json',JSON.stringify(m,null,2)+'\n');}
    else verify(release,'runtime-manifest.json');
    write('index.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>销售预测提报</title><script>location.replace(new URL("releases/v'+candidateVersion+'/index.html"+location.search+location.hash,location.href));</script><a href="releases/v'+candidateVersion+'/index.html">打开销售预测提报</a></html>\n');
  }else{write('index.html',fs.readFileSync(path.join(root,state.baseline,'index.html')));}
  const next={...state,previous:state.active,active:target,candidateStatus:command==='activate'?'approved':'rolled_back',lastActionAt:new Date().toISOString()};
  write('versions.json',JSON.stringify(next,null,2)+'\n');console.log('Active '+target+'; preview data was not merged.');
}else throw Error('Expected status, seal, verify, activate or rollback');
