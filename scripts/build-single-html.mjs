// Inlines the built JS and CSS into one HTML file that opens straight from disk.
// Usage: node scripts/build-single-html.mjs (after `vite build`)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet"[^>]*href="\.?\/?([^"]+\.css)"[^>]*>/g, (_m, href) => {
  const css = readFileSync(join(dist, href), 'utf8');
  return `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`;
});
html = html.replace(/<script type="module"[^>]*src="\.?\/?([^"]+\.js)"[^>]*><\/script>/g, (_m, src) => {
  const js = readFileSync(join(dist, src), 'utf8');
  return `<script type="module">\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`;
});
if (/src="\.?\/?assets\//.test(html) || /href="\.?\/?assets\//.test(html)) {
  throw new Error('An asset reference was not inlined');
}
writeFileSync(join(dist, 'mytruemargin.html'), html);
console.log(`Wrote ${join(dist, 'mytruemargin.html')} (${(html.length / 1024).toFixed(0)} KB)`);
