import http from 'node:http';
import {readFile, realpath, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = await realpath(fileURLToPath(new URL('../dist', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const basePath = process.env.BASE_PATH || '/';
if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(basePath)) throw new Error('BASE_PATH must be / or a trailing-slash path such as /LitMap/');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
http.createServer(async (req,res) => {
  try {
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const requestedPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if (!requestedPath.startsWith(basePath)) { res.writeHead(404);res.end('Not found');return; }
    const pathname='/'+requestedPath.slice(basePath.length);
    const candidate=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
    const actual=await realpath(candidate);
    if(!actual.startsWith(root+path.sep) || !(await stat(actual)).isFile()){res.writeHead(403);res.end('Forbidden');return;}
    const content=await readFile(actual);
    res.writeHead(200,{'Content-Type':mime[path.extname(actual)]||'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});
    res.end(req.method==='HEAD'?undefined:content);
  } catch {res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}${basePath}`));
