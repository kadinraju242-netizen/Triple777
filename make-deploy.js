/* Builds a clean copy of the site in ./deploy, ready to drag onto Netlify.

     node make-deploy.js

   Only what visitors need is copied: pages, css, js, fonts, images.
   Left out on purpose: the database scripts (supabase/, local-db/), which
   contain the test password; node_modules; the local server; and notes.

   Run it again whenever the site changes, then drag ./deploy again. */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'deploy');
const FOLDERS = ['css', 'js', 'fonts', 'images'];

const config = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8');
if (!/supabaseUrl:\s*'https?:\/\/[^']+'/.test(config) || !/supabaseAnonKey:\s*'[^']{20,}'/.test(config)) {
  console.error('\n  js/config.js has no Supabase URL and key yet.\n  Fill them in first, or sign-in will not work on the live site.\n');
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);

let count = 0;
for (const name of fs.readdirSync(ROOT)) {
  if (name.toLowerCase().endsWith('.html')) { fs.copyFileSync(path.join(ROOT, name), path.join(OUT, name)); count++; }
}
for (const folder of FOLDERS) {
  if (!fs.existsSync(path.join(ROOT, folder))) continue;
  fs.cpSync(path.join(ROOT, folder), path.join(OUT, folder), { recursive: true });
  count += fs.readdirSync(path.join(OUT, folder), { recursive: true }).length;
}

console.log('\n  deploy/ is ready (' + count + ' files).\n  Drag the "deploy" folder onto https://app.netlify.com/drop\n');
