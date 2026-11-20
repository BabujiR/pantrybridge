// Tiny zero-dependency static server for the demo: http://localhost:4173
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { exec } from 'node:child_process';
const port = Number(process.env.PORT) || 4173;
createServer(async (req, res) => {
  try {
    const html = await readFile(new URL('./dist/index.html', import.meta.url));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(html);
  } catch { res.writeHead(500); res.end('Run "npm run build" first.'); }
}).listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`PantryBridge demo running at ${url}  (Ctrl+C to stop)`);
  if (process.argv.includes('--open')) exec(process.platform === 'win32' ? `start "" ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`);
});
