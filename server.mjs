import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {readPages,writePages,fingerprintPage} from './content-store.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(process.env.DOCS_DIR || path.join(ROOT, 'docs'));
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY = 8 * 1024 * 1024;
let library;
let queue = Promise.resolve();
export async function initialize() {
  library = await readPages(DATA);
  validateLibrary(library);
}
function error(status, message) {return Object.assign(new Error(message), {status});}
function validatePage(p) {
  if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(p.id)) throw error(400,'Identificador de página inválido.');
  for (const field of ['title','section','summary','content','source']) if(typeof p[field] !== 'string') throw error(400,`Campo ${field} inválido.`);
  if(!p.title.trim() || p.title.length>160 || !p.section.trim() || p.section.length>80 || p.summary.length>1000 || p.source.length>500 || p.content.length>200000) throw error(400,'Revise os limites e preencha o título e a seção.');
  if(!Number.isInteger(p.revision) || p.revision<1) throw error(400,'Versão de página inválida.');
}
function validateLibrary(data) {
  if(!data || data.schemaVersion !== 1 || !Array.isArray(data.pages) || !data.pages.length || data.pages.length>500) throw error(400,'Backup inválido: é preciso ter entre 1 e 500 páginas.');
  data.pages.forEach(validatePage);
  if(new Set(data.pages.map(p=>p.id)).size !== data.pages.length) throw error(400,'Backup contém identificadores duplicados.');
}
function mutate(fn) {
  const task = queue.then(async()=> {
    library=await readPages(DATA);
    const next = structuredClone(library);
    const result = fn(next);
    await writePages(DATA,next,library);
    library = next;
    return result;
  });
  queue = task.catch(()=>{});
  return task;
}
async function body(req) {
  if(!req.headers['content-type']?.startsWith('application/json')) throw error(415,'Envie conteúdo JSON.');
  let length=0; const chunks=[];
  for await(const chunk of req) {length+=chunk.length; if(length>MAX_BODY) throw error(413,'O arquivo ultrapassa 8 MB.'); chunks.push(chunk);}
  try {return JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {throw error(400,'JSON inválido.');}
}
function json(res,status,data) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
}
function ensureOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if(origin && origin !== `http://${host}` && origin !== `https://${host}`) throw error(403,'Origem não permitida.');
  if(req.headers['sec-fetch-site'] === 'cross-site') throw error(403,'Origem não permitida.');
}
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
export function createServer() {
  return http.createServer(async(req,res)=> {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const route = decodeURIComponent(url.pathname);
      if(route.startsWith('/api/')) {
        if(!['GET','HEAD'].includes(req.method)) ensureOrigin(req);
        if(route==='/api/health' && req.method==='GET') return json(res,200,{status:'ok'});
        if(route==='/api/pages' && req.method==='GET') {await queue;library=await readPages(DATA);validateLibrary(library);return json(res,200,library);}
        if(route==='/api/backup' && req.method==='GET') {
          res.setHeader('Content-Disposition','attachment; filename="maratona-backup.json"');
          return json(res,200,library);
        }
        if(route==='/api/pages' && req.method==='POST') {
          const input=await body(req);
          const page={id:randomUUID(),title:input.title,section:input.section,summary:input.summary||'',content:input.content||'',source:input.source||'Anotações pessoais',order:100,revision:1,updatedAt:new Date().toISOString()};
          validatePage(page);
          page.fingerprint=fingerprintPage(page);
          return json(res,201,await mutate(data=>{if(data.pages.length>=500) throw error(400,'Limite de 500 páginas atingido.');data.pages.push(page);return page;}));
        }
        const match = route.match(/^\/api\/pages\/([a-z0-9-]{1,80})$/);
        if(match && req.method==='PUT') {
          const input=await body(req);
          const page=await mutate(data=> {
            const index=data.pages.findIndex(p=>p.id===match[1]);
            if(index<0) throw error(404,'Página não encontrada.');
            const current=data.pages[index];
            if(input.revision !== current.revision || input.fingerprint!==current.fingerprint) throw error(409,'Esta página foi alterada em outra aba ou arquivo. Copie seu texto antes de recarregar.');
            const next={...current,title:input.title,section:input.section,summary:input.summary,content:input.content,source:input.source,revision:current.revision+1,updatedAt:new Date().toISOString()};
            validatePage(next); next.fingerprint=fingerprintPage(next);data.pages[index]=next; return next;
          });
          return json(res,200,page);
        }
        if(match && req.method==='DELETE') {
          const input=await body(req);
          await mutate(data=> {
            const page=data.pages.find(p=>p.id===match[1]);
            if(!page) throw error(404,'Página não encontrada.');
            if(page.revision!==input.revision || page.fingerprint!==input.fingerprint) throw error(409,'A página mudou. Recarregue antes de excluir.');
            if(data.pages.length===1) throw error(400,'Mantenha pelo menos uma página.');
            data.pages=data.pages.filter(p=>p.id!==match[1]);
          });
          return json(res,200,{deleted:true});
        }
        if(route==='/api/restore' && req.method==='POST') {
          throw error(405,'Importe páginas copiando os arquivos Markdown para docs/.');
        }
        return json(res,404,{error:'Operação não encontrada.'});
      }
      if(!['GET','HEAD'].includes(req.method)) throw error(405,'Método não permitido.');
      const target=path.resolve(PUBLIC, '.'+(route==='/'?'/index.html':route));
      if(!target.startsWith(PUBLIC+path.sep)) throw error(403,'Caminho inválido.');
      const info=await stat(target);
      if(!info.isFile()) throw error(404,'Arquivo não encontrado.');
      res.writeHead(200, {'Content-Type':MIME[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});
      res.end(req.method==='HEAD'?undefined:await readFile(target));
    } catch(e) {
      const status=e.status || (e.code==='ENOENT'?404:500);
      if(status===500) console.error(e);
      if(!res.headersSent) json(res,status,{error:status===500?'Não foi possível concluir. Confira os metadados e a permissão da pasta docs.':e.message});
      else res.end();
    }
  });
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  await initialize();
  const server=createServer();
  server.listen(PORT,process.env.HOST || '0.0.0.0',()=>console.log(`Maratona de Gestão em http://localhost:${PORT}`));
  for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>server.close(()=>process.exit(0)));
}
