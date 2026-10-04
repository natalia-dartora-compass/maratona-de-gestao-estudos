import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {parsePage,readPages} from '../content-store.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('Conteúdo, edição persistente e proteção contra conflitos', async t=> {
  const tmp=await mkdtemp(path.join(os.tmpdir(),'maratona-test-'));
  await cp(path.join(root,'docs'),tmp,{recursive:true});
  process.env.DOCS_DIR=tmp;
  const {initialize,createServer}=await import('../server.mjs');
  await initialize();
  const server=createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  const request=async(route,method='GET',data,headers={})=>{
    const res=await fetch(url+route,{method,headers:{...(data?{'content-type':'application/json'}:{}),...headers},body:data?JSON.stringify(data):undefined});
    return {status:res.status,data:await res.json()};
  };
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(tmp,{recursive:true,force:true});});
  await t.test('Lê Markdown, agrupa e ignora o modelo',async()=>{
    const res=await request('/api/pages');assert.equal(res.status,200);assert.equal(res.data.pages.length,5);assert.equal(res.data.pages[0].id,'dia-1');assert(!res.data.pages.some(p=>p.id==='_modelo'));
    assert(res.data.pages[0].content.includes('## Projeto, programa e portfólio'));
  });
  let page;
  await t.test('Cria um arquivo Markdown persistente',async()=>{
    const res=await request('/api/pages','POST',{title:'Página de teste',section:'Anotações',summary:'Um teste',source:'Teste',content:'## Conteúdo\n\nPersistente.'});
    assert.equal(res.status,201);page=res.data;
    const md=await readFile(path.join(tmp,page.id+'.md'),'utf8');assert(md.includes('Persistente.'));assert(md.startsWith('---\n'));
    await initialize();assert((await request('/api/pages')).data.pages.some(p=>p.id===page.id));
  });
  await t.test('Atualiza e recusa edição desatualizada',async()=>{
    const saved=await request('/api/pages/'+page.id,'PUT',{...page,content:'## Atualizado\n\nNova explicação.'});assert.equal(saved.status,200);assert.equal(saved.data.revision,2);
    const stale=await request('/api/pages/'+page.id,'PUT',page);assert.equal(stale.status,409);
    page=saved.data;
  });
  await t.test('Detecta mudanças no arquivo feitas sem alterar revision',async()=>{
    const file=path.join(tmp,page.id+'.md');await writeFile(file,(await readFile(file,'utf8')).replace('Nova explicação.','Edição pelo VS Code.'));
    const stale=await request('/api/pages/'+page.id,'PUT',page);assert.equal(stale.status,409);
    page=(await request('/api/pages')).data.pages.find(p=>p.id===page.id);assert(page.content.includes('VS Code'));
  });
  await t.test('Recusa dados inválidos e pedidos de outra origem',async()=>{
    assert.equal((await request('/api/pages','POST',{title:''})).status,400);
    assert.equal((await request('/api/pages','POST',{title:'Ataque',section:'Teste'},{origin:'https://outro-site.example'})).status,403);
    const res=await fetch(url+'/api/pages',{method:'POST',headers:{'content-type':'application/json'},body:'{broken'});assert.equal(res.status,400);
    assert.throws(()=>parsePage('bad.md','---\norder: banana\n---\nTexto'),/inválidos/);
  });
  await t.test('Exclui o arquivo correto',async()=>{
    assert.equal((await request('/api/pages/'+page.id,'DELETE',{revision:page.revision,fingerprint:page.fingerprint})).status,200);
    await assert.rejects(stat(path.join(tmp,page.id+'.md')),/ENOENT/);
    assert.equal((await readPages(tmp)).pages.length,5);
  });
});

test('Exportação do Pages é estática e conserva recursos locais',async()=>{
  execFileSync(process.execPath,['scripts/export-pages.mjs'],{cwd:root,env:{...process.env,DOCS_DIR:path.join(root,'docs')}});
  const out=path.join(root,'github-pages');
  assert.equal(await readFile(path.join(out,'mode.js'),'utf8'),'window.MARATONA_STATIC = true;\n');
  const data=JSON.parse(await readFile(path.join(out,'data.json'),'utf8'));assert.equal(data.pages.length,5);
  const html=await readFile(path.join(out,'index.html'),'utf8');
  for(const match of html.matchAll(/(?:href|src)="(\.\/[^"#]+)"/g)) await stat(path.join(out,match[1]));
  await stat(path.join(out,'diagrams/conceitos.svg'));await stat(path.join(out,'.nojekyll'));
  await assert.rejects(stat(path.join(out,'server.mjs')),/ENOENT/);
  assert(!data.pages.some(p=>p.id.startsWith('_')));
});
