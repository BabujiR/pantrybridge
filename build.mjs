// Builds PantryBridge into ONE self-contained file: dist/index.html
// All JavaScript, CSS, icons and the logo are inlined, so the file works:
//   1) opened directly from disk (file://, double-click)
//   2) from a local server (npm run demo)
//   3) uploaded to AWS S3 or Google Cloud Storage
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--watch');

async function run() {
  const result = await build({
    entryPoints: ['src/main.tsx'],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2020',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    legalComments: 'none',
    write: false,
    logLevel: 'warning',
  });
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = readFileSync('src/styles.css', 'utf8');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#1F6F4A" />
<meta name="description" content="PantryBridge – client management demo for Sunrise Community Alliance (fictional)." />
<title>PantryBridge – Client Management Demo</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#1F6F4A"/><path d="M7 24 Q24 6 41 24" fill="none" stroke="#F28C28" stroke-width="3.5" stroke-linecap="round"/><path d="M10 30h28a14 9 0 0 1-28 0Z" fill="#fff"/></svg>')}" />
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<noscript>PantryBridge needs JavaScript enabled.</noscript>
<script>${js}</script>
</body>
</html>`;
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/index.html', html);
  console.log(`Built dist/index.html (${(html.length / 1024).toFixed(0)} KB)`);
}

await run();
if (watch) {
  const { watch: fsWatch } = await import('node:fs');
  console.log('Watching src/ for changes…');
  let t;
  fsWatch('src', { recursive: true }, () => { clearTimeout(t); t = setTimeout(() => run().catch(e => console.error(e.message)), 150); });
}
