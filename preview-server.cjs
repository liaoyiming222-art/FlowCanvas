const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, 'public');
const port = 4173;
const main = 'index.html';
const allowed = new Set([main,'defaults/default.aicases','styles.css','cases.css','workflows.js','cases.js','composer.js']);
const mime = {'.aicases':'application/octet-stream','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server = http.createServer((req,res) => {
  let name;
  try {name = decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1) || main;}
  catch {res.writeHead(400); return res.end('Bad request');}
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405); return res.end();}
  if (!allowed.has(name)) {res.writeHead(404); return res.end('Not found');}
  fs.readFile(path.join(root,name),(err,data) => {
    if(err){res.writeHead(500);return res.end('Unable to read page');}
    res.writeHead(200,{'Content-Type':mime[path.extname(name)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});
server.on('error',err => {console.error(err.code === 'EADDRINUSE' ? 'Port 4173 is in use. Reuse the existing preview or stop that server first.' : err.message);process.exit(1);});
server.listen(port,'127.0.0.1',() => console.log(`Local preview: http://127.0.0.1:${port}`));
