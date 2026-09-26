import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const files=new Set(['index.html']);
for(const m of html.matchAll(/(?:src|href)="([^"?#]+)(?:[^\"]*)"/g)){
  const rel=m[1];if(/^(?:data:|https?:|#)/.test(rel)||!fs.existsSync(path.join(root,rel)))continue;
  if(fs.statSync(path.join(root,rel)).isFile())files.add(rel);
}
function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())walk(p);else if(e.isFile())files.add(p);}}
walk('assets');
const entries=[...files].sort().map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}));
for(const target of ['releases/v0.3.3','reviews/v0.3.3','candidates/v0.3.4-rc1']){
  const dest=path.join(root,target);if(fs.existsSync(dest))throw Error('Refusing to overwrite '+target);
  for(const {file} of entries){fs.mkdirSync(path.dirname(path.join(dest,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(dest,file));}
}
fs.writeFileSync(path.join(root,'releases/v0.3.3/runtime-manifest.json'),JSON.stringify({version:'0.3.3',files:entries},null,2)+'\n');
for(const [folder,scope] of [['reviews/v0.3.3','pmc-review-v033:'],['candidates/v0.3.4-rc1','pmc-candidate-v034rc1:']]){
  for(const {file} of entries){if(file.startsWith('vendor/')||!(/\.(html|js)$/.test(file)))continue;const dest=path.join(root,folder,file);let content=fs.readFileSync(dest,'utf8').replace(/\blocalStorage\b/g,'forecastStorage');if(file==='index.html')content=content.replace('<head>','<head>\n  <script src="storage-config.js"></script>\n  <script src="storage-scope.js"></script>');fs.writeFileSync(dest,content);}
  fs.writeFileSync(path.join(root,folder,'storage-config.js'),'window.forecastStorageScope = '+JSON.stringify(scope)+';\n');
  fs.copyFileSync(path.join(root,'tools/storage-scope.js'),path.join(root,folder,'storage-scope.js'));
}
fs.writeFileSync(path.join(root,'versions.json'),JSON.stringify({active:'0.3.3',previous:null,baseline:'releases/v0.3.3',review:'reviews/v0.3.3',candidate:'candidates/v0.3.4-rc1',candidateStatus:'pending_user_review'},null,2)+'\n');
console.log('Frozen '+entries.length+' runtime files; default entry untouched.');
