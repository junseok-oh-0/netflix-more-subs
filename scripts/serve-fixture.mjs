import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const dir = resolve(import.meta.dirname, '../test/fixtures');
const port = Number(process.env.PORT) || 8787;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

createServer(async (req, res) => {
  const path = req.url === '/' ? '/fake-player.html' : req.url.split('?')[0];
  try {
    const body = await readFile(resolve(dir, '.' + path));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => console.log(`fixture: http://localhost:${port}/`));
