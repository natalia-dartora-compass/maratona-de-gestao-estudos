import {readFile,writeFile,mkdir,rename,readdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';

export function parsePage(filename, text) {
  const id=path.basename(filename,'.md');
  if(!/^[a-z0-9-]{1,80}$/.test(id)) throw Error(`Nome de arquivo inválido: ${filename}`);
  const match=text.replace(/\r\n/g,'\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if(!match) throw Error(`Metadados ausentes em ${filename}. Use docs/_modelo.md como exemplo.`);
  const meta={};
  for(const line of match[1].split('\n')) {
    if(!line.trim() || line.trim().startsWith('#')) continue;
    const kv=line.match(/^([a-zA-Z]+):\s*(.*)$/);
    if(!kv) throw Error(`Metadado inválido em ${filename}: ${line}`);
    let value=kv[2].trim();
    if(value.startsWith('"')) {try {value=JSON.parse(value);} catch {throw Error(`Aspas inválidas em ${filename}.`);}}
    meta[kv[1]]=value;
  }
  const revision=Number(meta.revision||1),order=Number(meta.order||100);
  if(!Number.isInteger(revision) || revision<1 || !Number.isFinite(order)) throw Error(`order ou revision inválidos em ${filename}.`);
  const page={id,title:meta.title||id,section:meta.section||'Anotações',summary:meta.summary||'',source:meta.source||'Anotações pessoais',revision,order,updatedAt:meta.updatedAt||'',content:match[2].trim()};
  page.fingerprint=fingerprintPage(page);
  return page;
}
export function fingerprintPage(page) {
  return createHash('sha256').update(serializePage(page)).digest('hex');
}
export function serializePage(page) {
  const fields=['title','section','summary','source','order','revision','updatedAt'];
  return '---\n'+fields.map(key=>`${key}: ${JSON.stringify(page[key] ?? (key==='order'?100:''))}`).join('\n')+'\n---\n\n'+page.content.trim()+'\n';
}
export async function readPages(dir) {
  await mkdir(dir,{recursive:true});
  const files=(await readdir(dir)).filter(f=>f.endsWith('.md') && !f.startsWith('_'));
  const pages=await Promise.all(files.map(async file=>parsePage(file,await readFile(path.join(dir,file),'utf8'))));
  pages.sort((a,b)=>a.order-b.order||a.title.localeCompare(b.title,'pt-BR'));
  return {schemaVersion:1,pages};
}
export async function writePages(dir, next, previous={pages:[]}) {
  await mkdir(dir,{recursive:true});
  const old=new Map(previous.pages.map(p=>[p.id,p]));
  for(const page of next.pages) {
    if(JSON.stringify(page)===JSON.stringify(old.get(page.id))) continue;
    const tmp=path.join(dir,`.${randomUUID()}.tmp`);
    await writeFile(tmp,serializePage(page),'utf8');
    await rename(tmp,path.join(dir,`${page.id}.md`));
  }
  for(const page of previous.pages) if(!next.pages.some(p=>p.id===page.id)) await unlink(path.join(dir,`${page.id}.md`));
}
