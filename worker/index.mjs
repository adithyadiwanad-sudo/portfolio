import { initialProjects, renderProjects } from './projects.mjs';
// The deployment gateway supplies verified identity headers. Never take identity
// from form fields, cookies, URL parameters, or client JavaScript.
const OWNER_EMAIL = 'adithyadiwanad@gmail.com';
const CATALOG = 'portfolio/projects.json';
const LIMIT = 4 * 1024 * 1024;
const baseHeaders = {'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-store'};
function owner(request) {
  return Boolean(request.headers.get('oai-authenticated-user-id')) && request.headers.get('oai-authenticated-user-email')?.toLowerCase() === OWNER_EMAIL;
}
function json(data, status=200) { return new Response(JSON.stringify(data), {status,headers:{...baseHeaders,'Content-Type':'application/json'}}); }
async function readBody(request, limit) {
  if (Number(request.headers.get('content-length') || 0) > limit) throw new Error('Request is too large.');
  const reader=request.body?.getReader(); if(!reader) return new Uint8Array();
  const parts=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error('Request is too large.');}parts.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}return bytes;
}
async function catalog(env) {
  if(!env.BUCKET) throw new Error('Project storage unavailable');
  const object=await env.BUCKET.get(CATALOG);
  return object ? {projects:await object.json(), revision:object.etag} : {projects:initialProjects,revision:'initial'};
}
function validURL(value) {
  if(value==='')return true;
  try{const url=new URL(value);return url.protocol==='https:' && !url.username && !url.password;}catch{return false;}
}
function normalizeProject(p) {
  if(!p||typeof p!=='object')throw new Error('Project details are required.');
  const text=(key,max,required=false)=>{if(typeof p[key]!=='string'||p[key].length>max||(required&&!p[key].trim()))throw new Error(`Please check ${key}.`);return p[key].trim();};
  const id=text('id',64,true);if(!/^[a-zA-Z0-9-]+$/.test(id))throw new Error('Invalid project id.');
  const title=text('title',80,true),subtitle=text('subtitle',140,true),description=text('description',1200,true);
  const github=text('github',500),demo=text('demo',500),image=text('image',200);
  if(!validURL(github)||!validURL(demo))throw new Error('Project links must use https://.');
  if(image&&!/^\/media\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(image))throw new Error('Choose a project screenshot through the uploader.');
  if(!['In development','Completed'].includes(p.status)||!['draft','published'].includes(p.visibility))throw new Error('Invalid project status.');
  const list=(key,count,max)=>{if(!Array.isArray(p[key])||p[key].length>count||p[key].some(x=>typeof x!=='string'||!x.trim()||x.length>max))throw new Error(`Please check ${key}.`);return p[key].map(x=>x.trim());};
  return {id,title,subtitle,description,github,demo,image,tags:list('tags',10,40),highlights:list('highlights',6,200),status:p.status,visibility:p.visibility};
}
export function createWorker(assets) {
  function serve(path) {
    const asset=assets[path];if(!asset)return new Response('Page not found',{status:404,headers:baseHeaders});
    const data=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));
    return new Response(data,{headers:{...baseHeaders,'Content-Type':asset.type}});
  }
  return {async fetch(request,env){
    const url=new URL(request.url),path=url.pathname;
    try{
      if(path==='/admin'||path==='/admin.html'){
        if(!request.headers.get('oai-authenticated-user-id'))return Response.redirect(new URL('/signin-with-chatgpt?return_to=%2Fadmin',url.origin),302);
        if(!owner(request))return new Response('Only Aditya can manage this portfolio.',{status:403,headers:baseHeaders});
        return serve('/admin.html');
      }
      if(path.startsWith('/api/admin/')){
        if(!owner(request))return json({error:'Sign in with the portfolio owner’s ChatGPT account.'},403);
        if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed.'},405);
        if(request.method==='POST' && request.headers.get('origin')!==url.origin)return json({error:'This request must come from the portfolio editor.'},403);
        if(path==='/api/admin/projects'&&request.method==='GET')return json(await catalog(env));
        if(path==='/api/admin/projects'&&request.method==='POST'){
          let body,project;try{body=JSON.parse(new TextDecoder().decode(await readBody(request,20000)));project=normalizeProject(body.project);}catch(e){return json({error:e.message},400);}
          const current=await catalog(env);
          if(body.revision!==current.revision)return json({error:'Projects changed in another tab. Reload the list, then save again. Your form has been kept.'},409);
          if(project.image&&!await env.BUCKET.head(project.image.slice(1)))return json({error:'The screenshot is missing. Please upload it again.'},400);
          const index=current.projects.findIndex(p=>p.id===project.id);
          const projects=[...current.projects];
          if(index<0){if(projects.length>=40)return json({error:'The portfolio supports up to 40 projects.'},400);projects.push(project);}else projects[index]=project;
          const saved=await env.BUCKET.put(CATALOG,JSON.stringify(projects),{onlyIf:current.revision==='initial'?{etagDoesNotMatch:'*'}:{etagMatches:current.revision},httpMetadata:{contentType:'application/json'}});
          if(!saved)return json({error:'Another save happened first. Reload the list and try again. Your form has been kept.'},409);
          return json({projects,revision:saved.etag});
        }
        if(path==='/api/admin/upload'&&request.method==='POST'){
          if(!env.BUCKET)throw new Error('Storage unavailable');
          let bytes;try{bytes=await readBody(request,LIMIT);}catch(e){return json({error:'Use an image smaller than 4 MB.'},400);}
          const type=request.headers.get('content-type');
          const png=bytes.length>8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10;
          const jpg=bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
          const webp=bytes.length>12&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
          const ext=type==='image/png'&&png?'png':type==='image/jpeg'&&jpg?'jpg':type==='image/webp'&&webp?'webp':null;
          if(!ext)return json({error:'Choose a valid PNG, JPEG, or WebP screenshot.'},400);
          const key=`media/${crypto.randomUUID()}.${ext}`;
          await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});
          return json({image:'/'+key},201);
        }
        return json({error:'Not found.'},404);
      }
      if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed.'},405);
      if(path.startsWith('/media/')){
        if(!/^\/media\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(path))return new Response('Not found',{status:404});
        if(!owner(request)){const data=await catalog(env);if(!data.projects.some(p=>p.visibility==='published'&&p.image===path))return new Response('Not found',{status:404});}
        const file=await env.BUCKET.get(path.slice(1));if(!file)return new Response('Not found',{status:404});
        return new Response(request.method==='HEAD'?null:file.body,{headers:{...baseHeaders,'Content-Type':file.httpMetadata.contentType}});
      }
      if(path==='/'||path==='/index.html'){
        const page=await serve('/index.html').text();
        let projects,notice='';
        try{projects=(await catalog(env)).projects;}catch(e){console.error('Portfolio storage unavailable',e.message);projects=null;notice='<p class="error-note">Project updates are temporarily unavailable. Please try again shortly.</p>';}
        const content=projects?renderProjects(projects):'';
        const html=page.replace(/<!-- PROJECTS_START -->[\s\S]*?<!-- PROJECTS_END -->/,()=>notice+content);
        return new Response(request.method==='HEAD'?null:html,{headers:{...baseHeaders,'Content-Type':'text/html; charset=utf-8'}});
      }
      return serve(path);
    }catch(e){console.error('Portfolio request failed',path,e.message);return json({error:'Project storage is temporarily unavailable. Your form has not been cleared. Please try again.'},503);}
  }};
}
