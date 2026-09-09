'use strict';
const form=document.getElementById('project-form');
const fields=document.getElementById('form-fields');
const message=document.getElementById('message');
const list=document.getElementById('project-list');
let projects=[], revision=null, currentId=null, currentImage='', dirty=false, previewURL=null;
function notify(text,error=false){message.textContent=text;message.dataset.error=String(error);}
async function api(path,options={}){
  const response=await fetch(path,{credentials:'same-origin',...options});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Unable to save. Please try again.');
  return data;
}
function renderList(){
  list.replaceChildren();
  projects.forEach(p=>{const button=document.createElement('button');button.type='button';button.className='project-choice';button.setAttribute('aria-pressed',String(p.id===currentId));const name=document.createElement('strong'),state=document.createElement('span');name.textContent=p.title;state.textContent=`${p.status} · ${p.visibility==='draft'?'Draft':'On portfolio'}`;button.append(name,state);button.addEventListener('click',()=>{if(!dirty||confirm('Discard unsaved form changes?'))selectProject(p);});list.append(button);});
  if(!projects.length)list.textContent='No projects yet. Add your first project.';
}
function updatePreview(url){
  document.getElementById('image-preview').hidden=!url;
  const image=document.getElementById('preview-image');
  if(url)image.src=url;else image.removeAttribute('src');
}
function selectProject(p=null){
  form.reset();currentId=p?.id||crypto.randomUUID();currentImage=p?.image||'';
  for(const key of ['title','subtitle','description','status','visibility','github','demo'])if(p)form.elements[key].value=p[key];
  form.elements.tags.value=p?.tags.join(', ')||'';form.elements.highlights.value=p?.highlights.join('\n')||'';
  if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}
  updatePreview(currentImage);document.getElementById('form-title').textContent=p?'Edit project':'New project';dirty=false;notify('');renderList();
}
async function loadProjects(keepForm=false){
  try{const data=await api('/api/admin/projects');projects=data.projects;revision=data.revision;fields.disabled=false;if(!keepForm)selectProject(projects[0]||null);else{renderList();notify('List refreshed. Your current form is preserved.');}}
  catch(e){notify(e.message,true);if(revision===null)list.textContent='Could not load projects. Use Reload list to retry.';}
}
document.getElementById('new-project').addEventListener('click',()=>{if(revision===null)return notify('Load the project list before adding a project.',true);if(!dirty||confirm('Discard unsaved form changes?'))selectProject();});
document.getElementById('reload-list').addEventListener('click',()=>loadProjects(true));
form.addEventListener('input',()=>dirty=true);
document.getElementById('screenshot').addEventListener('change',event=>{
  if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}
  const file=event.target.files[0];if(!file){updatePreview(currentImage);return;}
  if(file.size>4*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){event.target.value='';updatePreview(currentImage);return notify('Choose a PNG, JPEG, or WebP image under 4 MB.',true);}
  previewURL=URL.createObjectURL(file);updatePreview(previewURL);dirty=true;notify('Screenshot ready. Save the project to upload it.');
});
document.getElementById('remove-image').addEventListener('click',()=>{currentImage='';document.getElementById('screenshot').value='';if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}updatePreview('');dirty=true;});
form.addEventListener('submit',async event=>{
  event.preventDefault();if(revision===null)return;
  const submit=document.getElementById('save-project');submit.disabled=true;notify('Saving project…');
  const values=new FormData(form), file=document.getElementById('screenshot').files[0];
  try{
    if(file){const uploaded=await api('/api/admin/upload',{method:'POST',headers:{'Content-Type':file.type},body:file});currentImage=uploaded.image;document.getElementById('screenshot').value='';}
    const project={id:currentId,image:currentImage};
    for(const key of ['title','subtitle','description','status','visibility','github','demo'])project[key]=String(values.get(key)||'').trim();
    project.tags=String(values.get('tags')).split(',').map(x=>x.trim()).filter(Boolean);
    project.highlights=String(values.get('highlights')).split('\n').map(x=>x.trim()).filter(Boolean);
    const saved=await api('/api/admin/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,project})});
    projects=saved.projects;revision=saved.revision;selectProject(projects.find(p=>p.id===currentId));notify(project.visibility==='draft'?'Draft saved. It is visible only in your editor.':'Saved. Your portfolio now shows the updated project.');
  }catch(e){notify(e.message,true);dirty=true;}finally{submit.disabled=false;}
});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
loadProjects();
