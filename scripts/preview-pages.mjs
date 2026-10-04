import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../github-pages');
const prefix='/maratona-gestao';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
const server=http.createServer(async(req,res)=> {
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname===prefix){res.writeHead(302,{Location:prefix+'/'});res.end();return;}
    if(!url.pathname.startsWith(prefix+'/')){res.writeHead(404);res.end('Abra /maratona-gestao/');return;}
    const target=path.resolve(root,'.'+decodeURIComponent(url.pathname.slice(prefix.length)||'/'));
    if(!target.startsWith(root+path.sep) && target!==root) throw Error();
    const file=(await stat(target)).isDirectory()?path.join(target,'index.html'):target;
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(await readFile(file));
  }catch{res.writeHead(404);res.end('Execute npm run export:pages antes da prévia.');}
});
server.listen(4000,'127.0.0.1',()=>console.log('Prévia: http://localhost:4000/maratona-gestao/'));
