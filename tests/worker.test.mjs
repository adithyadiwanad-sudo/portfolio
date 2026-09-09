import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorker} from '../worker/index.mjs';
import {initialProjects} from '../worker/projects.mjs';
class Bucket {
  objects=new Map();counter=0;
  async get(key){const x=this.objects.get(key);if(!x)return null;return {...x,json:async()=>JSON.parse(x.data),body:x.data};}
  async head(key){return this.objects.get(key)||null;}
  async put(key,data,options={}){
    const old=this.objects.get(key),condition=options.onlyIf;
    if(condition?.etagDoesNotMatch==='*'&&old)return null;
    if(condition?.etagMatches&&old?.etag!==condition.etagMatches)return null;
    const object={data,etag:String(++this.counter),httpMetadata:options.httpMetadata};this.objects.set(key,object);return object;
  }
}
const owner={'oai-authenticated-user-id':'verified-site-user','oai-authenticated-user-email':'adithyadiwanad@gmail.com'};
const assets={'/index.html':{body:Buffer.from('<main><!-- PROJECTS_START --><!-- PROJECTS_END --></main>').toString('base64'),type:'text/html'},'/admin.html':{body:Buffer.from('editor').toString('base64'),type:'text/html'}};
const app=createWorker(assets);
function request(path,headers={},body){return new Request('https://portfolio.example'+path,{method:body===undefined?'GET':'POST',headers:{...headers},body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)});}
const writable={...owner,origin:'https://portfolio.example','Content-Type':'application/json'};
test('editor redirects anonymous users and rejects a different signed-in user',async()=>{
  const env={BUCKET:new Bucket()};
  assert.equal((await app.fetch(request('/admin'),env)).status,302);
  assert.equal((await app.fetch(request('/admin',{...owner,'oai-authenticated-user-email':'other@example.com'}),env)).status,403);
  assert.equal((await app.fetch(request('/admin',owner),env)).status,200);
  assert.equal((await app.fetch(request('/api/admin/projects'),env)).status,403);
});
test('save is persistent across requests, hidden drafts stay hidden, and stale saves are rejected',async()=>{
  const env={BUCKET:new Bucket()};
  const draft={...initialProjects[0],id:'test-project',title:'Private draft title',visibility:'draft'};
  const saved=await app.fetch(request('/api/admin/projects',writable,{revision:'initial',project:draft}),env);assert.equal(saved.status,200);
  const data=await saved.json();assert.equal(data.projects.length,3);
  const page=await (await app.fetch(request('/'),env)).text();assert(!page.includes('Private draft title'));assert(page.includes('WanderLust'));
  const read=await (await app.fetch(request('/api/admin/projects',owner),env)).json();assert.equal(read.projects[2].title,draft.title);
  assert.equal((await app.fetch(request('/api/admin/projects',writable,{revision:'initial',project:draft}),env)).status,409);
  draft.visibility='published';draft.title='<script>alert(1)</script>';
  assert.equal((await app.fetch(request('/api/admin/projects',writable,{revision:data.revision,project:draft}),env)).status,200);
  const published=await (await app.fetch(request('/'),env)).text();assert(published.includes('&lt;script&gt;'));assert(!published.includes('<script>'));
});
test('rejects cross-origin writes and unsafe links',async()=>{
  const env={BUCKET:new Bucket()};
  assert.equal((await app.fetch(request('/api/admin/projects',{...writable,origin:'https://other.example'},{revision:'initial',project:initialProjects[0]}),env)).status,403);
  const invalid={...initialProjects[0],demo:'javascript:alert(1)'};
  assert.equal((await app.fetch(request('/api/admin/projects',writable,{revision:'initial',project:invalid}),env)).status,400);
});
test('image upload validation and draft media access',async()=>{
  const env={BUCKET:new Bucket()};
  const bad=new Request('https://portfolio.example/api/admin/upload',{method:'POST',headers:{...writable,'Content-Type':'image/png'},body:'not an image'});
  assert.equal((await app.fetch(bad,env)).status,400);
  const valid=new Request('https://portfolio.example/api/admin/upload',{method:'POST',headers:{...writable,'Content-Type':'image/png'},body:Uint8Array.from([137,80,78,71,13,10,26,10,1])});
  const response=await app.fetch(valid,env);assert.equal(response.status,201);const {image}=await response.json();
  assert.equal((await app.fetch(request(image),env)).status,404);
  assert.equal((await app.fetch(request(image,owner),env)).status,200);
  const project={...initialProjects[0],image};
  assert.equal((await app.fetch(request('/api/admin/projects',writable,{revision:'initial',project}),env)).status,200);
  assert.equal((await app.fetch(request(image),env)).status,200);
});
test('storage failures never report a successful save',async()=>{
  const env={BUCKET:{get:async()=>{throw new Error('offline');}}};
  assert.equal((await app.fetch(request('/api/admin/projects',owner),env)).status,503);
  assert.equal((await app.fetch(request('/api/admin/projects',writable,{revision:'initial',project:initialProjects[0]}),env)).status,503);
  assert((await (await app.fetch(request('/'),env)).text()).includes('temporarily unavailable'));
});
