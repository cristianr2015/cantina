const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const roots = [
  'server.js', 'db.js', 'config.js', 'routes', 'middleware', 'lib', 'scripts',
  'public/app.js', 'public/i18n.js', 'public/sidebar-menu.js', 'public/superadmin.js'
];
const files = [];

function collect(entry) {
  const absolute = path.join(process.cwd(), entry);
  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(absolute)) collect(path.join(entry, child));
  } else if (entry.endsWith('.js') && entry !== 'scripts/check-syntax.js') {
    files.push(entry);
  }
}

for (const root of roots) collect(root);

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Sintaxis válida en ${files.length} archivos JavaScript.`);
