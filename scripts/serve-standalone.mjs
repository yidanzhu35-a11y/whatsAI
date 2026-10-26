import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const target=resolve(dirname(fileURLToPath(import.meta.url)),'../../model-training-tour.html');
http.createServer(async(req,res)=>{if(new URL(req.url,'http://localhost').pathname!=='/'){res.writeHead(404);res.end();return;}try{const data=await readFile(target);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(data);}catch{res.writeHead(500);res.end('Build not found');}}).listen(4174,'127.0.0.1',()=>console.log('Standalone tour: http://127.0.0.1:4174/'));
