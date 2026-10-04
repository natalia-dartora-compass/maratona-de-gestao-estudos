/* The same reading interface runs locally and under any GitHub Pages subpath. */
const $=id=>document.getElementById(id);
const readonly=Boolean(window.MARATONA_STATIC);
let pages=[],current=null,editing=null,dirty=false,busy=false,toastTimer;
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function safeURL(value, image=false) {
  try {
    const url=new URL(value,location.href);
    if(['http:','https:'].includes(url.protocol)) return !image || url.origin===location.origin || url.protocol==='https:';
    return !image && url.protocol==='mailto:';
  } catch{return false;}
}
function markdown(content) {
  const template=document.createElement('template');
  template.innerHTML=marked.parse(content,{gfm:true,breaks:false});
  const tags=new Set(['P','H1','H2','H3','H4','H5','H6','BLOCKQUOTE','UL','OL','LI','STRONG','EM','S','DEL','A','IMG','PRE','CODE','HR','BR','TABLE','THEAD','TBODY','TR','TH','TD','DETAILS','SUMMARY']);
  for(const node of [...template.content.querySelectorAll('*')]) {
    if(!tags.has(node.tagName)){node.remove();continue;}
    for(const attr of [...node.attributes]) {
      const allowed=(node.tagName==='A' && ['href','title'].includes(attr.name)) || (node.tagName==='IMG' && ['src','alt','title'].includes(attr.name)) || (node.tagName==='OL' && attr.name==='start') || (node.tagName==='DETAILS' && attr.name==='open');
      if(!allowed) node.removeAttribute(attr.name);
    }
    if(node.tagName==='A') {
      const href=node.getAttribute('href');
      if(!href || !safeURL(href)) node.removeAttribute('href');
      else if(new URL(href,location.href).origin!==location.origin){node.target='_blank';node.rel='noopener noreferrer';}
    }
    if(node.tagName==='IMG') {
      const src=node.getAttribute('src');
      if(!src || !safeURL(src,true)) node.remove();
      else {node.loading='lazy';node.decoding='async';}
    }
  }
  for(const table of template.content.querySelectorAll('table')) {
    const wrap=document.createElement('div');wrap.className='table-wrap';table.replaceWith(wrap);wrap.append(table);
  }
  return template.content;
}
async function api(path,method='GET',data) {
  const response=await fetch(path,{method,headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
  const result=await response.json();
  if(!response.ok) throw Error(result.error || 'Não foi possível concluir a operação.');
  return result;
}
function toast(message) {$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
function normalized(value){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function navigation() {
  const term=normalized($('search').value.trim());
  const visible=pages.filter(p=>normalized(p.title+' '+p.summary+' '+p.content).includes(term));
  const groups=[...new Set(visible.map(p=>p.section))];
  $('navigation').innerHTML=groups.map(section=>`<h2 class="nav-heading">${escapeHtml(section)}</h2>`+visible.filter(p=>p.section===section).map(p=>`<a class="nav-link ${p.id===current?.id?'active':''}" ${p.id===current?.id?'aria-current="page"':''} href="#${p.id}">${p.id.match(/^dia-\d$/)?`<span class="nav-number">0${p.id.slice(-1)}</span>`:'<span class="nav-dot" aria-hidden="true"></span>'}<span>${escapeHtml(p.title)}</span></a>`).join('')).join('') || '<p class="empty-state">Nenhuma página encontrada.</p>';
  $('page-count').textContent=`${pages.length} páginas`;
  $('sections').innerHTML=[...new Set(pages.map(p=>p.section))].map(s=>`<option value="${escapeHtml(s)}"></option>`).join('');
}
function selectedId(){try{return decodeURIComponent(location.hash.slice(1).split('/')[0]);}catch{return 'invalid-url';}}
function render() {
  const id=selectedId();current=pages.find(p=>p.id===id) || (!id?pages[0]:null);
  if(!current) {
    $('article').innerHTML='<div class="load-error"><h1>Página não encontrada</h1><p>Ela pode ter sido renomeada ou excluída.</p><a href="#'+escapeHtml(pages[0]?.id||'')+'">Voltar ao caderno</a></div>';
    $('outline').innerHTML='';$('edit-page').disabled=true;navigation();return;
  }
  $('edit-page').disabled=false;
  document.title=current.title+' · Maratona de Gestão';
  $('breadcrumb-section').textContent=current.section;
  const minutes=Math.max(1,Math.ceil(current.content.split(/\s+/).length/190));
  $('article').innerHTML=`<span class="eyebrow chapter-label">${escapeHtml(current.section)}</span><h1 class="page-title">${escapeHtml(current.title)}</h1><p class="page-summary">${escapeHtml(current.summary)}</p><div class="page-meta"><span class="source-badge">${escapeHtml(current.source)}</span><span>${minutes} min de leitura</span></div><div class="prose" id="page-content"></div>`;
  $('page-content').append(markdown(current.content));
  const headingCounts={};
  const headings=[...$('page-content').querySelectorAll('h2')];
  headings.forEach(heading=> {
    const base=slug(heading.textContent)||'topico';headingCounts[base]=(headingCounts[base]||0)+1;
    heading.id='topic-'+base+(headingCounts[base]>1?'-'+headingCounts[base]:'');
  });
  $('outline').innerHTML='<strong>Nesta página</strong>'+headings.map(h=>`<a href="#${current.id}/${h.id}">${escapeHtml(h.textContent)}</a>`).join('');
  const lessons=pages.filter(p=>p.section===current.section),index=lessons.findIndex(p=>p.id===current.id);
  const prev=lessons[index-1],next=lessons[index+1];
  if(prev||next) {
    const nav=document.createElement('nav');nav.className='lesson-nav';nav.setAttribute('aria-label','Continuar estudos');
    nav.innerHTML=(prev?`<a href="#${prev.id}"><small>Anterior</small><span>${escapeHtml(prev.title)}</span></a>`:'')+(next?`<a href="#${next.id}"><small>Próxima página</small><span>${escapeHtml(next.title)}</span></a>`:'');
    $('article').append(nav);
  }
  navigation();
  const anchor=location.hash.split('/')[1];
  if(anchor && /^topic-[a-z0-9-]+$/.test(anchor)) document.getElementById(anchor)?.scrollIntoView();
  else window.scrollTo({top:0});
}
async function load() {
  try {
    const data=await api(readonly?'./data.json':'./api/pages');
    pages=data.pages;if(!pages?.length) throw Error('Adicione uma página Markdown na pasta docs/.');
    render();
  } catch(e) {
    $('article').innerHTML=`<div class="load-error"><h1>Não foi possível abrir o caderno</h1><p>${escapeHtml(e.message)}</p><button class="button" id="retry">Tentar novamente</button></div>`;
    $('edit-page').disabled=true;$('navigation').textContent='Conteúdo indisponível.';$('retry').onclick=load;
  }
}
function openEditor(page) {
  if(readonly) return;
  editing=page?structuredClone(page):null;dirty=false;
  $('editor-heading').textContent=editing?'Editar página':'Nova página';
  for(const key of ['title','section','summary','source','content']) $('field-'+key).value=editing?.[key] || (key==='section'?'Anotações':key==='source'?'Anotações pessoais':'');
  $('field-content').hidden=false;$('editor-preview').hidden=true;$('toggle-preview').textContent='Ver prévia';$('editor-error').hidden=true;$('delete-page').hidden=!editing;
  $('editor').showModal();$('field-title').focus();
}
function closeEditor() {
  if(busy) return;
  if(dirty && !confirm('Descartar as alterações que ainda não foram salvas?')) return;
  $('editor').close();dirty=false;
}
$('editor').addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
for(const id of ['close-editor','cancel-editor']) $(id).onclick=closeEditor;
$('edit-page').onclick=()=>openEditor(current);$('new-page').onclick=()=>openEditor();
$('editor-form').addEventListener('input',()=>dirty=true);
$('toggle-preview').onclick=()=>{
  const show=$('editor-preview').hidden;
  if(show){$('editor-preview').replaceChildren(markdown($('field-content').value));}
  $('editor-preview').hidden=!show;$('field-content').hidden=show;$('toggle-preview').textContent=show?'Voltar ao texto':'Ver prévia';
};
function editorError(message){$('editor-error').textContent=message;$('editor-error').hidden=false;}
$('editor-form').onsubmit=async event=>{
  event.preventDefault();if(busy || readonly) return;
  busy=true;$('save-page').disabled=true;$('save-page').textContent='Salvando…';$('editor-error').hidden=true;
  const data=Object.fromEntries(['title','section','summary','source','content'].map(key=>[key,$('field-'+key).value]));
  data.revision=editing?.revision;
  data.fingerprint=editing?.fingerprint;
  try {
    const saved=await api(editing?'./api/pages/'+editing.id:'./api/pages',editing?'PUT':'POST',data);
    const existing=pages.findIndex(p=>p.id===saved.id);if(existing<0) pages.push(saved);else pages[existing]=saved;
    dirty=false;$('editor').close();location.hash=saved.id;render();toast('Página salva em docs/. Faça commit para publicar.');
  } catch(e){editorError(e.message);}
  finally{busy=false;$('save-page').disabled=false;$('save-page').textContent='Salvar página';}
};
$('delete-page').onclick=async()=>{
  if(!editing || busy || readonly || !confirm('Excluir esta página e seu arquivo Markdown?')) return;
  busy=true;
  try{await api('./api/pages/'+editing.id,'DELETE',{revision:editing.revision,fingerprint:editing.fingerprint});pages=pages.filter(p=>p.id!==editing.id);dirty=false;$('editor').close();location.hash=pages[0].id;render();toast('Página excluída.');}
  catch(e){editorError(e.message);}finally{busy=false;}
};
$('search').oninput=navigation;
$('navigation').onclick=()=>{$('sidebar').classList.remove('open');$('menu').setAttribute('aria-expanded','false');};
$('menu').onclick=()=>{const open=$('sidebar').classList.toggle('open');$('menu').setAttribute('aria-expanded',String(open));};
document.addEventListener('click',e=>{if($('sidebar').classList.contains('open') && !$('sidebar').contains(e.target) && !$('menu').contains(e.target)){$('sidebar').classList.remove('open');$('menu').setAttribute('aria-expanded','false');}});
window.addEventListener('hashchange',render);
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
document.addEventListener('keydown',e=>{
  if(e.key==='/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName) && !$('editor').open){e.preventDefault();$('search').focus();}
});
if(readonly) {
  $('new-page').hidden=true;$('edit-page').hidden=true;
  const badge=document.createElement('span');badge.className='readonly';badge.textContent='Caderno compartilhado';document.querySelector('.topbar').append(badge);
  $('storage-label').textContent='Versão de leitura';$('footer-mode').textContent='Publicado a partir do repositório.';
}
// Optional agent navigation, using the same hash routing as the reading interface.
if(document.modelContext?.registerTool) {
  const lifecycle=new AbortController();
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  try{Promise.resolve(document.modelContext.registerTool({name:'open_study_page',title:'Abrir página de estudo',description:'Navega para uma página existente do caderno.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input || typeof input.id!=='string' || !pages.some(p=>p.id===input.id)) throw Error('Página inválida.');location.hash=input.id;render();return {id:current.id,title:current.title};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
}
load();
