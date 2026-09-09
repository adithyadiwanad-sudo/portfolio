import fs from 'node:fs';
import path from 'node:path';
import {initialProjects,renderProjects} from '../worker/projects.mjs';
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.pdf':'application/pdf'};
const assets={};
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const name=path.join(dir,item.name);if(item.isDirectory())walk(name);else {const key='/'+path.relative('public',name).split(path.sep).join('/');let data=fs.readFileSync(name);if(key==='/index.html')data=Buffer.from(data.toString().replace(/<!-- PROJECTS_START -->[\s\S]*?<!-- PROJECTS_END -->/,()=>`<!-- PROJECTS_START -->${renderProjects(initialProjects)}<!-- PROJECTS_END -->`));assets[key]={type:mime[path.extname(name)]||'application/octet-stream',body:data.toString('base64')};}}}
walk('public');
fs.mkdirSync('dist/server',{recursive:true});fs.mkdirSync('dist/.openai',{recursive:true});
const projects=fs.readFileSync('worker/projects.mjs','utf8').replaceAll('export ','');
const worker=fs.readFileSync('worker/index.mjs','utf8').replace(/^import .*\n/,'').replace('export function createWorker','function createWorker');
fs.writeFileSync('dist/server/index.js',`${projects}\n${worker}\nconst assets=${JSON.stringify(assets)};\nexport default createWorker(assets);\n`);
fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
console.log(`Built portfolio and project editor with ${Object.keys(assets).length} assets.`);
